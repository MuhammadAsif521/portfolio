import { describe, expect, it } from 'vitest';
import { createRng } from '../lorem-ipsum-generator/lorem.logic';
import {
  STEP_DEFS,
  STEP_TYPES,
  applyStep,
  dedupeLines,
  defaultParams,
  extractFrom,
  leadingNumber,
  linesOf,
  runPipeline,
  shuffle,
  sortLines,
  unescapeSeparator,
  type Step,
  type StepType,
} from './text-cleaner.logic';

let uid = 0;
const step = (type: StepType, params: Record<string, string | boolean> = {}): Step => ({ id: ++uid, type, params: { ...defaultParams(type), ...params } });
const run = (text: string, ...steps: Step[]) => runPipeline(text, steps).text;

describe('linesOf', () => {
  it('splits all line endings and ignores one final line break', () => {
    expect(linesOf('a\r\nb\nc\rd\n')).toEqual(['a', 'b', 'c', 'd']);
    expect(linesOf('')).toEqual([]);
    expect(linesOf('\n')).toEqual(['']);
    expect(linesOf('a\n\n')).toEqual(['a', '']);
  });
});

describe('trim, collapse, remove empty', () => {
  it('trims both ends, start only or end only; tabs included', () => {
    expect(run('  a  \n\tb\t', step('trim'))).toBe('a\nb');
    expect(run('  a  ', step('trim', { where: 'start' }))).toBe('a  ');
    expect(run('  a  ', step('trim', { where: 'end' }))).toBe('  a');
  });
  it('collapses runs of spaces and tabs, not line breaks', () => {
    expect(run('a   b\t\tc  d', step('collapse'))).toBe('a b c d');
    expect(run('a  b\n\nc', step('collapse'))).toBe('a b\n\nc');
  });
  it('removes empty lines, whitespace-only lines optionally', () => {
    expect(run('a\n\n  \nb\n', step('remove-empty'))).toBe('a\nb');
    expect(run('a\n\n  \nb', step('remove-empty', { blank: false }))).toBe('a\n  \nb');
  });
});

describe('duplicates', () => {
  it('keeps first or last occurrence in place', () => {
    const lines = ['b', 'a', 'b', 'c', 'a'];
    expect(dedupeLines(lines, 'first', false, false)).toEqual(['b', 'a', 'c']);
    expect(dedupeLines(lines, 'last', false, false)).toEqual(['b', 'c', 'a']);
  });
  it('case and whitespace options', () => {
    expect(dedupeLines(['Apple', 'apple', 'APPLE'], 'first', false, false)).toHaveLength(3);
    expect(dedupeLines(['Apple', 'apple', 'APPLE'], 'first', true, false)).toEqual(['Apple']);
    expect(dedupeLines(['a', ' a', 'a '], 'first', false, false)).toHaveLength(3);
    expect(dedupeLines(['a', ' a', 'a '], 'first', false, true)).toEqual(['a']);
    expect(dedupeLines(['É', 'é'], 'first', true, false)).toEqual(['É']);
  });
  it('treats empty lines like any other line, and unicode lines exactly', () => {
    expect(dedupeLines(['', 'a', '', ''], 'first', false, false)).toEqual(['', 'a']);
    expect(dedupeLines(['👋', '👋', '👋🏽'], 'first', false, false)).toEqual(['👋', '👋🏽']);
  });
  it('the trace reports how many lines went away', () => {
    const r = runPipeline('a\na\nb', [step('dedupe')]);
    expect(r.trace[0]).toMatchObject({ before: 3, after: 2 });
  });
});

describe('sorting', () => {
  const l = ['banana', 'Apple', 'cherry', 'apple', 'Éclair', 'eclair'];
  it('A to Z and Z to A with accents and case handled', () => {
    expect(sortLines(l, 'az', true)).toEqual(['Apple', 'apple', 'banana', 'cherry', 'eclair', 'Éclair']);
    expect(sortLines(l, 'za', true)).toEqual(['Éclair', 'eclair', 'cherry', 'banana', 'apple', 'Apple'].map((x) => x));
  });
  it('case sensitive A to Z still groups letters sensibly', () => {
    const r = sortLines(['b', 'A', 'a', 'B'], 'az', false);
    expect(r.map((x) => x.toLowerCase())).toEqual(['a', 'a', 'b', 'b']);
  });
  it('natural order puts file2 before file10', () => {
    expect(sortLines(['file10', 'file2', 'file1'], 'natural', true)).toEqual(['file1', 'file2', 'file10']);
    expect(sortLines(['file10', 'file2', 'file1'], 'az', true)).toEqual(['file1', 'file10', 'file2']);
    expect(sortLines(['file10', 'file2', 'file1'], 'natural-desc', true)).toEqual(['file10', 'file2', 'file1']);
  });
  it('numeric: leading numbers, decimals, negatives, thousands; lines without a number go last in order', () => {
    expect(sortLines(['10', '9', '-3', '2.5', 'zebra', '1,000', 'apple'], 'numeric', true)).toEqual(['-3', '2.5', '9', '10', '1,000', 'zebra', 'apple']);
    expect(sortLines(['10', '9', 'x'], 'numeric-desc', true)).toEqual(['10', '9', 'x']);
    expect(leadingNumber('  12 apples')).toBe(12);
    expect(leadingNumber('apples 12')).toBeNull();
    expect(leadingNumber('1e3')).toBe(1000);
    expect(leadingNumber('')).toBeNull();
  });
  it('length: shortest or longest first, ties keep their order, emoji count once', () => {
    expect(sortLines(['ccc', 'a', 'bb', 'dd'], 'length', true)).toEqual(['a', 'bb', 'dd', 'ccc']);
    expect(sortLines(['ccc', 'a', 'bb', 'dd'], 'length-desc', true)).toEqual(['ccc', 'bb', 'dd', 'a']);
    expect(sortLines(['ab', '😀'], 'length', true)).toEqual(['😀', 'ab']);
  });
  it('shuffle is a permutation and deterministic for a seeded generator', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = shuffle(items, createRng('s'));
    const b = shuffle(items, createRng('s'));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items);
    expect(shuffle([], createRng('s'))).toEqual([]);
    expect(sortLines(['x', 'y', 'z'], 'random', true, createRng('q')).sort()).toEqual(['x', 'y', 'z']);
  });
  it('Cyrillic and Arabic lines sort without errors', () => {
    expect(sortLines(['я', 'а', 'б'], 'az', true)).toEqual(['а', 'б', 'я']);
    expect(sortLines(['ب', 'ا'], 'az', true)).toHaveLength(2);
  });
});

describe('reverse, prefix and suffix', () => {
  it('reverses line order', () => {
    expect(run('1\n2\n3', step('reverse'))).toBe('3\n2\n1');
  });
  it('adds prefix and suffix, skipping empty lines on request', () => {
    expect(run('a\n\nb', step('affix', { prefix: '- ', suffix: ';' }))).toBe('- a;\n\n- b;');
    expect(run('a\n\nb', step('affix', { prefix: '"', suffix: '"', skipEmpty: false }))).toBe('"a"\n""\n"b"');
  });
});

describe('split and join', () => {
  it('splits at a separator, trims and drops empty pieces', () => {
    expect(run('a, b,, c\nd', step('split'))).toBe('a\nb\nc\nd');
    expect(run('a, b,, c', step('split', { trimParts: false, dropEmpty: false }))).toBe('a\n b\n\n c');
    expect(run('a b c', step('split', { separator: ' ' }))).toBe('a\nb\nc');
    expect(run('a\tb', step('split', { separator: '\\t' }))).toBe('a\nb');
    expect(run('a,b', step('split', { separator: '' }))).toBe('a,b');
  });
  it('joins lines with a separator, including escapes', () => {
    expect(run('a\nb\nc', step('join', { separator: ', ' }))).toBe('a, b, c');
    expect(run('a\nb', step('join', { separator: '' }))).toBe('ab');
    expect(run('a\nb', step('join', { separator: '\\t' }))).toBe('a\tb');
    expect(run('', step('join'))).toBe('');
  });
  it('unescapeSeparator', () => {
    expect(unescapeSeparator('\\n\\t\\r\\\\')).toBe('\n\t\r\\');
    expect(unescapeSeparator('plain')).toBe('plain');
  });
});

describe('extraction', () => {
  it('emails', () => {
    const text = 'Contact: Jane.Doe+news@example.co.uk, bob@mail.example.com; invalid@; @nobody.com. Ünï@exämple.de';
    expect(extractFrom([text], 'emails')).toEqual(['Jane.Doe+news@example.co.uk', 'bob@mail.example.com', 'Ünï@exämple.de']);
  });
  it('URLs: trailing punctuation and unbalanced brackets are trimmed, balanced ones kept', () => {
    const text = 'See https://example.com/path?q=1&b=2, or (http://a.b/c) and www.test.org/x. Also https://en.wikipedia.org/wiki/Foo_(bar)!';
    expect(extractFrom([text], 'urls')).toEqual([
      'https://example.com/path?q=1&b=2',
      'http://a.b/c',
      'www.test.org/x',
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    ]);
    expect(extractFrom(['ftp://x.y and example.com'], 'urls')).toEqual([]);
  });
  it('numbers: signs, decimals, exponents, thousands; ASCII digits only', () => {
    expect(extractFrom(['a 12, -3.5 and +7 1,234,567 .5 2e3 abc1d'], 'numbers')).toEqual(['12', '-3.5', '+7', '1,234,567', '.5', '2e3', '1']);
    expect(extractFrom(['٣٤٥'], 'numbers')).toEqual([]);
  });
  it('one result per match across many lines; none for plain text', () => {
    expect(extractFrom(['a@b.co x@y.io', 'none', 'z@z.zz'], 'emails')).toEqual(['a@b.co', 'x@y.io', 'z@z.zz']);
    expect(extractFrom(['nothing here'], 'emails')).toEqual([]);
    expect(extractFrom([], 'urls')).toEqual([]);
  });
  it('as a pipeline step', () => {
    expect(run('mail a@b.co\nand a@b.co again', step('extract', { kind: 'emails' }), step('dedupe'))).toBe('a@b.co');
  });
});

describe('pipeline', () => {
  it('runs steps in order: the order changes the result', () => {
    const text = '  b \na\n\n B\n';
    expect(run(text, step('trim'), step('remove-empty'), step('dedupe', { ignoreCase: true }), step('sort'))).toBe('a\nb');
    expect(run(text, step('dedupe'), step('remove-empty', { blank: false }))).toBe('  b \na\n B');
  });
  it('keeps CRLF when the input is CRLF throughout, otherwise uses LF', () => {
    expect(run('b\r\na\r\n', step('sort'))).toBe('a\r\nb');
    expect(run('b\r\na\nc', step('sort'))).toBe('a\nb\nc');
  });
  it('an empty input or no steps is harmless', () => {
    expect(run('', step('sort'), step('dedupe'))).toBe('');
    expect(run('a\nb')).toBe('a\nb');
    expect(runPipeline('a\nb', []).trace).toEqual([]);
  });
  it('trace has one entry per step with line counts', () => {
    const r = runPipeline('a\n\nb\nb', [step('remove-empty'), step('dedupe'), step('join')]);
    expect(r.trace.map((t) => [t.type, t.before, t.after])).toEqual([
      ['remove-empty', 4, 3],
      ['dedupe', 3, 2],
      ['join', 2, 1],
    ]);
    expect(r.inputLines).toBe(4);
  });
  it('every step type has a definition, defaults and works on empty input', () => {
    for (const type of STEP_TYPES) {
      const def = STEP_DEFS[type];
      expect(def.label).toBeTruthy();
      for (const f of def.fields) expect(f.key in def.defaults).toBe(true);
      expect(applyStep([], { id: 1, type, params: defaultParams(type) })).toEqual([]);
    }
  });
});

describe('unicode and large input', () => {
  it('handles emoji, RTL and CRLF in one go', () => {
    expect(run('مرحبا\r\n👋\r\nمرحبا\r\n', step('dedupe'), step('sort'))).toBe('👋\r\nمرحبا');
  });
  it('processes 300,000 lines through a 5-step pipeline in a few seconds', () => {
    const text = Array.from({ length: 300_000 }, (_, i) => `  Item ${(i * 7919) % 100_000}  `).join('\n');
    const t0 = performance.now();
    const r = runPipeline(text, [step('trim'), step('collapse'), step('remove-empty'), step('dedupe', { ignoreCase: true }), step('sort', { order: 'natural' })]);
    expect(performance.now() - t0).toBeLessThan(15_000);
    expect(r.lines).toHaveLength(100_000);
    expect(r.lines[0]).toBe('Item 0');
    expect(r.lines[99_999]).toBe('Item 99999');
  });
  it('one huge line is fine', () => {
    const line = 'a,'.repeat(500_000);
    expect(runPipeline(line, [step('split')]).lines).toHaveLength(500_000);
  });
});
