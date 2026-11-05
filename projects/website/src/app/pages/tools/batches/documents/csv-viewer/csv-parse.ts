import { MB } from '../shared/doc-utils';

export const CSV_MAX_MB = 100;
export const CSV_WARN_MB = 25;
/** Rows kept in memory; a file with more is shown up to this and flagged. */
export const MAX_ROWS = 2_000_000;
const CHUNK_BYTES = MB;

export const DELIMITERS = [',', ';', '\t', '|'] as const;
export const DELIMITER_NAMES: Record<string, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

export type Encoding = 'utf-8' | 'windows-1252' | 'iso-8859-1' | 'utf-16le' | 'utf-16be';

// ── detection ──────────────────────────────────────────────────────────────────

/** Guesses the text encoding from the first bytes: a byte-order mark, else UTF-8 if it decodes cleanly, else Windows-1252. Pass truncated when the bytes are only the start of a longer file. */
export function detectEncoding(head: Uint8Array, truncated = false): Encoding {
  if (head.length >= 2 && head[0] === 0xff && head[1] === 0xfe) return 'utf-16le';
  if (head.length >= 2 && head[0] === 0xfe && head[1] === 0xff) return 'utf-16be';
  if (head.length >= 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return 'utf-8';
  try {
    // A sample cut out of a longer file may end inside a multi-byte character; a whole file may not.
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: truncated });
    return 'utf-8';
  } catch {
    return 'windows-1252';
  }
}

/** Number of fields per line for the first `maxLines` lines of a sample, honouring quotes (a quoted newline stays in its line). */
function fieldCounts(sample: string, delimiter: string, maxLines: number): number[] {
  const counts: number[] = [];
  let fields = 1;
  let inQuotes = false;
  let lineHasContent = false;
  for (let i = 0; i < sample.length && counts.length < maxLines; i++) {
    const ch = sample[i];
    if (ch === '"') {
      if (inQuotes && sample[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      lineHasContent = true;
    } else if (!inQuotes && ch === delimiter) {
      fields++;
      lineHasContent = true;
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && sample[i + 1] === '\n') i++;
      if (lineHasContent) counts.push(fields);
      fields = 1;
      lineHasContent = false;
    } else {
      lineHasContent = true;
    }
  }
  return counts;
}

/** Picks the delimiter whose field count is the same on most lines (and above 1); comma when nothing stands out. */
export function detectDelimiter(sample: string): string {
  let best = ',';
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const counts = fieldCounts(sample, delimiter, 40);
    if (counts.length === 0) continue;
    const tally = new Map<number, number>();
    for (const c of counts) tally.set(c, (tally.get(c) ?? 0) + 1);
    let modal = 1;
    let modalLines = 0;
    for (const [fields, lines] of tally) {
      if (fields > 1 && lines > modalLines) {
        modal = fields;
        modalLines = lines;
      }
    }
    if (modal < 2) continue;
    const consistency = modalLines / counts.length;
    if (consistency < 0.6) continue;
    const score = consistency * 100 + Math.min(modal, 20);
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

// ── parsing ────────────────────────────────────────────────────────────────────

export interface ParseOptions {
  delimiter: string;
  encoding: Encoding;
  onProgress?: (fraction: number) => void;
  signal?: { aborted: boolean };
}

export interface ParsedCsv {
  rows: string[][];
  columns: number;
  /** Rows whose number of fields differs from the first row's. */
  irregularRows: number;
  /** Rows with a quote that is never closed or is misplaced. */
  quoteIssues: number;
  /** More rows than MAX_ROWS: the rest was not loaded. */
  truncated: boolean;
  /** The text contains U+FFFD: the chosen encoding is probably wrong. */
  replacementChars: boolean;
}

/** Streams a file (or parses a string) with Papa Parse into rows of text. Rows are kept as they are; nothing is typed. */
export async function parseCsv(input: Blob | string, opts: ParseOptions): Promise<ParsedCsv> {
  const Papa = (await import('papaparse')).default;
  const rows: string[][] = [];
  let irregular = 0;
  let quoteIssues = 0;
  let columns = 0;
  let truncated = false;
  let replacement = false;
  const size = typeof input === 'string' ? input.length : input.size;

  const take = (data: string[][], abort: () => void): void => {
    for (const row of data) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        abort();
        return;
      }
      if (!replacement && rows.length < 2000 && row.some((cell) => cell.includes('�'))) replacement = true;
      if (rows.length === 0) columns = row.length;
      else if (row.length !== rows[0].length) irregular++;
      if (row.length > columns) columns = row.length;
      rows.push(row);
    }
  };

  await new Promise<void>((resolve, reject) => {
    const base = {
      delimiter: opts.delimiter,
      skipEmptyLines: true as const,
      header: false as const,
      dynamicTyping: false as const,
    };
    const countErrors = (errors: { type: string }[]): void => {
      for (const e of errors) if (e.type === 'Quotes') quoteIssues++;
    };
    if (typeof input === 'string') {
      const result = Papa.parse<string[]>(input, base);
      countErrors(result.errors);
      take(result.data, () => undefined);
      resolve();
      return;
    }
    Papa.parse<string[]>(input as File, {
      ...base,
      encoding: opts.encoding,
      chunkSize: CHUNK_BYTES,
      chunk: (results, parser) => {
        if (opts.signal?.aborted) {
          parser.abort();
          return;
        }
        countErrors(results.errors);
        take(results.data, () => parser.abort());
        opts.onProgress?.(Math.min(1, results.meta.cursor / Math.max(1, size)));
      },
      complete: () => {
        opts.onProgress?.(1);
        resolve();
      },
      error: (error: Error) => reject(error),
    });
  });

  return { rows, columns, irregularRows: irregular, quoteIssues, truncated, replacementChars: replacement };
}
