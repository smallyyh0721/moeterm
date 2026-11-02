import { createHash } from 'node:crypto';
import type { Client as SshClient, ClientChannel } from 'ssh2';
import { legacyAlgorithms } from './algorithms';
import { HostKeyChangedError } from './errors';

export interface EndpointOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: Buffer | string;
  passphrase?: string;
  legacyAlgorithms?: boolean;
  readyTimeout?: number;
  verifyHostKey: (fingerprint: string) => boolean;
}

export interface ShellOptions extends EndpointOptions {
  cols?: number;
  rows?: number;
}

export interface ShellHandle {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
  onData(cb: (chunk: Buffer) => void): void;
  onClose(cb: () => void): void;
  onError(cb: (error: Error) => void): void;
}

export function fingerprintOf(key: Buffer | string): string {
  const bytes = Buffer.isBuffer(key) ? key : Buffer.from(key);
  return createHash('sha256').update(bytes).digest('base64');
}

async function loadClient(): Promise<typeof import('ssh2').Client> {
  const ssh = await import('ssh2');
  return ssh.Client;
}

export async function openShell(options: ShellOptions): Promise<ShellHandle> {
  const Client = await loadClient();
  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;
    let closed = false;
    let rejectedFingerprint: string | undefined;
    const pending: Buffer[] = [];
    let onData: ((chunk: Buffer) => void) | null = null;
    let onClose: (() => void) | null = null;
    let onError: ((error: Error) => void) | null = null;

    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        client.end();
        reject(error);
        return;
      }
      onError?.(error);
    };

    client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      const password = options.password ?? '';
      finish(prompts.map(() => password));
    });

    client.on('ready', () => {
      client.shell(
        { term: 'xterm-256color', cols: options.cols ?? 80, rows: options.rows ?? 24 },
        (error, channel) => {
          if (error || !channel) {
            fail(error ?? new Error('无法打开终端'));
            return;
          }
          const take = (chunk: Buffer | string) => {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            if (onData) onData(bytes);
            else pending.push(bytes);
          };
          channel.on('data', take);
          channel.stderr.on('data', take);
          channel.on('error', (err: Error) => onError?.(err));
          channel.on('close', () => {
            if (closed) return;
            closed = true;
            onClose?.();
            client.end();
          });
          settled = true;
          resolve(createHandle(channel, client));
        },
      );
    });

    client.on('error', (error) => {
      if (rejectedFingerprint) fail(new HostKeyChangedError(rejectedFingerprint));
      else fail(error);
    });

    client.on('close', () => {
      if (!settled) fail(new Error('连接在就绪前关闭'));
    });

    try {
      client.connect({
        host: options.host,
        port: options.port,
        username: options.username,
        password: options.password || undefined,
        privateKey: options.privateKey,
        passphrase: options.passphrase || undefined,
        tryKeyboard: Boolean(options.password),
        readyTimeout: options.readyTimeout ?? 20000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 4,
        algorithms: options.legacyAlgorithms ? legacyAlgorithms() : undefined,
        hostVerifier(key: Buffer | string) {
          const fingerprint = fingerprintOf(key);
          const accepted = options.verifyHostKey(fingerprint);
          if (!accepted) rejectedFingerprint = fingerprint;
          return accepted;
        },
      });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }

    function createHandle(channel: ClientChannel, connection: SshClient): ShellHandle {
      return {
        write(data: string) {
          if (!closed) channel.write(data);
        },
        resize(cols: number, rows: number) {
          if (!closed) channel.setWindow(rows, cols, 0, 0);
        },
        close() {
          if (closed) return;
          closed = true;
          channel.close();
          connection.end();
        },
        onData(cb) {
          onData = cb;
          for (const chunk of pending) cb(chunk);
          pending.length = 0;
        },
        onClose(cb) {
          onClose = cb;
          if (closed) cb();
        },
        onError(cb) {
          onError = cb;
        },
      };
    }
  });
}

export interface SftpHandle {
  sftp: import('ssh2').SFTPWrapper;
  close(): void;
}

export async function openSftp(options: EndpointOptions): Promise<SftpHandle> {
  const Client = await loadClient();
  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;
    let rejectedFingerprint: string | undefined;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      client.end();
      reject(error);
    };

    client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      const password = options.password ?? '';
      finish(prompts.map(() => password));
    });

    client.on('ready', () => {
      client.sftp((error, sftp) => {
        if (error || !sftp) {
          fail(error ?? new Error('无法打开 SFTP'));
          return;
        }
        settled = true;
        resolve({
          sftp,
          close() {
            client.end();
          },
        });
      });
    });

    client.on('error', (error) => {
      if (rejectedFingerprint) fail(new HostKeyChangedError(rejectedFingerprint));
      else fail(error);
    });

    try {
      client.connect({
        host: options.host,
        port: options.port,
        username: options.username,
        password: options.password || undefined,
        privateKey: options.privateKey,
        passphrase: options.passphrase || undefined,
        tryKeyboard: Boolean(options.password),
        readyTimeout: options.readyTimeout ?? 20000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 4,
        algorithms: options.legacyAlgorithms ? legacyAlgorithms() : undefined,
        hostVerifier(key: Buffer | string) {
          const fingerprint = fingerprintOf(key);
          const accepted = options.verifyHostKey(fingerprint);
          if (!accepted) rejectedFingerprint = fingerprint;
          return accepted;
        },
      });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
