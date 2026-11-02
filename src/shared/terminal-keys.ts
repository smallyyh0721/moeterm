export function failureKeyAction(status: string, key: string, shortcut: boolean): 'retry' | 'close' | null {
  if (shortcut) return null;
  if (status === 'error' && key.toLowerCase() === 'r') return 'retry';
  if ((status === 'error' || status === 'closed') && key === 'Enter') return 'close';
  return null;
}
