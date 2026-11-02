import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../src/shared/ansi';
import { formatMode, formatSize, formatSpeed, sanitizeFileName } from '../src/shared/format';
import { normalizeRemote, remoteJoin, remoteParent } from '../src/shared/remote-path';
import { assertOpenSshKey, privateKeyNeedsPassphrase } from '../src/core/keys';
import { SessionLogger } from '../src/core/log';
import { failureKeyAction } from '../src/shared/terminal-keys';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('文本和路径', () => {
  it('去掉终端颜色和控制序列，保留中文', () => {
    expect(stripAnsi('\u001b[31m失败\u001b[0m')).toBe('失败');
    expect(stripAnsi('\u001b[H\u001b[2J')).toBe('');
    expect(stripAnsi('\u001b]0;标题\u0007正文')).toBe('正文');
  });

  it('格式化权限和大小', () => {
    expect(formatMode(0o040755)).toBe('drwxr-xr-x');
    expect(formatMode(0o100644)).toBe('-rw-r--r--');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSpeed(1536)).toBe('1.5 KB/s');
  });

  it('整理远程路径', () => {
    expect(normalizeRemote('.')).toBe('/');
    expect(remoteJoin('/var', 'log')).toBe('/var/log');
    expect(remoteJoin('/var/log', '..')).toBe('/var');
    expect(remoteParent('/var/log')).toBe('/var');
    expect(remoteJoin('/var', '../etc/passwd')).toBe('/etc/passwd');
  });

  it('日志文件名去掉不能用的字符', () => {
    expect(sanitizeFileName('nas:01/root')).toBe('nas_01_root');
  });

  it('识别加密私钥，并拒绝 ppk', () => {
    expect(privateKeyNeedsPassphrase('-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\n')).toBe(true);
    expect(privateKeyNeedsPassphrase(openssh('none'))).toBe(false);
    expect(privateKeyNeedsPassphrase(openssh('aes256-ctr'))).toBe(true);
    expect(() => assertOpenSshKey(Buffer.from('PuTTY-User-Key-File-2: ssh-rsa'))).toThrow(/ppk/);
  });

  it('日志去掉颜色并写上头尾', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moeterm-log-'));
    const logger = new SessionLogger(root, 'nas:01');
    const file = logger.start();
    logger.write(Buffer.from('\u001b[32mhello\u001b[0m\r\n'));
    expect(logger.stop()).toBe(file);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const text = fs.readFileSync(file, 'utf8');
    expect(text.startsWith('\uFEFF===== kittyTerm')).toBe(true);
    expect(text).toContain('hello');
    expect(text).not.toContain('\u001b');
    expect(text).toContain('结束');
  });

  it('连接失败后 Enter 关闭，R 重试', () => {
    expect(failureKeyAction('error', 'Enter', false)).toBe('close');
    expect(failureKeyAction('error', 'r', false)).toBe('retry');
    expect(failureKeyAction('error', 'R', false)).toBe('retry');
    expect(failureKeyAction('closed', 'Enter', false)).toBe('close');
    expect(failureKeyAction('error', 'Enter', true)).toBeNull();
    expect(failureKeyAction('connected', 'r', false)).toBeNull();
  });
});

function openssh(cipher: string): string {
  const magic = Buffer.from('openssh-key-v1\0');
  const body = Buffer.concat([magic, sshString(cipher), sshString('none'), sshString('')]);
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${body.toString('base64')}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

function sshString(value: string): Buffer {
  const data = Buffer.from(value);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, data]);
}
