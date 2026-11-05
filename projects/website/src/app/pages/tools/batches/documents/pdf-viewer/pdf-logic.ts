import { isPdf } from '../shared/doc-utils';

export const PDF_MAX_MB = 100;
/** Most search hits kept; more than this is not useful to step through. */
export const MAX_HITS = 1000;
/** A canvas above this many device pixels gets slower than it is worth (and phones may refuse it). */
const MAX_CANVAS_PIXELS = 16_000_000;

export class PdfError extends Error {}

export function checkPdfBytes(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new PdfError('This file is empty.');
  if (!isPdf(bytes)) throw new PdfError('This is not a PDF file. It does not start with the PDF header that every PDF has.');
}

/** Plain message for whatever pdf.js throws while opening a file. */
export function pdfOpenMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'PasswordException') return 'The password is not correct.';
  if (name === 'InvalidPDFException' || name === 'FormatError' || name === 'XRefParseException') {
    return 'This PDF could not be read. It may be damaged or cut short.';
  }
  return 'This file could not be opened as a PDF. It may be damaged, or not a PDF at all.';
}

// ── page text and search ───────────────────────────────────────────────────────

/** The parts of a pdf.js text item that this tool needs. */
export interface TextRun {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

export interface RunSpan {
  run: number;
  /** Start and end offsets of this run inside the page text. */
  start: number;
  end: number;
}

export interface PageText {
  text: string;
  spans: RunSpan[];
}

/**
 * One string per page, plus where every run landed in it. A line break follows a run that ends a line, and
 * a space is inserted between two runs on one line when there is a visible gap, so "Hello" + "World" with a
 * gap searches as "Hello World".
 */
export function buildPageText(runs: readonly TextRun[]): PageText {
  let text = '';
  const spans: RunSpan[] = [];
  let prev: TextRun | null = null;
  runs.forEach((run, i) => {
    if (prev && !prev.hasEOL && run.str !== '') {
      const prevEnd = prev.transform[4] + prev.width;
      const sameLine = Math.abs(run.transform[5] - prev.transform[5]) < Math.max(prev.height, 1) * 0.5;
      const gap = run.transform[4] - prevEnd;
      if (sameLine && gap > Math.max(prev.height, 1) * 0.15 && !/\s$/.test(text) && !/^\s/.test(run.str)) text += ' ';
    }
    const start = text.length;
    text += run.str;
    if (run.str !== '') spans.push({ run: i, start, end: text.length });
    if (run.hasEOL) text += '\n';
    if (run.str !== '' || run.hasEOL) prev = run;
  });
  return { text, spans };
}

export interface Hit {
  start: number;
  end: number;
}

/** Every non-overlapping, case-insensitive occurrence of `query` (whitespace in the query matches any run of whitespace). */
export function findHits(text: string, query: string, limit = MAX_HITS): Hit[] {
  const needle = query.trim();
  if (!needle) return [];
  const pattern = new RegExp(
    needle
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+'),
    'giu',
  );
  const hits: Hit[] = [];
  for (const m of text.matchAll(pattern)) {
    if (m[0].length === 0) continue;
    hits.push({ start: m.index, end: m.index + m[0].length });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** A short, single-line excerpt around a hit for the result list. */
export function snippet(text: string, hit: Hit, radius = 36): string {
  const from = Math.max(0, hit.start - radius);
  const to = Math.min(text.length, hit.end + radius);
  const clean = text.slice(from, to).replace(/\s+/g, ' ').trim();
  return `${from > 0 ? '…' : ''}${clean}${to < text.length ? '…' : ''}`;
}

// ── geometry ───────────────────────────────────────────────────────────────────

export type Matrix = readonly [number, number, number, number, number, number];

/** Matrix product m1 x m2 in the PDF convention (apply m2 first, then m1). */
export function multiply(m1: Matrix, m2: readonly number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Highlight rectangle (in canvas CSS pixels) for the part of one text run covered by a hit. Horizontal text only,
 * with the hit's position inside the run estimated from its character offsets: close for most fonts,
 * approximate for very uneven ones. Returns null for rotated text or empty overlap.
 */
export function hitRect(run: TextRun, span: RunSpan, hit: Hit, viewport: Matrix, scale: number): Rect | null {
  const from = Math.max(hit.start, span.start);
  const to = Math.min(hit.end, span.end);
  const length = span.end - span.start;
  if (to <= from || length <= 0) return null;
  const m = multiply(viewport, run.transform);
  if (Math.abs(m[1]) > 0.01 * Math.abs(m[0]) || Math.abs(m[2]) > 0.01 * Math.abs(m[3])) return null;
  const fontHeight = Math.hypot(m[2], m[3]) || run.height * scale;
  const runWidth = run.width * scale;
  const startFrac = (from - span.start) / length;
  const endFrac = (to - span.start) / length;
  return {
    x: m[4] + startFrac * runWidth,
    y: m[5] - fontHeight * 0.95,
    w: Math.max(2, (endFrac - startFrac) * runWidth),
    h: fontHeight * 1.2,
  };
}

// ── zoom ───────────────────────────────────────────────────────────────────────

export const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300] as const;

/** Scale that makes a page fit the available width, kept within a sensible range. */
export function fitWidthScale(pageWidth: number, availableWidth: number): number {
  if (pageWidth <= 0 || availableWidth <= 0) return 1;
  return Math.min(4, Math.max(0.25, availableWidth / pageWidth));
}

/** The next zoom step above/below a percentage (clamped to the list). */
export function stepZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + 0.5) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 0.5) ?? ZOOM_STEPS[0];
}

/** Device-pixel ratio to draw with: the screen's (up to 2), lowered until the canvas is within a safe size. */
export function renderRatio(cssWidth: number, cssHeight: number, devicePixelRatio: number): number {
  let ratio = Math.max(1, Math.min(2, devicePixelRatio || 1));
  while (ratio > 0.5 && cssWidth * ratio * cssHeight * ratio > MAX_CANVAS_PIXELS) ratio *= 0.85;
  return ratio;
}

// ── metadata ───────────────────────────────────────────────────────────────────

/** "D:20240115103000+01'00'" -> "2024-01-15 10:30". Falls back to the raw string when it is not a PDF date. */
export function formatPdfDate(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(raw.trim());
  if (!m) return raw.trim();
  const [, y, mo = '01', d = '01', h, mi] = m;
  return `${y}-${mo}-${d}${h ? ` ${h}:${mi ?? '00'}` : ''}`;
}

/** Page text for display: capped so the result box stays fast; the copy button still gets everything. */
export function previewText(text: string, max = 100_000): { shown: string; truncated: boolean } {
  return text.length <= max ? { shown: text, truncated: false } : { shown: text.slice(0, max), truncated: true };
}
