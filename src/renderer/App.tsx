import { useEffect, useRef, useState } from 'react';
import type { DataPaths } from '../shared/api';
import { findParentId, findPublic, folderOptions } from '../shared/tree';
import type { ConnectionSave, PublicConnection, PublicNode, Settings, SftpProgress, StoredNode } from '../shared/types';
import { defaultSettings } from '../shared/types';
import { ConnectionModal } from './components/ConnectionModal';
import { FolderModal } from './components/FolderModal';
import { Pet } from './components/Pet';
import { SettingsModal } from './components/SettingsModal';
import { SftpPanel } from './components/SftpPanel';
import { Sidebar } from './components/Sidebar';
import { TerminalPane } from './components/TerminalPane';
import { TitleBar } from './components/TitleBar';
import { Welcome } from './components/Welcome';
import { type SecretKind, type TabModel, type TypedSecret, neededPrompt } from './lib/prompt';

interface SecretAsk {
  connection: PublicConnection;
  kind: SecretKind;
  next: 'shell' | 'sftp' | 'reconnect';
  trust?: boolean;
  tabLocalId?: string;
  value: string;
}

export function App() {
  if (typeof window.moeterm === 'undefined') return <div className="boot">MoeTerm 正在启动</div>;
  return <Shell />;
}

function Shell() {
  const [tree, setTree] = useState<PublicNode[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [paths, setPaths] = useState<DataPaths | null>(null);
  const [tabs, setTabs] = useState<TabModel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sftpId, setSftpId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SftpProgress | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const [dims, setDims] = useState({ cols: 80, rows: 24 });
  const [connectionEdit, setConnectionEdit] = useState<{ connection?: PublicConnection; parentId: string | null } | null>(null);
  const [folderEdit, setFolderEdit] = useState<{ mode: 'create' | 'rename'; parentId: string | null; id?: string; name?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ text: string; ok: string; run: () => void } | null>(null);
  const [secretAsk, setSecretAsk] = useState<SecretAsk | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const tabsRef = useRef<TabModel[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const secretsRef = useRef(new Map<string, TypedSecret>());
  const toastRef = useRef<(text: string) => void>(() => undefined);
  const toggleLogRef = useRef<() => void>(() => undefined);
  const fontTimer = useRef<number | null>(null);
  const pendingFont = useRef<number | null>(null);
  tabsRef.current = tabs;
  activeIdRef.current = activeId;

  const toast = (text: string, duration = 3600) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), duration);
  };
  toastRef.current = toast;

  useEffect(() => {
    void (async () => {
      const [treeResult, settingsResult, pathResult] = await Promise.all([
        window.moeterm.getTree(),
        window.moeterm.getSettings(),
        window.moeterm.getPaths(),
      ]);
      if (treeResult.ok) setTree(treeResult.data);
      else toastRef.current(treeResult.message);
      if (settingsResult.ok) setSettings(settingsResult.data);
      if (pathResult.ok) setPaths(pathResult.data);
    })();
    const offStatus = window.moeterm.onSshStatus((event) => {
      setTabs((current) =>
        current.map((tab) =>
          tab.sessionId === event.sessionId
            ? {
                ...tab,
                status: event.status,
                message: event.status === 'connecting' || event.status === 'connected' ? undefined : (event.message ?? tab.message),
                code: event.status === 'connecting' || event.status === 'connected' ? undefined : (event.code ?? tab.code),
                fingerprint: event.fingerprint ?? tab.fingerprint,
              }
            : tab,
        ),
      );
      if (event.hostKey === 'new') toastRef.current('第一次连接，已保存这台主机的密钥');
      if (event.logFile) toastRef.current('终端日志已开始写入');
    });
    const offProgress = window.moeterm.onSftpProgress((event) => setProgress(event.done ? null : event));
    const offFull = window.moeterm.onFullscreen(setFullscreen);
    const offClose = window.moeterm.onConfirmClose(() => setConfirmClose(true));
    return () => {
      offStatus();
      offProgress();
      offFull();
      offClose();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        void window.moeterm.windowFullscreen();
      } else if (event.key === 'Escape' && fullscreen) {
        event.preventDefault();
        void window.moeterm.windowFullscreen();
      } else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        toggleLogRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [fullscreen]);

  const active = tabs.find((tab) => tab.localId === activeId) ?? null;
  const activeNode = active ? findPublic(tree, active.connectionId) : null;
  const activeConnection = activeNode && activeNode.type === 'connection' ? activeNode : null;
  const sftpNode = sftpId ? findPublic(tree, sftpId) : null;
  const sftpConnection = sftpNode && sftpNode.type === 'connection' ? sftpNode : null;

  async function patchSettings(patch: Partial<Settings>) {
    const result = await window.moeterm.updateSettings(patch);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    const { closedLogFiles: _ignored, ...next } = result.data;
    setSettings(next);
    void _ignored;
    if (patch.logEnabled === true) toast('之后新建的终端会记录日志');
    if (patch.logEnabled === false) toast('之后新建的终端不再自动记录');
  }

  function stepFont(delta: number) {
    setSettings((current) => {
      const fontSize = Math.min(24, Math.max(12, current.fontSize + delta));
      pendingFont.current = fontSize;
      return { ...current, fontSize };
    });
    if (fontTimer.current) window.clearTimeout(fontTimer.current);
    fontTimer.current = window.setTimeout(() => {
      const fontSize = pendingFont.current;
      if (fontSize != null) void window.moeterm.updateSettings({ fontSize });
    }, 250);
  }

  async function toggleActiveLog() {
    const tab = tabsRef.current.find((item) => item.localId === activeIdRef.current);
    if (!tab) {
      toast('先打开一个终端');
      return;
    }
    const enabled = !tab.logging;
    setTabs((current) => current.map((item) => (item.localId === tab.localId ? { ...item, logging: enabled } : item)));
    if (!tab.sessionId) {
      toast(enabled ? '当前终端连上后开始记录' : '当前终端不记录日志');
      return;
    }
    const result = await window.moeterm.setSessionLog(tab.sessionId, enabled);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    if (!enabled) toast(result.data.file ? `当前终端日志已关闭\n${result.data.file}` : '当前终端日志已关闭', 8000);
    else toast(result.data.file ? `当前终端开始记录\n${result.data.file}` : '当前终端连上后开始记录');
  }
  toggleLogRef.current = () => {
    void toggleActiveLog();
  };

  async function openConnection(connection: PublicConnection, options?: { force?: boolean; secret?: TypedSecret; trust?: boolean; tabLocalId?: string }) {
    if (!options?.force && !options?.tabLocalId) {
      const existing = tabsRef.current.find(
        (tab) => tab.connectionId === connection.id && (tab.status === 'connected' || tab.status === 'connecting'),
      );
      if (existing) {
        setActiveId(existing.localId);
        return;
      }
    }
    const secret = options?.secret ?? secretsRef.current.get(connection.id);
    if (!secret && neededPrompt(connection)) {
      setSecretAsk({
        connection,
        kind: neededPrompt(connection) as SecretKind,
        next: options?.tabLocalId ? 'reconnect' : 'shell',
        trust: options?.trust,
        tabLocalId: options?.tabLocalId,
        value: '',
      });
      return;
    }
    const localId = options?.tabLocalId ?? crypto.randomUUID();
    const previous = options?.tabLocalId ? tabsRef.current.find((tab) => tab.localId === options.tabLocalId) : undefined;
    const logging = previous?.logging ?? settings.logEnabled;
    if (!options?.tabLocalId) {
      setTabs((current) => [
        ...current,
        { localId, sessionId: null, connectionId: connection.id, title: connection.name, status: 'connecting', logging },
      ]);
      setActiveId(localId);
    } else {
      setTabs((current) =>
        current.map((tab) =>
          tab.localId === localId ? { ...tab, status: 'connecting', sessionId: null, message: undefined, code: undefined, logging } : tab,
        ),
      );
    }
    const result = await window.moeterm.connect({
      connectionId: connection.id,
      cols: dims.cols,
      rows: dims.rows,
      password: secret?.password,
      passphrase: secret?.passphrase,
      trustChangedHostKey: options?.trust,
      logging: tabsRef.current.find((tab) => tab.localId === localId)?.logging ?? logging,
    });
    if (!result.ok) {
      setTabs((current) =>
        current.map((tab) =>
          tab.localId === localId ? { ...tab, status: 'error', message: result.message, code: result.code, fingerprint: result.fingerprint } : tab,
        ),
      );
      toast(result.message);
      return;
    }
    setTabs((current) => current.map((tab) => (tab.localId === localId ? { ...tab, sessionId: result.data.sessionId } : tab)));
    const wanted = tabsRef.current.find((tab) => tab.localId === localId)?.logging;
    if (wanted !== undefined && wanted !== logging) {
      await window.moeterm.setSessionLog(result.data.sessionId, wanted);
    }
  }

  async function openSftp(connection: PublicConnection, secret?: TypedSecret, trust?: boolean) {
    const typed = secret ?? secretsRef.current.get(connection.id);
    const prompt = typed ? null : neededPrompt(connection);
    if (prompt) {
      setSecretAsk({ connection, kind: prompt, next: 'sftp', trust, value: '' });
      return;
    }
    if (sftpId && sftpId !== connection.id) await window.moeterm.sftpClose();
    const result = await window.moeterm.sftpOpen({
      connectionId: connection.id,
      cols: 80,
      rows: 24,
      password: typed?.password,
      passphrase: typed?.passphrase,
      trustChangedHostKey: trust,
    });
    if (!result.ok) {
      toast(result.message);
      return;
    }
    setSftpId(connection.id);
  }

  async function openAll(list: PublicConnection[]) {
    if (list.length === 0) {
      toast('这个目录里没有连接');
      return;
    }
    if (list.length > 20) {
      setConfirm({ text: `这个目录里有 ${list.length} 个连接，确定全部打开？`, ok: '全部打开', run: () => void runOpenAll(list) });
      return;
    }
    await runOpenAll(list);
  }

  async function runOpenAll(list: PublicConnection[]) {
    toast(`正在打开 ${list.length} 个连接`);
    for (const connection of list) {
      await openConnection(connection);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  function connectionsIn(node: PublicNode): PublicConnection[] {
    if (node.type === 'connection') return [node];
    return node.children.flatMap(connectionsIn);
  }

  async function closeTab(localId: string) {
    const tab = tabsRef.current.find((item) => item.localId === localId);
    if (tab?.sessionId) await window.moeterm.disconnect(tab.sessionId);
    const rest = tabsRef.current.filter((item) => item.localId !== localId);
    setTabs(rest);
    if (activeId === localId) setActiveId(rest[rest.length - 1]?.localId ?? null);
  }

  async function submitSecret() {
    if (!secretAsk) return;
    const secret: TypedSecret = secretAsk.kind === 'password' ? { password: secretAsk.value } : { passphrase: secretAsk.value };
    if (!secretAsk.value) {
      toast(secretAsk.kind === 'password' ? '请填写密码' : '请填写私钥口令');
      return;
    }
    secretsRef.current.set(secretAsk.connection.id, secret);
    const ask = secretAsk;
    setSecretAsk(null);
    if (ask.next === 'sftp') await openSftp(ask.connection, secret, ask.trust);
    else await openConnection(ask.connection, { force: true, secret, trust: ask.trust, tabLocalId: ask.tabLocalId });
  }

  const connectedIds = new Set(tabs.filter((tab) => tab.status === 'connected').map((tab) => tab.connectionId));
  const connectingIds = new Set(tabs.filter((tab) => tab.status === 'connecting').map((tab) => tab.connectionId));
  const folders = folderOptions(tree as unknown as StoredNode[]);

  return (
    <div className="app">
      <TitleBar
        subtitle={activeConnection ? `${activeConnection.username}@${activeConnection.host}` : 'classical shell'}
        logOn={Boolean(active?.logging)}
        petOn={settings.petEnabled}
        sftpOn={Boolean(sftpConnection)}
        onLog={() => void toggleActiveLog()}
        onPet={() => void patchSettings({ petEnabled: !settings.petEnabled })}
        onSftp={() => {
          if (sftpConnection) {
            void window.moeterm.sftpClose();
            setSftpId(null);
            return;
          }
          if (!activeConnection) {
            toast('先打开一个连接，或在左侧选择 SFTP');
            return;
          }
          void openSftp(activeConnection);
        }}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="body">
        <Sidebar
          tree={tree}
          width={settings.sidebarWidth}
          selectedId={selectedId}
          connectedIds={connectedIds}
          connectingIds={connectingIds}
          onSelect={setSelectedId}
          onConnect={(connection) => void openConnection(connection)}
          onOpenAll={(folderId) => {
            const folder = findPublic(tree, folderId);
            if (folder) void openAll(connectionsIn(folder).filter((item) => item.type === 'connection'));
          }}
          onSftp={(connection) => void openSftp(connection)}
          onEdit={(connection) => setConnectionEdit({ connection, parentId: findParentId(tree, connection.id) ?? null })}
          onDuplicate={(id) => {
            void window.moeterm.duplicateConnection(id).then((result) => {
              if (result.ok) setTree(result.data);
              else toast(result.message);
            });
          }}
          onDelete={(node) =>
            setConfirm({
              text: node.type === 'folder' ? `删除目录「${node.name}」和里面的连接？密钥文件会一并清理。` : `删除连接「${node.name}」？`,
              ok: '删除',
              run: () => {
                void window.moeterm.deleteNode(node.id).then((result) => {
                  if (result.ok) setTree(result.data);
                  else toast(result.message);
                });
              },
            })
          }
          onRename={(node) => setFolderEdit({ mode: 'rename', parentId: null, id: node.id, name: node.name })}
          onCreateFolder={(parentId) => setFolderEdit({ mode: 'create', parentId })}
          onCreateConnection={(parentId) => setConnectionEdit({ parentId })}
          onMove={(id, parentId) => {
            void window.moeterm.moveNode({ id, parentId }).then((result) => {
              if (result.ok) setTree(result.data);
              else toast(result.message);
            });
          }}
        />
        <div
          className="splitter"
          onPointerDown={(event) => {
            const startX = event.clientX;
            const startW = settings.sidebarWidth;
            const move = (ev: PointerEvent) => {
              const width = Math.min(520, Math.max(200, startW + ev.clientX - startX));
              setSettings((current) => ({ ...current, sidebarWidth: width }));
            };
            const up = (ev: PointerEvent) => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              void patchSettings({ sidebarWidth: Math.min(520, Math.max(200, startW + ev.clientX - startX)) });
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        />
        <main className="stage">
          <div className="tabbar">
            {tabs.map((tab) => (
              <div key={tab.localId} className={tab.localId === activeId ? 'tab active' : 'tab'} onClick={() => setActiveId(tab.localId)}>
                <span className={`dot ${tab.status === 'connected' ? 'on' : tab.status === 'connecting' ? 'wait' : ''}`} />
                <span>{tab.title}</span>
                <button type="button" className="tab-close" onClick={() => void closeTab(tab.localId)} aria-label="关闭会话">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="terminal-stack">
            {tabs.length === 0 ? <Welcome /> : null}
            {tabs.map((tab) => (
              <TerminalPane
                key={tab.localId}
                tab={tab}
                active={tab.localId === activeId}
                fontSize={settings.fontSize}
                onFontStep={stepFont}
                onRetry={() => {
                  const node = findPublic(tree, tab.connectionId);
                  if (node?.type === 'connection') void openConnection(node, { force: true, tabLocalId: tab.localId });
                }}
                onDismiss={() => void closeTab(tab.localId)}
                onDims={(cols, rows) => setDims({ cols, rows })}
              />
            ))}
            <Pet
              settings={settings}
              signal={
                active?.status === 'connecting'
                  ? 'connecting'
                  : active?.status === 'error'
                    ? 'error'
                    : active?.status === 'connected'
                      ? 'connected'
                      : 'idle'
              }
              onPlace={(petX, petY) => void patchSettings({ petX, petY })}
            />
          </div>
          {sftpConnection ? (
            <SftpPanel
              key={sftpConnection.id}
              title={`${sftpConnection.username}@${sftpConnection.host}`}
              progress={progress}
              onClose={() => {
                void window.moeterm.sftpClose();
                setSftpId(null);
              }}
            />
          ) : null}
          <footer className="statusbar">
            <span>{activeConnection ? `${activeConnection.username}@${activeConnection.host}:${activeConnection.port}` : '未连接'}</span>
            <span>{active ? statusText(active) : '就绪'}</span>
            <span>{active?.logging ? '当前日志 开' : '当前日志 关'}</span>
            <span>UTF-8</span>
            <span className="spacer" />
            {active?.code === 'HOST_KEY_CHANGED' && activeConnection ? (
              <button type="button" className="btn" onClick={() => void openConnection(activeConnection, { force: true, trust: true, tabLocalId: active.localId })}>
                信任新密钥并重连
              </button>
            ) : null}
            {active && active.status !== 'connected' && activeConnection ? (
              <button type="button" className="btn" onClick={() => void openConnection(activeConnection, { force: true, tabLocalId: active.localId })}>
                重新连接
              </button>
            ) : null}
            <span>{dims.cols}×{dims.rows}</span>
          </footer>
        </main>
      </div>
      <div className="toast-wrap">
        {toasts.map((item) => (
          <div key={item.id} className="toast">{item.text}</div>
        ))}
      </div>
      {connectionEdit ? (
        <ConnectionModal
          folders={folders}
          initial={connectionEdit.connection}
          parentId={connectionEdit.parentId}
          onClose={() => setConnectionEdit(null)}
          onSave={async (draft: ConnectionSave) => {
            const result = await window.moeterm.saveConnection(draft);
            if (!result.ok) throw new Error(result.message);
            setTree(result.data);
            setConnectionEdit(null);
            toast('连接已保存');
          }}
        />
      ) : null}
      {folderEdit ? (
        <FolderModal
          mode={folderEdit.mode}
          initialName={folderEdit.name}
          onClose={() => setFolderEdit(null)}
          onSubmit={async (name) => {
            const result = folderEdit.id
              ? await window.moeterm.renameNode({ id: folderEdit.id, name })
              : await window.moeterm.createFolder({ parentId: folderEdit.parentId, name });
            if (!result.ok) throw new Error(result.message);
            setTree(result.data);
            setFolderEdit(null);
          }}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsModal settings={settings} paths={paths} onChange={(patch) => void patchSettings(patch)} onClose={() => setSettingsOpen(false)} />
      ) : null}
      {confirm ? (
        <div className="modal-back" onMouseDown={() => setConfirm(null)}>
          <div className="modal confirm" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title">确认</div>
            <div className="modal-body">{confirm.text}</div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setConfirm(null)}>取消</button>
              <button type="button" className="btn danger" onClick={() => { const run = confirm.run; setConfirm(null); run(); }}>
                {confirm.ok}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {secretAsk ? (
        <div className="modal-back">
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              void submitSecret();
            }}
          >
            <div className="modal-title">{secretAsk.kind === 'password' ? '输入密码' : '输入私钥口令'}</div>
            <div className="modal-body">
              <p>{secretAsk.connection.name} · {secretAsk.connection.username}@{secretAsk.connection.host}</p>
              <input autoFocus type="password" value={secretAsk.value} onChange={(event) => setSecretAsk({ ...secretAsk, value: event.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setSecretAsk(null)}>取消</button>
              <button type="submit" className="btn primary">连接</button>
            </div>
          </form>
        </div>
      ) : null}
      {confirmClose ? (
        <div className="modal-back">
          <div className="modal confirm">
            <div className="modal-title">断开并退出</div>
            <div className="modal-body">还有会话连着。退出会断开它们。</div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setConfirmClose(false)}>留下</button>
              <button type="button" className="btn danger" onClick={() => void window.moeterm.forceQuit()}>退出</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusText(tab: TabModel): string {
  if (tab.status === 'connecting') return '连接中';
  if (tab.status === 'connected') return '已连接';
  if (tab.status === 'error') return tab.message ?? '连接失败';
  return tab.message ?? '已断开';
}
