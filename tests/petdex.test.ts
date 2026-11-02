import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PetLibrary } from '../src/core/pets';
import { atlasLayout, frameIndex, isPetSlug, readImageSize } from '../src/shared/petdex';

describe('Petdex 精灵图', () => {
  it('识别 8×9 和 8×11，以及按比例放大的图', () => {
    expect(atlasLayout(1536, 1872)).toMatchObject({ rows: 9, frameWidth: 192, frameHeight: 208 });
    expect(atlasLayout(1536, 2288)).toMatchObject({ rows: 11, frameWidth: 192, frameHeight: 208 });
    expect(atlasLayout(3072, 3744)).toMatchObject({ rows: 9, frameWidth: 384, frameHeight: 416 });
    expect(atlasLayout(100, 100)).toBeNull();
  });

  it('按每帧时长循环', () => {
    expect(frameIndex([100, 50], 0)).toBe(0);
    expect(frameIndex([100, 50], 100)).toBe(1);
    expect(frameIndex([100, 50], 150)).toBe(0);
  });

  it('只接受合法的宠物编号', () => {
    expect(isPetSlug('boba')).toBe(true);
    expect(isPetSlug('lulu-capybara-2')).toBe(true);
    expect(isPetSlug('../boba')).toBe(false);
    expect(isPetSlug('Boba')).toBe(false);
  });

  it('从 PNG 和 Petdex 的无损 WebP 头读出尺寸', () => {
    const png = Buffer.alloc(24);
    png[0] = 0x89;
    png.write('PNG', 1, 'ascii');
    png.writeUInt32BE(1536, 16);
    png.writeUInt32BE(1872, 20);
    expect(readImageSize(png)).toEqual({ width: 1536, height: 1872 });
    const boba = Buffer.from('52494646B43E2500574542505650384CA83E25002FFF C53B12'.replace(/ /g, ''), 'hex');
    const lulu = Buffer.from('524946462C391700574542505650384C1F3917002FFFC5D311', 'hex');
    expect(readImageSize(boba)).toEqual({ width: 1536, height: 2288 });
    expect(readImageSize(lulu)).toEqual({ width: 1536, height: 1872 });
  });
});

describe('安装本地 Petdex 目录', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('复制 pet.json 和精灵图，并拒绝不合法的图', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moeterm-pets-'));
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'moeterm-pet-src-'));
    dirs.push(root, source);
    fs.writeFileSync(path.join(source, 'pet.json'), JSON.stringify({ id: 'tiny-otters', displayName: '小水獭' }));
    fs.writeFileSync(path.join(source, 'spritesheet.png'), png(1536, 1872));
    const library = new PetLibrary(root);
    const saved = await library.installPath(source);
    expect(saved.id).toBe('tiny-otters');
    expect(saved.name).toBe('小水獭');
    expect(saved.rows).toBe(9);
    expect(library.list().map((item) => item.id)).toEqual(['tiny-otters']);
    expect(library.sheet('tiny-otters').mime).toBe('image/png');
  });
});

function png(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ~crc;
}
