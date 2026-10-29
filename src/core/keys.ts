export function privateKeyNeedsPassphrase(content: Buffer | string): boolean {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  if (text.includes('BEGIN ENCRYPTED PRIVATE KEY')) return true;
  if (/Proc-Type:\s*4,ENCRYPTED/i.test(text)) return true;
  const match = text.match(/-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]+?)-----END OPENSSH PRIVATE KEY-----/);
  if (!match) return false;
  const body = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  const magic = Buffer.from('openssh-key-v1\0');
  if (body.length < magic.length + 8 || !body.subarray(0, magic.length).equals(magic)) return false;
  const cipher = readSshString(body, magic.length);
  return cipher.value.length > 0 && cipher.value !== 'none';
}

export function readSshString(buf: Buffer, offset: number): { value: string; next: number } {
  if (offset + 4 > buf.length) return { value: '', next: buf.length };
  const length = buf.readUInt32BE(offset);
  const start = offset + 4;
  const end = start + length;
  if (length < 0 || end > buf.length) return { value: '', next: buf.length };
  return { value: buf.subarray(start, end).toString('utf8'), next: end };
}

export function assertOpenSshKey(content: Buffer): void {
  const text = content.toString('utf8');
  if (text.startsWith('PuTTY-User-Key-File-')) {
    throw new Error('暂不支持 PuTTY 的 .ppk。请用 puttygen 转成 OpenSSH 格式后再导入。');
  }
  if (content.length > 1024 * 1024) {
    throw new Error('私钥文件过大');
  }
}
