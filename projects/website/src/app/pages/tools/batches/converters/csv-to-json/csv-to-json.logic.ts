import {
  type ConvertResult,
  type IndentChoice,
  byteLength,
  defineOwn,
  fail,
  failAt,
  failFromException,
  jsonIndent,
  offsetToLocation,
  plural,
  stripBom,
} from '../shared/convert-common';

/*
 * CSV / TSV → JSON. papaparse tokenises the text (quotes, escaped quotes, line breaks inside cells) and tells us
 * where each row ends, so every warning and error can name the exact line. Delimiter detection, headers, type
 * inference and the shape of the result are done here.
 */

export type Delimiter = ',' | ';' | '\t' | '|';

export interface CsvToJsonOptions {
  delimiter: 'auto' | Delimiter;
  /** First row holds the keys. */
  header: boolean;
  /** Turn numbers, true/false and null into JSON values instead of keeping every cell as a string. */
  inferTypes: boolean;
  trim: boolean;
  /** Skip lines that are empty (or only spaces). */
  skipEmpty: boolean;
  emptyAsNull: boolean;
  shape: 'objects' | 'arrays';
  indent: IndentChoice;
}

export const DEFAULT_CSV_TO_JSON: CsvToJsonOptions = {
  delimiter: 'auto',
  header: true,
  inferTypes: true,
  trim: true,
  skipEmpty: true,
  emptyAsNull: false,
  shape: 'objects',
  indent: '2',
};

const CANDIDATES: Delimiter[] = [',', ';', '\t', '|'];
const SNIFF_CHARS = 64_000;
const SNIFF_LINES = 30;
const MAX_LISTED = 3;

const DELIMITER_NAME: Record<Delimiter, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

/** Picks the delimiter that splits the first lines into the same number (more than one) of fields. */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.slice(0, SNIFF_CHARS);
  const counts = new Map<Delimiter, number[]>(CANDIDATES.map((d) => [d, [0]]));
  let inQuotes = false;
  let lines = 1;
  for (let i = 0; i < sample.length && lines <= SNIFF_LINES; i++) {
    const c = sample[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (c === '\n' || (c === '\r' && sample[i + 1] !== '\n'))) {
      if (sample.slice(0, i).trim()) {
        lines++;
        for (const list of counts.values()) list.push(0);
      }
    } else if (!inQuotes && c !== '\r') {
      const list = counts.get(c as Delimiter);
      if (list) list[list.length - 1]++;
    }
  }
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of CANDIDATES) {
    const fields = (counts.get(d) ?? []).filter((n, idx, all) => n > 0 || idx < all.length - 1).map((n) => n + 1);
    if (!fields.length) continue;
    const freq = new Map<number, number>();
    for (const f of fields) freq.set(f, (freq.get(f) ?? 0) + 1);
    const [modal, hits] = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (modal < 2) continue;
    const score = (hits / fields.length) * 100 + Math.min(modal, 20) / 100;
    if (score > bestScore) (best = d, (bestScore = score));
  }
  return best;
}

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** The JSON value for one cell. Numbers that would lose digits (long ids) and "007" style codes stay strings. */
export function inferValue(cell: string, options: Pick<CsvToJsonOptions, 'inferTypes' | 'emptyAsNull'>): string | number | boolean | null {
  if (cell === '') return options.emptyAsNull ? null : '';
  if (!options.inferTypes) return cell;
  if (/^(?:true|false)$/i.test(cell)) return cell.toLowerCase() === 'true';
  if (/^null$/i.test(cell)) return null;
  if (!NUMBER.test(cell)) return cell;
  const significant = cell.replace(/[eE].*$/, '').replace(/[-.]/g, '').replace(/^0+/, '');
  if (significant.length > 15) return cell;
  const n = Number(cell);
  return Number.isFinite(n) ? n : cell;
}

type PapaStep = (results: { data: string[]; errors: { code: string; message: string; index?: number }[]; meta: { cursor: number } }) => void;
type PapaModule = { parse: (input: string, config: Record<string, unknown>) => unknown };

interface Notice {
  count: number;
  lines: number[];
}

const note = (n: Notice, line: number | null) => {
  n.count++;
  if (line !== null && n.lines.length < MAX_LISTED) n.lines.push(line);
};
const where = (n: Notice) => `line${n.lines.length === 1 ? '' : 's'} ${n.lines.join(', ')}${n.count > n.lines.length ? ` and ${n.count - n.lines.length} more` : ''}`;

export async function convertCsvToJson(raw: string, options: CsvToJsonOptions): Promise<ConvertResult> {
  try {
    const text = stripBom(raw);
    if (!text.trim()) return fail('There is nothing to convert yet.');
    const delimiter = options.delimiter === 'auto' ? detectDelimiter(text) : options.delimiter;

    const mod = (await import('papaparse')) as unknown as { default?: PapaModule } & PapaModule;
    const Papa = mod.default ?? mod;

    const rows: { fields: string[]; start: number }[] = [];
    const quoteErrors: { offset: number; fatal: boolean }[] = [];
    let previousEnd = 0;
    const step: PapaStep = (results) => {
      const start = previousEnd;
      previousEnd = results.meta.cursor;
      for (const e of results.errors) {
        if (e.code === 'MissingQuotes') quoteErrors.push({ offset: Math.max(0, (e.index ?? start + 1) - 1), fatal: true });
        else if (e.code === 'InvalidQuotes') quoteErrors.push({ offset: e.index ?? start, fatal: false });
      }
      rows.push({ fields: results.data, start });
    };
    Papa.parse(text, { delimiter, step, skipEmptyLines: false, header: false, dynamicTyping: false });

    const fatal = quoteErrors.find((e) => e.fatal);
    if (fatal) {
      const malformed = quoteErrors.find((e) => !e.fatal);
      if (malformed) {
        return failAt(
          'A closing " is followed by other characters, so the parser cannot tell where this cell ends. Inside a quoted cell, write a quote as two quotes ("").',
          text,
          offsetToLocation(text, malformed.offset),
        );
      }
      return failAt('A quoted field is never closed: a " opens a value that has no matching closing ".', text, offsetToLocation(text, fatal.offset));
    }

    const warnings: string[] = [];
    const badQuotes: Notice = { count: 0, lines: [] };
    for (const e of quoteErrors) note(badQuotes, offsetToLocation(text, e.offset).line);
    if (badQuotes.count) warnings.push(`Malformed quotes near ${where(badQuotes)}: a closing quote is followed by other characters. The cell was kept as parsed.`);

    // Drop empty lines (and the empty "row" after a final line break).
    const kept = rows.filter((r) => {
      const empty = r.fields.length === 1 && (r.fields[0] === '' || r.fields[0].trim() === '');
      if (!empty) return true;
      if (r.start >= text.length) return false;
      return !options.skipEmpty && r.fields[0] === '';
    });
    if (kept.length === 0) return fail('No rows found: the text only contains empty lines.');

    const prepare = (cell: string) => (options.trim ? cell.trim() : cell);
    const asObjects = options.shape === 'objects';
    let names: string[] = [];
    let body = kept;
    if (options.header && !asObjects) {
      body = kept.slice(1);
    } else if (options.header) {
      const seen = new Map<string, number>();
      let renamed = 0;
      names = kept[0].fields.map((cell, i) => {
        const base = prepare(cell) || `column_${i + 1}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        if (n === 1) return base;
        renamed++;
        return `${base}_${n}`;
      });
      if (renamed) warnings.push(`${plural(renamed, 'duplicate column name')} got a numeric suffix (for example "${names.find((x) => /_\d+$/.test(x))}") so no value is overwritten.`);
      body = kept.slice(1);
    }
    const width = options.header && asObjects ? names.length : kept.reduce((m, r) => Math.max(m, r.fields.length), 0);
    if (!options.header && asObjects) names = Array.from({ length: width }, (_, i) => `column_${i + 1}`);

    const tooMany: Notice = { count: 0, lines: [] };
    const tooFew: Notice = { count: 0, lines: [] };
    const records: unknown[] = options.header && !asObjects ? [kept[0].fields.map(prepare)] : [];
    for (const row of body) {
      const values = row.fields.map((cell) => inferValue(prepare(cell), options));
      if (options.header && asObjects) {
        const lineOf = (n: Notice) => (n.lines.length < MAX_LISTED ? offsetToLocation(text, row.start).line : null);
        if (values.length > names.length) note(tooMany, lineOf(tooMany));
        else if (values.length < names.length) note(tooFew, lineOf(tooFew));
      }
      if (asObjects) {
        const record: Record<string, unknown> = {};
        names.forEach((name, i) => defineOwn(record, name, i < values.length ? values[i] : null));
        if (values.length > names.length) defineOwn(record, '__extra', values.slice(names.length));
        records.push(record);
      } else {
        records.push(values);
      }
    }
    if (tooMany.count) warnings.push(`${plural(tooMany.count, 'row')} had more cells than the header (${where(tooMany)}). The extra cells are kept in "__extra".`);
    if (tooFew.count) warnings.push(`${plural(tooFew.count, 'row')} had fewer cells than the header (${where(tooFew)}). The missing values are null.`);

    const output = JSON.stringify(records, null, jsonIndent(options.indent));
    const meta = [
      plural(records.length, 'row'),
      plural(width, 'column'),
      `${options.delimiter === 'auto' ? 'detected ' : ''}${DELIMITER_NAME[delimiter]} delimiter`,
      `${byteLength(output).toLocaleString('en-US')} bytes`,
    ];
    if (!options.header && asObjects) meta.push('no header: keys are column_1, column_2, ...');
    return { ok: true, output, meta, warnings };
  } catch (error) {
    return failFromException(error, 'csv-to-json');
  }
}
