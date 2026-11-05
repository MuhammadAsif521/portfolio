import { describe, expect, it } from 'vitest';
import { convertJsonToCsv, DEFAULT_JSON_TO_CSV } from '../json-to-csv/json-to-csv.logic';
import { convertCsvToJson, DEFAULT_CSV_TO_JSON, detectDelimiter, inferValue, type CsvToJsonOptions } from './csv-to-json.logic';

const run = (csv: string, over: Partial<CsvToJsonOptions> = {}) =>
  convertCsvToJson(csv, { ...DEFAULT_CSV_TO_JSON, indent: 'minify', ...over });

async function json(csv: string, over: Partial<CsvToJsonOptions> = {}): Promise<unknown> {
  const r = await run(csv, over);
  if (!r.ok) throw new Error(r.error.message);
  return JSON.parse(r.output);
}

describe('csv to json', () => {
  it('turns a header row and data rows into objects with typed values', async () => {
    expect(await json('id,name,active,score,note\n1,Asif,true,9.5,\n2,Sara,FALSE,-3,null')).toEqual([
      { id: 1, name: 'Asif', active: true, score: 9.5, note: '' },
      { id: 2, name: 'Sara', active: false, score: -3, note: null },
    ]);
  });

  it('keeps every cell a string when inference is off', async () => {
    expect(await json('a,b\n1,true', { inferTypes: false })).toEqual([{ a: '1', b: 'true' }]);
  });

  it('does not turn ids, zip codes or huge numbers into lossy numbers', async () => {
    expect(await json('zip,phone,big,ok\n00123,+44 7700,12345678901234567890,12345', {})).toEqual([
      { zip: '00123', phone: '+44 7700', big: '12345678901234567890', ok: 12345 },
    ]);
    expect(inferValue('1e3', { inferTypes: true, emptyAsNull: false })).toBe(1000);
    expect(inferValue('1.', { inferTypes: true, emptyAsNull: false })).toBe('1.');
  });

  it('writes empty cells as null when asked', async () => {
    expect(await json('a,b\n1,', { emptyAsNull: true })).toEqual([{ a: 1, b: null }]);
  });

  it('detects comma, semicolon, tab and pipe delimiters', async () => {
    expect(detectDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|');
    expect(detectDelimiter('a,b\n1,2')).toBe(',');
    expect(detectDelimiter('single\nvalues')).toBe(',');
    expect(detectDelimiter('a;b\n"x,y,z";2\n"p,q";3')).toBe(';');
    expect(await json('a;b\n1;2')).toEqual([{ a: 1, b: 2 }]);
    expect(await json('a\tb\n1\t2')).toEqual([{ a: 1, b: 2 }]);
  });

  it('honours an explicit delimiter', async () => {
    expect(await json('a;b,c\n1;2,3', { delimiter: ',' })).toEqual([{ 'a;b': '1;2', c: 3 }]);
  });

  it('handles quoted cells with delimiters, doubled quotes and line breaks (CRLF too)', async () => {
    expect(await json('t,q,n\r\n"a,b","say ""hi""","line1\r\nline2"\r\n')).toEqual([{ t: 'a,b', q: 'say "hi"', n: 'line1\r\nline2' }]);
  });

  it('skips blank lines, or keeps them as empty rows', async () => {
    expect(await json('a\n1\n\n2\n')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(await json('a,b\n1,2\n\n3,4', { skipEmpty: false })).toEqual([
      { a: 1, b: 2 },
      { a: '', b: null },
      { a: 3, b: 4 },
    ]);
  });

  it('trims cells and header names by default', async () => {
    expect(await json(' a , b \n 1 , x ')).toEqual([{ a: 1, b: 'x' }]);
    expect(await json(' a \n 1 ', { trim: false, inferTypes: false })).toEqual([{ ' a ': ' 1 ' }]);
  });

  it('outputs arrays of arrays, with the header as the first row', async () => {
    expect(await json('a,b\n1,2', { shape: 'arrays' })).toEqual([['a', 'b'], [1, 2]]);
    expect(await json('a,b\n1,2', { shape: 'arrays', header: false })).toEqual([['a', 'b'], [1, 2]]);
  });

  it('names columns when there is no header', async () => {
    expect(await json('1,2\n3,4', { header: false })).toEqual([
      { column_1: 1, column_2: 2 },
      { column_1: 3, column_2: 4 },
    ]);
  });

  it('renames duplicate and empty header names and says so', async () => {
    const r = await run('a,a,\n1,2,3');
    expect(r.ok && JSON.parse(r.output)).toEqual([{ a: 1, a_2: 2, column_3: 3 }]);
    expect(r.ok && r.warnings.join(' ')).toContain('duplicate');
  });

  it('reports rows with too many or too few cells, with line numbers', async () => {
    const r = await run('a,b\n1,2\n3\n4,5,6\n');
    expect(r.ok && JSON.parse(r.output)).toEqual([{ a: 1, b: 2 }, { a: 3, b: null }, { a: 4, b: 5, __extra: [6] }]);
    const text = r.ok ? r.warnings.join(' | ') : '';
    expect(text).toContain('fewer cells than the header (line 3)');
    expect(text).toContain('more cells than the header (line 4)');
  });

  it('refuses an unclosed quote and points at it', async () => {
    const r = await run('a,b\n1,2\n"oops,3\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBe(1);
      expect(r.error.snippet).toContain('"oops,3');
    }
  });

  it('explains a closing quote that is followed by text', async () => {
    const r = await run('a,b\n"x"y,2\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(2);
      expect(r.error.message).toContain('two quotes');
    }
  });

  it('strips a BOM, and survives unicode and emoji', async () => {
    expect(await json('﻿name,mood\nJosé,😀\n世界,ok')).toEqual([
      { name: 'José', mood: '😀' },
      { name: '世界', mood: 'ok' },
    ]);
  });

  it('does not let a __proto__ header pollute objects', async () => {
    const r = await run('__proto__,x\n1,2');
    expect(r.ok && r.output).toBe('[{"__proto__":1,"x":2}]');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it('formats with the chosen indent', async () => {
    const r = await convertCsvToJson('a\n1', { ...DEFAULT_CSV_TO_JSON, indent: 'tab' });
    expect(r.ok && r.output).toBe('[\n\t{\n\t\t"a": 1\n\t}\n]');
  });

  it('rejects empty input and only-blank input', async () => {
    expect((await run('')).ok).toBe(false);
    expect((await run('\n\n   \n')).ok).toBe(false);
  });

  it('converts a few hundred thousand cells without trouble', async () => {
    const rows = Array.from({ length: 30_000 }, (_, i) => `${i},name ${i},${i % 2 === 0}`);
    const r = await run(['id,name,even', ...rows].join('\n'));
    expect(r.ok && (JSON.parse(r.output) as unknown[]).length).toBe(30_000);
  });

  it('round-trips JSON through CSV and back', async () => {
    const original = [
      { id: 1, name: 'Asif, "Raza"', note: 'line1\nline2', active: true, score: 2.5 },
      { id: 2, name: 'José 😀', note: '', active: false, score: -1 },
    ];
    const csv = await convertJsonToCsv(JSON.stringify(original), DEFAULT_JSON_TO_CSV);
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    expect(await json(csv.output)).toEqual(original);
  });

  it('round-trips flattened nested objects as dotted keys', async () => {
    const csv = await convertJsonToCsv('[{"a":{"b":1,"c":"x"}}]', DEFAULT_JSON_TO_CSV);
    if (!csv.ok) throw new Error('json to csv failed');
    expect(await json(csv.output)).toEqual([{ 'a.b': 1, 'a.c': 'x' }]);
  });
});
