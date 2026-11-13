import { describe, expect, it } from 'vitest';
import { dropIndex, reorder } from '../src/renderer/lib/order';

describe('标签顺序', () => {
  it('把一项插到新位置', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorder(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('指针越过中线才换位', () => {
    const rects = [
      { left: 0, width: 100 },
      { left: 100, width: 100 },
      { left: 200, width: 100 },
    ];
    expect(dropIndex(0, 40, rects)).toBe(0);
    expect(dropIndex(0, 160, rects)).toBe(1);
    expect(dropIndex(2, 40, rects)).toBe(0);
    expect(dropIndex(2, 160, rects)).toBe(2);
    expect(dropIndex(2, 140, rects)).toBe(1);
  });
});
