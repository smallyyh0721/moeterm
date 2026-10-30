export type AuthType = 'password' | 'privateKey';

export interface StoredConnection {
  type: 'connection';
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  keyId?: string;
  keyLabel?: string;
  saveSecret: boolean;
  legacyAlgorithms: boolean;
  passphraseRequired: boolean;
}

export interface StoredFolder {
  type: 'folder';
  id: string;
  name: string;
  children: StoredNode[];
}

export type StoredNode = StoredFolder | StoredConnection;

export interface PublicConnection extends StoredConnection {
  hasPassword: boolean;
  hasPassphrase: boolean;
}

export interface PublicFolder {
  type: 'folder';
  id: string;
  name: string;
  children: PublicNode[];
}

export type PublicNode = PublicFolder | PublicConnection;

export interface Settings {
  version: 1;
  petEnabled: boolean;
  petX: number | null;
  petY: number | null;
  fontSize: number;
  logEnabled: boolean;
  sidebarWidth: number;
}

export interface RemoteEntry {
  name: string;
  size: number;
  mtime: number;
  mode: number;
  isDir: boolean;
  isLink: boolean;
}

export interface ConnectionSave {
  id?: string;
  parentId: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  saveSecret: boolean;
  legacyAlgorithms: boolean;
  password?: string;
  passphrase?: string;
  clearSecret?: boolean;
  keyToken?: string;
  keyId?: string;
  keyLabel?: string;
}

export interface ConnectRequest {
  connectionId: string;
  cols: number;
  rows: number;
  password?: string;
  passphrase?: string;
  trustChangedHostKey?: boolean;
  logging?: boolean;
}

export interface SessionStatusEvent {
  sessionId: string;
  connectionId: string;
  status: 'connecting' | 'connected' | 'closed' | 'error';
  message?: string;
  code?: string;
  fingerprint?: string;
  hostKey?: 'new' | 'known';
  logFile?: string;
}

export interface SftpProgress {
  transferred: number;
  total: number;
  name: string;
  done: boolean;
  bytesPerSecond: number;
  error?: string;
}

export const defaultSettings = (): Settings => ({
  version: 1,
  petEnabled: true,
  petX: null,
  petY: null,
  fontSize: 15,
  logEnabled: false,
  sidebarWidth: 280,
});
