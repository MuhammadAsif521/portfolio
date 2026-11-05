import { describe, expect, it } from 'vitest';
import {
  PdfError,
  buildPageText,
  checkPdfBytes,
  findHits,
  fitWidthScale,
  formatPdfDate,
  hitRect,
  multiply,
  pdfOpenMessage,
  previewText,
  renderRatio,
  snippet,
  stepZoom,
  type TextRun,
} from './pdf-logic';

const run = (str: string, x: number, y: number, width: number, extra: Partial<TextRun> = {}): TextRun => ({
  str,
  transform: [12, 0, 0, 12, x, y],
  width,
  height: 12,
  ...extra,
});

describe('input checks and messages', () => {
  it('rejects empty and non-PDF bytes', () => {
    expect(() => checkPdfBytes(new Uint8Array())).toThrow(PdfError);
    expect(() => checkPdfBytes(new TextEncoder().encode('hello'))).toThrow(/not a PDF/);
    expect(() => checkPdfBytes(new TextEncoder().encode('%PDF-1.4\n'))).not.toThrow();
  });

  it('turns pdf.js errors into plain messages', () => {
    expect(pdfOpenMessage({ name: 'PasswordException' })).toMatch(/password/);
    expect(pdfOpenMessage({ name: 'InvalidPDFException' })).toMatch(/damaged/);
    expect(pdfOpenMessage(new Error('boom'))).toMatch(/could not be opened/);
    expect(pdfOpenMessage(null)).toMatch(/could not be opened/);
  });
});

describe('page text', () => {
  it('joins runs, adds line breaks and a space only where there is a gap', () => {
    const page = buildPageText([
      run('Hello', 10, 700, 30),
      run('World', 50, 700, 30), // gap of 10 -> space
      run('glued', 80, 700, 30, { hasEOL: true }), // no gap -> no space
      run('Next line', 10, 680, 50, { hasEOL: true }),
      run('Third', 10, 660, 25),
    ]);
    expect(page.text).toBe('Hello Worldglued\nNext line\nThird');
    expect(page.spans.map((s) => page.text.slice(s.start, s.end))).toEqual(['Hello', 'World', 'glued', 'Next line', 'Third']);
  });

  it('handles empty pages and empty runs', () => {
    expect(buildPageText([])).toEqual({ text: '', spans: [] });
    expect(buildPageText([run('', 0, 0, 0, { hasEOL: true })]).text).toBe('\n');
  });
});

describe('findHits', () => {
  it('finds every occurrence ignoring case and treats the query as plain text', () => {
    expect(findHits('Cat cat CAT. c.t', 'cat')).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 11 },
    ]);
    expect(findHits('a.b axb', 'a.b')).toEqual([{ start: 0, end: 3 }]);
    expect(findHits('(x) [y]', '(x)')).toHaveLength(1);
  });

  it('lets spaces match line breaks and ignores empty queries', () => {
    expect(findHits('hello\nworld', 'hello world')).toHaveLength(1);
    expect(findHits('anything', '   ')).toEqual([]);
    expect(findHits('x', '')).toEqual([]);
  });

  it('caps the number of hits', () => {
    expect(findHits('a'.repeat(50), 'a', 10)).toHaveLength(10);
  });

  it('builds a one-line excerpt', () => {
    const text = 'x'.repeat(100) + ' the\nneedle here ' + 'y'.repeat(100);
    const hit = findHits(text, 'needle')[0];
    const s = snippet(text, hit);
    expect(s.startsWith('…')).toBe(true);
    expect(s).toContain('needle here');
    expect(s).not.toContain('\n');
  });
});

describe('geometry', () => {
  it('multiplies matrices in PDF order', () => {
    const flip = [1, 0, 0, -1, 0, 800] as const;
    expect(multiply(flip, [12, 0, 0, 12, 10, 700])).toEqual([12, 0, 0, -12, 10, 100]);
  });

  it('places a highlight inside the run, proportionally', () => {
    const flip = [1, 0, 0, -1, 0, 800] as const;
    const r = run('abcdefghij', 10, 700, 100);
    const span = { run: 0, start: 0, end: 10 };
    const rect = hitRect(r, span, { start: 5, end: 10 }, flip, 1);
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeCloseTo(60);
    expect(rect!.w).toBeCloseTo(50);
    expect(rect!.y).toBeLessThan(100);
    expect(rect!.h).toBeGreaterThan(12);
  });

  it('skips rotated text and hits outside the run', () => {
    const flip = [1, 0, 0, -1, 0, 800] as const;
    const span = { run: 0, start: 0, end: 4 };
    const rotated: TextRun = { ...run('abcd', 0, 0, 40), transform: [0, 12, -12, 0, 10, 10] };
    expect(hitRect(rotated, span, { start: 0, end: 2 }, flip, 1)).toBeNull();
    expect(hitRect(run('abcd', 0, 0, 40), span, { start: 10, end: 12 }, flip, 1)).toBeNull();
  });
});

describe('zoom and rendering size', () => {
  it('fits width within limits', () => {
    expect(fitWidthScale(600, 900)).toBe(1.5);
    expect(fitWidthScale(600, 10)).toBe(0.25);
    expect(fitWidthScale(100, 9000)).toBe(4);
    expect(fitWidthScale(0, 500)).toBe(1);
  });

  it('steps through the zoom list and stops at both ends', () => {
    expect(stepZoom(100, 1)).toBe(125);
    expect(stepZoom(100, -1)).toBe(75);
    expect(stepZoom(137, 1)).toBe(150);
    expect(stepZoom(300, 1)).toBe(300);
    expect(stepZoom(50, -1)).toBe(50);
  });

  it('lowers the pixel ratio for very large pages', () => {
    expect(renderRatio(600, 800, 2)).toBe(2);
    expect(renderRatio(600, 800, 1)).toBe(1);
    expect(renderRatio(6000, 8000, 2)).toBeLessThan(1);
    expect(renderRatio(600, 800, 0)).toBe(1);
  });
});

describe('metadata and previews', () => {
  it('formats PDF dates', () => {
    expect(formatPdfDate("D:20240115103000+01'00'")).toBe('2024-01-15 10:30');
    expect(formatPdfDate('D:2024')).toBe('2024-01-01');
    expect(formatPdfDate('yesterday')).toBe('yesterday');
    expect(formatPdfDate(undefined)).toBe('');
  });

  it('caps the text shown but says so', () => {
    expect(previewText('abc', 10)).toEqual({ shown: 'abc', truncated: false });
    expect(previewText('abcdefghijkl', 10)).toEqual({ shown: 'abcdefghij', truncated: true });
  });
});
