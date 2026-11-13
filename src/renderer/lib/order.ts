export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Index the pointer wants, using each tab's horizontal midpoint. */
export function dropIndex(from: number, clientX: number, rects: readonly { left: number; width: number }[]): number {
  let to = from;
  for (let i = 0; i < rects.length; i += 1) {
    const mid = rects[i].left + rects[i].width / 2;
    if (i < from && clientX < mid) return i;
    if (i > from && clientX > mid) to = i;
  }
  return to;
}
