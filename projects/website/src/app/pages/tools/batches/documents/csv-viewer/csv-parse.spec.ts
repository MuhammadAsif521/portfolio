import { describe, expect, it } from 'vitest';
import { detectDelimiter, detectEncoding, parseCsv } from './csv-parse';

describe('detectDelimiter', () => {
  it('finds comma, semicolon, tab and pipe', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',');
    expect(detectDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|');
  });

  it('prefers the delimiter used consistently, not one that appears inside values', () => {
    expect(detectDelimiter('name;note\nAda;"likes a, b, c"\nBob;"x, y"\nCy;plain')).toBe(';');
    expect(detectDelimiter('id,price\n1,"1,5"\n2,"2,5"')).toBe(',');
  });

  it('keeps quoted line breaks inside one record', () => {
    expect(detectDelimiter('a;b\n"line one\nline two";2\n"x";3')).toBe(';');
  });

  it('falls back to comma for a single column or empty text', () => {
    expect(detectDelimiter('just one column\nsecond line')).toBe(',');
    expect(detectDelimiter('')).toBe(',');
  });
});

describe('detectEncoding', () => {
  it('reads byte-order marks, valid UTF-8 and falls back to Windows-1252', () => {
    expect(detectEncoding(Uint8Array.from([0xff, 0xfe, 0x61, 0]))).toBe('utf-16le');
    expect(detectEncoding(Uint8Array.from([0xfe, 0xff, 0, 0x61]))).toBe('utf-16be');
    expect(detectEncoding(new TextEncoder().encode('café, Zürich'))).toBe('utf-8');
    expect(detectEncoding(Uint8Array.from([0x63, 0x61, 0x66, 0xe9]))).toBe('windows-1252');
  });

  it('does not mistake a multi-byte character cut at the end for bad UTF-8', () => {
    const bytes = new TextEncoder().encode('abc€');
    expect(detectEncoding(bytes.slice(0, bytes.length - 1), true)).toBe('utf-8');
    expect(detectEncoding(bytes.slice(0, bytes.length - 1), false)).toBe('windows-1252');
  });
});

describe('parseCsv', () => {
  const opts = { delimiter: ',', encoding: 'utf-8' as const };

  it('parses quotes, doubled quotes and embedded line breaks', async () => {
    const text = 'name,quote\r\n"Smith, J.","He said ""hi"""\r\nLee,"two\nlines"\r\n';
    const result = await parseCsv(text, opts);
    expect(result.rows).toEqual([['name', 'quote'], ['Smith, J.', 'He said "hi"'], ['Lee', 'two\nlines']]);
    expect(result.columns).toBe(2);
    expect(result.irregularRows).toBe(0);
  });

  it('skips blank lines and counts rows with a different number of fields', async () => {
    const result = await parseCsv('a,b,c\n\n1,2\n3,4,5,6\n', opts);
    expect(result.rows).toHaveLength(3);
    expect(result.irregularRows).toBe(2);
    expect(result.columns).toBe(4);
  });

  it('handles an empty file and a header-only file', async () => {
    expect((await parseCsv('', opts)).rows).toEqual([]);
    expect((await parseCsv('a,b', opts)).rows).toEqual([['a', 'b']]);
  });

  it('reports a quote that is never closed', async () => {
    const result = await parseCsv('a,b\n1,"oops\n', opts);
    expect(result.quoteIssues).toBeGreaterThan(0);
  });

  it('parses a File in chunks with the chosen delimiter, dropping the BOM', async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `${i};name ${i};${i * 2}`);
    const file = new File(['﻿id;name;double\n' + lines.join('\n')], 'data.csv', { type: 'text/csv' });
    const progress: number[] = [];
    const result = await parseCsv(file, { delimiter: ';', encoding: 'utf-8', onProgress: (f) => progress.push(f) });
    expect(result.rows).toHaveLength(5001);
    expect(result.rows[0]).toEqual(['id', 'name', 'double']);
    expect(result.rows[5000]).toEqual(['4999', 'name 4999', '9998']);
    expect(progress.at(-1)).toBe(1);
  });

  it('decodes Windows-1252 text when told to', async () => {
    const bytes = Uint8Array.from([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x63, 0x61, 0x66, 0xe9]); // "name\ncafé"
    const good = await parseCsv(new File([bytes], 'x.csv'), { delimiter: ',', encoding: 'windows-1252' });
    expect(good.rows[1][0]).toBe('café');
    expect(good.replacementChars).toBe(false);
    const bad = await parseCsv(new File([bytes], 'x.csv'), { delimiter: ',', encoding: 'utf-8' });
    expect(bad.replacementChars).toBe(true);
  });

  it('stops early when cancelled', async () => {
    const big = new File(['a,b\n' + '1,2\n'.repeat(400_000)], 'big.csv');
    const signal = { aborted: true };
    const result = await parseCsv(big, { ...opts, signal });
    expect(result.rows.length).toBeLessThan(400_000);
  });
});
