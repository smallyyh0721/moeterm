import fs from 'node:fs';
import path from 'node:path';
import type { ZipFile } from 'yauzl';
import { atlasLayout, isPetSlug, readImageSize } from '../shared/petdex';
import type { InstalledPet } from '../shared/types';

export type { InstalledPet };

interface ManifestPet {
  slug: string;
  displayName: string;
  spritesheetUrl: string;
  petJsonUrl: string;
}

const MANIFEST_URL = 'https://assets.petdex.dev/manifests/petdex-v1.json';

export class PetLibrary {
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  list(): InstalledPet[] {
    if (!fs.existsSync(this.root)) return [];
    const pets: InstalledPet[] = [];
    for (const name of fs.readdirSync(this.root)) {
      if (!isPetSlug(name)) continue;
      const pet = this.read(name);
      if (pet) pets.push(pet);
    }
    return pets.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }

  sheet(id: string): { mime: string; base64: string } {
    const pet = this.read(id);
    if (!pet) throw new Error('找不到这个宠物');
    const file = this.safeFile(id, pet.sheet);
    const buf = fs.readFileSync(file);
    return { mime: pet.sheet.endsWith('.png') ? 'image/png' : 'image/webp', base64: buf.toString('base64') };
  }

  async installSlug(slug: string, onProgress?: (ratio: number, label: string) => void): Promise<InstalledPet> {
    if (!isPetSlug(slug)) throw new Error('宠物名称只能用小写字母、数字和短横线');
    const report = onProgress ?? (() => undefined);
    const manifestBuf = await download(MANIFEST_URL, (loaded, total) => {
      report(0.2 * portion(loaded, total), '正在读取 Petdex 目录');
    });
    const manifest = JSON.parse(manifestBuf.toString('utf8')) as { pets?: ManifestPet[] };
    const found = manifest.pets?.find((item) => item.slug === slug);
    if (!found) throw new Error(`Petdex 里没有「${slug}」`);
    report(0.25, '正在读取宠物信息');
    const metaBuf = await download(found.petJsonUrl);
    const meta = JSON.parse(metaBuf.toString('utf8')) as { displayName?: string };
    report(0.3, '正在下载精灵图');
    const bytes = await download(found.spritesheetUrl, (loaded, total) => {
      report(0.3 + 0.65 * portion(loaded, total), '正在下载精灵图');
    });
    report(0.97, '正在保存');
    const ext = found.spritesheetUrl.toLowerCase().includes('.png') ? 'png' : 'webp';
    const pet = this.save(slug, meta.displayName || found.displayName || slug, ext, bytes);
    report(1, '安装完成');
    return pet;
  }

  async installPath(target: string): Promise<InstalledPet> {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) return this.installDirectory(target);
    if (target.toLowerCase().endsWith('.json')) return this.installDirectory(path.dirname(target));
    if (target.toLowerCase().endsWith('.zip')) return this.installZip(target);
    throw new Error('请选择 Petdex 的 zip、pet.json，或它所在的文件夹');
  }

  private installDirectory(dir: string): InstalledPet {
    const jsonPath = firstExisting(dir, ['pet.json', 'petjson.json']);
    if (!jsonPath) throw new Error('这个目录里没有 pet.json');
    const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as { id?: string; displayName?: string };
    const sheetPath = firstExisting(dir, ['spritesheet.webp', 'sprite.webp', 'spritesheet.png', 'sprite.png']);
    if (!sheetPath) throw new Error('这个目录里没有精灵图');
    const id = isPetSlug(meta.id ?? '') ? meta.id! : path.basename(dir);
    if (!isPetSlug(id)) throw new Error('pet.json 里的 id 不合法');
    const ext = sheetPath.endsWith('.png') ? 'png' : 'webp';
    return this.save(id, meta.displayName || id, ext, fs.readFileSync(sheetPath));
  }

  private async installZip(file: string): Promise<InstalledPet> {
    const entries = await readZip(file);
    let jsonName = '';
    for (const name of entries.keys()) {
      if (name.endsWith('/')) continue;
      const base = path.posix.basename(name);
      if ((base === 'pet.json' || base === 'petjson.json') && (jsonName === '' || name.length < jsonName.length)) jsonName = name;
    }
    if (!jsonName) throw new Error('压缩包里没有 pet.json');
    const meta = JSON.parse(entries.get(jsonName)!.toString('utf8')) as { id?: string; displayName?: string };
    const folder = path.posix.dirname(jsonName);
    const prefix = folder === '.' ? '' : `${folder}/`;
    const sheet = firstBuffer(entries, prefix, ['spritesheet.webp', 'sprite.webp', 'spritesheet.png', 'sprite.png']);
    if (!sheet) throw new Error('压缩包里没有精灵图');
    const id = isPetSlug(meta.id ?? '') ? meta.id! : 'pet';
    if (!isPetSlug(id)) throw new Error('pet.json 里的 id 不合法');
    return this.save(id, meta.displayName || id, sheet.ext, sheet.bytes);
  }

  private save(id: string, name: string, ext: 'png' | 'webp', bytes: Buffer): InstalledPet {
    if (!isPetSlug(id)) throw new Error('宠物编号不合法');
    if (bytes.length > 8 * 1024 * 1024) throw new Error('精灵图太大');
    const size = readImageSize(bytes);
    if (!size) throw new Error('认不出这张精灵图，请使用 PNG 或 WebP');
    const layout = atlasLayout(size.width, size.height);
    if (!layout) throw new Error('这不是 Petdex 的 8×9 或 8×11 精灵图');
    const dir = this.safeDir(id);
    fs.mkdirSync(dir, { recursive: true });
    const sheet = ext === 'png' ? 'spritesheet.png' : 'spritesheet.webp';
    fs.writeFileSync(path.join(dir, sheet), bytes);
    const other = ext === 'png' ? 'spritesheet.webp' : 'spritesheet.png';
    fs.rmSync(path.join(dir, other), { force: true });
    const pet: InstalledPet = {
      id,
      name: name.trim().slice(0, 40) || id,
      rows: layout.rows,
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
      sheet,
    };
    fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify(pet, null, 2), 'utf8');
    return pet;
  }

  private read(id: string): InstalledPet | null {
    if (!isPetSlug(id)) return null;
    const file = path.join(this.safeDir(id), 'pet.json');
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as InstalledPet;
    if (!parsed || parsed.sheet !== 'spritesheet.png' && parsed.sheet !== 'spritesheet.webp') return null;
    if (!fs.existsSync(path.join(this.safeDir(id), parsed.sheet))) return null;
    return { ...parsed, id };
  }

  private safeDir(id: string): string {
    if (!isPetSlug(id)) throw new Error('宠物编号不合法');
    const dir = path.resolve(this.root, id);
    const root = path.resolve(this.root);
    if (dir !== root && !dir.startsWith(root + path.sep)) throw new Error('宠物路径无效');
    return dir;
  }

  private safeFile(id: string, sheet: string): string {
    if (sheet !== 'spritesheet.png' && sheet !== 'spritesheet.webp') throw new Error('精灵图无效');
    return path.join(this.safeDir(id), sheet);
  }
}

function firstExisting(dir: string, names: string[]): string {
  for (const name of names) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return file;
  }
  return '';
}

function firstBuffer(
  entries: Map<string, Buffer>,
  prefix: string,
  names: string[],
): { ext: 'png' | 'webp'; bytes: Buffer } | null {
  for (const name of names) {
    const bytes = entries.get(`${prefix}${name}`);
    if (bytes) return { ext: name.endsWith('.png') ? 'png' : 'webp', bytes };
  }
  return null;
}

async function download(url: string, onChunk?: (loaded: number, total: number) => void): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('宠物文件下载失败');
  const total = Number(response.headers.get('content-length') || 0);
  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    onChunk?.(bytes.length, bytes.length || 1);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onChunk?.(loaded, total);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function portion(loaded: number, total: number): number {
  if (total > 0) return Math.min(1, loaded / total);
  return Math.min(0.95, loaded / (2 * 1024 * 1024));
}

async function readZip(file: string): Promise<Map<string, Buffer>> {
  const { default: yauzl } = await import('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error: Error | null, zip?: ZipFile) => {
      if (error || !zip) {
        reject(error ?? new Error('无法打开压缩包'));
        return;
      }
      const files = new Map<string, Buffer>();
      zip.on('error', reject);
      zip.on('end', () => resolve(files));
      zip.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error('无法读取压缩包'));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            files.set(entry.fileName.replace(/\\/g, '/'), Buffer.concat(chunks));
            zip.readEntry();
          });
          stream.on('error', reject);
        });
      });
      zip.readEntry();
    });
  });
}
