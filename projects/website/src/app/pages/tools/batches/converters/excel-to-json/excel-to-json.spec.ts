import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXCEL,
  explainReadError,
  formatDate,
  parseHeaderRow,
  readWorkbook,
  sheetToOutput,
  type Cell,
  type ExcelOptions,
  type SheetRows,
} from './excel-to-json.logic';

/** Builds a small but valid .xlsx (a ZIP of XML parts) with real shared strings and date styles. */
function makeXlsx(sheets: { name: string; rows: (string | number | boolean | Date | null | { f: string; v: number })[][] }[]): ArrayBuffer {
  const strings: string[] = [];
  const sst = (s: string) => {
    let i = strings.indexOf(s);
    if (i < 0) i = strings.push(s) - 1;
    return i;
  };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const col = (n: number) => String.fromCharCode(65 + n);
  const sheetXml = (rows: (typeof sheets)[number]['rows']) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
      .map(
        (row, r) =>
          `<row r="${r + 1}">${row
            .map((cell, c) => {
              const ref = `${col(c)}${r + 1}`;
              if (cell === null) return '';
              if (typeof cell === 'string') return `<c r="${ref}" t="s"><v>${sst(cell)}</v></c>`;
              if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
              if (typeof cell === 'boolean') return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
              if (cell instanceof Date) return `<c r="${ref}" s="${cell.getUTCHours() || cell.getUTCMinutes() ? 2 : 1}"><v>${cell.getTime() / 86400000 + 25569}</v></c>`;
              return `<c r="${ref}"><f>${esc(cell.f)}</f><v>${cell.v}</v></c>`;
            })
            .join('')}</row>`,
      )
      .join('')}</sheetData></worksheet>`;
  const sheetParts = sheets.map((s) => sheetXml(s.rows));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
    ),
  };
  sheetParts.forEach((xml, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xml)));
  files['xl/sharedStrings.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings
      .map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`)
      .join('')}</sst>`,
  );
  const zipped = zipSync(files);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

const opts = (over: Partial<ExcelOptions> = {}): ExcelOptions => ({ ...DEFAULT_EXCEL, indent: 'minify', ...over });

async function convert(rows: Cell[][], over: Partial<ExcelOptions> = {}, name = 'Sheet1'): Promise<string> {
  const sheet: SheetRows = { name, rows };
  const r = await sheetToOutput(sheet, opts(over));
  if (!r.ok) throw new Error(r.error.message);
  return r.output;
}

describe('excel to json: reading a workbook', () => {
  it('reads strings, numbers, booleans, dates, cached formula results and blanks across sheets', async () => {
    const buffer = makeXlsx([
      {
        name: 'People',
        rows: [
          ['name', 'age', 'active', 'joined', 'total'],
          ['Asif', 30, true, new Date(Date.UTC(2024, 2, 5)), { f: 'B2*2', v: 60 }],
          ['José 😀', 25.5, false, new Date(Date.UTC(2023, 10, 20, 14, 30)), null],
        ],
      },
      { name: 'Other & <more>', rows: [['x'], [1]] },
    ]);
    const wb = await readWorkbook(buffer);
    expect(wb.ok).toBe(true);
    if (!wb.ok) return;
    expect(wb.sheets.map((s) => s.name)).toEqual(['People', 'Other & <more>']);
    const rows = wb.sheets[0].rows;
    expect(rows[0]).toEqual(['name', 'age', 'active', 'joined', 'total']);
    expect(rows[1][0]).toBe('Asif');
    expect(rows[1][1]).toBe(30);
    expect(rows[1][2]).toBe(true);
    expect(rows[1][3]).toBeInstanceOf(Date);
    expect((rows[1][3] as Date).toISOString()).toBe('2024-03-05T00:00:00.000Z');
    expect(rows[1][4]).toBe(60);
    expect(rows[2][0]).toBe('José 😀');
    expect(rows[2][4]).toBeNull();
    expect(wb.sheets[1].rows).toEqual([['x'], [1]]);
  });

  it('explains non-xlsx input in plain language', async () => {
    const legacy = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]).buffer;
    const a = await readWorkbook(legacy);
    expect(!a.ok && a.message).toContain('old .xls');
    const text = await readWorkbook(new TextEncoder().encode('a,b\n1,2').buffer);
    expect(!text.ok && text.message).toContain('not a valid .xlsx');
    const empty = await readWorkbook(new ArrayBuffer(0));
    expect(!empty.ok && empty.message).toContain('empty');
    const good = new Uint8Array(makeXlsx([{ name: 'S', rows: [['a']] }]));
    const truncated = await readWorkbook(good.slice(0, Math.floor(good.length / 2)).buffer);
    expect(truncated.ok).toBe(false);
    const garbage = new Uint8Array(good);
    garbage.fill(0x41, 40, 120);
    expect((await readWorkbook(garbage.buffer)).ok).toBe(false);
  });

  it('rejects a ZIP that is not a spreadsheet (for example a docx or an empty archive)', async () => {
    const notExcel = zipSync({ 'word/document.xml': strToU8('<w:document/>'), '[Content_Types].xml': strToU8('<Types/>') });
    const r = await readWorkbook(notExcel.buffer.slice(notExcel.byteOffset, notExcel.byteOffset + notExcel.byteLength) as ArrayBuffer);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(20);
    expect(explainReadError(new Error('boom'))).toContain('could not be read');
    expect(explainReadError({ name: 'InvalidInputError', code: 'FILE_NOT_SUPPORTED' })).toContain('password-protected');
  });

  it('stays readable for a workbook with thousands of rows', async () => {
    const rows: (string | number)[][] = [['id', 'name']];
    for (let i = 1; i <= 20_000; i++) rows.push([i, `row ${i}`]);
    const wb = await readWorkbook(makeXlsx([{ name: 'Big', rows }]));
    expect(wb.ok && wb.sheets[0].rows.length).toBe(20_001);
    if (wb.ok) {
      const out = await sheetToOutput(wb.sheets[0], opts());
      expect(out.ok && (JSON.parse(out.output) as unknown[]).length).toBe(20_000);
    }
  });
});

describe('excel to json: converting a sheet', () => {
  const table: Cell[][] = [
    ['id', 'name', 'when', 'ok'],
    [1, 'Asif', new Date(Date.UTC(2024, 2, 5, 14, 30, 15)), true],
    [2, null, null, false],
  ];

  it('writes an array of objects, using empty cells as null by default', async () => {
    expect(JSON.parse(await convert(table))).toEqual([
      { id: 1, name: 'Asif', when: '2024-03-05T14:30:15.000Z', ok: true },
      { id: 2, name: null, when: null, ok: false },
    ]);
  });

  it('can omit empty cells or write empty strings', async () => {
    expect(JSON.parse(await convert(table, { empty: 'omit' }))[1]).toEqual({ id: 2, ok: false });
    expect(JSON.parse(await convert(table, { empty: 'string' }))[1]).toEqual({ id: 2, name: '', when: '', ok: false });
  });

  it('formats dates three ways', async () => {
    expect(JSON.parse(await convert(table, { dates: 'date' }))[0].when).toBe('2024-03-05');
    expect(JSON.parse(await convert(table, { dates: 'datetime' }))[0].when).toBe('2024-03-05 14:30:15');
    expect(formatDate(new Date(NaN), 'iso')).toBe('');
  });

  it('writes arrays of arrays', async () => {
    expect(JSON.parse(await convert(table, { shape: 'arrays' }))).toEqual([
      ['id', 'name', 'when', 'ok'],
      [1, 'Asif', '2024-03-05T14:30:15.000Z', true],
      [2, null, null, false],
    ].slice(1));
    expect(JSON.parse(await convert(table, { shape: 'arrays', headerRow: '0' }))[0]).toEqual(['id', 'name', 'when', 'ok']);
  });

  it('picks the header row, or none', async () => {
    const withTitle: Cell[][] = [['Report 2024'], [], ['a', 'b'], [1, 2]];
    expect(JSON.parse(await convert(withTitle, { headerRow: '3' }))).toEqual([{ a: 1, b: 2 }]);
    expect(JSON.parse(await convert([[1, 2], [3, 4]], { headerRow: '0' }))).toEqual([
      { column_1: 1, column_2: 2 },
      { column_1: 3, column_2: 4 },
    ]);
    const bad = await sheetToOutput({ name: 'S', rows: [['a']] }, opts({ headerRow: '9' }));
    expect(!bad.ok && bad.error.message).toContain('row 9 cannot be the header');
    const nan = await sheetToOutput({ name: 'S', rows: [['a']] }, opts({ headerRow: 'x' }));
    expect(!nan.ok && nan.error.message).toContain('whole number');
    expect(parseHeaderRow(' 2 ')).toBe(2);
    expect(parseHeaderRow('1.5')).toBeNull();
  });

  it('names empty and duplicate headers', async () => {
    const r = await sheetToOutput({ name: 'S', rows: [['a', 'a', null], [1, 2, 3]] }, opts());
    expect(r.ok && JSON.parse(r.output)).toEqual([{ a: 1, a_2: 2, column_3: 3 }]);
    expect(r.ok && r.warnings.join(' ')).toContain('duplicate');
  });

  it('trims strings and skips empty rows, unless told not to', async () => {
    const rows: Cell[][] = [['a'], ['  x  '], [null], ['   '], ['y']];
    expect(JSON.parse(await convert(rows))).toEqual([{ a: 'x' }, { a: 'y' }]);
    expect(JSON.parse(await convert(rows, { trim: false, skipEmptyRows: false }))).toEqual([{ a: '  x  ' }, { a: null }, { a: '   ' }, { a: 'y' }]);
  });

  it('writes CSV with the chosen delimiter and asks for a BOM in the download only', async () => {
    const r = await sheetToOutput({ name: 'S', rows: table }, { ...DEFAULT_EXCEL, format: 'csv', delimiter: ';', bom: true });
    expect(r.ok && r.output).toBe('id;name;when;ok\n1;Asif;2024-03-05T14:30:15.000Z;true\n2;;;false');
    expect(r.ok && r.bom).toBe(true);
    const quoted = await sheetToOutput({ name: 'S', rows: [['t'], ['a,"b"\nc']] }, { ...DEFAULT_EXCEL, format: 'csv' });
    expect(quoted.ok && quoted.output).toBe('t\n"a,""b""\nc"');
  });

  it('indents JSON as asked', async () => {
    const r = await sheetToOutput({ name: 'S', rows: [['a'], [1]] }, { ...DEFAULT_EXCEL, indent: '2' });
    expect(r.ok && r.output).toBe('[\n  {\n    "a": 1\n  }\n]');
    const tab = await sheetToOutput({ name: 'S', rows: [['a'], [1]] }, { ...DEFAULT_EXCEL, indent: 'tab' });
    expect(tab.ok && tab.output).toBe('[\n\t{\n\t\t"a": 1\n\t}\n]');
    const compact = await sheetToOutput({ name: 'S', rows: [['a'], [1], [2]] }, opts());
    expect(compact.ok && compact.output).toBe('[{"a":1},{"a":2}]');
  });

  it('warns about numbers beyond 2^53 and keeps __proto__ headers harmless', async () => {
    const big = await sheetToOutput({ name: 'S', rows: [['id'], [12345678901234567890]] }, opts());
    expect(big.ok && big.warnings.join(' ')).toContain('2^53');
    const proto = await sheetToOutput({ name: 'S', rows: [['__proto__'], [1]] }, opts());
    expect(proto.ok && proto.output).toBe('[{"__proto__":1}]');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it('reports empty sheets and header-only sheets', async () => {
    const empty = await sheetToOutput({ name: 'Empty', rows: [] }, opts());
    expect(!empty.ok && empty.error.message).toContain('empty');
    const headerOnly = await sheetToOutput({ name: 'H', rows: [['a', 'b']] }, opts());
    expect(!headerOnly.ok && headerOnly.error.message).toContain('no data rows');
  });
});
