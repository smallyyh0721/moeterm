import { describe, expect, it } from 'vitest';
import { closeSlot, focusTab, paneGridArea, placeNewTab, seedSlots, splitCapacity } from '../src/renderer/lib/split';

describe('分屏', () => {
  it('默认单屏，最多四格', () => {
    expect(splitCapacity('single')).toBe(1);
    expect(splitCapacity('columns')).toBe(2);
    expect(splitCapacity('stack3')).toBe(3);
    expect(splitCapacity('grid4')).toBe(4);
    expect(seedSlots('single', ['a', 'b'], 'a')).toEqual([]);
  });

  it('打开分屏时当前终端排在第一格，多出来的只留在标签上', () => {
    expect(seedSlots('grid4', ['a', 'b', 'c', 'd', 'e'], 'c')).toEqual(['c', 'a', 'b', 'd']);
    expect(seedSlots('columns', ['a', 'b', 'c'], 'a')).toEqual(['a', 'b']);
  });

  it('有空格才放进新终端，关掉后格子收拢', () => {
    expect(placeNewTab(['a'], 'b', 'columns')).toEqual(['a', 'b']);
    expect(placeNewTab(['a', 'b'], 'c', 'columns')).toEqual(['a', 'b']);
    expect(placeNewTab(['a'], 'b', 'single')).toEqual(['a']);
    expect(closeSlot(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('点不在格子里的标签时，换进当前格', () => {
    expect(focusTab(['a', 'b'], 'c', 'columns', 'b')).toEqual(['a', 'c']);
    expect(focusTab(['a'], 'c', 'grid4', 'a')).toEqual(['a', 'c']);
  });

  it('三格时左边占满两行', () => {
    expect(paneGridArea(0, 3)).toEqual({ gridColumn: '1', gridRow: '1 / span 2' });
    expect(paneGridArea(2, 3)).toEqual({ gridColumn: '2', gridRow: '2' });
    expect(paneGridArea(3, 4)).toEqual({ gridColumn: '2', gridRow: '2' });
  });
});