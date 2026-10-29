export function normalizeRemote(input: string): string {
  const raw = input.replace(/\\/g, '/').trim();
  if (!raw || raw === '.') return '/';
  const absolute = raw.startsWith('/') ? raw : `/${raw}`;
  const parts: string[] = [];
  for (const part of absolute.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

export function remoteJoin(dir: string, name: string): string {
  if (name === '..') return remoteParent(dir);
  const base = normalizeRemote(dir);
  const child = name.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!child) return base;
  return normalizeRemote(`${base === '/' ? '' : base}/${child}`);
}

export function remoteParent(target: string): string {
  const normalized = normalizeRemote(target);
  if (normalized === '/') return '/';
  const parts = normalized.split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}`;
}

export function remoteBase(target: string): string {
  const parts = normalizeRemote(target).split('/').filter(Boolean);
  return parts[parts.length - 1] ?? target;
}
