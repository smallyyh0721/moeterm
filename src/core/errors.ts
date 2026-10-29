export class HostKeyChangedError extends Error {
  readonly code = 'HOST_KEY_CHANGED';

  constructor(readonly fingerprint: string) {
    super('主机密钥已变化，连接已中止');
    this.name = 'HostKeyChangedError';
  }
}

export function explainSshError(error: unknown): string {
  if (error instanceof HostKeyChangedError) return error.message;
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.toLowerCase();
  if (msg.includes('all configured authentication methods failed')) return '认证失败，请检查用户名、密码或私钥';
  if (msg.includes('timed out') || msg.includes('timeout')) return '连接超时';
  if (msg.includes('enotfound') || msg.includes('getaddrinfo')) return '找不到主机';
  if (msg.includes('econnrefused')) return '连接被拒绝，请确认端口和 SSH 服务';
  if (msg.includes('host key verification failed') || msg.includes('主机密钥')) return '主机密钥校验失败';
  if (
    msg.includes('bad decrypt') ||
    msg.includes('cannot parse privatekey') ||
    msg.includes('unsupported key format') ||
    (msg.includes('passphrase') && msg.includes('key'))
  ) {
    return '私钥无法解析。若私钥有口令，请填写口令；PuTTY 的 ppk 需要先转换成 OpenSSH 格式';
  }
  return `连接失败：${raw}`;
}
