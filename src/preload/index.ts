import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { MoetermApi } from '../shared/api';
import { CH } from '../shared/channels';
import type { Result } from '../shared/result';
import type { SessionStatusEvent, SftpProgress } from '../shared/types';

function invoke<T>(channel: string, payload?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, payload) as Promise<Result<T>>;
}

function listen<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

function asBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === 'object' && data !== null && Array.isArray((data as { data?: unknown }).data)) {
    return Uint8Array.from((data as { data: number[] }).data);
  }
  return new Uint8Array();
}

const api: MoetermApi = {
  getTree: () => invoke(CH.treeGet),
  createFolder: (input) => invoke(CH.folderCreate, input),
  renameNode: (input) => invoke(CH.nodeRename, input),
  deleteNode: (id) => invoke(CH.nodeDelete, id),
  moveNode: (input) => invoke(CH.nodeMove, input),
  saveConnection: (draft) => invoke(CH.connectionSave, draft),
  duplicateConnection: (id) => invoke(CH.connectionDuplicate, id),
  getSettings: () => invoke(CH.settingsGet),
  updateSettings: (patch) => invoke(CH.settingsUpdate, patch),
  getPaths: () => invoke(CH.pathsGet),
  openPath: (which) => invoke(CH.pathOpen, which),
  pickKey: () => invoke(CH.keyPick),
  connect: (request) => invoke(CH.sshConnect, request),
  attach: (sessionId) => invoke(CH.sshAttach, sessionId),
  write: (sessionId, data) => invoke(CH.sshWrite, { sessionId, data }),
  resize: (sessionId, cols, rows) => invoke(CH.sshResize, { sessionId, cols, rows }),
  disconnect: (sessionId) => invoke(CH.sshDisconnect, sessionId),
  sftpOpen: (request) => invoke(CH.sftpOpen, request),
  sftpList: (target) => invoke(CH.sftpList, target),
  sftpMkdir: (target) => invoke(CH.sftpMkdir, target),
  sftpRemove: (target) => invoke(CH.sftpRemove, target),
  sftpRename: (input) => invoke(CH.sftpRename, input),
  sftpUpload: (remoteDir) => invoke(CH.sftpUpload, remoteDir),
  sftpDownload: (remotePath) => invoke(CH.sftpDownload, remotePath),
  sftpClose: () => invoke(CH.sftpClose),
  exportText: (input) => invoke(CH.textExport, input),
  copyText: (text) => invoke(CH.textCopy, text),
  pasteText: () => invoke(CH.textPaste),
  openExternal: (url) => invoke(CH.externalOpen, url),
  windowMinimize: () => invoke(CH.winMinimize),
  windowMaximize: () => invoke(CH.winMaximize),
  windowClose: () => invoke(CH.winClose),
  windowFullscreen: () => invoke(CH.winFullscreen),
  forceQuit: () => invoke(CH.appForceQuit),
  onSshData(cb) {
    return listen<{ sessionId: string; data: unknown }>(CH.sshData, (event) => {
      cb({ sessionId: event.sessionId, data: asBytes(event.data) });
    });
  },
  onSshStatus: (cb) => listen<SessionStatusEvent>(CH.sshStatus, cb),
  onSftpProgress: (cb) => listen<SftpProgress>(CH.sftpProgress, cb),
  onFullscreen: (cb) => listen<boolean>(CH.winFullscreenChanged, cb),
  onConfirmClose: (cb) => listen<undefined>(CH.appConfirmClose, () => cb()),
};

contextBridge.exposeInMainWorld('moeterm', api);
