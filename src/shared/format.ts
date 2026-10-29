const S_IFMT = 0o170000;
const S_IFDIR = 0o040000;
const S_IFLNK = 0o120000;

export function isDirMode(mode: number): boolean {
  return (mode & S_IFMT) === S_IFDIR;
}

export function isLinkMode(mode: number): boolean {
  return (mode & S_IFMT) === S_IFLNK;
}

export function formatMode(mode: number): string {
  const type = isDirMode(mode) ? 'd' : isLinkMode(mode) ? 'l' : '-';
  const flags = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  const chars = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x'];
  let text = type;
  for (let i = 0; i < flags.length; i += 1) {
    text += mode & flags[i] ? chars[i] : '-';
  }
  return text;
}

export function formatSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '-';
  if (size < 1024) return `${Math.floor(size)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatMtime(seconds: number): string {
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function fileStamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim();
  return cleaned.slice(0, 80) || 'session';
}
