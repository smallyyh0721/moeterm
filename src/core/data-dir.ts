import fs from 'node:fs';
import path from 'node:path';

const DATA_NAMES = ['tree.json', 'secrets.json', 'known_hosts.json', 'settings.json', 'keys', 'logs', 'pets'] as const;

export function samePath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  if (rel === '') return false;
  const probe = process.platform === 'win32' ? rel.toLowerCase() : rel;
  return probe !== '' && !probe.startsWith('..') && !path.isAbsolute(rel);
}

export function assertMovable(current: string, target: string): void {
  if (samePath(current, target)) throw new Error('已经是这个目录');
  if (isInside(current, target)) throw new Error('不能改到当前数据目录里面');
  if (isInside(target, current)) throw new Error('不能改到包含当前数据目录的位置');
}

export function hasSavedData(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'tree.json'));
}

export function copyData(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const name of DATA_NAMES) {
    const source = path.join(from, name);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(to, name), { recursive: true });
  }
}

export function readDataDirChoice(pointer: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(pointer, 'utf8')) as { dataDir?: unknown };
    if (typeof parsed.dataDir !== 'string' || !parsed.dataDir.trim()) return null;
    return path.resolve(parsed.dataDir);
  } catch {
    return null;
  }
}

export function writeDataDirChoice(pointer: string, dataDir: string): void {
  fs.mkdirSync(path.dirname(pointer), { recursive: true });
  const tmp = `${pointer}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ dataDir: path.resolve(dataDir) }, null, 2), 'utf8');
  fs.renameSync(tmp, pointer);
}
