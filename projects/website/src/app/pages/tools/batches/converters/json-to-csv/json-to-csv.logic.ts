import {
  type ConvertResult,
  type ConvertFailure,
  byteLength,
  fail,
  failFromException,
  parseJson,
  plural,
  stringifyJson,
} from '../shared/convert-common';

/*
 * JSON → CSV. The CSV writing itself is papaparse (quoting, delimiters, line endings); everything that decides
 * which rows and columns exist is here, so it can be unit tested without the library's quirks.
 */

export interface JsonToCsvOptions {
  delimiter: ',' | ';' | '\t' | '|';
  /** First row holds the column names. */
  header: boolean;
  /** Nested objects become `a.b.c` columns, or stay as a JSON string in one cell. */
  nested: 'flatten' | 'stringify';
  /** Arrays become a JSON string, a "a; b; c" list, or one column per index (`tags.0`, `tags.1`). */
  arrays: 'json' | 'join' | 'columns';
  columnOrder: 'first-seen' | 'alphabetical';
  quoteAll: boolean;
  newline: '\n' | '\r\n';
  /** Start the downloaded file with a UTF-8 byte order mark so Excel reads accents and emoji correctly. */
  bom: boolean;
  /** Prefix cells that start with = + - @ with a single quote so spreadsheets do not run them as formulas. */
  guardFormulas: boolean;
  nullAs: 'empty' | 'null';
  /** ISO 8601 timestamps as `YYYY-MM-DD HH:MM:SS` (UTC), which Excel recognises as dates. */
  dates: 'keep' | 'excel';
  /** What a top-level object is: detect, one row, or one row per key. */
  rootObject: 'auto' | 'row' | 'keyed';
  /** Dot path to the rows inside the document, e.g. `data.users`. Empty means detect. */
  path: string;
}

export const DEFAULT_JSON_TO_CSV: JsonToCsvOptions = {
  delimiter: ',',
  header: true,
  nested: 'flatten',
  arrays: 'json',
  columnOrder: 'first-seen',
  quoteAll: false,
  newline: '\n',
  bom: false,
  guardFormulas: false,
  nullAs: 'empty',
  dates: 'keep',
  rootObject: 'auto',
  path: '',
};

export const MAX_COLUMNS = 10_000;
const MAX_DEPTH = 100;
const LIST_SEPARATOR = '; ';

type Cell = string | number | boolean;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

export interface RowSelection {
  rows: unknown[];
  /** What was chosen automatically, for the status line. */
  note?: string;
  /** Rows are already arrays of cells (an array of arrays). */
  matrix?: boolean;
}

/** Walk `a.b.0.c` through objects and arrays. */
export function resolvePath(root: unknown, path: string): { found: true; value: unknown } | { found: false; at: string } {
  let current: unknown = root;
  const walked: string[] = [];
  for (const part of path.split('.').map((p) => p.trim()).filter(Boolean)) {
    walked.push(part);
    if (Array.isArray(current) && /^\d+$/.test(part) && Number(part) < current.length) current = current[Number(part)];
    else if (isRecord(current) && Object.prototype.hasOwnProperty.call(current, part)) current = current[part];
    else return { found: false, at: walked.join('.') };
  }
  return { found: true, value: current };
}

/** Decides which part of the document becomes the rows. */
export function selectRows(value: unknown, options: Pick<JsonToCsvOptions, 'rootObject' | 'path'>): RowSelection | ConvertFailure {
  let target = value;
  let note: string | undefined;
  if (options.path.trim()) {
    const hit = resolvePath(value, options.path);
    if (!hit.found) return fail(`The path "${options.path.trim()}" does not exist in this JSON (nothing at "${hit.at}").`);
    target = hit.value;
    note = `rows from "${options.path.trim()}"`;
  }
  if (Array.isArray(target)) {
    const matrix = target.length > 0 && target.every(Array.isArray);
    return { rows: target, note, matrix };
  }
  if (!isRecord(target)) {
    return fail('CSV needs a table: an array of objects, an array of arrays, or an object. This JSON is a single value.');
  }
  if (options.rootObject === 'row') return { rows: [target], note };
  if (options.rootObject === 'keyed') {
    const rows = Object.keys(target).map((key) => {
      const v = target[key];
      return isRecord(v) ? { key, ...v } : { key, value: v };
    });
    return { rows, note: 'one row per top-level key' };
  }
  // auto: an array of records hidden under a key (the usual API envelope), else columns, else a single row.
  const keys = Object.keys(target);
  let best: { key: string; length: number } | null = null;
  for (const key of keys) {
    const v = target[key];
    if (Array.isArray(v) && v.some(isRecord) && (!best || v.length > best.length)) best = { key, length: v.length };
  }
  if (best) {
    return { rows: target[best.key] as unknown[], note: `rows from "${best.key}" (the largest array of objects)` };
  }
  if (keys.length > 0 && keys.every((k) => Array.isArray(target[k]))) {
    const columns = target as Record<string, unknown[]>;
    const length = Math.max(...keys.map((k) => columns[k].length));
    const rows = Array.from({ length }, (_, i) => {
      const row: Record<string, unknown> = {};
      for (const k of keys) row[k] = i < columns[k].length ? columns[k][i] : null;
      return row;
    });
    return { rows, note: 'each key is a column' };
  }
  return { rows: [target], note };
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

export function isoToExcelDate(text: string): string | null {
  if (!ISO_TIMESTAMP.test(text)) return null;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 19).replace('T', ' ');
}

interface Flattener {
  record: Map<string, Cell>;
  options: JsonToCsvOptions;
  collisions: Set<string>;
  tooManyColumns: boolean;
}

function put(f: Flattener, key: string, value: Cell): void {
  if (f.record.has(key)) f.collisions.add(key);
  f.record.set(key, value);
}

function scalarCell(value: unknown, options: JsonToCsvOptions): Cell {
  if (value === null || value === undefined) return options.nullAs === 'null' ? 'null' : '';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  return String(value);
}

function flattenValue(f: Flattener, key: string, value: unknown, depth: number): void {
  const { options } = f;
  if (Array.isArray(value)) {
    if (value.length === 0) return put(f, key, '');
    if (options.arrays === 'columns' && depth < MAX_DEPTH) {
      value.forEach((item, i) => flattenValue(f, key ? `${key}.${i}` : `column_${i + 1}`, item, depth + 1));
      return;
    }
    if (options.arrays === 'join' && value.every((v) => !isRecord(v) && !Array.isArray(v))) {
      return put(f, key, value.map((v) => String(scalarCell(v, options))).join(LIST_SEPARATOR));
    }
    return put(f, key, stringifyJson(value, undefined));
  }
  if (isRecord(value) && !(value instanceof Date)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return put(f, key, '');
    if ((options.nested === 'stringify' && key) || depth >= MAX_DEPTH) return put(f, key, stringifyJson(value, undefined));
    for (const k of keys) flattenValue(f, key ? `${key}.${k}` : k, value[k], depth + 1);
    return;
  }
  put(f, key || 'value', scalarCell(value, options));
}

export interface Table {
  fields: string[];
  rows: Cell[][];
  collisions: string[];
}

/** Rows → one flat record each → a table whose columns are the union of every record's keys. */
export function buildTable(rows: unknown[], options: JsonToCsvOptions, matrix = false): Table | ConvertFailure {
  const order = new Map<string, number>();
  const records: Map<string, Cell>[] = [];
  const collisions = new Set<string>();
  for (const row of rows) {
    const f: Flattener = { record: new Map(), options, collisions, tooManyColumns: false };
    if (matrix && Array.isArray(row)) row.forEach((item, i) => flattenValue(f, `column_${i + 1}`, item, 1));
    else flattenValue(f, '', row, 0);
    for (const key of f.record.keys()) {
      if (!order.has(key)) {
        order.set(key, order.size);
        if (order.size > MAX_COLUMNS) {
          return fail(`These rows produce more than ${MAX_COLUMNS.toLocaleString('en-US')} different columns. Switch "Arrays" to JSON string or "Nested objects" to JSON string, or pick a narrower path.`);
        }
      }
    }
    records.push(f.record);
  }
  let fields = [...order.keys()];
  if (options.columnOrder === 'alphabetical') fields = fields.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const table = records.map((record) => fields.map((field) => record.get(field) ?? ''));
  return { fields, rows: table, collisions: [...collisions] };
}

/** Prefix formula-looking text cells with ' (plain numbers like -5 are left alone). */
export function guardCell(cell: Cell): { cell: Cell; guarded: boolean } {
  if (typeof cell !== 'string' || !/^[=+\-@\t\r]/.test(cell) || NUMERIC_TEXT.test(cell)) return { cell, guarded: false };
  return { cell: `'${cell}`, guarded: true };
}

type PapaModule = { unparse: (input: unknown, config?: Record<string, unknown>) => string };

export async function convertJsonToCsv(text: string, options: JsonToCsvOptions): Promise<ConvertResult> {
  try {
    const parsed = parseJson(text);
    if (!parsed.ok) return parsed;
    const selected = selectRows(parsed.value, options);
    if ('ok' in selected) return selected;
    if (selected.rows.length === 0) return fail('The array is empty, so there are no rows to write.');

    const built = buildTable(selected.rows, options, selected.matrix);
    if ('ok' in built) return built;
    const warnings = [...parsed.warnings];
    if (parsed.bigInts) warnings.push(`${plural(parsed.bigInts, 'integer')} beyond 2^53 kept exact as digits.`);
    if (built.collisions.length) {
      const shown = built.collisions.slice(0, 3).map((k) => `"${k}"`).join(', ');
      warnings.push(`Some keys flatten to the same column name (${shown}${built.collisions.length > 3 ? ', ...' : ''}); the later value won. Use "Nested objects: JSON string" to keep both.`);
    }

    let dates = 0;
    let guarded = 0;
    const data = built.rows.map((row) =>
      row.map((cell) => {
        let out: Cell = cell;
        if (options.dates === 'excel' && typeof out === 'string') {
          const converted = isoToExcelDate(out);
          if (converted) (out = converted, dates++);
        }
        if (options.guardFormulas) {
          const g = guardCell(out);
          if (g.guarded) guarded++;
          out = g.cell;
        }
        return out;
      }),
    );
    const fields = options.guardFormulas ? built.fields.map((f) => guardCell(f).cell as string) : built.fields;
    if (guarded) {
      warnings.push(
        `${plural(guarded, 'cell')} started with = + - or @ and got a leading ' so Excel and Sheets show them as text instead of running them as formulas.`,
      );
    }
    if (dates) warnings.push(`${plural(dates, 'ISO timestamp')} written as "YYYY-MM-DD HH:MM:SS" in UTC.`);

    const mod = (await import('papaparse')) as unknown as { default?: PapaModule } & PapaModule;
    const Papa = mod.default ?? mod;
    const config = { delimiter: options.delimiter, newline: options.newline, quotes: options.quoteAll, header: options.header, skipEmptyLines: false };
    const output = options.header ? Papa.unparse({ fields, data }, config) : Papa.unparse(data, config);

    const meta = [plural(data.length, 'row'), plural(fields.length, 'column'), `${byteLength(output).toLocaleString('en-US')} bytes`];
    if (selected.note) meta.unshift(selected.note);
    return { ok: true, output, meta, warnings, bom: options.bom };
  } catch (error) {
    return failFromException(error, 'json-to-csv');
  }
}
