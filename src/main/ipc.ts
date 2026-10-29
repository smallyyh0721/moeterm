import { clipboard, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HostKeyChangedError } from '../core/errors';
import type { DataStore } from '../core/store';
import type { SessionManager } from './sessions';
import { CH } from '../shared/channels';
import { fail, ok, type Result } from '../shared/result';
import { remoteBase } from '../shared/remote-path';
import type { ConnectionSave, ConnectRequest } from '../shared/types';

interface IpcDeps {
  getWindow: () => BrowserWindow;
  store: DataStore;
  sessions: SessionManager;
  version: string;
  requestQuit: () => void;
}

const pendingKeys = new Map<string, string>();

export function registerIpc(deps: IpcDeps): void {
  const { store, sessions } = deps;

  handle(CH.treeGet, () => store.getTree());
  handle(CH.folderCreate, (payload) => {
    const body = record(payload);
    const parentId = body.parentId === null || typeof body.parentId === 'string' ? body.parentId : null;
    if (typeof body.name !== 'string') throw new Error('请填写目录名');
    return store.createFolder(parentId, body.name);
  });
  handle(CH.nodeRename, (payload) => {
    const body = record(payload);
    if (typeof body.id !== 'string' || typeof body.name !== 'string') throw new Error('参数不正确');
    return store.rename(body.id, body.name);
  });
  handle(CH.nodeDelete, (payload) => {
    if (typeof payload !== 'string') throw new Error('参数不正确');
    return store.deleteNode(payload);
  });
  handle(CH.nodeMove, (payload) => {
    const body = record(payload);
    if (typeof body.id !== 'string') throw new Error('参数不正确');
    const parentId = body.parentId === null || typeof body.parentId === 'string' ? body.parentId : null;
    return store.move(body.id, parentId);
  });
  handle(CH.connectionDuplicate, (payload) => {
    if (typeof payload !== 'string') throw new Error('参数不正确');
    return store.duplicate(payload);
  });
  handle(CH.connectionSave, (payload) => {
    const draft = parseDraft(payload);
    let imported: { bytes: Buffer; label: string } | undefined;
    if (draft.keyToken) {
      const filePath = pendingKeys.get(draft.keyToken);
      pendingKeys.delete(draft.keyToken);
      if (!filePath) throw new Error('私钥选择已失效，请重新选择');
      imported = { bytes: fs.readFileSync(filePath), label: path.basename(filePath) };
    }
    return store.saveConnection(draft, imported);
  });
  handle(CH.settingsGet, () => store.getSettings());
  handle(CH.settingsUpdate, (payload) => {
    const body = record(payload);
    const patch: Partial<import('../shared/types').Settings> = {};
    if (typeof body.petEnabled === 'boolean') patch.petEnabled = body.petEnabled;
    if (typeof body.logEnabled === 'boolean') patch.logEnabled = body.logEnabled;
    if (typeof body.fontSize === 'number') patch.fontSize = body.fontSize;
    if (typeof body.sidebarWidth === 'number') patch.sidebarWidth = body.sidebarWidth;
    if (body.petX === null || typeof body.petX === 'number') patch.petX = body.petX as number | null;
    if (body.petY === null || typeof body.petY === 'number') patch.petY = body.petY as number | null;
    const settings = store.updateSettings(patch);
    if (typeof patch.logEnabled === 'boolean') sessions.setLogEnabled(patch.logEnabled);
    return settings;
  });
  handle(CH.pathsGet, () => ({
    dataDir: store.root,
    logDir: store.logDir,
    keyDir: store.keyDir,
    version: deps.version,
  }));
  handle(CH.pathOpen, async (payload) => {
    const which = payload === 'logs' ? store.logDir : payload === 'keys' ? store.keyDir : store.root;
    const error = await shell.openPath(which);
    if (error) throw new Error(error);
    return null;
  });
  handle(CH.keyPick, async () => {
    const result = await dialog.showOpenDialog(deps.getWindow(), {
      title: '选择私钥',
      properties: ['openFile'],
      filters: [{ name: '私钥', extensions: ['pem', 'key', '*'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const token = randomUUID();
    pendingKeys.set(token, result.filePaths[0]);
    return { token, label: path.basename(result.filePaths[0]) };
  });
  handle(CH.sshConnect, (payload) => sessions.connect(parseConnect(payload)));
  handle(CH.sshAttach, (payload) => {
    if (typeof payload !== 'string') throw new Error('参数不正确');
    sessions.attach(payload);
    return null;
  });
  handle(CH.sshWrite, (payload) => {
    const body = record(payload);
    if (typeof body.sessionId !== 'string' || typeof body.data !== 'string') throw new Error('参数不正确');
    sessions.write(body.sessionId, body.data);
    return null;
  });
  handle(CH.sshResize, (payload) => {
    const body = record(payload);
    if (typeof body.sessionId !== 'string') throw new Error('参数不正确');
    sessions.resize(body.sessionId, clampInt(body.cols, 20, 500, 80), clampInt(body.rows, 5, 300, 24));
    return null;
  });
  handle(CH.sshDisconnect, (payload) => {
    if (typeof payload !== 'string') throw new Error('参数不正确');
    sessions.disconnect(payload);
    return null;
  });
  handle(CH.sftpOpen, (payload) => sessions.sftpOpen(parseConnect(payload)));
  handle(CH.sftpList, (payload) => sessions.sftpList(typeof payload === 'string' ? payload : ''));
  handle(CH.sftpMkdir, async (payload) => {
    if (typeof payload !== 'string' || !payload) throw new Error('请填写目录名');
    await sessions.sftpMkdir(payload);
    return null;
  });
  handle(CH.sftpRemove, async (payload) => {
    if (typeof payload !== 'string' || !payload) throw new Error('请选择文件');
    await sessions.sftpRemove(payload);
    return null;
  });
  handle(CH.sftpRename, async (payload) => {
    const body = record(payload);
    if (typeof body.from !== 'string' || typeof body.to !== 'string') throw new Error('参数不正确');
    await sessions.sftpRename(body.from, body.to);
    return null;
  });
  handle(CH.sftpUpload, async (payload) => {
    const remoteDir = typeof payload === 'string' ? payload : '';
    const picked = await dialog.showOpenDialog(deps.getWindow(), {
      title: '上传到服务器',
      properties: ['openFile', 'multiSelections'],
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    for (const filePath of picked.filePaths) {
      await sessions.sftpUpload(filePath, remoteDir);
    }
    return null;
  });
  handle(CH.sftpDownload, async (payload) => {
    if (typeof payload !== 'string' || !payload) throw new Error('请选择文件');
    const save = await dialog.showSaveDialog(deps.getWindow(), {
      title: '下载到本机',
      defaultPath: remoteBase(payload),
    });
    if (save.canceled || !save.filePath) return null;
    await sessions.sftpDownload(payload, save.filePath);
    return null;
  });
  handle(CH.sftpClose, () => {
    sessions.closeSftp();
    return null;
  });
  handle(CH.textExport, (payload) => {
    const body = record(payload);
    if (typeof body.text !== 'string' || typeof body.defaultName !== 'string') throw new Error('参数不正确');
    return exportText(deps.getWindow(), body.text, body.defaultName);
  });
  handle(CH.textCopy, (payload) => {
    if (typeof payload !== 'string') throw new Error('参数不正确');
    clipboard.writeText(payload);
    return null;
  });
  handle(CH.textPaste, () => clipboard.readText());
  handle(CH.externalOpen, async (payload) => {
    if (typeof payload !== 'string' || !/^https?:\/\//i.test(payload)) throw new Error('只打开网页链接');
    await shell.openExternal(payload);
    return null;
  });
  handle(CH.winMinimize, () => {
    deps.getWindow().minimize();
    return null;
  });
  handle(CH.winMaximize, () => {
    const win = deps.getWindow();
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return null;
  });
  handle(CH.winClose, () => {
    deps.getWindow().close();
    return null;
  });
  handle(CH.winFullscreen, () => {
    const win = deps.getWindow();
    win.setFullScreen(!win.isFullScreen());
    return null;
  });
  handle(CH.appForceQuit, () => {
    deps.requestQuit();
    return null;
  });
}

function handle<T>(channel: string, fn: (payload: unknown) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, payload: unknown): Promise<Result<T>> => {
    try {
      return ok(await fn(payload));
    } catch (error) {
      if (error instanceof HostKeyChangedError) return fail(error.message, error.code, error.fingerprint);
      return fail(error instanceof Error ? error.message : String(error));
    }
  });
}

function record(payload: unknown): Record<string, unknown> {
  if (typeof payload === 'object' && payload !== null) return payload as Record<string, unknown>;
  throw new Error('参数不正确');
}

function parseConnect(payload: unknown): ConnectRequest {
  const body = record(payload);
  if (typeof body.connectionId !== 'string') throw new Error('连接参数不正确');
  return {
    connectionId: body.connectionId,
    cols: clampInt(body.cols, 20, 500, 80),
    rows: clampInt(body.rows, 5, 300, 24),
    password: typeof body.password === 'string' ? body.password : undefined,
    passphrase: typeof body.passphrase === 'string' ? body.passphrase : undefined,
    trustChangedHostKey: body.trustChangedHostKey === true,
  };
}

function parseDraft(payload: unknown): ConnectionSave {
  const body = record(payload);
  if (typeof body.name !== 'string' || typeof body.host !== 'string' || typeof body.username !== 'string') {
    throw new Error('连接参数不正确');
  }
  if (body.authType !== 'password' && body.authType !== 'privateKey') throw new Error('认证方式不正确');
  return {
    id: typeof body.id === 'string' ? body.id : undefined,
    parentId: body.parentId === null || typeof body.parentId === 'string' ? body.parentId : null,
    name: body.name,
    host: body.host,
    port: Number(body.port),
    username: body.username,
    authType: body.authType,
    saveSecret: body.saveSecret === true,
    legacyAlgorithms: body.legacyAlgorithms === true,
    password: typeof body.password === 'string' ? body.password : undefined,
    passphrase: typeof body.passphrase === 'string' ? body.passphrase : undefined,
    clearSecret: body.clearSecret === true,
    keyToken: typeof body.keyToken === 'string' ? body.keyToken : undefined,
    keyId: typeof body.keyId === 'string' ? body.keyId : undefined,
    keyLabel: typeof body.keyLabel === 'string' ? body.keyLabel : undefined,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function exportText(win: BrowserWindow, text: string, defaultName: string): Promise<{ path: string } | null> {
  if (text.length > 20_000_000) throw new Error('内容太大，无法导出');
  const result = await dialog.showSaveDialog(win, {
    title: '导出为 TXT',
    defaultPath: defaultName.endsWith('.txt') ? defaultName : `${defaultName}.txt`,
    filters: [{ name: '文本文件', extensions: ['txt'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
  const body = normalized.startsWith('\uFEFF') ? normalized : `\uFEFF${normalized}`;
  fs.writeFileSync(result.filePath, body, 'utf8');
  return { path: result.filePath };
}
