/// <reference types="vite/client" />
import { themeColorKeys, validateThemeFile, type ThemeFile } from './validate';

const jsonModules = import.meta.glob('./packs/*/theme.json', { eager: true, import: 'default' }) as Record<string, ThemeFile>;
const portraitModules = import.meta.glob('./packs/*/portrait.{png,jpg,jpeg,webp}') as Record<
  string,
  () => Promise<{ default: string }>
>;

export interface ThemePack {
  file: ThemeFile;
  loadPortrait: () => Promise<string | null>;
}

function folderOf(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 2] ?? '';
}

function loadThemes(): ThemePack[] {
  const portraits = new Map<string, () => Promise<{ default: string }>>();
  for (const [filePath, load] of Object.entries(portraitModules)) portraits.set(folderOf(filePath), load);
  const packs: ThemePack[] = [];
  for (const [filePath, file] of Object.entries(jsonModules)) {
    const folder = folderOf(filePath);
    const errors = validateThemeFile(file, folder);
    if (errors.length > 0) {
      console.error(`主题 ${folder} 无效：${errors.join('；')}`);
      continue;
    }
    const load = portraits.get(folder);
    packs.push({
      file,
      loadPortrait: load ? () => load().then((mod) => mod.default) : () => Promise.resolve(null),
    });
  }
  packs.sort((a, b) => a.file.id.localeCompare(b.file.id));
  return packs;
}

export const themes = loadThemes();

export function themeById(id: string | undefined): ThemePack {
  const found = themes.find((item) => item.file.id === id);
  if (found) return found;
  const classic = themes.find((item) => item.file.id === 'classic');
  if (classic) return classic;
  if (themes[0]) return themes[0];
  throw new Error('没有可用的界面主题');
}

export function applyTheme(pack: ThemePack): void {
  const root = document.documentElement;
  const file = pack.file;
  root.dataset.theme = file.id;
  root.dataset.button = file.button;
  root.style.setProperty('--radius', `${file.radius}px`);
  root.style.setProperty('--glow', file.glow);
  for (const key of themeColorKeys) {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, file.colors[key]);
  }
  root.style.setProperty('--phosphor', file.colors.accent);
  root.style.setProperty('--phosphor-dim', file.colors.accentDim);
}
