import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { explainSshError, HostKeyChangedError } from '../src/core/errors';
import { legacyAlgorithms } from '../src/core/algorithms';
import { downloadFile, listDir, mkdir, realpath, removePath, rename, uploadFile } from '../src/core/sftp';
import { openSftp, openShell } from '../src/core/ssh';
import { startTestServer, type TestServer } from './support/ssh-server';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
}, 30000);

afterAll(async () => {
  await server?.close();
});

describe('SSH', () => {
  it('打开终端并回显输入', async () => {
    const shell = await openShell(base());
    const chunks: Buffer[] = [];
    shell.onData((chunk) => chunks.push(chunk));
    await waitFor(() => Buffer.concat(chunks).toString().includes('welcome'));
    shell.write('hi');
    await waitFor(() => Buffer.concat(chunks).toString().includes('hi'));
    shell.resize(100, 40);
    shell.close();
  });

  it('兼容算法列表也能连上', async () => {
    const algorithms = legacyAlgorithms();
    expect(algorithms.kex?.length).toBeGreaterThan(0);
    const shell = await openShell({ ...base(), legacyAlgorithms: true });
    const chunks: Buffer[] = [];
    shell.onData((chunk) => chunks.push(chunk));
    await waitFor(() => Buffer.concat(chunks).toString().includes('welcome'));
    shell.close();
  });

  it('密码错误时给出中文原因', async () => {
    await expect(openShell({ ...base(), password: 'nope' })).rejects.toThrow(/认证失败|All configured/);
    try {
      await openShell({ ...base(), password: 'nope' });
    } catch (error) {
      expect(explainSshError(error)).toMatch(/认证失败/);
    }
  });

  it('主机密钥变化时拒绝连接', async () => {
    await expect(openShell({ ...base(), verifyHostKey: () => false })).rejects.toBeInstanceOf(HostKeyChangedError);
  });
});

describe('SFTP', () => {
  it('上传、列出、下载、重命名和删除', async () => {
    const opened = await openSftp(base());
    const cwd = await realpath(opened.sftp, '.');
    expect(cwd.startsWith('/')).toBe(true);
    await mkdir(opened.sftp, '/box');
    const local = path.join(os.tmpdir(), `moeterm-up-${Date.now()}.txt`);
    fs.writeFileSync(local, '文件内容-甲乙丙');
    let seen = 0;
    await uploadFile(opened.sftp, local, '/box/note.txt', (got) => {
      seen = got;
    });
    expect(seen).toBeGreaterThan(0);
    const entries = await listDir(opened.sftp, '/box');
    expect(entries.map((entry) => entry.name)).toContain('note.txt');
    const downloaded = path.join(os.tmpdir(), `moeterm-down-${Date.now()}.txt`);
    await downloadFile(opened.sftp, '/box/note.txt', downloaded);
    expect(fs.readFileSync(downloaded, 'utf8')).toBe('文件内容-甲乙丙');
    await rename(opened.sftp, '/box/note.txt', '/box/renamed.txt');
    await removePath(opened.sftp, '/box');
    await expect(listDir(opened.sftp, '/box')).rejects.toThrow();
    opened.close();
    fs.rmSync(local, { force: true });
    fs.rmSync(downloaded, { force: true });
  });
});

function base() {
  return {
    host: '127.0.0.1',
    port: server.port,
    username: server.user,
    password: server.password,
    verifyHostKey: () => true,
  };
}

async function waitFor(check: () => boolean, timeout = 4000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('等待超时');
}
