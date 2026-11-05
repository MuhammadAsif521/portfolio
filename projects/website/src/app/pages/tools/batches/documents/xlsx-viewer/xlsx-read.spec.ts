import { describe, expect, it } from 'vitest';
import { buildXlsx } from '../shared/office-fixtures';
import { XlsxError, checkXlsxBytes, readWorkbook, type SheetReader } from './xlsx-read';

/** Node-side reader: the universal build of the same library (the browser one needs a Web Worker). */
const reader: SheetReader = async (input) => {
  const lib = await import('read-excel-file/universal');
  return (await lib.default(input)) as { sheet: string; data: unknown[][] }[];
};

const blob = (bytes: Uint8Array) => new Blob([bytes as BlobPart]);

describe('xlsx input checks', () => {
  it('explains empty, legacy and non-zip files', () => {
    expect(() => checkXlsxBytes(new Uint8Array())).toThrow(/empty/);
    expect(() => checkXlsxBytes(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]))).toThrow(/\.xls/);
    expect(() => checkXlsxBytes(new TextEncoder().encode('a,b\n1,2'))).toThrow(XlsxError);
    expect(() => checkXlsxBytes(Uint8Array.from([0x50, 0x4b, 3, 4]))).not.toThrow();
  });
});

describe('readWorkbook', () => {
  it('reads sheets with text, numbers, booleans and dates', async () => {
    const bytes = buildXlsx([
      { name: 'Sales', rows: [['Region', 'Units', 'Active', 'Since'], ['EU', 12.5, true, new Date('2026-01-31T00:00:00Z')], ['US', 7, false, null]] },
      { name: 'Notes', rows: [['Only one cell']] },
    ]);
    const sheets = await readWorkbook(blob(bytes), reader);
    expect(sheets.map((s) => s.name)).toEqual(['Sales', 'Notes']);
    expect(sheets[0].columns).toBe(4);
    expect(sheets[0].rows[0]).toEqual(['Region', 'Units', 'Active', 'Since']);
    expect(sheets[0].rows[1].slice(0, 3)).toEqual(['EU', 12.5, true]);
    expect(sheets[0].rows[1][3]).toBeInstanceOf(Date);
    expect((sheets[0].rows[1][3] as Date).toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(sheets[1].rows).toEqual([['Only one cell']]);
  });

  it('fails with a plain message for a zip that is not a workbook', async () => {
    const notExcel = new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(readWorkbook(blob(notExcel), reader)).rejects.toThrow(/Could not read this workbook/);
  });

  it('rejects text files before parsing', async () => {
    await expect(readWorkbook(new Blob(['a,b\n1,2']), reader)).rejects.toThrow(/not an .xlsx file/);
  });
});
