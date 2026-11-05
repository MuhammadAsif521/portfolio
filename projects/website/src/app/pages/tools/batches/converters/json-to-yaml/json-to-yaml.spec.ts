import { describe, expect, it } from 'vitest';
import { convertJsonToYaml, DEFAULT_JSON_TO_YAML, type JsonToYamlOptions } from './json-to-yaml.logic';

const run = (json: string, over: Partial<JsonToYamlOptions> = {}) => convertJsonToYaml(json, { ...DEFAULT_JSON_TO_YAML, ...over });

async function yaml(json: string, over: Partial<JsonToYamlOptions> = {}): Promise<string> {
  const r = await run(json, over);
  if (!r.ok) throw new Error(r.error.message);
  return r.output;
}

describe('json to yaml', () => {
  it('writes mappings, lists and scalars', async () => {
    expect(await yaml('{"name":"Asif","tags":["a","b"],"none":null,"ok":true,"pi":3.14}')).toBe('name: Asif\ntags:\n  - a\n  - b\nnone: null\nok: true\npi: 3.14\n');
  });

  it('honours the indent', async () => {
    expect(await yaml('{"a":{"b":1}}', { indent: 4 })).toBe('a:\n    b: 1\n');
    expect(await yaml('{"a":{"b":{"c":1}}}', { indent: 6 })).toBe('a:\n      b:\n            c: 1\n');
  });

  it('can write list items flush with their key', async () => {
    expect(await yaml('{"a":[1,2]}', { flushLists: true })).toBe('a:\n- 1\n- 2\n');
  });

  it('quotes strings that would otherwise change type', async () => {
    const out = await yaml('{"a":"yes","b":"123","c":"null","d":"2001-01-01","e":"a: b","f":""}');
    expect(out).toContain("a: 'yes'");
    expect(out).toContain("b: '123'");
    expect(out).toContain("c: 'null'");
    expect(out).toContain("d: '2001-01-01'");
    expect(out).toContain("e: 'a: b'");
    expect(out).toContain("f: ''");
  });

  it('supports quoting styles', async () => {
    expect(await yaml('{"a":"x"}', { quoting: 'all-single' })).toBe("a: 'x'\n");
    expect(await yaml('{"a":"x"}', { quoting: 'all-double' })).toBe('a: "x"\n');
    expect(await yaml('{"a":"yes"}', { quoting: 'minimal-double' })).toBe('a: "yes"\n');
  });

  it('folds long text at the line width, or not at all', async () => {
    const long = 'word '.repeat(30).trim();
    const folded = await yaml(JSON.stringify({ t: long }), { lineWidth: 40 });
    expect(folded.split('\n').length).toBeGreaterThan(3);
    const flat = await yaml(JSON.stringify({ t: long }), { lineWidth: -1 });
    expect(flat).toBe(`t: ${long}\n`);
  });

  it('writes multi-line strings as block scalars', async () => {
    expect(await yaml('{"t":"a\\nb"}')).toBe('t: |-\n  a\n  b\n');
  });

  it('sorts keys at every level', async () => {
    expect(await yaml('{"b":1,"a":{"d":1,"c":2}}', { sortKeys: true })).toBe('a:\n  c: 2\n  d: 1\nb: 1\n');
  });

  it('splits a top-level array into documents when asked', async () => {
    expect(await yaml('[{"a":1},{"b":2}]', { multiDocument: true })).toBe('a: 1\n---\nb: 2\n');
    const r = await run('{"a":1}', { multiDocument: true });
    expect(r.ok && r.warnings.join(' ')).toContain('top-level array');
  });

  it('never writes anchors or aliases', async () => {
    const out = await yaml('{"a":{"x":1},"b":{"x":1},"c":[[1],[1]]}');
    expect(out).not.toMatch(/[&*]/);
  });

  it('keeps big integers exact and strips a BOM', async () => {
    expect(await yaml('\uFEFF{"id":12345678901234567890}')).toBe('id: 12345678901234567890\n');
  });

  it('keeps unicode and emoji readable', async () => {
    expect(await yaml('{"s":"José 😀 世界"}')).toContain('José 😀 世界');
  });

  it('reports invalid JSON with line and column', async () => {
    const r = await run('{\n  "a": 1,\n  "b": \n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(4);
      expect(r.error.snippet).toContain('^');
    }
  });

  it('handles root scalars and empty containers', async () => {
    expect(await yaml('"hello"')).toBe('hello\n');
    expect(await yaml('[]')).toBe('[]\n');
    expect(await yaml('{}')).toBe('{}\n');
  });
});
