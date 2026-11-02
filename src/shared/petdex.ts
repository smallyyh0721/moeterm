export interface AtlasLayout {
  columns: 8;
  rows: 9 | 11;
  frameWidth: number;
  frameHeight: number;
}

export interface SpriteAnimation {
  row: number;
  durations: number[];
}

export const PETDEX_ANIMATIONS = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  'running-right': { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  'running-left': { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, durations: [140, 140, 140, 280] },
  jumping: { row: 4, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, durations: [150, 150, 150, 150, 150, 280] },
} as const satisfies Record<string, SpriteAnimation>;

export type PetdexAnimation = keyof typeof PETDEX_ANIMATIONS;

const V1_RATIO = 1872 / 1536;
const V2_RATIO = 2288 / 1536;

export function atlasLayout(width: number, height: number): AtlasLayout | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || width % 8 !== 0) return null;
  const ratio = height / width;
  const rows: 9 | 11 = Math.abs(ratio - V2_RATIO) < Math.abs(ratio - V1_RATIO) ? 11 : 9;
  const expected = rows === 11 ? V2_RATIO : V1_RATIO;
  if (Math.abs(ratio - expected) > 0.02) return null;
  if (height % rows !== 0) return null;
  return { columns: 8, rows, frameWidth: width / 8, frameHeight: height / rows };
}

export function frameIndex(durations: number[], elapsedMs: number): number {
  const total = durations.reduce((sum, item) => sum + item, 0);
  if (total <= 0) return 0;
  let time = ((elapsedMs % total) + total) % total;
  for (let index = 0; index < durations.length; index += 1) {
    if (time < durations[index]) return index;
    time -= durations[index];
  }
  return 0;
}

export function isPetSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

export function readImageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length < 16 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const type = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && data + 10 <= buf.length) {
      return { width: 1 + buf.readUIntLE(data + 4, 3), height: 1 + buf.readUIntLE(data + 7, 3) };
    }
    if (type === 'VP8L' && data + 5 <= buf.length && buf[data] === 0x2f) {
      const bits = buf.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8 ' && data + 10 <= buf.length) {
      return { width: buf.readUInt16LE(data + 6) & 0x3fff, height: buf.readUInt16LE(data + 8) & 0x3fff };
    }
    if (size > buf.length) return null;
    offset += 8 + size + (size & 1);
  }
  return null;
}
