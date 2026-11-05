import { isOleOffice, isZip } from '../shared/doc-utils';
import { type Cell, maxColumns } from '../shared/grid-data';

export const XLSX_MAX_MB = 30;

export class XlsxError extends Error {}

export interface SheetModel {
  name: string;
  rows: Cell[][];
  columns: number;
}

/** What read-excel-file hands back: every sheet with its rows of values. */
export type SheetReader = (input: Blob | ArrayBuffer) => Promise<{ sheet: string; data: unknown[][] }[]>;

/** The browser build parses in a Web Worker, so large workbooks do not freeze the page. */
const browserReader: SheetReader = async (input) => {
  const lib = await import('read-excel-file/browser');
  return (await lib.default(input)) as { sheet: string; data: unknown[][] }[];
};

export function checkXlsxBytes(head: Uint8Array): void {
  if (head.length === 0) throw new XlsxError('This file is empty.');
  if (isOleOffice(head)) {
    throw new XlsxError(
      'This looks like an older Excel file (.xls) or a password-protected workbook. Save it as .xlsx (without a password) in Excel and open that.',
    );
  }
  if (!isZip(head)) throw new XlsxError('This is not an .xlsx file. An .xlsx is a ZIP package that Excel saves; this file is something else.');
}

const isCell = (v: unknown): v is Cell =>
  v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v instanceof Date;

/** Reads every sheet of an .xlsx as rows of typed values (cached results only: formulas are not recalculated). */
export async function readWorkbook(file: Blob, reader: SheetReader = browserReader): Promise<SheetModel[]> {
  checkXlsxBytes(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = await reader(file);
  } catch {
    throw new XlsxError('Could not read this workbook. It may be damaged, password-protected, or not an Excel .xlsx file.');
  }
  if (!sheets.length) throw new XlsxError('This workbook has no sheets.');
  return sheets.map((s) => {
    const rows = s.data.map((row) => row.map((v) => (isCell(v) ? v : String(v))));
    return { name: s.sheet || 'Sheet', rows, columns: maxColumns(rows) };
  });
}
