import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertMovable, copyData, hasSavedData, readDataDirChoice, writeDataDirChoice } from '../src/core/data-dir';

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitty-data-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('数据目录', () => {
  it('拒绝当前目录、其子目录和它的上级', () => {
    expect(() => assertMovable('D:\\app\\data', 'D:\\app\\data')).toThrow('已经是这个目录');
    expect(() => assertMovable('D:\\app\\data', 'D:\\app\\data\\logs')).toThrow('里面');
    expect(() => assertMovable('D:\\app\\data', 'D:\\app')).toThrow('包含');
    expect(() => assertMovable('D:\\app\\data', 'E:\\keep')).not.toThrow();
  });

  it('只复制连接、密钥、日志、宠物和设置', () => {
    const from = tempDir();
    const to = tempDir();
    fs.writeFileSync(path.join(from, 'tree.json'), '{"ok":true}');
    fs.mkdirSync(path.join(from, 'pets'));
    fs.writeFileSync(path.join(from, 'pets', 'boba.txt'), 'pet');
    fs.writeFileSync(path.join(from, 'location.json'), '{"dataDir":"x"}');
    copyData(from, to);
    expect(hasSavedData(to)).toBe(true);
    expect(fs.readFileSync(path.join(to, 'pets', 'boba.txt'), 'utf8')).toBe('pet');
    expect(fs.existsSync(path.join(to, 'location.json'))).toBe(false);
  });

  it('记住用户改过的目录', () => {
    const root = tempDir();
    const pointer = path.join(root, 'location.json');
    writeDataDirChoice(pointer, path.join(root, 'chosen'));
    expect(readDataDirChoice(pointer)).toBe(path.resolve(root, 'chosen'));
    expect(readDataDirChoice(path.join(root, 'missing.json'))).toBeNull();
  });
});