export type SplitLayout = 'single' | 'columns' | 'stack3' | 'grid4';

export function splitCapacity(layout: SplitLayout): number {
  if (layout === 'columns') return 2;
  if (layout === 'stack3') return 3;
  if (layout === 'grid4') return 4;
  return 1;
}

export function seedSlots(layout: SplitLayout, tabIds: string[], activeId: string | null): string[] {
  const cap = splitCapacity(layout);
  if (cap <= 1) return [];
  const picked: string[] = [];
  if (activeId && tabIds.includes(activeId)) picked.push(activeId);
  for (const id of tabIds) {
    if (picked.length >= cap) break;
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

export function placeNewTab(slots: string[], localId: string, layout: SplitLayout): string[] {
  if (splitCapacity(layout) <= 1 || slots.includes(localId) || slots.length >= splitCapacity(layout)) return slots;
  return [...slots, localId];
}

export function closeSlot(slots: string[], localId: string): string[] {
  return slots.filter((id) => id !== localId);
}

export function focusTab(slots: string[], localId: string, layout: SplitLayout, activeId: string | null): string[] {
  const cap = splitCapacity(layout);
  if (cap <= 1 || slots.includes(localId)) return slots;
  if (slots.length < cap) return [...slots, localId];
  const index = Math.max(0, slots.indexOf(activeId ?? ''));
  const next = [...slots];
  next[index] = localId;
  return next;
}

export function paneGridArea(index: number, count: number): { gridColumn: string; gridRow: string } {
  if (count === 3 && index === 0) return { gridColumn: '1', gridRow: '1 / span 2' };
  if (count === 3 && index === 1) return { gridColumn: '2', gridRow: '1' };
  if (count === 3 && index === 2) return { gridColumn: '2', gridRow: '2' };
  if (count >= 4) {
    return { gridColumn: index % 2 === 0 ? '1' : '2', gridRow: index < 2 ? '1' : '2' };
  }
  if (count === 2) return { gridColumn: index === 0 ? '1' : '2', gridRow: '1' };
  return { gridColumn: '1', gridRow: '1' };
}
