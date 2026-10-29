import type { AuthType } from './types';

export function normalizeHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.length > 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function validateFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '请填写目录名';
  if (trimmed.length > 64) return '目录名最多 64 个字符';
  return null;
}

export function validateConnection(input: {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
}): string | null {
  const name = input.name.trim();
  if (!name) return '请填写名称';
  if (name.length > 64) return '名称最多 64 个字符';
  const host = normalizeHost(input.host);
  if (!host) return '请填写主机';
  if (host.length > 255) return '主机名过长';
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    return '端口需要在 1 到 65535 之间';
  }
  const username = input.username.trim();
  if (!username) return '请填写用户名';
  if (username.length > 128) return '用户名过长';
  if (input.authType !== 'password' && input.authType !== 'privateKey') return '认证方式不正确';
  return null;
}
