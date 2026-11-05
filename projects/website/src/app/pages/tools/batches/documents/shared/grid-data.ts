import { toCsv, yieldToUi } from './doc-utils';

/** A table cell as the readers hand it over: text from CSV, typed values from Excel. */
export type Cell = string | number | boolean | Date | null | undefined;
export type Rows = readonly (readonly Cell[])[];
export type SortDir = 'asc' | 'desc';
export type WidthMode = 'narrow' | 'auto' | 'wide';

export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 32;
export const ROW_HEAD_WIDTH = 56;
/** Chrome stops growing an element near 33M px (Firefox near 18M): beyond this the grid maps scroll to rows. */
export const MAX_SCROLL_PX = 10_000_000;

// ── cells ──────────────────────────────────────────────────────────────────────

/** Text of a cell as shown and exported: dates as ISO dates (with time only when there is one), TRUE/FALSE for booleans. */
export function formatCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.replace('.000Z', 'Z');
  }
  return String(value);
}

/** Spreadsheet column name: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function maxColumns(rows: Rows): number {
  let max = 0;
  for (const row of rows) if (row.length > max) max = row.length;
  return max;
}

/** Header labels from the first row: blanks become "Column N", repeats get " (2)", " (3)". */
export function headerNames(first: readonly Cell[] | undefined, columns: number): string[] {
  const seen = new Map<string, number>();
  return Array.from({ length: columns }, (_, i) => {
    const raw = formatCell(first?.[i]).trim();
    const name = raw || `Column ${i + 1}`;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}

// ── widths ─────────────────────────────────────────────────────────────────────

/** Column pixel widths sized from the longest of the first 200 values (and the header), per sizing mode. */
export function columnWidths(rows: Rows, labels: readonly string[], mode: WidthMode, sample = 200): number[] {
  const bounds = { narrow: [56, 150], auto: [72, 340], wide: [140, 520] }[mode];
  return labels.map((label, col) => {
    let chars = Math.min(label.length, 40);
    const limit = Math.min(rows.length, sample);
    for (let r = 0; r < limit; r++) {
      const len = formatCell(rows[r]?.[col]).length;
      if (len > chars) chars = len;
    }
    const px = Math.round(chars * 7.4 + 28);
    return Math.max(bounds[0], Math.min(bounds[1], mode === 'wide' ? Math.round(px * 1.4) : px));
  });
}

// ── virtual window ─────────────────────────────────────────────────────────────

export function prefixSums(widths: readonly number[]): number[] {
  const sums = new Array<number>(widths.length + 1);
  sums[0] = 0;
  for (let i = 0; i < widths.length; i++) sums[i + 1] = sums[i] + widths[i];
  return sums;
}

/** Index of the item that contains offset `x` (binary search over prefix sums), clamped to the list. */
export function indexAt(sums: readonly number[], x: number): number {
  const last = sums.length - 2;
  if (last < 0) return 0;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sums[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface RowWindow {
  /** Fractional index of the row at the top of the viewport. */
  top: number;
  first: number;
  last: number;
  /** Height of the scroll area the grid asks the browser for. */
  scrollHeight: number;
}

/**
 * Which rows to draw. Normally row = scrollTop / rowHeight. When rows * rowHeight would exceed what browsers
 * can scroll (MAX_SCROLL_PX), scroll progress is mapped linearly onto the row range instead, so a million
 * rows stay reachable.
 */
export function rowWindow(rowCount: number, scrollTop: number, viewportPx: number, overscan = 4): RowWindow {
  const visible = Math.ceil(viewportPx / ROW_HEIGHT);
  const total = rowCount * ROW_HEIGHT;
  const scaled = total > MAX_SCROLL_PX;
  const scrollHeight = scaled ? MAX_SCROLL_PX : total;
  let top: number;
  if (scaled) {
    const range = Math.max(1, MAX_SCROLL_PX - viewportPx);
    top = Math.min(1, Math.max(0, scrollTop / range)) * Math.max(0, rowCount - visible);
  } else {
    top = scrollTop / ROW_HEIGHT;
  }
  const first = Math.max(0, Math.floor(top) - overscan);
  const last = Math.min(rowCount - 1, Math.floor(top) + visible + overscan);
  return { top, first, last, scrollHeight: scrollHeight + HEADER_HEIGHT };
}

// ── view: filter and sort ──────────────────────────────────────────────────────

export const SORT_LIMIT = 300_000;
const CHUNK = 50_000;

export interface ViewOptions {
  /** Row index where data starts (1 when the first row is a header). */
  startRow: number;
  query: string;
  /** Column to search, or -1 for every column. */
  column?: number;
  sortCol: number;
  sortDir: SortDir;
  signal?: { aborted: boolean };
}

/** Row indexes to show, after the filter and the sort; chunked so the page stays responsive. Null when cancelled. */
export async function buildView(rows: Rows, opts: ViewOptions): Promise<Uint32Array | null> {
  const needle = opts.query.trim().toLowerCase();
  const column = opts.column ?? -1;
  const picked: number[] = [];
  const start = Math.min(opts.startRow, rows.length);

  for (let from = start; from < rows.length; from += CHUNK) {
    const to = Math.min(rows.length, from + CHUNK);
    for (let r = from; r < to; r++) {
      if (!needle || rowMatches(rows[r], needle, column)) picked.push(r);
    }
    if (to < rows.length) {
      await yieldToUi();
      if (opts.signal?.aborted) return null;
    }
  }

  const out = Uint32Array.from(picked);
  if (opts.sortCol >= 0 && out.length <= SORT_LIMIT) sortIndexes(rows, out, opts.sortCol, opts.sortDir);
  return out;
}

function rowMatches(row: readonly Cell[], needle: string, column: number): boolean {
  if (column >= 0) return formatCell(row[column]).toLowerCase().includes(needle);
  for (let c = 0; c < row.length; c++) {
    const v = row[c];
    if (v === null || v === undefined || v === '') continue;
    if (formatCell(v).toLowerCase().includes(needle)) return true;
  }
  return false;
}

interface SortKey {
  num: number;
  text: string;
  empty: boolean;
}

function sortKey(value: Cell): SortKey {
  if (value === null || value === undefined || value === '') return { num: NaN, text: '', empty: true };
  if (typeof value === 'number') return { num: value, text: String(value), empty: false };
  if (value instanceof Date) return { num: value.getTime(), text: formatCell(value), empty: false };
  const text = formatCell(value);
  const trimmed = text.trim();
  const num = trimmed !== '' && /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(trimmed) ? Number(trimmed) : NaN;
  return { num, text: text.toLowerCase(), empty: false };
}

/** Sorts row indexes by one column: numbers numerically (and before text), text case-insensitively, empty cells last. */
export function sortIndexes(rows: Rows, indexes: Uint32Array, col: number, dir: SortDir): void {
  const keys = new Map<number, SortKey>();
  for (const i of indexes) keys.set(i, sortKey(rows[i]?.[col]));
  const sign = dir === 'asc' ? 1 : -1;
  indexes.sort((a, b) => {
    const ka = keys.get(a) as SortKey;
    const kb = keys.get(b) as SortKey;
    if (ka.empty || kb.empty) return ka.empty === kb.empty ? a - b : ka.empty ? 1 : -1;
    const na = !Number.isNaN(ka.num);
    const nb = !Number.isNaN(kb.num);
    let diff: number;
    if (na && nb) diff = ka.num - kb.num;
    else if (na !== nb) diff = na ? -1 : 1;
    else diff = ka.text < kb.text ? -1 : ka.text > kb.text ? 1 : 0;
    return diff === 0 ? a - b : diff * sign;
  });
}

// ── export ─────────────────────────────────────────────────────────────────────

/** CSV of the shown rows (header line first when there is one). */
export function viewToCsv(rows: Rows, view: ArrayLike<number>, columns: number, header: readonly string[] | null, delimiter = ','): string {
  const lines: string[][] = [];
  if (header) lines.push([...header]);
  for (let i = 0; i < view.length; i++) {
    const row = rows[view[i]] ?? [];
    lines.push(Array.from({ length: columns }, (_, c) => formatCell(row[c])));
  }
  return toCsv(lines, delimiter);
}

/**
 * JSON of the shown rows (empty cells become null, or empty strings when emptyAsNull is false). With a header: an array of objects keyed by the header names (numbers, booleans
 * and ISO dates keep their type for Excel input). Without: an array of arrays.
 */
export function viewToJson(
  rows: Rows,
  view: ArrayLike<number>,
  columns: number,
  header: readonly string[] | null,
  emptyAsNull = true,
): string {
  const jsonValue = (v: Cell): string | number | boolean | null => {
    if (v === null || v === undefined) return null;
    if (v === '') return emptyAsNull ? null : '';
    return v instanceof Date ? formatCell(v) : v;
  };
  const out: unknown[] = [];
  for (let i = 0; i < view.length; i++) {
    const row = rows[view[i]] ?? [];
    if (header) {
      const obj: Record<string, string | number | boolean | null> = {};
      for (let c = 0; c < columns; c++) obj[header[c]] = jsonValue(row[c]);
      out.push(obj);
    } else {
      out.push(Array.from({ length: columns }, (_, c) => jsonValue(row[c])));
    }
  }
  return JSON.stringify(out, null, 2);
}
