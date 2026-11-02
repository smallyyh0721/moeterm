import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateThemeFile } from '../src/themes/validate';

const packs = path.join(process.cwd(), 'src/themes/packs');
const portraitNames = ['portrait.png', 'portrait.jpg', 'portrait.jpeg', 'portrait.webp'];

describe('主题包', () => {
  const folders = fs.readdirSync(packs).filter((name) => fs.statSync(path.join(packs, name)).isDirectory());

  it('至少有古典绿、橙黑和暖棕', () => {
    expect(folders).toEqual(expect.arrayContaining(['classic', 'orange', 'warm']));
  });

  it('每个目录都是合法主题，画像最多一张', () => {
    expect(folders.length).toBeGreaterThan(0);
    for (const folder of folders) {
      const dir = path.join(packs, folder);
      const raw = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')) as unknown;
      expect(validateThemeFile(raw, folder)).toEqual([]);
      const portraits = portraitNames.filter((name) => fs.existsSync(path.join(dir, name)));
      expect(portraits.length).toBeLessThanOrEqual(1);
    }
  });

  it('暖棕带狗头画像，橙黑带角色画像，古典绿没有画像', () => {
    expect(fs.existsSync(path.join(packs, 'warm', 'portrait.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(packs, 'orange', 'portrait.jpg'))).toBe(true);
    const classicPortraits = portraitNames.filter((name) => fs.existsSync(path.join(packs, 'classic', name)));
    expect(classicPortraits).toEqual([]);
  });

  it('拒绝和目录名不一致的 id', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(packs, 'classic', 'theme.json'), 'utf8')) as { id: string };
    raw.id = 'other';
    expect(validateThemeFile(raw, 'classic').some((item) => item.includes('目录名'))).toBe(true);
  });
});
