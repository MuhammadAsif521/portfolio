import { afterEach, describe, expect, it } from 'vitest';
import { setSegmenterEnabled, setWordSegmenterEnabled } from '../text-utils';
import {
  LIMIT_PRESETS,
  READING_WPM,
  SPEAKING_WPM,
  STOP_WORDS,
  analyzeText,
  analyzeTextAsync,
  countCharactersNoSpaces,
  countLines,
  countParagraphs,
  countSentences,
  countWords,
  formatDuration,
  limitStatus,
  smsInfo,
  topKeywords,
  wordTokens,
  xWeightedLength,
} from './word-counter.logic';

afterEach(() => {
  setSegmenterEnabled(true);
  setWordSegmenterEnabled(true);
});

describe('words', () => {
  it('counts whitespace-separated words and ignores bare punctuation', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('Hello,   world!  - & ... ')).toBe(2);
    expect(countWords('one\ntwo\r\nthree\tfour')).toBe(4);
  });
  it('keeps apostrophes and hyphens inside a word, strips them at the edges', () => {
    expect(wordTokens("don't well-known 'quoted' (paren)").map((t) => t.word)).toEqual(["don't", 'well-known', 'quoted', 'paren']);
    expect(wordTokens('don’t').map((t) => t.word)).toEqual(['don’t']);
  });
  it('treats em and en dashes as separators', () => {
    expect(countWords('word—word word–word')).toBe(4);
  });
  it('counts numbers, emoji-only tokens are not words', () => {
    expect(countWords('in 2026 we shipped 3.5 releases')).toBe(6);
    expect(countWords('👋 👋 👋')).toBe(0);
    expect(countWords('hi 👋')).toBe(1);
  });
  it('handles accents, Cyrillic, Arabic and Urdu', () => {
    expect(countWords('Crème brûlée à la façon')).toBe(5);
    expect(countWords('Привет, мир! Как дела?')).toBe(4);
    expect(countWords('مرحبا بالعالم كيف حالك')).toBe(4);
    expect(countWords('یہ ایک اردو جملہ ہے')).toBe(5);
  });
  it('segments scripts without spaces with Intl.Segmenter, per character otherwise', () => {
    expect(countWords('私は学生です')).toBeGreaterThan(1);
    setWordSegmenterEnabled(false);
    expect(countWords('日本語')).toBe(3);
  });
  it('marks sentence and line ends as phrase breaks', () => {
    const t = wordTokens('one two. three\nfour');
    expect(t.map((x) => x.breakAfter)).toEqual([false, true, true, false]);
  });
});

describe('sentences', () => {
  it('counts terminated and unterminated sentences', () => {
    expect(countSentences('')).toBe(0);
    expect(countSentences('Hello world.')).toBe(1);
    expect(countSentences('Hello world')).toBe(1);
    expect(countSentences('One. Two! Three? Four')).toBe(4);
    expect(countSentences('Wait... what?! Really.')).toBe(3);
  });
  it('does not split decimals, domains or known abbreviations', () => {
    expect(countSentences('Pi is 3.14 and the site is example.com today.')).toBe(1);
    expect(countSentences('Dr. Smith met Mr. Jones, e.g. at noon. Fine.')).toBe(2);
  });
  it('handles closing quotes and CJK terminators', () => {
    expect(countSentences('He said "stop." Then left.')).toBe(2);
    expect(countSentences('これはテスト。次の文です。')).toBe(2);
  });
  it('ignores punctuation-only text', () => {
    expect(countSentences('... !!! ???')).toBe(0);
  });
});

describe('paragraphs and lines', () => {
  it('paragraphs are blocks separated by blank lines, LF or CRLF', () => {
    expect(countParagraphs('')).toBe(0);
    expect(countParagraphs('one')).toBe(1);
    expect(countParagraphs('a\nb\n\nc')).toBe(2);
    expect(countParagraphs('a\r\n\r\n\r\n  \r\nb\r\n')).toBe(2);
  });
  it('counts lines without a phantom line after a trailing break', () => {
    expect(countLines('')).toEqual({ lines: 0, nonEmpty: 0 });
    expect(countLines('a')).toEqual({ lines: 1, nonEmpty: 1 });
    expect(countLines('a\n')).toEqual({ lines: 1, nonEmpty: 1 });
    expect(countLines('a\n\nb')).toEqual({ lines: 3, nonEmpty: 2 });
    expect(countLines('a\r\nb\r\n')).toEqual({ lines: 2, nonEmpty: 2 });
  });
});

describe('characters', () => {
  it('counts user-perceived characters', () => {
    const { stats } = analyzeText('Hi 👋🏽 é');
    expect(stats.characters).toBe(6);
    expect(stats.charactersNoSpaces).toBe(4);
    expect(stats.codeUnits).toBeGreaterThan(stats.characters);
  });
  it('CRLF counts as one character and is whitespace', () => {
    const { stats } = analyzeText('a\r\nb');
    expect(stats.characters).toBe(3);
    expect(stats.charactersNoSpaces).toBe(2);
    expect(countCharactersNoSpaces('a b\tc\nd')).toBe(4);
  });
  it('counts bytes in UTF-8', () => {
    expect(analyzeText('aé日👋').stats.bytes).toBe(1 + 2 + 3 + 4);
  });
  it('works without Intl.Segmenter', () => {
    setSegmenterEnabled(false);
    expect(analyzeText('Hi 👨‍👩‍👧 🇵🇰').stats.characters).toBe(6);
  });
});

describe('reading and speaking time', () => {
  it('states the assumptions as constants', () => {
    expect(READING_WPM).toBe(238);
    expect(SPEAKING_WPM).toBe(150);
  });
  it('derives times from the word count', () => {
    const text = Array.from({ length: 238 }, () => 'word').join(' ');
    const { stats } = analyzeText(text);
    expect(stats.words).toBe(238);
    expect(Math.round(stats.readingSeconds)).toBe(60);
    expect(Math.round(stats.speakingSeconds)).toBe(95);
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0 sec');
    expect(formatDuration(0.4)).toBe('less than 1 sec');
    expect(formatDuration(45)).toBe('45 sec');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(125)).toBe('2 min 5 sec');
    expect(formatDuration(3700)).toBe('1 hr 1 min');
  });
});

describe('word statistics', () => {
  it('finds the longest word and the average length', () => {
    const { stats } = analyzeText('a bb cccc dd');
    expect(stats.longestWord).toBe('cccc');
    expect(stats.averageWordLength).toBe(2.3);
    expect(stats.uniqueWords).toBe(4);
  });
  it('is zero-safe on empty input', () => {
    const { stats } = analyzeText('');
    expect(stats.words).toBe(0);
    expect(stats.averageWordLength).toBe(0);
    expect(stats.longestWord).toBe('');
    expect(stats.characters).toBe(0);
  });
  it('unique words are case-insensitive', () => {
    expect(analyzeText('The the THE cat').stats.uniqueWords).toBe(2);
  });
});

describe('keywords', () => {
  const text = 'The quick fox jumps. The quick dog sleeps. A quick fox runs. Foxes and dogs, quick dogs.';
  const { tokens, stats } = analyzeText(text);
  it('ranks words with density and drops stop words on request', () => {
    const rows = topKeywords(tokens, stats.words, { size: 1, excludeStopWords: true, limit: 3 });
    expect(rows[0]).toMatchObject({ phrase: 'quick', count: 4 });
    expect(rows[0].density).toBeCloseTo((4 / stats.words) * 100, 5);
    expect(rows.map((r) => r.phrase)).not.toContain('the');
    const withStops = topKeywords(tokens, stats.words, { size: 1, excludeStopWords: false, limit: 10 });
    expect(withStops.map((r) => r.phrase)).toContain('the');
  });
  it('builds phrases that do not cross sentence breaks and need 2+ occurrences', () => {
    const rows = topKeywords(tokens, stats.words, { size: 2, excludeStopWords: false, limit: 10 });
    expect(rows.find((r) => r.phrase === 'the quick')).toMatchObject({ count: 2 });
    expect(rows.find((r) => r.phrase === 'jumps the')).toBeUndefined();
  });
  it('skips numbers and one-letter words, and is case-insensitive', () => {
    const t = analyzeText('2026 2026 x x Cat cat CAT');
    const rows = topKeywords(t.tokens, t.stats.words, { size: 1, excludeStopWords: false, limit: 5 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phrase: 'cat', count: 3 });
  });
  it('knows English stop words including contractions', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has("don't")).toBe(true);
    expect(STOP_WORDS.has('angular')).toBe(false);
  });
  it('limit and empty input', () => {
    expect(topKeywords([], 0, { size: 1, excludeStopWords: true, limit: 5 })).toEqual([]);
  });
});

describe('character limits', () => {
  it('reports remaining and over-limit counts', () => {
    expect(limitStatus('a'.repeat(150), 'meta', 0)).toMatchObject({ used: 150, limit: 155, remaining: 5, over: false });
    expect(limitStatus('a'.repeat(160), 'meta', 0)).toMatchObject({ remaining: -5, over: true });
    expect(limitStatus('abc', 'custom', 10)).toMatchObject({ remaining: 7 });
    expect(limitStatus('abc', 'custom', 0)).toBeNull();
    expect(limitStatus('abc', 'none', 0)).toBeNull();
    expect(limitStatus('abc', 'sms', 0)).toBeNull();
    expect(LIMIT_PRESETS.find((p) => p.id === 'meta')?.limit).toBe(155);
  });
  it('counts an emoji or accented letter as one character against a limit', () => {
    expect(limitStatus('👋🏽é', 'custom', 10)?.used).toBe(2);
  });
  it('X weighting: Latin 1, CJK and emoji 2, links 23', () => {
    expect(xWeightedLength('hello')).toBe(5);
    expect(xWeightedLength('日本')).toBe(4);
    expect(xWeightedLength('👋')).toBe(2);
    expect(xWeightedLength('see https://example.com/a/very/long/path?with=query ok')).toBe(4 + 23 + 3);
    expect(limitStatus('a'.repeat(280), 'x', 0)?.over).toBe(false);
    expect(limitStatus('a'.repeat(281), 'x', 0)?.over).toBe(true);
  });
  it('SMS: GSM-7 vs Unicode and part counts', () => {
    expect(smsInfo('')).toMatchObject({ segments: 0, encoding: 'GSM-7' });
    expect(smsInfo('a'.repeat(160))).toMatchObject({ segments: 1, remaining: 0, encoding: 'GSM-7' });
    expect(smsInfo('a'.repeat(161))).toMatchObject({ segments: 2, perPart: 153 });
    expect(smsInfo('a'.repeat(306))).toMatchObject({ segments: 2, remaining: 0 });
    expect(smsInfo('a'.repeat(307))).toMatchObject({ segments: 3 });
    expect(smsInfo('€')).toMatchObject({ units: 2, encoding: 'GSM-7' });
    expect(smsInfo('ç')).toMatchObject({ encoding: 'Unicode (UCS-2)', single: 70 });
    expect(smsInfo('hi 👋')).toMatchObject({ encoding: 'Unicode (UCS-2)', units: 5 });
    expect(smsInfo('ا'.repeat(71))).toMatchObject({ segments: 2, perPart: 67 });
  });
});

describe('large input', () => {
  it('analyses ~2 MB of mixed text correctly and quickly (async path)', async () => {
    const unit = 'Hello wörld, this is a test. 👋🏽 Привет мир!\n';
    const text = unit.repeat(45_000);
    const t0 = performance.now();
    const result = await analyzeTextAsync(text, () => false);
    expect(result).not.toBeNull();
    expect(result!.stats.words).toBe(45_000 * 8);
    expect(result!.stats.lines).toBe(45_000);
    expect(result!.stats.sentences).toBe(45_000 * 2);
    expect(performance.now() - t0).toBeLessThan(8000);
  });
  it('a stale run is cancelled', async () => {
    expect(await analyzeTextAsync('word '.repeat(100_000), () => true)).toBeNull();
  });
});
