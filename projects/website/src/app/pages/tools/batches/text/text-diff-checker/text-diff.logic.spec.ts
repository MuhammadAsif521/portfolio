import { diffArrays } from 'diff';
import { describe, expect, it } from 'vitest';
import {
  buildUnifiedPatch,
  collapseUnchanged,
  computeDiff,
  inlineSegments,
  isSkip,
  limitSegments,
  sideBySideRows,
  sideSegments,
  tidySegments,
  toLines,
  wordTokens,
  type DiffOptions,
  type Seg,
} from './text-diff.logic';

const opts = (o: Partial<DiffOptions> = {}): DiffOptions => ({ mode: 'lines', ignoreWhitespace: false, ignoreCase: false, ...o });
const run = (a: string, b: string, o: Partial<DiffOptions> = {}) => computeDiff(diffArrays, a, b, opts(o));
const rebuild = (segs: Seg[], side: 'old' | 'new') => segs.filter((s) => s.type === 'eq' || s.type === (side === 'old' ? 'del' : 'add')).map((s) => s.text).join('');

describe('toLines', () => {
  it('splits CRLF, LF and CR alike and ignores one final line break', () => {
    expect(toLines('a\r\nb\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
    expect(toLines('a\n')).toEqual(['a']);
    expect(toLines('a\n\n')).toEqual(['a', '']);
    expect(toLines('')).toEqual([]);
  });
});

describe('line diff', () => {
  it('reports additions and removals with line numbers', () => {
    const r = run('one\ntwo\nthree', 'one\n2\nthree\nfour');
    expect(r.ops.map((o) => `${o.type}:${o.text}:${o.oldNo}:${o.newNo}`)).toEqual([
      'eq:one:1:1',
      'del:two:2:null',
      'add:2:null:2',
      'eq:three:3:3',
      'add:four:null:4',
    ]);
    expect(r.stats).toEqual({ added: 2, removed: 1, unchanged: 2, unit: 'lines' });
    expect(r.identical).toBe(false);
    expect(r.approximate).toBe(false);
  });
  it('identical texts, CRLF vs LF, trailing newline', () => {
    expect(run('a\nb', 'a\nb').identical).toBe(true);
    expect(run('a\r\nb\r\n', 'a\nb').identical).toBe(true);
    expect(run('', '').identical).toBe(true);
  });
  it('empty against text', () => {
    const r = run('', 'x\ny');
    expect(r.stats).toMatchObject({ added: 2, removed: 0 });
    const r2 = run('x\ny', '');
    expect(r2.stats).toMatchObject({ added: 0, removed: 2 });
  });
  it('ignore whitespace and ignore case', () => {
    expect(run('a  b\n  c', 'a b\nc').identical).toBe(false);
    expect(run('a  b\n  c', 'a b\nc', { ignoreWhitespace: true }).identical).toBe(true);
    expect(run('Hello', 'hello').identical).toBe(false);
    expect(run('Hello', 'hello', { ignoreCase: true }).identical).toBe(true);
    expect(run('É', 'é', { ignoreCase: true }).identical).toBe(true);
  });
  it('moves show as removal plus addition', () => {
    const r = run('a\nb\nc', 'b\nc\na');
    expect(r.lineStats.added).toBe(1);
    expect(r.lineStats.removed).toBe(1);
  });
  it('unicode lines are compared exactly', () => {
    const r = run('café\n日本語\n👋', 'café\n日本\n👋');
    expect(r.stats).toMatchObject({ added: 1, removed: 1, unchanged: 2 });
  });
});

describe('word and character diff', () => {
  it('words: only changed words are marked and both texts can be rebuilt', () => {
    const a = 'The quick brown fox jumps';
    const b = 'The slow brown fox leaps';
    const r = run(a, b, { mode: 'words' });
    expect(r.segments).not.toBeNull();
    expect(rebuild(r.segments!, 'old')).toBe(a);
    expect(rebuild(r.segments!, 'new')).toBe(b);
    expect(r.stats).toEqual({ added: 2, removed: 2, unchanged: 3, unit: 'words' });
    expect(r.segments!.filter((s) => s.type === 'del').map((s) => s.text)).toEqual(['quick', 'jumps']);
  });
  it('chars: emoji and accented letters are never split', () => {
    const a = 'é 👍🏽 a';
    const b = 'é 👨‍👩‍👧 a';
    const r = run(a, b, { mode: 'chars' });
    expect(rebuild(r.segments!, 'old')).toBe(a);
    expect(rebuild(r.segments!, 'new')).toBe(b);
    expect(r.segments!.find((s) => s.type === 'del')?.text).toBe('👍🏽');
    expect(r.segments!.find((s) => s.type === 'add')?.text).toBe('👨‍👩‍👧');
    expect(r.stats).toMatchObject({ added: 1, removed: 1, unit: 'characters' });
  });
  it('chars: RTL text', () => {
    const r = run('مرحبا بالعالم', 'مرحبا بالعلم', { mode: 'chars' });
    expect(rebuild(r.segments!, 'old')).toBe('مرحبا بالعالم');
    expect(rebuild(r.segments!, 'new')).toBe('مرحبا بالعلم');
    expect(r.stats.removed).toBe(1);
  });
  it('ignore case and whitespace apply to words', () => {
    expect(run('Hello  World', 'hello world', { mode: 'words', ignoreCase: true, ignoreWhitespace: true }).identical).toBe(true);
    expect(run('Hello World', 'hello world', { mode: 'words' }).identical).toBe(false);
    expect(run('a\nb', 'a b', { mode: 'words', ignoreWhitespace: true }).stats.removed).toBe(0);
  });
  it('identical texts give no changes', () => {
    const r = run('same text', 'same text', { mode: 'words' });
    expect(r.identical).toBe(true);
    expect(r.segments).toEqual([{ type: 'eq', text: 'same text' }]);
  });
  it('tokenises words with apostrophes and punctuation', () => {
    expect(wordTokens("don't stop, ok")).toEqual(["don't", ' ', 'stop', ',', ' ', 'ok']);
  });
  it('tidySegments folds a blank gap between changes and merges runs', () => {
    const segs: Seg[] = [
      { type: 'del', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'eq', text: ' ' },
      { type: 'del', text: 'c' },
      { type: 'add', text: 'd' },
      { type: 'eq', text: ' tail' },
    ];
    expect(tidySegments(segs)).toEqual([
      { type: 'del', text: 'a c' },
      { type: 'add', text: 'b d' },
      { type: 'eq', text: ' tail' },
    ]);
  });
  it('inlineSegments returns null when the budget is already spent', () => {
    expect(inlineSegments(diffArrays, 'a b c d e', 'x y z w v', opts({ mode: 'words' }), Date.now() - 1)).toBeNull();
  });
});

describe('unified patch', () => {
  it('matches the diff -u format', () => {
    const r = run('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten', 'one\ntwo\nTHREE\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven');
    const patch = buildUnifiedPatch(r.ops);
    expect(patch).toBe(
      [
        '--- original',
        '+++ modified',
        '@@ -1,6 +1,6 @@',
        ' one',
        ' two',
        '-three',
        '+THREE',
        ' four',
        ' five',
        ' six',
        '@@ -8,3 +8,4 @@',
        ' eight',
        ' nine',
        ' ten',
        '+eleven',
        '',
      ].join('\n'),
    );
  });
  it('is empty for identical texts and handles pure additions and removals', () => {
    expect(buildUnifiedPatch(run('a', 'a').ops)).toBe('');
    expect(buildUnifiedPatch(run('', 'a\nb').ops)).toBe('--- original\n+++ modified\n@@ -0,0 +1,2 @@\n+a\n+b\n');
    expect(buildUnifiedPatch(run('a\nb', '').ops)).toBe('--- original\n+++ modified\n@@ -1,2 +0,0 @@\n-a\n-b\n');
  });
  it('honours the context and custom names', () => {
    const r = run('1\n2\n3\n4\n5', '1\n2\nX\n4\n5');
    expect(buildUnifiedPatch(r.ops, { context: 0, oldName: 'a.txt', newName: 'b.txt' })).toBe('--- a.txt\n+++ b.txt\n@@ -3 +3 @@\n-3\n+X\n');
  });
  it('is consistent: applying the patch lines reproduces the new text', () => {
    const a = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
    const b = a.replace('line 10', 'changed 10').replace('line 40\n', '');
    const r = run(a, b);
    const newLines = r.ops.filter((o) => o.type !== 'del').map((o) => o.text).join('\n');
    expect(newLines).toBe(b);
    const oldLines = r.ops.filter((o) => o.type !== 'add').map((o) => o.text).join('\n');
    expect(oldLines).toBe(a);
  });
});

describe('views', () => {
  it('side by side pairs removed and added lines and highlights words inside them', () => {
    const r = run('keep\nthe quick fox\nbye', 'keep\nthe slow fox\nbye\nextra');
    const rows = sideBySideRows(diffArrays, r.ops, opts());
    expect(rows).toHaveLength(4);
    expect(rows[1].left).toMatchObject({ type: 'del', no: 2 });
    expect(rows[1].right).toMatchObject({ type: 'add', no: 2 });
    expect(rows[1].left!.segs!.find((s) => s.type === 'del')?.text).toBe('quick');
    expect(rows[1].right!.segs!.find((s) => s.type === 'add')?.text).toBe('slow');
    expect(rows[3].left).toBeNull();
    expect(rows[3].right).toMatchObject({ type: 'add', text: 'extra' });
  });
  it('side segments split correctly', () => {
    const { left, right } = sideSegments([
      { type: 'eq', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'c' },
    ]);
    expect(left.map((s) => s.text).join('')).toBe('ab');
    expect(right.map((s) => s.text).join('')).toBe('ac');
  });
  it('collapseUnchanged keeps context and counts skipped rows', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ changed: i === 10 }));
    const out = collapseUnchanged(rows, (r) => r.changed, 2);
    expect(out.filter((r) => !isSkip(r))).toHaveLength(5);
    expect(out.filter(isSkip).map((s) => s.skip)).toEqual([8, 7]);
    expect(collapseUnchanged([], () => false, 3)).toEqual([]);
    expect(collapseUnchanged([1, 2, 3], () => false, 3)).toEqual([{ skip: 3 }]);
  });
  it('limitSegments caps rendering', () => {
    const segs: Seg[] = Array.from({ length: 10 }, () => ({ type: 'eq', text: 'x' }));
    expect(limitSegments(segs, 4)).toMatchObject({ hidden: 6 });
    expect(limitSegments(segs, 40).hidden).toBe(0);
  });
});

describe('large input', () => {
  const make = (n: number, edit: (i: number) => string | null) =>
    Array.from({ length: n }, (_, i) => edit(i) ?? `line number ${i} with some text, héllo wörld 👋`).join('\n');

  it('diffs 60,000 lines with a few edits instantly (line mode)', () => {
    const a = make(60_000, () => null);
    const b = make(60_000, (i) => (i % 10_000 === 5 ? `edited ${i}` : null));
    const t0 = performance.now();
    const r = run(a, b);
    expect(r.stats).toMatchObject({ added: 6, removed: 6 });
    expect(r.approximate).toBe(false);
    expect(performance.now() - t0).toBeLessThan(4000);
  });
  it('word mode on ~3 MB refines changed blocks only', () => {
    const a = make(40_000, () => null);
    const b = make(40_000, (i) => (i % 8_000 === 3 ? `line number ${i} with other text, héllo wörld 👋` : null));
    const t0 = performance.now();
    const r = run(a, b, { mode: 'words' });
    expect(r.segments!.filter((s) => s.type === 'del').map((s) => s.text.trim())).toEqual(['some', 'some', 'some', 'some', 'some']);
    expect(r.stats.added).toBe(5);
    expect(performance.now() - t0).toBeLessThan(6000);
  });
  it('character mode on a big text works through line blocks', () => {
    const a = make(20_000, () => null);
    const b = make(20_000, (i) => (i === 7 ? 'line number 7 with some text, héllo wörld 👋!' : null));
    const r = run(a, b, { mode: 'chars' });
    expect(r.segments!.filter((s) => s.type === 'add').map((s) => s.text)).toEqual(['!']);
  });
  it('completely different huge texts stay responsive and are flagged approximate', () => {
    const a = Array.from({ length: 30_000 }, (_, i) => `alpha ${i * 7919}`).join('\n');
    const b = Array.from({ length: 30_000 }, (_, i) => `beta ${i * 104729}`).join('\n');
    const t0 = performance.now();
    const r = run(a, b, { budgetMs: 300 });
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.approximate).toBe(true);
    expect(r.stats).toMatchObject({ added: 30_000, removed: 30_000 });
  });
  it('a 1 MB single line works in word mode', () => {
    const a = 'word '.repeat(200_000);
    const b = a + 'extra';
    const r = run(a, b, { mode: 'words' });
    expect(r.stats.added).toBe(1);
  });
});
