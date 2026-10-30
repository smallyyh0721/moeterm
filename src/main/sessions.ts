import type { BrowserWindow } from 'electron';
import type { SFTPWrapper } from 'ssh2';
import { SessionLogger } from '../core/log';
import { explainSshError, HostKeyChangedError } from '../core/errors';
import { openSftp, openShell, type ShellHandle } from '../core/ssh';
import { downloadFile, listDir, mkdir, realpath, removePath, rename, uploadFile } from '../core/sftp';
import type { DataStore } from '../core/store';
import { CH } from '../shared/channels';
import { remoteBase, remoteJoin } from '../shared/remote-path';
import type { ConnectRequest, RemoteEntry, SessionStatusEvent, SftpProgress, StoredConnection } from '../shared/types';

interface LiveSession {
  id: string;
  connectionId: string;
  name: string;
  status: SessionStatusEvent['status'];
  shell: ShellHandle | null;
  buffer: Buffer[];
  buffered: number;
  attached: boolean;
  logger: SessionLogger;
  logging: boolean;
  inputQueue: string[];
  cols: number;
  rows: number;
}

interface LiveSftp {
  connectionId: string;
  sftp: SFTPWrapper;
  close: () => void;
  cwd: string;
}

interface AuthMaterial {
  connection: StoredConnection;
  password?: string;
  passphrase?: string;
  privateKey?: Buffer;
}

export class SessionManager {
  private sessions = new Map<string, LiveSession>();
  private sftpLive: LiveSftp | null = null;
  private defaultLogging = false;
  private seq = 0;

  constructor(
    private readonly window: () => BrowserWindow | null,
    private readonly store: DataStore,
  ) {}

  setDefaultLogging(enabled: boolean): void {
    this.defaultLogging = enabled;
  }

  setSessionLog(sessionId: string, enabled: boolean): { file: string | null } {
    const live = this.sessions.get(sessionId);
    if (!live) throw new Error('找不到这个终端');
    live.logging = enabled;
    if (!enabled) return { file: live.logger.stop() };
    if (live.status !== 'connected') return { file: null };
    return { file: live.logger.start() };
  }

  hasLive(): boolean {
    for (const live of this.sessions.values()) {
      if (live.status === 'connecting' || live.status === 'connected') return true;
    }
    return false;
  }

  connect(request: ConnectRequest): { sessionId: string } {
    const auth = this.material(request);
    const sessionId = `s_${Date.now().toString(36)}_${(this.seq += 1)}`;
    const live: LiveSession = {
      id: sessionId,
      connectionId: auth.connection.id,
      name: auth.connection.name,
      status: 'connecting',
      shell: null,
      buffer: [],
      buffered: 0,
      attached: false,
      logger: new SessionLogger(this.store.root, auth.connection.name),
      logging: request.logging ?? this.defaultLogging,
      inputQueue: [],
      cols: request.cols,
      rows: request.rows,
    };
    this.sessions.set(sessionId, live);
    this.emitStatus(live, { status: 'connecting' });
    const hostKey = { value: 'known' as 'new' | 'known' };

    void openShell({
      host: auth.connection.host,
      port: auth.connection.port,
      username: auth.connection.username,
      password: auth.password,
      privateKey: auth.privateKey,
      passphrase: auth.passphrase,
      legacyAlgorithms: auth.connection.legacyAlgorithms,
      cols: request.cols,
      rows: request.rows,
      verifyHostKey: (fingerprint) => this.acceptHost(auth.connection, fingerprint, request.trustChangedHostKey, hostKey),
    })
      .then((shell) => {
        if (!this.sessions.has(sessionId) || live.status === 'closed') {
          shell.close();
          return;
        }
        live.shell = shell;
        live.status = 'connected';
        shell.resize(live.cols, live.rows);
        for (const chunk of live.inputQueue) shell.write(chunk);
        live.inputQueue = [];
        const logFile = live.logging ? live.logger.start() : undefined;
        shell.onData((chunk) => {
          if (live.logging) live.logger.write(chunk);
          this.pushOut(live, chunk);
        });
        shell.onClose(() => {
          live.logger.stop();
          if (live.status !== 'error') {
            live.status = 'closed';
            this.emitStatus(live, { status: 'closed', message: '连接已断开' });
          }
        });
        shell.onError((error) => {
          live.status = 'error';
          live.logger.stop();
          this.emitStatus(live, { status: 'error', message: explainSshError(error) });
        });
        this.emitStatus(live, { status: 'connected', hostKey: hostKey.value, logFile });
      })
      .catch((error: unknown) => {
        live.status = 'error';
        live.logger.stop();
        this.emitStatus(live, {
          status: 'error',
          message: explainSshError(error),
          code: error instanceof HostKeyChangedError ? error.code : undefined,
          fingerprint: error instanceof HostKeyChangedError ? error.fingerprint : undefined,
        });
      });

    return { sessionId };
  }

  attach(sessionId: string): void {
    const live = this.sessions.get(sessionId);
    if (!live) return;
    live.attached = true;
    const chunks = live.buffer;
    live.buffer = [];
    live.buffered = 0;
    for (const chunk of chunks) this.send(CH.sshData, { sessionId, data: chunk });
  }

  write(sessionId: string, data: string): void {
    const live = this.sessions.get(sessionId);
    if (!live) return;
    if (live.shell) live.shell.write(data);
    else live.inputQueue.push(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const live = this.sessions.get(sessionId);
    if (!live) return;
    live.cols = cols;
    live.rows = rows;
    live.shell?.resize(cols, rows);
  }

  disconnect(sessionId: string): void {
    const live = this.sessions.get(sessionId);
    if (!live) return;
    live.status = 'closed';
    live.logger.stop();
    try {
      live.shell?.close();
    } catch {
      /* 会话可能已经结束 */
    }
    this.sessions.delete(sessionId);
  }

  async sftpOpen(request: ConnectRequest): Promise<{ cwd: string }> {
    const auth = this.material(request);
    this.closeSftp();
    const hostKey = { value: 'known' as 'new' | 'known' };
    const opened = await openSftp({
      host: auth.connection.host,
      port: auth.connection.port,
      username: auth.connection.username,
      password: auth.password,
      privateKey: auth.privateKey,
      passphrase: auth.passphrase,
      legacyAlgorithms: auth.connection.legacyAlgorithms,
      verifyHostKey: (fingerprint) => this.acceptHost(auth.connection, fingerprint, request.trustChangedHostKey, hostKey),
    });
    const cwd = await realpath(opened.sftp, '.');
    this.sftpLive = { connectionId: auth.connection.id, sftp: opened.sftp, close: opened.close, cwd };
    return { cwd };
  }

  async sftpList(target: string): Promise<{ cwd: string; entries: RemoteEntry[] }> {
    const live = this.requireSftp();
    const cwd = target ? target : live.cwd;
    const entries = await listDir(live.sftp, cwd);
    live.cwd = cwd;
    return { cwd, entries };
  }

  async sftpMkdir(target: string): Promise<void> {
    await mkdir(this.requireSftp().sftp, target);
  }

  async sftpRemove(target: string): Promise<void> {
    await removePath(this.requireSftp().sftp, target);
  }

  async sftpRename(from: string, to: string): Promise<void> {
    await rename(this.requireSftp().sftp, from, to);
  }

  async sftpUpload(localPath: string, remoteDir: string): Promise<void> {
    const live = this.requireSftp();
    const remotePath = remoteJoin(remoteDir || live.cwd, remoteBase(localPath));
    const name = remoteBase(localPath);
    this.resetSpeed();
    await uploadFile(live.sftp, localPath, remotePath, (transferred, total) => {
      this.reportTransfer(name, transferred, total, false);
    });
    this.reportTransfer(name, 1, 1, true);
  }

  async sftpDownload(remotePath: string, localPath: string): Promise<void> {
    const live = this.requireSftp();
    const name = remoteBase(remotePath);
    this.resetSpeed();
    await downloadFile(live.sftp, remotePath, localPath, (transferred, total) => {
      this.reportTransfer(name, transferred, total, false);
    });
    this.reportTransfer(name, 1, 1, true);
  }

  closeSftp(): void {
    try {
      this.sftpLive?.close();
    } catch {
      /* 忽略已断开的 SFTP */
    }
    this.sftpLive = null;
  }

  closeAll(): void {
    for (const live of this.sessions.values()) {
      live.status = 'closed';
      live.logger.stop();
      try {
        live.shell?.close();
      } catch {
        /* 忽略 */
      }
    }
    this.sessions.clear();
    this.closeSftp();
  }

  private material(request: ConnectRequest): AuthMaterial {
    const connection = this.store.getConnection(request.connectionId);
    if (!connection) throw new Error('找不到这个连接');
    const saved = this.store.readSecret(connection.id);
    const password = request.password || saved.password;
    const passphrase = request.passphrase || saved.passphrase;
    if (connection.authType === 'password' && !password) throw new Error('请填写密码');
    let privateKey: Buffer | undefined;
    if (connection.authType === 'privateKey') {
      if (!connection.keyId) throw new Error('请选择私钥');
      privateKey = this.store.readKey(connection.keyId);
      if (connection.passphraseRequired && !passphrase) throw new Error('请填写私钥口令');
    }
    return { connection, password, passphrase, privateKey };
  }

  private acceptHost(
    connection: StoredConnection,
    fingerprint: string,
    trustChanged: boolean | undefined,
    hostKey: { value: 'new' | 'known' },
  ): boolean {
    const result = this.store.knownHosts.check(connection.host, connection.port, fingerprint, Boolean(trustChanged));
    if (result === 'changed') return false;
    if (result === 'saved') hostKey.value = 'new';
    return true;
  }

  private requireSftp(): LiveSftp {
    if (!this.sftpLive) throw new Error('SFTP 还没有连接');
    return this.sftpLive;
  }

  private pushOut(live: LiveSession, chunk: Buffer): void {
    if (live.attached) {
      this.send(CH.sshData, { sessionId: live.id, data: chunk });
      return;
    }
    live.buffer.push(chunk);
    live.buffered += chunk.length;
    while (live.buffered > 4_000_000 && live.buffer.length > 1) {
      const dropped = live.buffer.shift();
      if (dropped) live.buffered -= dropped.length;
    }
  }

  private emitStatus(live: LiveSession, extra: Omit<SessionStatusEvent, 'sessionId' | 'connectionId'>): void {
    const event: SessionStatusEvent = {
      sessionId: live.id,
      connectionId: live.connectionId,
      ...extra,
    };
    this.send(CH.sshStatus, event);
  }

  private lastProgress = 0;
  private speedAt = 0;
  private speedBytes = 0;
  private speed = 0;

  private resetSpeed(): void {
    this.speedAt = 0;
    this.speedBytes = 0;
    this.speed = 0;
  }

  private reportTransfer(name: string, transferred: number, total: number, done: boolean): void {
    const now = Date.now();
    if (this.speedAt === 0) {
      this.speedAt = now;
      this.speedBytes = transferred;
    } else {
      const elapsed = (now - this.speedAt) / 1000;
      if (elapsed >= 0.25) {
        this.speed = Math.max(0, (transferred - this.speedBytes) / elapsed);
        this.speedAt = now;
        this.speedBytes = transferred;
      }
    }
    this.emitProgress({ transferred, total, name, done, bytesPerSecond: this.speed });
    if (done) this.resetSpeed();
  }

  private emitProgress(event: SftpProgress): void {
    const now = Date.now();
    if (!event.done && !event.error && now - this.lastProgress < 80) return;
    this.lastProgress = now;
    this.send(CH.sftpProgress, event);
  }

  private send(channel: string, payload: unknown): void {
    const win = this.window();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }
}
