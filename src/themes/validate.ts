export const themeColorKeys = [
  'bg',
  'bgElev',
  'bgInset',
  'side',
  'titleA',
  'titleB',
  'stage',
  'terminal',
  'accent',
  'accentDim',
  'amber',
  'text',
  'muted',
  'line',
  'bevelLight',
  'bevelDark',
  'card',
  'bubble',
  'bubbleInk',
  'ok',
  'danger',
  'inputBorder',
  'selected',
  'hover',
  'btnTop',
  'btnBottom',
  'btnInset',
] as const;

export type ThemeColorKey = (typeof themeColorKeys)[number];
export const themeButtons = ['bevel', 'flat', 'round'] as const;
export type ThemeButton = (typeof themeButtons)[number];

export interface ThemeFile {
  id: string;
  name: string;
  button: ThemeButton;
  radius: number;
  glow: string;
  colors: Record<ThemeColorKey, string>;
}

const slug = /^[a-z][a-z0-9-]{0,31}$/;
const color =
  /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/;

export function isThemeSlug(value: unknown): value is string {
  return typeof value === 'string' && slug.test(value);
}

export function validateThemeFile(value: unknown, folder: string): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['theme.json 必须是对象'];
  const body = value as Record<string, unknown>;
  const allowed = new Set(['id', 'name', 'button', 'radius', 'glow', 'colors']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) errors.push(`不能有多余字段 ${key}`);
  }
  if (body.id !== folder) errors.push(`id 必须和目录名相同，当前目录是 ${folder}`);
  if (!isThemeSlug(body.id)) errors.push('id 只能用小写字母、数字和短横线，并且以字母开头');
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 16) {
    errors.push('name 用 1 到 16 个字');
  }
  if (!(themeButtons as readonly string[]).includes(String(body.button))) errors.push('button 只能是 bevel、flat 或 round');
  if (typeof body.radius !== 'number' || !Number.isInteger(body.radius) || body.radius < 0 || body.radius > 16) {
    errors.push('radius 是 0 到 16 的整数');
  }
  if (typeof body.glow !== 'string' || !color.test(body.glow)) errors.push('glow 必须是 #RRGGBB 或 rgb/rgba');
  if (!body.colors || typeof body.colors !== 'object' || Array.isArray(body.colors)) {
    errors.push('colors 必须是对象');
    return errors;
  }
  const colors = body.colors as Record<string, unknown>;
  for (const key of Object.keys(colors)) {
    if (!(themeColorKeys as readonly string[]).includes(key)) errors.push(`colors 不能有多余字段 ${key}`);
  }
  for (const key of themeColorKeys) {
    const item = colors[key];
    if (typeof item !== 'string' || !color.test(item)) errors.push(`colors.${key} 必须是 #RRGGBB 或 rgb/rgba`);
  }
  return errors;
}
