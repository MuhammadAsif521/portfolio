import { describe, expect, it } from 'vitest';
import { JsonStore, findJsonError, lineColumn, toDotPath, toJsonPath, typeOf } from './json-logic';

const SAMPLE = JSON.stringify({
  name: 'Asif',
  tags: ['a', 'b', { deep: true }],
  nested: { 'odd key': 1, "it's": null, list: [] },
  n: 3.5,
});

describe('paths', () => {
  it('formats JSONPath', () => {
    expect(toJsonPath([])).toBe('$');
    expect(toJsonPath(['users', 0, 'name'])).toBe('$.users[0].name');
    expect(toJsonPath(['odd key', 'a.b'])).toBe("$['odd key']['a.b']");
    expect(toJsonPath(["it's"])).toBe("$['it\\'s']");
    expect(toJsonPath(['1abc'])).toBe("$['1abc']");
  });

  it('formats dot paths', () => {
    expect(toDotPath([])).toBe('');
    expect(toDotPath(['users', 0, 'name'])).toBe('users[0].name');
    expect(toDotPath([0, 'a'])).toBe('[0].a');
    expect(toDotPath(['odd key', 'x'])).toBe('["odd key"].x');
  });

  it('classifies values', () => {
    expect([null, [], {}, 'x', 1, true].map(typeOf)).toEqual(['null', 'array', 'object', 'string', 'number', 'boolean']);
  });
});

describe('findJsonError', () => {
  const at = (text: string) => findJsonError(text);

  it('returns null for valid JSON', () => {
    for (const ok of ['{}', '[]', '1', '"x"', 'null', ' {"a": [1, 2.5e3, -0.1, true, false, null, "\\u00e9\\n"]} ', '[[[]]]']) {
      expect(at(ok), ok).toBeNull();
    }
  });

  it('reports a trailing comma with line and column', () => {
    const e = at('{\n  "a": 1,\n}');
    expect(e).toMatchObject({ line: 3, column: 1 });
    expect(e?.message).toMatch(/Trailing comma/);
    expect(at('[1, 2,]')?.message).toMatch(/Trailing comma/);
  });

  it('reports single quotes, unquoted keys and missing commas or colons', () => {
    expect(at("{'a': 1}")?.message).toMatch(/single quotes/);
    expect(at('{a: 1}')?.message).toMatch(/double quotes/);
    expect(at('{"a" 1}')?.message).toMatch(/Expected ":"/);
    expect(at('{"a": 1 "b": 2}')).toMatchObject({ offset: 8, message: expect.stringMatching(/Expected ","/) });
  });

  it('reports truncated input, bad literals, bad numbers and bad strings', () => {
    expect(at('{"a": [1, 2')?.message).toMatch(/"\]" is missing/);
    expect(at('{"a": 1')?.message).toMatch(/"}" is missing/);
    expect(at('')?.message).toMatch(/Empty input/);
    expect(at('{"a": undefined}')?.message).toMatch(/expected a value/);
    expect(at('[01]')).toMatchObject({ offset: 2 });
    expect(at('["abc')?.message).toMatch(/not closed/);
    expect(at('["a\\qb"]')?.message).toMatch(/Invalid escape/);
    expect(at('["\\u12G4"]')?.message).toMatch(/four hexadecimal/);
    expect(at('["a\nb"]')?.message).toMatch(/line break/);
  });

  it('reports extra content after the value', () => {
    expect(at('{} x')).toMatchObject({ offset: 3 });
    expect(at('1 2')?.message).toMatch(/after the end/);
  });

  it('computes line and column', () => {
    expect(lineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
    expect(lineColumn('abc', 0)).toEqual({ line: 1, column: 1 });
  });
});

describe('JsonStore', () => {
  it('loads, reports the root and computes stats', () => {
    const store = new JsonStore();
    const r = store.load(SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rootType).toBe('object');
    expect(r.rootCount).toBe(4);
    expect(r.stats).toMatchObject({ depth: 3, objects: 3, arrays: 2, strings: 3, numbers: 2, booleans: 1, nulls: 1, nodes: 12, keys: 8 });
    expect(r.stats.bytes).toBe(new TextEncoder().encode(SAMPLE).length);
    expect(r.stats.longestArray).toEqual({ length: 3, path: '$.tags' });
  });

  it('returns a located error for invalid JSON', () => {
    const r = new JsonStore().load('{"a": 1,}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ line: 1, column: 9 });
  });

  it('pages through children of objects and arrays', () => {
    const store = new JsonStore();
    store.load(SAMPLE);
    const root = store.children([]);
    expect(root.total).toBe(4);
    expect(root.rows.map((r) => r.key)).toEqual(['name', 'tags', 'nested', 'n']);
    expect(root.rows[0]).toMatchObject({ type: 'string', preview: '"Asif"' });
    expect(root.rows[1]).toMatchObject({ type: 'array', count: 3, preview: '[ 3 items ]' });
    expect(root.rows[2]).toMatchObject({ type: 'object', count: 3, preview: '{ 3 keys }' });
    expect(store.children(['tags']).rows.map((r) => r.key)).toEqual([0, 1, 2]);
    expect(store.children(['tags', 2]).rows[0]).toMatchObject({ key: 'deep', type: 'boolean', preview: 'true' });
    expect(store.children(['nested', 'list']).total).toBe(0);
    expect(store.children(['missing'])).toEqual({ rows: [], total: 0 });
    expect(store.children([], 1, 2).rows.map((r) => r.key)).toEqual(['tags', 'nested']);
  });

  it('truncates long strings in previews', () => {
    const store = new JsonStore();
    store.load(JSON.stringify({ s: 'x'.repeat(500) }));
    const row = store.children([]).rows[0];
    expect(row.preview.length).toBeLessThan(200);
    expect(row.preview.endsWith('…"')).toBe(true);
  });

  it('handles a primitive root', () => {
    const store = new JsonStore();
    expect(store.load('42')).toMatchObject({ ok: true, rootType: 'number', rootCount: 0 });
    expect(store.rootRow()).toMatchObject({ key: '$', type: 'number', preview: '42' });
    expect(store.children([])).toEqual({ rows: [], total: 0 });
  });

  it('searches keys, values or both, with case control and a limit', () => {
    const store = new JsonStore();
    store.load(SAMPLE);
    expect(store.search('deep', 'keys', false).hits).toEqual([{ path: ['tags', 2, 'deep'], in: 'key' }]);
    expect(store.search('ASIF', 'values', false).hits).toEqual([{ path: ['name'], in: 'value' }]);
    expect(store.search('ASIF', 'values', true).hits).toEqual([]);
    expect(store.search('true', 'values', false).hits).toEqual([{ path: ['tags', 2, 'deep'], in: 'value' }]);
    expect(store.search('a', 'both', false).hits.length).toBeGreaterThan(3);
    const limited = store.search('a', 'both', false, 2);
    expect(limited.hits).toHaveLength(2);
    expect(limited.truncated).toBe(true);
    expect(store.search('', 'both', false)).toEqual({ hits: [], truncated: false });
  });

  it('stringifies a node and truncates huge ones', () => {
    const store = new JsonStore();
    store.load(SAMPLE);
    expect(store.stringify(['tags', 2])).toEqual({ text: '{\n  "deep": true\n}', truncated: false });
    expect(store.stringify(['tags'], 10)).toMatchObject({ truncated: true });
    expect(store.stringify(['missing']).text).toBe('');
  });

  it('copes with a 12 MB document quickly and pages 200 rows at a time', () => {
    const rows = Array.from({ length: 110_000 }, (_, i) => ({ id: i, name: `user-${i}`, email: `user${i}@example.com`, active: i % 2 === 0, score: i * 1.5, tags: ['a', 'b'] }));
    const text = JSON.stringify({ users: rows });
    expect(text.length).toBeGreaterThan(10_000_000);
    const store = new JsonStore();
    const start = performance.now();
    const r = store.load(text);
    expect(r.ok).toBe(true);
    const page = store.children(['users'], 0, 200);
    expect(page.total).toBe(110_000);
    expect(page.rows).toHaveLength(200);
    const hit = store.search('user109999@', 'values', false);
    expect(hit.hits).toEqual([{ path: ['users', 109999, 'email'], in: 'value' }]);
    expect(performance.now() - start).toBeLessThan(5000);
    if (r.ok) expect(r.stats.nodes).toBe(1 + 1 + 110_000 * 9);
  });

  it('survives deep nesting without overflowing the stack', () => {
    const depth = 3000;
    const store = new JsonStore();
    const r = store.load('['.repeat(depth) + ']'.repeat(depth));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stats.depth).toBe(depth - 1);
    expect(store.search('x', 'both', false).hits).toEqual([]);
  });
});
