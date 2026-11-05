import type { JsonPath, JsonRow, JsonType } from './json-logic';

export const pathKey = (path: JsonPath): string => JSON.stringify(path);

export interface ChildPage {
  rows: JsonRow[];
  total: number;
}

export interface FlatNode {
  kind: 'node';
  id: string;
  path: JsonPath;
  key: string | number;
  type: JsonType;
  preview: string;
  count: number;
  depth: number;
  isContainer: boolean;
  expanded: boolean;
}

export interface FlatMore {
  kind: 'more';
  id: string;
  path: JsonPath;
  depth: number;
  remaining: number;
}

export type FlatItem = FlatNode | FlatMore;

/**
 * Turns the expanded set and the loaded pages into the visible, flat list of rows. Iterative (no recursion) so a
 * deeply nested document cannot overflow the stack.
 */
export function flatten(root: JsonRow, expanded: ReadonlySet<string>, cache: ReadonlyMap<string, ChildPage>): FlatItem[] {
  const out: FlatItem[] = [];
  type Work = { kind: 'node'; path: JsonPath; row: JsonRow; depth: number } | { kind: 'more'; path: JsonPath; depth: number; remaining: number };
  const stack: Work[] = [{ kind: 'node', path: [], row: root, depth: 0 }];
  while (stack.length) {
    const work = stack.pop()!;
    const id = pathKey(work.path);
    if (work.kind === 'more') {
      out.push({ kind: 'more', id: `${id}#more`, path: work.path, depth: work.depth, remaining: work.remaining });
      continue;
    }
    const { row, path, depth } = work;
    const isContainer = row.type === 'object' || row.type === 'array';
    const isOpen = isContainer && row.count > 0 && expanded.has(id);
    out.push({ kind: 'node', id, path, key: row.key, type: row.type, preview: row.preview, count: row.count, depth, isContainer: isContainer && row.count > 0, expanded: isOpen });
    const page = isOpen ? cache.get(id) : undefined;
    if (!page) continue;
    if (page.total > page.rows.length) stack.push({ kind: 'more', path, depth: depth + 1, remaining: page.total - page.rows.length });
    for (let i = page.rows.length - 1; i >= 0; i--) {
      const child = page.rows[i];
      stack.push({ kind: 'node', path: [...path, child.key], row: child, depth: depth + 1 });
    }
  }
  return out;
}

/** Ids of every ancestor of a path, root first (the path itself is not included). */
export function ancestorPaths(path: JsonPath): JsonPath[] {
  return Array.from({ length: path.length }, (_, i) => path.slice(0, i));
}

/** The rows to render for a scroll position: a window of `visible` rows plus `overscan` rows either side. */
export function windowRange(scrollTop: number, rowHeight: number, viewportHeight: number, total: number, overscan = 8): { start: number; end: number } {
  const first = Math.floor(scrollTop / rowHeight);
  const count = Math.ceil(viewportHeight / rowHeight);
  return { start: Math.max(0, first - overscan), end: Math.min(total, first + count + overscan) };
}
