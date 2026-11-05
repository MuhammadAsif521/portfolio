import { describe, expect, it } from 'vitest';
import { countWords, csvField, extensionOf, baseName, isPdf, isZip, toCsv } from './doc-utils';
import {
  MAX_SCROLL_PX,
  ROW_HEIGHT,
  buildView,
  columnLabel,
  columnWidths,
  formatCell,
  headerNames,
  indexAt,
  prefixSums,
  rowWindow,
  viewToCsv,
  viewToJson,
  type Rows,
} from './grid-data';

describe('formatCell', () => {
  it('formats every cell type', () => {
    expect(formatCell(null)).toBe('');
    expect(formatCell(undefined)).toBe('');
    expect(formatCell(42.5)).toBe('42.5');
    expect(formatCell(true)).toBe('TRUE');
    expect(formatCell(new Date('2026-03-04T00:00:00Z'))).toBe('2026-03-04');
    expect(formatCell(new Date('2026-03-04T10:30:00Z'))).toBe('2026-03-04T10:30:00Z');
    expect(formatCell(new Date('nope'))).toBe('');
  });
});

describe('labels and widths', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLabel)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('builds unique, non-empty header names', () => {
    expect(headerNames(['id', '', 'id', null, 'id'], 6)).toEqual(['id', 'Column 2', 'id (2)', 'Column 4', 'id (3)', 'Column 6']);
    expect(headerNames(undefined, 2)).toEqual(['Column 1', 'Column 2']);
  });

  it('sizes columns from their content within the mode bounds', () => {
    const rows: Rows = [['a', 'x'.repeat(200)], ['b', 'y']];
    const auto = columnWidths(rows, ['N', 'Long'], 'auto');
    expect(auto[0]).toBe(72);
    expect(auto[1]).toBe(340);
    expect(columnWidths(rows, ['N', 'Long'], 'narrow')[1]).toBe(150);
    expect(columnWidths(rows, ['N', 'Long'], 'wide')[0]).toBeGreaterThanOrEqual(140);
  });
});

describe('virtual window', () => {
  it('finds the column at an offset', () => {
    const sums = prefixSums([100, 50, 200]);
    expect(sums).toEqual([0, 100, 150, 350]);
    expect([0, 99, 100, 149, 150, 349, 9999].map((x) => indexAt(sums, x))).toEqual([0, 0, 1, 1, 2, 2, 2]);
    expect(indexAt([0], 5)).toBe(0);
  });

  it('draws only the rows in view', () => {
    const w = rowWindow(100_000, 28 * 500, 448);
    expect(w.top).toBe(500);
    expect(w.first).toBe(496);
    expect(w.last - w.first).toBeLessThan(40);
  });

  it('maps scroll progress to rows when the list is too tall to scroll natively', () => {
    const rows = 5_000_000;
    expect(rows * ROW_HEIGHT).toBeGreaterThan(MAX_SCROLL_PX);
    const end = rowWindow(rows, MAX_SCROLL_PX, 448);
    expect(end.last).toBe(rows - 1);
    expect(rowWindow(rows, 0, 448).first).toBe(0);
    const mid = rowWindow(rows, MAX_SCROLL_PX / 2, 448);
    expect(mid.top).toBeGreaterThan(2_000_000);
    expect(mid.top).toBeLessThan(3_000_000);
  });

  it('handles an empty list', () => {
    const w = rowWindow(0, 0, 400);
    expect(w.last).toBeLessThan(w.first);
  });
});

const ROWS: Rows = [
  ['name', 'qty', 'when'],
  ['pear', 10, new Date('2026-01-02T00:00:00Z')],
  ['Apple', 9, new Date('2026-01-01T00:00:00Z')],
  ['fig', '', null],
  ['kiwi', '100', new Date('2025-12-31T00:00:00Z')],
  ['plum', 'n/a', new Date('2026-02-01T00:00:00Z')],
];

describe('buildView', () => {
  const base = { startRow: 1, query: '', sortCol: -1, sortDir: 'asc' as const };

  it('lists data rows in file order, skipping the header', async () => {
    expect(Array.from((await buildView(ROWS, base))!)).toEqual([1, 2, 3, 4, 5]);
    expect(Array.from((await buildView(ROWS, { ...base, startRow: 0 }))!)).toHaveLength(6);
  });

  it('filters case-insensitively across all columns or one', async () => {
    expect(Array.from((await buildView(ROWS, { ...base, query: ' APP ' }))!)).toEqual([2]);
    expect(Array.from((await buildView(ROWS, { ...base, query: '2026-01' }))!)).toEqual([1, 2]);
    expect(Array.from((await buildView(ROWS, { ...base, query: 'a', column: 2 }))!)).toEqual([]);
    expect(Array.from((await buildView(ROWS, { ...base, query: 'zzz' }))!)).toEqual([]);
  });

  it('sorts numbers numerically, text case-insensitively and empty cells last in both directions', async () => {
    const byName = Array.from((await buildView(ROWS, { ...base, sortCol: 0 }))!).map((i) => ROWS[i][0]);
    expect(byName).toEqual(['Apple', 'fig', 'kiwi', 'pear', 'plum']);
    const asc = Array.from((await buildView(ROWS, { ...base, sortCol: 1 }))!).map((i) => ROWS[i][1]);
    expect(asc).toEqual([9, 10, '100', 'n/a', '']);
    const desc = Array.from((await buildView(ROWS, { ...base, sortCol: 1, sortDir: 'desc' }))!).map((i) => ROWS[i][1]);
    expect(desc).toEqual(['n/a', '100', 10, 9, '']);
  });

  it('can be cancelled between chunks', async () => {
    const big: Rows = Array.from({ length: 120_000 }, (_, i) => [String(i)]);
    const signal = { aborted: false };
    const pending = buildView(big, { ...base, startRow: 0, signal });
    signal.aborted = true;
    expect(await pending).toBeNull();
  });
});

describe('export', () => {
  const view = [1, 3];
  it('writes CSV with quoting, and the header first', () => {
    const rows: Rows = [['h1', 'h2'], ['a,b', 'say "hi"'], ['line\nbreak', null]];
    expect(viewToCsv(rows, [1, 2], 2, ['h1', 'h2'])).toBe('h1,h2\r\n"a,b","say ""hi"""\r\n"line\nbreak",');
    expect(viewToCsv(rows, [1], 2, null, ';')).toBe('a,b;"say ""hi"""');
  });

  it('writes JSON objects keyed by the header, or arrays without one', () => {
    expect(JSON.parse(viewToJson(ROWS, view, 3, ['name', 'qty', 'when']))).toEqual([
      { name: 'pear', qty: 10, when: '2026-01-02' },
      { name: 'fig', qty: null, when: null },
    ]);
    expect(JSON.parse(viewToJson(ROWS, [1], 3, null))).toEqual([['pear', 10, '2026-01-02']]);
  });
});

describe('doc-utils', () => {
  it('quotes csv fields only when needed', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a;b', ';')).toBe('"a;b"');
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('counts words across scripts and keeps contractions together', () => {
    expect(countWords("It's a well-known fact: 3 apples.")).toBe(6);
    expect(countWords('اردو زبان')).toBe(2);
    expect(countWords('')).toBe(0);
  });

  it('works with file names and signatures', () => {
    expect(baseName('report.final.docx')).toBe('report.final');
    expect(baseName('.docx')).toBe('document');
    expect(extensionOf('A.B.XLSX')).toBe('xlsx');
    expect(extensionOf('noext')).toBe('');
    expect(isZip(Uint8Array.from([0x50, 0x4b, 3, 4]))).toBe(true);
    expect(isZip(Uint8Array.from([0x50, 0x4b, 9, 9]))).toBe(false);
    expect(isPdf(new TextEncoder().encode('junk\n%PDF-1.7\n'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('hello world'))).toBe(false);
  });
});
