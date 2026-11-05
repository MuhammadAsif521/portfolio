import { describe, expect, it } from 'vitest';
import { everyN, formatRanges, groupLabel, parsePageRanges } from './page-ranges';

describe('parsePageRanges', () => {
  it('parses singles, ranges and open ranges into groups', () => {
    expect(parsePageRanges('1-3,5,8-', 10)).toEqual({
      ok: true,
      groups: [[1, 2, 3], [5], [8, 9, 10]],
      pages: [1, 2, 3, 5, 8, 9, 10],
    });
  });

  it('treats an empty text as all pages', () => {
    expect(parsePageRanges('  ', 3)).toEqual({ ok: true, groups: [[1, 2, 3]], pages: [1, 2, 3] });
  });

  it('tolerates spaces, semicolons and trailing commas, and keeps typed order and duplicates', () => {
    expect(parsePageRanges(' 3 - 4 ; 1,, 1 ,', 5)).toMatchObject({ ok: true, pages: [3, 4, 1, 1] });
  });

  it('rejects out-of-range pages with the page count in the message', () => {
    expect(parsePageRanges('11', 10)).toEqual({ ok: false, error: 'Page 11 does not exist: this file has 10 pages.' });
    expect(parsePageRanges('2-12', 10)).toMatchObject({ ok: false, error: expect.stringContaining('Page 12') });
    expect(parsePageRanges('2', 1)).toMatchObject({ ok: false, error: expect.stringContaining('1 page.') });
  });

  it('rejects zero, reversed ranges and stray characters', () => {
    expect(parsePageRanges('0', 5)).toMatchObject({ ok: false });
    expect(parsePageRanges('0-3', 5)).toMatchObject({ ok: false });
    expect(parsePageRanges('5-3', 9)).toMatchObject({ ok: false, error: expect.stringContaining('backwards') });
    expect(parsePageRanges('a-b', 9)).toMatchObject({ ok: false });
    expect(parsePageRanges('1..3', 9)).toMatchObject({ ok: false });
    expect(parsePageRanges('-3', 9)).toMatchObject({ ok: false });
    expect(parsePageRanges(',,', 9)).toMatchObject({ ok: false });
    expect(parsePageRanges('1', 0)).toMatchObject({ ok: false });
  });

  it('does not hang or allocate for absurd numbers', () => {
    expect(parsePageRanges('1-99999999999', 10)).toMatchObject({ ok: false });
  });
});

describe('formatRanges', () => {
  it('compresses sorted unique pages into ranges', () => {
    expect(formatRanges([1, 2, 3, 5, 8, 9])).toBe('1-3,5,8-9');
    expect(formatRanges([9, 1, 2, 2, 3])).toBe('1-3,9');
    expect(formatRanges([])).toBe('');
    expect(formatRanges([4])).toBe('4');
  });

  it('round-trips with parsePageRanges', () => {
    const text = formatRanges([2, 3, 4, 7, 10, 11]);
    expect(parsePageRanges(text, 12)).toMatchObject({ ok: true, pages: [2, 3, 4, 7, 10, 11] });
  });
});

describe('everyN and groupLabel', () => {
  it('splits into equal chunks with a shorter last one', () => {
    expect(everyN(7, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(everyN(4, 1)).toEqual([[1], [2], [3], [4]]);
    expect(everyN(3, 10)).toEqual([[1, 2, 3]]);
    expect(everyN(0, 2)).toEqual([]);
    expect(everyN(5, 0)).toEqual([]);
  });

  it('names output files from their pages', () => {
    expect(groupLabel([7])).toBe('page-7');
    expect(groupLabel([3, 4, 5])).toBe('pages-3-5');
    expect(groupLabel([1, 3, 4, 8])).toBe('pages-1_3-4_8');
    expect(groupLabel([])).toBe('pages');
  });
});
