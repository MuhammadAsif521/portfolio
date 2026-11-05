import { describe, expect, it } from 'vitest';
import { JsonStore, type JsonRow } from './json-logic';
import { ancestorPaths, flatten, pathKey, windowRange, type ChildPage } from './json-tree';

function setup(json: unknown) {
  const store = new JsonStore();
  store.load(JSON.stringify(json));
  const cache = new Map<string, ChildPage>();
  const expanded = new Set<string>();
  const open = (path: (string | number)[], limit = 200) => {
    cache.set(pathKey(path), store.children(path, 0, limit));
    expanded.add(pathKey(path));
  };
  return { store, cache, expanded, open, root: store.rootRow() as JsonRow };
}

describe('flatten', () => {
  it('shows only the root when nothing is expanded', () => {
    const { root, expanded, cache } = setup({ a: 1 });
    const flat = flatten(root, expanded, cache);
    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({ kind: 'node', depth: 0, isContainer: true, expanded: false });
  });

  it('lists children in document order with depth, and nested expansion', () => {
    const { root, expanded, cache, open } = setup({ a: 1, list: [10, { x: true }], z: 'end' });
    open([]);
    open(['list']);
    const flat = flatten(root, expanded, cache);
    expect(flat.map((i) => (i.kind === 'node' ? `${i.depth}:${i.key}` : 'more'))).toEqual(['0:$', '1:a', '1:list', '2:0', '2:1', '1:z']);
    const list = flat[2];
    expect(list).toMatchObject({ kind: 'node', type: 'array', expanded: true, isContainer: true });
    expect(flat[4]).toMatchObject({ type: 'object', expanded: false });
  });

  it('adds a "more" row after a partial page', () => {
    const { root, expanded, cache, open } = setup({ items: Array.from({ length: 5 }, (_, i) => i) });
    open([]);
    open(['items'], 2);
    const flat = flatten(root, expanded, cache);
    const more = flat.find((i) => i.kind === 'more');
    expect(more).toMatchObject({ kind: 'more', remaining: 3, depth: 2 });
    expect(flat[flat.length - 1].kind).toBe('more');
  });

  it('treats empty containers and primitives as leaves', () => {
    const { root, expanded, cache, open } = setup({ e: [], o: {}, n: 1 });
    open([]);
    const nodes = flatten(root, expanded, cache).filter((i) => i.kind === 'node');
    expect(nodes.slice(1).map((n) => n.kind === 'node' && n.isContainer)).toEqual([false, false, false]);
  });

  it('copes with very deep expansion without recursion', () => {
    const depth = 2000;
    const json = JSON.parse('['.repeat(depth) + ']'.repeat(depth));
    const { root, expanded, cache, open } = setup(json);
    const path: number[] = [];
    open(path);
    for (let i = 0; i < depth - 1; i++) {
      path.push(0);
      open([...path]);
    }
    expect(flatten(root, expanded, cache).length).toBe(depth);
  });
});

describe('path and window helpers', () => {
  it('lists ancestors root first', () => {
    expect(ancestorPaths(['a', 0, 'b'])).toEqual([[], ['a'], ['a', 0]]);
    expect(ancestorPaths([])).toEqual([]);
  });

  it('computes the rendered window with overscan', () => {
    expect(windowRange(0, 28, 448, 1000)).toEqual({ start: 0, end: 24 });
    expect(windowRange(2800, 28, 448, 1000)).toEqual({ start: 92, end: 124 });
    expect(windowRange(0, 28, 448, 5)).toEqual({ start: 0, end: 5 });
    expect(windowRange(1e9, 28, 448, 100).start).toBeGreaterThanOrEqual(0);
  });
});
