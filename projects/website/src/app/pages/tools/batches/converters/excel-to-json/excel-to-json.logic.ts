import {
  type ConvertResult,
  type IndentChoice,
  byteLength,
  defineOwn,
  fail,
  failFromException,
  jsonIndent,
  plural,
} from '../shared/convert-common';

/*
 * .xlsx → JSON or CSV with read-excel-file. Two steps: readWorkbook() opens the file once (in a Web Worker for
 * anything above ~1 MB) and returns every sheet as rows of cells; sheetToOutput() turns one sheet into JSON or
 * CSV text. Only the values saved in the file are read: a formula cell yields the result Excel stored the last
 * time the workbook was saved, never a recalculated one.
 */

export type Cell = string | number | boolean | Date | null;

export interface SheetRows {
  name: string;
  rows: Cell[][];
}

export type WorkbookResult = { ok: true; sheets: SheetRows[] } | { ok: false; message: string };

export interface ExcelOptions {
  /** Sheet name. Empty means the first sheet. */
  sheet: string;
  format: 'json' | 'csv';
  /** json only */
  shape: 'objects' | 'arrays';
  /** 1-based row that holds the column names; 0 means there is no header row. */
  headerRow: string;
  /** `iso`: 2024-03-05T00:00:00.000Z. `date`: 2024-03-05. `datetime`: 2024-03-05 14:30:00. All in UTC, as stored. */
  dates: 'iso' | 'date' | 'datetime';
  /** How an empty cell is written in JSON objects. */
  empty: 'null' | 'omit' | 'string';
  trim: boolean;
  skipEmptyRows: boolean;
  indent: IndentChoice;
  /** csv only */
  delimiter: ',' | ';' | '\t';
  bom: boolean;
}

export const DEFAULT_EXCEL: ExcelOptions = {
  sheet: '',
  format: 'json',
  shape: 'objects',
  headerRow: '1',
  dates: 'iso',
  empty: 'null',
  trim: true,
  skipEmptyRows: true,
  indent: '2',
  delimiter: ',',
  bom: false,
};

export const MAX_ROWS_PER_YIELD = 5000;

const looksLikeZip = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
const looksLikeLegacyXls = (bytes: Uint8Array) => bytes.length > 7 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

/** Plain-language explanation for whatever read-excel-file threw. */
export function explainReadError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  const code = (error as { code?: string } | null)?.code ?? '';
  if (name === 'InvalidInputError') {
    switch (code) {
      case 'XLS_FILE_NOT_SUPPORTED':
        return 'This is an old .xls file (binary format). Open it in Excel or LibreOffice and save it as .xlsx, then try again.';
      case 'INVALID_ZIP':
        return 'This file is not a valid .xlsx workbook: it cannot be opened as a ZIP archive. It may be corrupt, cut short, or a different kind of file renamed to .xlsx.';
      case 'NO_DATA':
        return 'This file is empty.';
      default:
        return 'This is not a standard .xlsx workbook. It may be password-protected, another spreadsheet format, or damaged.';
    }
  }
  if (name === 'InvalidSpreadsheetError') return 'The workbook is damaged or uses a structure this reader does not understand. Try opening it in Excel and saving a copy as .xlsx.';
  const message = error instanceof Error ? error.message : '';
  if (/Invalid string length|allocation|out of memory/i.test(message)) return 'This workbook is too large to read in a browser tab. Split it into smaller files.';
  return 'This file could not be read as an .xlsx workbook. It may be damaged, password-protected, or not a spreadsheet.';
}

type Reader = { default: (input: ArrayBuffer, options?: Record<string, unknown>) => Promise<{ sheet: string; data: Cell[][] }[]> };

/** Opens an .xlsx and returns every sheet as rows of cells (dates as Date, empty cells as null). */
export async function readWorkbook(buffer: ArrayBuffer): Promise<WorkbookResult> {
  try {
    const head = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
    if (buffer.byteLength === 0) return { ok: false, message: 'This file is empty.' };
    if (looksLikeLegacyXls(head)) return { ok: false, message: explainReadError({ name: 'InvalidInputError', code: 'XLS_FILE_NOT_SUPPORTED' }) };
    if (!looksLikeZip(head)) return { ok: false, message: explainReadError({ name: 'InvalidInputError', code: 'INVALID_ZIP' }) };
    const reader = (await import('read-excel-file/universal')) as unknown as Reader;
    const sheets = await reader.default(buffer, { trim: false });
    if (!sheets.length) return { ok: false, message: 'This workbook has no sheets.' };
    return { ok: true, sheets: sheets.map((s) => ({ name: s.sheet, rows: s.data })) };
  } catch (error) {
    return { ok: false, message: explainReadError(error) };
  }
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function formatDate(date: Date, mode: ExcelOptions['dates']): string {
  if (Number.isNaN(date.getTime())) return '';
  if (mode === 'iso') return date.toISOString();
  const day = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  if (mode === 'date') return day;
  return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

type Plain = string | number | boolean | null;

function plainCell(cell: Cell | undefined, options: ExcelOptions): Plain {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return formatDate(cell, options.dates);
  if (typeof cell === 'string') {
    const text = options.trim ? cell.trim() : cell;
    return text === '' ? null : text;
  }
  return cell;
}

const isBlank = (cell: Plain) => cell === null || cell === '';
const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

export function parseHeaderRow(value: string): number | null {
  const n = Number(String(value).trim());
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
}

/** One sheet as JSON or CSV text. Long sheets are processed in slices so the page keeps responding. */
export async function sheetToOutput(sheet: SheetRows, options: ExcelOptions): Promise<ConvertResult> {
  try {
    if (sheet.rows.length === 0) return fail(`The sheet "${sheet.name}" is empty.`);
    const header = parseHeaderRow(options.headerRow);
    if (header === null) return fail('Header row must be a whole number: 1 for the first row, or 0 when the sheet has no header.');
    if (header > sheet.rows.length) return fail(`The sheet "${sheet.name}" has ${plural(sheet.rows.length, 'row')}, so row ${header} cannot be the header.`);
    const warnings: string[] = [];

    // Cells to plain values, slice by slice.
    const plain: Plain[][] = [];
    for (let i = 0; i < sheet.rows.length; i++) {
      plain.push(sheet.rows[i].map((c) => plainCell(c, options)));
      if (i % MAX_ROWS_PER_YIELD === MAX_ROWS_PER_YIELD - 1) await tick();
    }
    const width = plain.reduce((m, r) => Math.max(m, r.length), 0);
    if (width === 0) return fail(`The sheet "${sheet.name}" is empty.`);

    let names: string[] = [];
    let bodyStart = 0;
    if (header > 0) {
      const seen = new Map<string, number>();
      let renamed = 0;
      names = Array.from({ length: width }, (_, i) => {
        const raw = plain[header - 1]?.[i];
        const base = raw === null || raw === undefined ? `column_${i + 1}` : String(raw);
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        if (n === 1) return base;
        renamed++;
        return `${base}_${n}`;
      });
      if (renamed) warnings.push(`${plural(renamed, 'duplicate column name')} got a numeric suffix so no value is overwritten.`);
      bodyStart = header;
    } else {
      names = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    }

    let body = plain.slice(bodyStart);
    if (options.skipEmptyRows) {
      body = body.filter((r) => r.some((c) => !isBlank(c)));
    }
    if (body.length === 0) return fail(`The sheet "${sheet.name}" has a header but no data rows.`);

    let unsafe = 0;
    for (const r of body) for (const c of r) if (typeof c === 'number' && Number.isInteger(c) && Math.abs(c) > Number.MAX_SAFE_INTEGER) unsafe++;
    if (unsafe) warnings.push(`${plural(unsafe, 'number')} are larger than 2^53 and Excel stores them as floating-point, so digits beyond about 15 are not exact. Format such cells as Text in Excel (ids, card numbers) to keep every digit.`);

    let output: string;
    let bom = false;
    if (options.format === 'csv') {
      const mod = (await import('papaparse')) as unknown as { default?: { unparse: (i: unknown, c?: Record<string, unknown>) => string } } & { unparse: (i: unknown, c?: Record<string, unknown>) => string };
      const Papa = mod.default ?? mod;
      const data = body.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
      output = header > 0 ? Papa.unparse({ fields: names, data }, { delimiter: options.delimiter, newline: '\n' }) : Papa.unparse(data, { delimiter: options.delimiter, newline: '\n' });
      bom = options.bom;
    } else {
      const indent = jsonIndent(options.indent);
      const rowText = (value: unknown): string => JSON.stringify(value, null, indent);
      const pieces: string[] = [];
      for (let i = 0; i < body.length; i++) {
        const r = body[i];
        let record: unknown;
        if (options.shape === 'arrays') {
          record = Array.from({ length: width }, (_, c) => (r[c] === null || r[c] === undefined ? (options.empty === 'string' ? '' : null) : r[c]));
        } else {
          const obj: Record<string, unknown> = {};
          for (let c = 0; c < width; c++) {
            const v = r[c] ?? null;
            if (v === null && options.empty === 'omit') continue;
            defineOwn(obj, names[c], v === null && options.empty === 'string' ? '' : v);
          }
          record = obj;
        }
        pieces.push(rowText(record));
        if (i % MAX_ROWS_PER_YIELD === MAX_ROWS_PER_YIELD - 1) await tick();
      }
      if (indent === undefined) output = `[${pieces.join(',')}]`;
      else {
        const lead = typeof indent === 'number' ? ' '.repeat(indent) : indent;
        output = `[\n${pieces.map((p) => p.replace(/^/gm, lead)).join(',\n')}\n]`;
      }
    }

    const meta = [`sheet "${sheet.name}"`, plural(body.length, 'row'), plural(width, 'column'), `${byteLength(output).toLocaleString('en-US')} bytes`];
    return { ok: true, output, meta, warnings, bom };
  } catch (error) {
    return failFromException(error, 'excel-to-json');
  }
}
