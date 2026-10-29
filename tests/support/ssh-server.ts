import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Server, type Connection, type Session } from 'ssh2';

const READ = 0x00000001;
const WRITE = 0x00000002;
const APPEND = 0x00000004;
const CREAT = 0x00000008;
const TRUNC = 0x00000010;
const STATUS_OK = 0;
const STATUS_EOF = 1;
const STATUS_NO_SUCH_FILE = 2;
const STATUS_FAILURE = 4;

interface SftpRequest {
  handle(reqid: number, handle: Buffer): void;
  status(reqid: number, code: number, message?: string): void;
  data(reqid: number, data: Buffer): void;
  name(reqid: number, names: Array<{ filename: string; longname: string; attrs: Record<string, number> }>): void;
  attrs(reqid: number, attrs: Record<string, number>): void;
  on(event: string, listener: (...args: never[]) => void): void;
}

interface FileHandle {
  kind: 'file';
  fd: number;
}
interface DirHandle {
  kind: 'dir';
  local: string;
  sent: boolean;
}

export interface TestServer {
  port: number;
  root: string;
  user: string;
  password: string;
  close(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moeterm-sftp-'));
  const user = 'tester';
  const password = 'secret';
  const server = new Server({ hostKeys: [pem] }, (client) => acceptClient(client, root, user, password));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('测试 SSH 服务没有端口');
  return {
    port: address.port,
    root,
    user,
    password,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          fs.rmSync(root, { recursive: true, force: true });
          resolve();
        });
      }),
  };
}

function acceptClient(client: Connection, root: string, user: string, password: string): void {
  client.on('error', () => undefined);
  client.on('authentication', (ctx) => {
    if (ctx.method === 'password' && ctx.username === user && ctx.password === password) ctx.accept();
    else ctx.reject(['password']);
  });
  client.on('ready', () => {
    client.on('session', (accept) => {
      const session = accept();
      bindSession(session, root);
    });
  });
}

function bindSession(session: Session, root: string): void {
  session.on('pty', (accept) => accept());
  session.on('shell', (accept) => {
    const stream = accept();
    stream.write('welcome\r\n');
    stream.on('data', (data: Buffer) => stream.write(data));
  });
  session.on('sftp', (accept) => {
    bindSftp(accept() as unknown as SftpRequest, root);
  });
}

function bindSftp(sftp: SftpRequest, root: string): void {
  const handles = new Map<string, FileHandle | DirHandle>();
  let next = 1;
  const alloc = (handle: FileHandle | DirHandle) => {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(next);
    next += 1;
    handles.set(buf.toString('hex'), handle);
    return buf;
  };

  sftp.on('OPEN', ((reqid: number, filename: string, flags: number) => {
    try {
      const local = localPath(root, filename);
      const fd = fs.openSync(local, fsFlags(flags));
      sftp.handle(reqid, alloc({ kind: 'file', fd }));
    } catch {
      sftp.status(reqid, STATUS_NO_SUCH_FILE);
    }
  }) as (...args: never[]) => void);

  sftp.on('READ', ((reqid: number, handle: Buffer, offset: number, length: number) => {
    const item = handles.get(handle.toString('hex'));
    if (!item || item.kind !== 'file') {
      sftp.status(reqid, STATUS_FAILURE);
      return;
    }
    const buf = Buffer.alloc(length);
    const bytes = fs.readSync(item.fd, buf, 0, length, offset);
    if (bytes <= 0) sftp.status(reqid, STATUS_EOF);
    else sftp.data(reqid, buf.subarray(0, bytes));
  }) as (...args: never[]) => void);

  sftp.on('WRITE', ((reqid: number, handle: Buffer, offset: number, data: Buffer) => {
    const item = handles.get(handle.toString('hex'));
    if (!item || item.kind !== 'file') {
      sftp.status(reqid, STATUS_FAILURE);
      return;
    }
    fs.writeSync(item.fd, data, 0, data.length, offset);
    sftp.status(reqid, STATUS_OK);
  }) as (...args: never[]) => void);

  sftp.on('CLOSE', ((reqid: number, handle: Buffer) => {
    const key = handle.toString('hex');
    const item = handles.get(key);
    if (item?.kind === 'file') fs.closeSync(item.fd);
    handles.delete(key);
    sftp.status(reqid, STATUS_OK);
  }) as (...args: never[]) => void);

  sftp.on('OPENDIR', ((reqid: number, filename: string) => {
    try {
      const local = localPath(root, filename);
      if (!fs.statSync(local).isDirectory()) throw new Error('not dir');
      sftp.handle(reqid, alloc({ kind: 'dir', local, sent: false }));
    } catch {
      sftp.status(reqid, STATUS_NO_SUCH_FILE);
    }
  }) as (...args: never[]) => void);

  sftp.on('READDIR', ((reqid: number, handle: Buffer) => {
    const item = handles.get(handle.toString('hex'));
    if (!item || item.kind !== 'dir') {
      sftp.status(reqid, STATUS_FAILURE);
      return;
    }
    if (item.sent) {
      sftp.status(reqid, STATUS_EOF);
      return;
    }
    item.sent = true;
    const names = fs.readdirSync(item.local).map((name) => {
      const st = fs.statSync(path.join(item.local, name));
      const attrs = toAttrs(st);
      return { filename: name, longname: name, attrs };
    });
    if (names.length === 0) sftp.status(reqid, STATUS_EOF);
    else sftp.name(reqid, names);
  }) as (...args: never[]) => void);

  const statLike = (reqid: number, filename: string) => {
    try {
      sftp.attrs(reqid, toAttrs(fs.statSync(localPath(root, filename))));
    } catch {
      sftp.status(reqid, STATUS_NO_SUCH_FILE);
    }
  };
  sftp.on('STAT', ((reqid: number, filename: string) => statLike(reqid, filename)) as (...args: never[]) => void);
  sftp.on('LSTAT', ((reqid: number, filename: string) => statLike(reqid, filename)) as (...args: never[]) => void);
  sftp.on('FSTAT', ((reqid: number, handle: Buffer) => {
    const item = handles.get(handle.toString('hex'));
    if (!item || item.kind !== 'file') {
      sftp.status(reqid, STATUS_FAILURE);
      return;
    }
    sftp.attrs(reqid, toAttrs(fs.fstatSync(item.fd)));
  }) as (...args: never[]) => void);

  sftp.on('MKDIR', ((reqid: number, filename: string) => {
    try {
      fs.mkdirSync(localPath(root, filename));
      sftp.status(reqid, STATUS_OK);
    } catch {
      sftp.status(reqid, STATUS_FAILURE);
    }
  }) as (...args: never[]) => void);
  sftp.on('RMDIR', ((reqid: number, filename: string) => {
    try {
      fs.rmdirSync(localPath(root, filename));
      sftp.status(reqid, STATUS_OK);
    } catch {
      sftp.status(reqid, STATUS_FAILURE);
    }
  }) as (...args: never[]) => void);
  sftp.on('REMOVE', ((reqid: number, filename: string) => {
    try {
      fs.rmSync(localPath(root, filename));
      sftp.status(reqid, STATUS_OK);
    } catch {
      sftp.status(reqid, STATUS_FAILURE);
    }
  }) as (...args: never[]) => void);
  sftp.on('RENAME', ((reqid: number, from: string, to: string) => {
    try {
      fs.renameSync(localPath(root, from), localPath(root, to));
      sftp.status(reqid, STATUS_OK);
    } catch {
      sftp.status(reqid, STATUS_FAILURE);
    }
  }) as (...args: never[]) => void);
  sftp.on('REALPATH', ((reqid: number, target: string) => {
    const normalized = normalize(target);
    const attrs = fs.existsSync(localPath(root, normalized)) ? toAttrs(fs.statSync(localPath(root, normalized))) : { mode: 0o040755, size: 0, uid: 0, gid: 0, atime: 0, mtime: 0 };
    sftp.name(reqid, [{ filename: normalized, longname: normalized, attrs }]);
  }) as (...args: never[]) => void);
  sftp.on('SETSTAT', ((reqid: number) => sftp.status(reqid, STATUS_OK)) as (...args: never[]) => void);
}

function fsFlags(flags: number): string {
  const write = (flags & WRITE) !== 0;
  const append = (flags & APPEND) !== 0;
  const creat = (flags & CREAT) !== 0;
  const trunc = (flags & TRUNC) !== 0;
  const read = (flags & READ) !== 0;
  if (append) return read ? 'a+' : 'a';
  if (trunc || (creat && write && !read)) return 'w';
  if (write && read) return creat ? 'w+' : 'r+';
  if (write) return 'w';
  return 'r';
}

function normalize(target: string): string {
  const parts: string[] = [];
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.' || part === '~') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function localPath(root: string, target: string): string {
  const parts = normalize(target).split('/').filter(Boolean);
  const full = path.resolve(root, ...parts);
  const relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path escapes root');
  return full;
}

function toAttrs(st: fs.Stats): Record<string, number> {
  const type = st.isDirectory() ? 0o040000 : 0o100000;
  return {
    mode: type | (st.mode & 0o777),
    size: st.size,
    uid: 0,
    gid: 0,
    atime: Math.floor(st.atimeMs / 1000),
    mtime: Math.floor(st.mtimeMs / 1000),
  };
}
