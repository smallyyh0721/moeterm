import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { SFTPWrapper } from 'ssh2';
import { isDirMode, isLinkMode } from '../shared/format';
import { remoteJoin } from '../shared/remote-path';
import type { RemoteEntry } from '../shared/types';

export function realpath(sftp: SFTPWrapper, target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(target, (error, absolute) => (error ? reject(error) : resolve(absolute)));
  });
}

export function listDir(sftp: SFTPWrapper, target: string): Promise<RemoteEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(target, (error, list) => {
      if (error) {
        reject(error);
        return;
      }
      const entries = list
        .filter((item) => item.filename !== '.' && item.filename !== '..')
        .map((item) => ({
          name: item.filename,
          size: item.attrs.size ?? 0,
          mtime: item.attrs.mtime ?? 0,
          mode: item.attrs.mode ?? 0,
          isDir: isDirMode(item.attrs.mode ?? 0),
          isLink: isLinkMode(item.attrs.mode ?? 0),
        }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name, 'zh');
        });
      resolve(entries);
    });
  });
}

function lstat(sftp: SFTPWrapper, target: string): Promise<{ mode: number; size: number }> {
  return new Promise((resolve, reject) => {
    sftp.lstat(target, (error, stats) => {
      if (error) reject(error);
      else resolve({ mode: stats.mode, size: stats.size });
    });
  });
}

export async function removePath(sftp: SFTPWrapper, target: string): Promise<void> {
  const stats = await lstat(sftp, target);
  if (isDirMode(stats.mode) && !isLinkMode(stats.mode)) {
    const entries = await listDir(sftp, target);
    for (const entry of entries) {
      await removePath(sftp, remoteJoin(target, entry.name));
    }
    await call((done) => sftp.rmdir(target, done));
    return;
  }
  await call((done) => sftp.unlink(target, done));
}

export function mkdir(sftp: SFTPWrapper, target: string): Promise<void> {
  return call((done) => sftp.mkdir(target, { mode: 0o755 }, done));
}

export function rename(sftp: SFTPWrapper, from: string, to: string): Promise<void> {
  return call((done) => sftp.rename(from, to, done));
}

export async function uploadFile(
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  onProgress?: (transferred: number, total: number) => void,
): Promise<void> {
  const total = fs.statSync(localPath).size;
  let transferred = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      transferred += chunk.length;
      onProgress?.(transferred, total);
      callback(null, chunk);
    },
  });
  await pipeline(fs.createReadStream(localPath), counter, sftp.createWriteStream(remotePath));
}

export async function downloadFile(
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string,
  onProgress?: (transferred: number, total: number) => void,
): Promise<void> {
  const stats = await lstat(sftp, remotePath);
  if (isDirMode(stats.mode)) throw new Error('请选择文件，不能直接下载目录');
  const total = stats.size;
  let transferred = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      transferred += chunk.length;
      onProgress?.(transferred, total);
      callback(null, chunk);
    },
  });
  await pipeline(sftp.createReadStream(remotePath), counter, fs.createWriteStream(localPath));
}

function call(run: (done: (error: Error | null | undefined) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    run((error) => (error ? reject(error) : resolve()));
  });
}
