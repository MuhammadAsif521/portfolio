import { describe, expect, it } from 'vitest';
import { convertJsonToCsv, DEFAULT_JSON_TO_CSV, guardCell, isoToExcelDate, resolvePath, selectRows, type JsonToCsvOptions } from './json-to-csv.logic';

const run = (json: string, over: Partial<JsonToCsvOptions> = {}) => convertJsonToCsv(json, { ...DEFAULT_JSON_TO_CSV, ...over });

async function csv(json: string, over: Partial<JsonToCsvOptions> = {}): Promise<string> {
  const r = await run(json, over);
  if (!r.ok) throw new Error(r.error.message);
  return r.output;
}

describe('json to csv', () => {
  it('writes an array of objects with a header', async () => {
    expect(await csv('[{"id":1,"name":"Asif"},{"id":2,"name":"Sara"}]')).toBe('id,name\n1,Asif\n2,Sara');
  });

  it('uses the union of all keys and leaves missing cells empty', async () => {
    expect(await csv('[{"a":1},{"b":2},{"a":3,"c":4}]')).toBe('a,b,c\n1,,\n,2,\n3,,4');
  });

  it('can order columns alphabetically', async () => {
    expect(await csv('[{"b":1,"a":2}]', { columnOrder: 'alphabetical' })).toBe('a,b\n2,1');
  });

  it('flattens nested objects to dot paths, or keeps them as JSON', async () => {
    const json = '[{"id":1,"address":{"city":"Lahore","geo":{"lat":1.5}}}]';
    expect(await csv(json)).toBe('id,address.city,address.geo.lat\n1,Lahore,1.5');
    expect(await csv(json, { nested: 'stringify' })).toBe('id,address\n1,"{""city"":""Lahore"",""geo"":{""lat"":1.5}}"');
  });

  it('handles arrays as JSON, a joined list, or one column per index', async () => {
    const json = '[{"tags":["a","b"]},{"tags":["c"]}]';
    expect(await csv(json)).toBe('tags\n"[""a"",""b""]"\n"[""c""]"');
    expect(await csv(json, { arrays: 'join' })).toBe('tags\na; b\nc');
    expect(await csv(json, { arrays: 'columns' })).toBe('tags.0,tags.1\na,b\nc,');
  });

  it('keeps objects inside a joined array as JSON', async () => {
    expect(await csv('[{"x":[{"a":1}]}]', { arrays: 'join' })).toBe('x\n"[{""a"":1}]"');
  });

  it('writes null as an empty cell or the word null, and keeps booleans and numbers', async () => {
    const json = '[{"a":null,"b":true,"c":0,"d":-1.5e3}]';
    expect(await csv(json)).toBe('a,b,c,d\n,true,0,-1500');
    expect(await csv(json, { nullAs: 'null' })).toBe('a,b,c,d\nnull,true,0,-1500');
  });

  it('quotes cells that contain the delimiter, quotes or line breaks', async () => {
    const out = await csv('[{"t":"a,b","q":"say \\"hi\\"","n":"line1\\nline2"}]');
    expect(out).toBe('t,q,n\n"a,b","say ""hi""","line1\nline2"');
  });

  it('supports other delimiters, no header, quote-all and CRLF', async () => {
    const json = '[{"a":1,"b":"x"}]';
    expect(await csv(json, { delimiter: ';' })).toBe('a;b\n1;x');
    expect(await csv(json, { delimiter: '\t' })).toBe('a\tb\n1\tx');
    expect(await csv(json, { header: false })).toBe('1,x');
    expect(await csv(json, { quoteAll: true })).toBe('"a","b"\n"1","x"');
    expect(await csv(json, { newline: '\r\n' })).toBe('a,b\r\n1,x');
  });

  it('asks for a BOM in the download, not in the text', async () => {
    const r = await run('[{"a":"é"}]', { bom: true });
    expect(r.ok && r.bom).toBe(true);
    expect(r.ok && r.output.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('guards formula cells, but not plain negative numbers', async () => {
    const json = '[{"a":"=SUM(A1)","b":"+1 555","c":"-5","d":-7,"e":"@user","f":"ok"}]';
    const r = await run(json, { guardFormulas: true });
    expect(r.ok && r.output).toBe(`a,b,c,d,e,f\n'=SUM(A1),'+1 555,-5,-7,'@user,ok`);
    expect(r.ok && r.warnings.join(' ')).toContain('3 cells');
    expect(await csv(json)).toContain('=SUM(A1),+1 555');
    expect(guardCell('-5').guarded).toBe(false);
    expect(guardCell('\t=cmd').guarded).toBe(true);
  });

  it('writes ISO timestamps for Excel when asked', async () => {
    expect(await csv('[{"at":"2024-03-05T14:30:15.123Z","day":"2024-03-05"}]', { dates: 'excel' })).toBe('at,day\n2024-03-05 14:30:15,2024-03-05');
    expect(isoToExcelDate('2024-03-05T14:30:00+02:00')).toBe('2024-03-05 12:30:00');
    expect(isoToExcelDate('not a date')).toBeNull();
  });

  it('keeps unicode, emoji and CRLF inside strings intact', async () => {
    const out = await csv('[{"s":"héllo 😀 世界","m":"a\\r\\nb"}]');
    expect(out).toContain('héllo 😀 世界');
    expect(out).toContain('"a\r\nb"');
  });

  it('strips a byte order mark from the input', async () => {
    expect(await csv('﻿[{"a":1}]')).toBe('a\n1');
  });

  it('accepts an array of primitives and an array of arrays', async () => {
    expect(await csv('[1,2,3]')).toBe('value\n1\n2\n3');
    expect(await csv('[[1,2],[3,4]]')).toBe('column_1,column_2\n1,2\n3,4');
  });

  it('finds the array inside an API envelope', async () => {
    const r = await run('{"page":1,"data":[{"id":1},{"id":2}],"meta":{"x":1}}');
    expect(r.ok && r.output).toBe('id\n1\n2');
    expect(r.ok && r.meta.join(' ')).toContain('"data"');
  });

  it('treats an object of arrays as columns', async () => {
    expect(await csv('{"a":[1,2,3],"b":["x","y"]}')).toBe('a,b\n1,x\n2,y\n3,');
  });

  it('writes a single object as one row, or one row per key', async () => {
    expect(await csv('{"a":1,"b":{"c":2}}')).toBe('a,b.c\n1,2');
    expect(await csv('{"u1":{"n":"x"},"u2":{"n":"y"}}', { rootObject: 'keyed' })).toBe('key,n\nu1,x\nu2,y');
  });

  it('follows an explicit path and explains a wrong one', async () => {
    expect(await csv('{"a":{"b":[{"x":1}]}}', { path: 'a.b' })).toBe('x\n1');
    const bad = await run('{"a":{}}', { path: 'a.zzz' });
    expect(!bad.ok && bad.error.message).toContain('"a.zzz"');
    expect(resolvePath([{ a: 1 }], '0.a')).toEqual({ found: true, value: 1 });
  });

  it('keeps integers beyond 2^53 exact', async () => {
    const r = await run('[{"id":12345678901234567890,"n":9007199254740993}]');
    expect(r.ok && r.output).toBe('id,n\n12345678901234567890,9007199254740993');
  });

  it('survives hostile keys such as __proto__ without polluting anything', async () => {
    const out = await csv('[{"__proto__":{"x":1},"constructor":"c"}]');
    expect(out).toBe('__proto__.x,constructor\n1,c');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it('reports invalid JSON with line and column', async () => {
    const r = await run('[\n  {"a": 1},\n  {"a": }\n]');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBeGreaterThan(0);
      expect(r.error.snippet).toContain('{"a": }');
    }
  });

  it('rejects empty input, empty arrays and bare values with plain messages', async () => {
    expect((await run('   ')).ok).toBe(false);
    const empty = await run('[]');
    expect(!empty.ok && empty.error.message).toContain('empty');
    const bare = await run('42');
    expect(!bare.ok && bare.error.message).toContain('table');
  });

  it('stops before a flood of columns', async () => {
    const wide = JSON.stringify([{ list: Array.from({ length: 10_100 }, (_, i) => i) }]);
    const r = await run(wide, { arrays: 'columns' });
    expect(!r.ok && r.error.message).toContain('more than 10,000');
  });

  it('warns when two paths flatten to the same column', async () => {
    const r = await run('[{"a.b":1,"a":{"b":2}}]');
    expect(r.ok && r.warnings.join(' ')).toContain('same column');
  });

  it('exposes selectRows for an object with no arrays', () => {
    expect(selectRows({ a: 1 }, { rootObject: 'auto', path: '' })).toMatchObject({ rows: [{ a: 1 }] });
  });
});
