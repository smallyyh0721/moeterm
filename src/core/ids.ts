import { randomUUID } from 'node:crypto';

export function createId(prefix: 'c' | 'f' | 'k' | 's'): string {
  return `${prefix}_${randomUUID()}`;
}

export function assertSafeId(id: string): void {
  if (!/^[a-z]_[0-9a-f-]{36}$/i.test(id)) {
    throw new Error('编号无效');
  }
}
