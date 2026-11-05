import { describe, expect, it } from 'vitest';
import { utf8ByteLength } from '../text-utils';
import { CLASSIC_START, LATIN_WORDS, LOREM_LIMITS, createRng, generateLorem, heading, sentence, type LoremOptions } from './lorem.logic';

const base: LoremOptions = { unit: 'paragraphs', count: 3, startWithClassic: true, layout: 'plain', format: 'text', seed: 'seed' };
const gen = (o: Partial<LoremOptions> = {}) => generateLorem({ ...base, ...o });
const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean);

describe('word bank', () => {
  it('is a lower-case, duplicate-free list of words from Cicero, without the invented filler words', () => {
    for (const invented of ['nostrud', 'ullamco', 'cupidatat', 'proident', 'incididunt', 'eiusmod', 'irure', 'aliquip', 'exercitation']) expect(LATIN_WORDS).not.toContain(invented);
    expect(LATIN_WORDS.length).toBeGreaterThan(150);
    expect(new Set(LATIN_WORDS).size).toBe(LATIN_WORDS.length);
    for (const w of LATIN_WORDS) expect(w).toMatch(/^[a-z]+$/);
    for (const w of ['ipsum', 'dolor', 'consectetur', 'voluptatem', 'exercitationem', 'deserunt']) expect(LATIN_WORDS).toContain(w);
  });
});

describe('rng', () => {
  it('is deterministic per seed and different across seeds', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    const c = createRng('abd');
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c())).not.toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('accepts numeric and empty seeds', () => {
    expect(createRng(42)()).toBe(createRng(42)());
    expect(createRng('')()).toBe(createRng('')());
  });
});

describe('paragraphs', () => {
  it('starts with the classic sentence and has the requested number of paragraphs', () => {
    const r = gen();
    expect(r.text.startsWith(CLASSIC_START + '.')).toBe(true);
    expect(r.text.split('\n\n')).toHaveLength(3);
    expect(r.paragraphs).toBe(3);
  });
  it('does not start with the classic text when switched off', () => {
    expect(gen({ startWithClassic: false, seed: 'x' }).text.startsWith('Lorem ipsum dolor sit amet, consectetur')).toBe(false);
  });
  it('same seed gives the same text, another seed another text', () => {
    expect(gen({ seed: 'one' }).text).toBe(gen({ seed: 'one' }).text);
    expect(gen({ seed: 'one' }).text).not.toBe(gen({ seed: 'two' }).text);
  });
  it('every sentence is capitalised, ends in a full stop, and only uses bank words', () => {
    const r = gen({ count: 5, startWithClassic: false });
    const bank = new Set(LATIN_WORDS);
    for (const w of wordsOf(r.text)) expect(bank.has(w.toLowerCase().replace(/[.,]/g, ''))).toBe(true);
    for (const p of r.text.split('\n\n')) {
      expect(p).toMatch(/^[A-Z]/);
      expect(p).toMatch(/\.$/);
    }
  });
  it('never repeats the same word twice in a row', () => {
    const w = wordsOf(gen({ unit: 'words', count: 5000 }).text.toLowerCase().replace(/[.,]/g, ''));
    for (let i = 1; i < w.length; i++) expect(w[i]).not.toBe(w[i - 1]);
  });
});

describe('sentences, words, bytes', () => {
  it('sentences: exact count', () => {
    const r = gen({ unit: 'sentences', count: 7 });
    expect(r.sentences).toBe(7);
    expect(r.text.startsWith(CLASSIC_START)).toBe(true);
    expect(r.text).not.toContain('\n');
  });
  it('words: exact count, with and without the classic start', () => {
    expect(wordsOf(gen({ unit: 'words', count: 25 }).text)).toHaveLength(25);
    expect(gen({ unit: 'words', count: 5 }).text).toBe('Lorem ipsum dolor sit amet.');
    expect(wordsOf(gen({ unit: 'words', count: 1, startWithClassic: false }).text)).toHaveLength(1);
    expect(gen({ unit: 'words', count: 1 }).words).toBe(1);
  });
  it('bytes: exactly N bytes, ends with a full stop', () => {
    for (const n of [1, 2, 10, 100, 1000, 54321]) {
      const r = gen({ unit: 'bytes', count: n });
      expect(utf8ByteLength(r.text), String(n)).toBe(n);
      expect(r.bytes).toBe(n);
      if (n >= 2) expect(r.text.endsWith('.')).toBe(true);
    }
  });
});

describe('layouts and formats', () => {
  it('html wraps paragraphs, words, sentences and bytes in <p>', () => {
    const p = gen({ format: 'html', count: 2 }).text;
    expect(p.split('\n')).toHaveLength(2);
    expect(p).toMatch(/^<p>Lorem ipsum.*<\/p>\n<p>.*<\/p>$/s);
    for (const unit of ['words', 'sentences', 'bytes'] as const) expect(gen({ unit, format: 'html', count: 20 }).text).toMatch(/^<p>.*<\/p>$/);
  });
  it('headings: plain, markdown and html', () => {
    const plain = gen({ layout: 'headings', count: 2 }).text.split('\n\n');
    expect(plain).toHaveLength(4);
    expect(plain[0]).not.toMatch(/\.$/);
    expect(gen({ layout: 'headings', format: 'markdown', count: 2 }).text).toMatch(/^## [A-Za-z ]+\n\nLorem ipsum/);
    expect(gen({ layout: 'headings', format: 'html', count: 2 }).text).toMatch(/^<h2>[A-Za-z ]+<\/h2>\n<p>Lorem ipsum.*<\/p>\n<h2>/s);
  });
  it('lists: bullets, numbers and html', () => {
    expect(gen({ layout: 'list', count: 3 }).text.split('\n').every((l) => l.startsWith('- '))).toBe(true);
    expect(gen({ layout: 'numbered', count: 3 }).text.split('\n').map((l) => l.slice(0, 3))).toEqual(['1. ', '2. ', '3. ']);
    const html = gen({ layout: 'list', format: 'html', count: 2 }).text;
    expect(html).toMatch(/^<ul>\n  <li>.*<\/li>\n  <li>.*<\/li>\n<\/ul>$/s);
    expect(gen({ layout: 'numbered', format: 'html', count: 1 }).text).toMatch(/^<ol>/);
  });
  it('the layout is ignored for other units', () => {
    expect(gen({ unit: 'sentences', layout: 'headings', count: 3 }).text).not.toContain('\n');
  });
});

describe('limits and bad input', () => {
  it('clamps counts', () => {
    expect(gen({ count: 0 }).paragraphs).toBe(1);
    expect(gen({ count: -5 }).paragraphs).toBe(1);
    expect(gen({ count: NaN }).paragraphs).toBe(1);
    expect(gen({ unit: 'paragraphs', count: 99999 }).paragraphs).toBe(LOREM_LIMITS.paragraphs);
    expect(wordsOf(gen({ unit: 'words', count: 10 ** 9 }).text)).toHaveLength(LOREM_LIMITS.words);
  });
  it('sentence and heading helpers', () => {
    const rng = createRng('h');
    expect(sentence(rng)).toMatch(/^[A-Z][a-z, ]+\.$/);
    expect(heading(rng)).toMatch(/^([A-Z][a-z]+ ?)+$/);
    const s = sentence(createRng('c'), { classic: true });
    expect(s).toBe('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
  });
  it('generates the maximum sizes quickly', () => {
    const t0 = performance.now();
    expect(utf8ByteLength(gen({ unit: 'bytes', count: LOREM_LIMITS.bytes }).text)).toBe(LOREM_LIMITS.bytes);
    expect(gen({ unit: 'words', count: LOREM_LIMITS.words }).words).toBe(LOREM_LIMITS.words);
    expect(gen({ count: LOREM_LIMITS.paragraphs }).paragraphs).toBe(LOREM_LIMITS.paragraphs);
    expect(performance.now() - t0).toBeLessThan(3000);
  });
});
