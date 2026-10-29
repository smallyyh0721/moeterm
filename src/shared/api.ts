import type { CH } from './channels';
import type { Result } from './result';
import type {
  ConnectionSave,
  ConnectRequest,
  PublicNode,
  RemoteEntry,
  SessionStatusEvent,
  Settings,
  SftpProgress,
} from './types';

export interface DataPaths {
  dataDir: string;
  logDir: string;
  keyDir: string;
  version: string;
}

export interface MoetermApi {
  getTree(): Promise<Result<PublicNode[]>>;
  createFolder(input: { parentId: string | null; name: string }): Promise<Result<PublicNode[]>>;
  renameNode(input: { id: string; name: string }): Promise<Result<PublicNode[]>>;
  deleteNode(id: string): Promise<Result<PublicNode[]>>;
  moveNode(input: { id: string; parentId: string | null }): Promise<Result<PublicNode[]>>;
  saveConnection(draft: ConnectionSave): Promise<Result<PublicNode[]>>;
  duplicateConnection(id: string): Promise<Result<PublicNode[]>>;
  getSettings(): Promise<Result<Settings>>;
  updateSettings(patch: Partial<Settings>): Promise<Result<Settings>>;
  getPaths(): Promise<Result<DataPaths>>;
  openPath(which: 'data' | 'logs' | 'keys'): Promise<Result<null>>;
  pickKey(): Promise<Result<{ token: string; label: string } | null>>;
  connect(request: ConnectRequest): Promise<Result<{ sessionId: string }>>;
  attach(sessionId: string): Promise<Result<null>>;
  write(sessionId: string, data: string): Promise<Result<null>>;
  resize(sessionId: string, cols: number, rows: number): Promise<Result<null>>;
  disconnect(sessionId: string): Promise<Result<null>>;
  sftpOpen(request: ConnectRequest): Promise<Result<{ cwd: string }>>;
  sftpList(path: string): Promise<Result<{ cwd: string; entries: RemoteEntry[] }>>;
  sftpMkdir(path: string): Promise<Result<null>>;
  sftpRemove(path: string): Promise<Result<null>>;
  sftpRename(input: { from: string; to: string }): Promise<Result<null>>;
  sftpUpload(remoteDir: string): Promise<Result<null>>;
  sftpDownload(remotePath: string): Promise<Result<null>>;
  sftpClose(): Promise<Result<null>>;
  exportText(input: { text: string; defaultName: string }): Promise<Result<{ path: string } | null>>;
  copyText(text: string): Promise<Result<null>>;
  pasteText(): Promise<Result<string>>;
  openExternal(url: string): Promise<Result<null>>;
  windowMinimize(): Promise<Result<null>>;
  windowMaximize(): Promise<Result<null>>;
  windowClose(): Promise<Result<null>>;
  windowFullscreen(): Promise<Result<null>>;
  forceQuit(): Promise<Result<null>>;
  onSshData(cb: (event: { sessionId: string; data: Uint8Array }) => void): () => void;
  onSshStatus(cb: (event: SessionStatusEvent) => void): () => void;
  onSftpProgress(cb: (event: SftpProgress) => void): () => void;
  onFullscreen(cb: (value: boolean) => void): () => void;
  onConfirmClose(cb: () => void): () => void;
}

export type ChannelName = (typeof CH)[keyof typeof CH];
