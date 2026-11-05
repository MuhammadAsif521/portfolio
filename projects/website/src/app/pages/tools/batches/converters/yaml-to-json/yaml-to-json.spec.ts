import { describe, expect, it } from 'vitest';
import { convertJsonToYaml, DEFAULT_JSON_TO_YAML } from '../json-to-yaml/json-to-yaml.logic';
import { convertYamlToJson, DEFAULT_YAML_TO_JSON, type YamlToJsonOptions } from './yaml-to-json.logic';

const run = (yaml: string, over: Partial<YamlToJsonOptions> = {}) => convertYamlToJson(yaml, { ...DEFAULT_YAML_TO_JSON, indent: 'minify', ...over });

async function json(yaml: string, over: Partial<YamlToJsonOptions> = {}): Promise<unknown> {
  const r = await run(yaml, over);
  if (!r.ok) throw new Error(r.error.message);
  return JSON.parse(r.output);
}

describe('yaml to json', () => {
  it('converts mappings, sequences, scalars and block text', async () => {
    const yaml = 'name: Asif\nage: 30\nactive: true\nnothing: ~\ntags:\n  - node\n  - angular\nbio: |\n  line one\n  line two\nflow: {a: 1, b: [x, y]}\n';
    expect(await json(yaml)).toEqual({
      name: 'Asif',
      age: 30,
      active: true,
      nothing: null,
      tags: ['node', 'angular'],
      bio: 'line one\nline two\n',
      flow: { a: 1, b: ['x', 'y'] },
    });
  });

  it('uses YAML 1.2 rules by default: yes/no stay text, dates stay text', async () => {
    expect(await json('a: yes\nb: no\nc: 2001-01-01\nd: 0777')).toEqual({ a: 'yes', b: 'no', c: '2001-01-01', d: 777 });
  });

  it('can switch to YAML 1.1 rules', async () => {
    const r = await run('a: yes\nb: 0777\nc: 2001-01-02\nd: !!set {x, z}\ne: !!binary aGk=', { yaml11: true });
    expect(r.ok && JSON.parse(r.output)).toMatchObject({ a: true, b: 511, d: ["x", "z"], e: 'aGk=' });
    expect(r.ok && r.warnings.join(' ')).toContain('converted');
  });

  it('handles several documents as an array, or only the first', async () => {
    expect(await json('a: 1\n---\nb: 2\n')).toEqual([{ a: 1 }, { b: 2 }]);
    const first = await run('a: 1\n---\nb: 2\n', { documents: 'first' });
    expect(first.ok && JSON.parse(first.output)).toEqual({ a: 1 });
    expect(first.ok && first.warnings.join(' ')).toContain('only the first');
  });

  it('ignores an empty document after a trailing ---', async () => {
    expect(await json('a: 1\n---\n')).toEqual({ a: 1 });
  });

  it('resolves anchors and aliases, and merge keys', async () => {
    const yaml = 'base: &base\n  x: 1\n  y: 2\nitem:\n  <<: *base\n  y: 3\nlist: [*base, *base]\n';
    expect(await json(yaml)).toEqual({ base: { x: 1, y: 2 }, item: { x: 1, y: 3 }, list: [{ x: 1, y: 2 }, { x: 1, y: 2 }] });
  });

  it('can leave merge keys unexpanded, or reject aliases outright', async () => {
    expect(await json('b: &b {x: 1}\nd:\n  <<: *b', { mergeKeys: false })).toEqual({ b: { x: 1 }, d: { '<<': { x: 1 } } });
    const r = await run('a: &a 1\nb: *a', { allowAliases: false });
    expect(!r.ok && r.error.message).toContain('anchors or aliases');
  });

  it('REFUSES unsafe tags instead of executing or constructing anything', async () => {
    for (const yaml of [
      'a: !!js/function "function(){ return 1 }"',
      'a: !!js/regexp /x/gi',
      'a: !!js/undefined ""',
      'a: !!python/object/apply:os.system ["id"]',
      'a: !ruby/object:Gem::Installer {}',
      'a: !!java.lang.Runtime {}',
    ]) {
      const r = await run(yaml);
      expect(r.ok, yaml).toBe(false);
      if (!r.ok) {
        expect(r.error.message, yaml).toContain('unknown');
        expect(r.error.line).toBe(1);
      }
    }
  });

  it('stops a billion-laughs alias bomb before it expands', async () => {
    let bomb = 'a: &a [x,x,x,x,x,x,x,x,x,x]\n';
    let prev = 'a';
    for (let i = 0; i < 9; i++) {
      bomb += `b${i}: &b${i} [${Array(10).fill('*' + prev).join(',')}]\n`;
      prev = 'b' + i;
    }
    const started = Date.now();
    const r = await run(bomb);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toContain('billion laughs');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('refuses circular aliases', async () => {
    const r = await run('a: &x [*x]');
    expect(!r.ok && r.error.message).toContain('circular');
  });

  it('keeps integers beyond 2^53 exact and maps .inf/.nan to null with a warning', async () => {
    const r = await run('big: 12345678901234567890\nneg: -9007199254740993\nhex: 0xFFFFFFFFFFFFFFFF\ninf: .inf\nnan: .nan');
    expect(r.ok && r.output).toBe('{"big":12345678901234567890,"neg":-9007199254740993,"hex":18446744073709551615,"inf":null,"nan":null}');
    expect(r.ok && r.warnings.join(' ')).toContain('2 values');
  });

  it('reports syntax errors with line and column and a snippet', async () => {
    const r = await run('a: 1\nb: [1, 2\nc: 3\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain('Invalid YAML');
      expect(r.error.line).toBeGreaterThanOrEqual(2);
      expect(r.error.column).toBeGreaterThanOrEqual(1);
      expect(r.error.snippet).toContain('^');
    }
  });

  it('explains duplicate keys, tabs and unknown aliases', async () => {
    const dup = await run('a: 1\na: 2');
    expect(!dup.ok && dup.error.message).toContain('duplicated');
    expect(!dup.ok && dup.error.line).toBe(2);
    const tab = await run('a:\n\t- 1');
    expect(!tab.ok && tab.error.message).toContain('tab');
    const alias = await run('a: *nope');
    expect(!alias.ok && alias.error.message).toContain('unidentified alias');
  });

  it('rejects empty and comment-only input', async () => {
    expect((await run('')).ok).toBe(false);
    expect((await run('# just a comment\n')).ok).toBe(false);
  });

  it('keeps unicode and emoji, strips a BOM, and accepts CRLF', async () => {
    expect(await json('\uFEFFname: "José 😀"\r\nplace: 世界\r\n')).toEqual({ name: 'José 😀', place: '世界' });
  });

  it('treats __proto__ as an ordinary key', async () => {
    const r = await run('__proto__:\n  polluted: true\nb: 1');
    expect(r.ok && r.output).toBe('{"__proto__":{"polluted":true},"b":1}');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('formats and sorts', async () => {
    const r = await convertYamlToJson('b: 1\na: {d: 1, c: 2}', { ...DEFAULT_YAML_TO_JSON, indent: '2', sortKeys: true });
    expect(r.ok && r.output).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}');
  });

  it('round-trips JSON through YAML and back, for tricky strings too', async () => {
    const original = {
      plain: 'text',
      yes: 'yes',
      no: 'no',
      nul: 'null',
      numeric: '123',
      float: '1.5',
      date: '2001-01-01',
      colon: 'a: b',
      hash: '# not a comment',
      multi: 'line1\nline2\n',
      empty: '',
      spaces: '  padded  ',
      emoji: 'José 😀 世界',
      quote: `it's "quoted"`,
      list: [1, -2.5, true, false, null, [], {}, [1, [2]]],
      nested: { a: { b: { c: [{ d: 1 }] } } },
      big: 9007199254740991,
    };
    const yaml = await convertJsonToYaml(JSON.stringify(original), DEFAULT_JSON_TO_YAML);
    if (!yaml.ok) throw new Error(yaml.error.message);
    expect(await json(yaml.output)).toEqual(original);
    for (const quoting of ['minimal-double', 'all-single', 'all-double'] as const) {
      const styled = await convertJsonToYaml(JSON.stringify(original), { ...DEFAULT_JSON_TO_YAML, quoting, indent: 4, lineWidth: -1, flushLists: true });
      if (!styled.ok) throw new Error(styled.error.message);
      expect(await json(styled.output), quoting).toEqual(original);
    }
  });

  it('round-trips big integers exactly', async () => {
    const yaml = await convertJsonToYaml('{"id":12345678901234567890,"neg":-12345678901234567890}', DEFAULT_JSON_TO_YAML);
    expect(yaml.ok && yaml.output).toBe('id: 12345678901234567890\nneg: -12345678901234567890\n');
    const back = await run(yaml.ok ? yaml.output : '');
    expect(back.ok && back.output).toBe('{"id":12345678901234567890,"neg":-12345678901234567890}');
  });
});
