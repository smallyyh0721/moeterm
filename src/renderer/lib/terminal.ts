import type { Terminal } from '@xterm/xterm';

export const TERM_FONT =
  '"Cascadia Mono", "Cascadia Code", Consolas, "Sarasa Mono SC", "Microsoft YaHei Mono", "Microsoft YaHei", monospace';

export const TERM_THEME = {
  background: '#050806',
  foreground: '#c8f5c4',
  cursor: '#e7ffbf',
  cursorAccent: '#050806',
  selectionBackground: '#1e5c32',
  selectionForeground: '#f3ffe8',
  black: '#1a1f1a',
  red: '#e07070',
  green: '#7dff9a',
  yellow: '#e4c07a',
  blue: '#7eb6ff',
  magenta: '#d7a0e4',
  cyan: '#7ee0d0',
  white: '#d5e6d4',
  brightBlack: '#5c6b5e',
  brightRed: '#ff9a90',
  brightGreen: '#b6ffbf',
  brightYellow: '#ffe0a0',
  brightBlue: '#b5d4ff',
  brightMagenta: '#f0c6ff',
  brightCyan: '#b8fff2',
  brightWhite: '#f4fff4',
};

export function bufferText(term: Terminal): string {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i += 1) {
    lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
