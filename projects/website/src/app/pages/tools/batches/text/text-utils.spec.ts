import { afterEach, describe, expect, it } from 'vitest';
import {
  chunkText,
  countGraphemes,
  countGraphemesAsync,
  debounceFor,
  detectEol,
  formatSize,
  graphemes,
  segmentWords,
  setSegmenterEnabled,
  setWordSegmenterEnabled,
  splitLines,
  utf8ByteLength,
} from './text-utils';

afterEach(() => {
  setSegmenterEnabled(true);
  setWordSegmenterEnabled(true);
});

const SAMPLES = [
  '',
  'hello',
  'café',
  'café',
  'a\r\nb',
  '👋',
  '👍🏽',
  '👨‍👩‍👧‍👦 family',
  '🇵🇰 flag',
  'Привет, мир',
  'مرحبا بالعالم',
  'اردو زبان',
  'नमस्ते',
  '한국어',
  '日本語のテキスト',
  'é̂',
  '❤️ heart',
];

describe('splitLines / detectEol', () => {
  it('splits CRLF, LF and CR the same way', () => {
    expect(splitLines('a\r\nb\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitLines('')).toEqual(['']);
    expect(splitLines('a\n')).toEqual(['a', '']);
  });
  it('detects CRLF only when it is used throughout', () => {
    expect(detectEol('a\r\nb\r\n')).toBe('\r\n');
    expect(detectEol('a\nb\n')).toBe('\n');
    expect(detectEol('a\r\nb\nc')).toBe('\n');
    expect(detectEol('single line')).toBe('\n');
  });
});

describe('utf8ByteLength', () => {
  it('matches TextEncoder for ASCII, accents, CJK, emoji and lone surrogates', () => {
    const enc = new TextEncoder();
    for (const s of [...SAMPLES, 'a\ud800b', '\udc00', 'x'.repeat(1000)]) {
      expect(utf8ByteLength(s), JSON.stringify(s)).toBe(enc.encode(s).length);
    }
  });
});

describe('graphemes', () => {
  it('keeps clusters together with Intl.Segmenter', () => {
    expect(graphemes('é')).toHaveLength(1);
    expect(graphemes('👨‍👩‍👧‍👦')).toHaveLength(1);
    expect(graphemes('🇵🇰🇺🇸')).toHaveLength(2);
    expect(graphemes('👍🏽')).toHaveLength(1);
    expect(graphemes('a\r\nb')).toEqual(['a', '\r\n', 'b']);
  });
  it('the regex fallback agrees on the common cases', () => {
    setSegmenterEnabled(false);
    expect(graphemes('é')).toHaveLength(1);
    expect(graphemes('👨‍👩‍👧‍👦')).toHaveLength(1);
    expect(graphemes('🇵🇰🇺🇸')).toHaveLength(2);
    expect(graphemes('👍🏽')).toHaveLength(1);
    expect(graphemes('a\r\nb')).toEqual(['a', '\r\n', 'b']);
    expect(graphemes('نص')).toHaveLength(2);
    expect(graphemes('')).toEqual([]);
  });
  it('countGraphemes equals graphemes().length, fast path or not', () => {
    for (const s of SAMPLES) expect(countGraphemes(s), JSON.stringify(s)).toBe(graphemes(s).length);
  });
  it('countGraphemes without Segmenter stays consistent on the simple samples', () => {
    setSegmenterEnabled(false);
    for (const s of ['', 'hello', 'café', 'a\r\nb', '👋', 'Привет, мир', 'مرحبا بالعالم']) {
      expect(countGraphemes(s), s).toBe(graphemes(s).length);
    }
  });
});

describe('chunkText / countGraphemesAsync', () => {
  it('chunks reassemble into the original and cut after line feeds', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `line ${i} é 👋`).join('\n');
    const chunks = chunkText(text, 10_000);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.join('')).toBe(text);
    for (const c of chunks.slice(0, -1)) expect(c.endsWith('\n')).toBe(true);
  });
  it('falls back to spaces, then to one chunk, when there are no line breaks', () => {
    const spaced = 'word '.repeat(5000);
    const chunks = chunkText(spaced, 1000);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.join('')).toBe(spaced);
    const solid = 'x'.repeat(5000);
    expect(chunkText(solid, 1000)).toEqual([solid]);
  });
  it('counts a multi-megabyte emoji text correctly and can be cancelled', async () => {
    const text = 'héllo 👋🏽 wörld\n'.repeat(120_000); // ~ 2.1 MB
    const n = await countGraphemesAsync(text, () => false, 200_000);
    expect(n).toBe(120_000 * 14);
    expect(await countGraphemesAsync(text, () => true)).toBeNull();
  });
});

describe('segmentWords', () => {
  it('splits Japanese into several words when Intl.Segmenter exists', () => {
    const words = segmentWords('私は学生です');
    expect(words && words.length).toBeGreaterThan(1);
  });
  it('returns null without Intl.Segmenter', () => {
    setWordSegmenterEnabled(false);
    expect(segmentWords('日本語')).toBeNull();
  });
});

describe('debounceFor / formatSize', () => {
  it('waits longer for bigger text', () => {
    expect(debounceFor(10)).toBe(0);
    expect(debounceFor(50_000)).toBeGreaterThan(0);
    expect(debounceFor(2_000_000)).toBeGreaterThan(debounceFor(50_000));
  });
  it('formats sizes', () => {
    expect(formatSize(12)).toBe('12 B');
    expect(formatSize(2048)).toBe('2.0 kB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
