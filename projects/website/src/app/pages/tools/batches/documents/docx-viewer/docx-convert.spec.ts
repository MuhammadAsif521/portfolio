import { describe, expect, it } from 'vitest';
import { buildDocx } from '../shared/office-fixtures';
import { DocxError, checkDocxBytes, convertDocx, countStats, mergeWarnings } from './docx-convert';

const toBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

describe('docx input checks', () => {
  it('rejects empty, legacy .doc and non-zip files in plain language', () => {
    expect(() => checkDocxBytes(new Uint8Array())).toThrow(/empty/);
    expect(() => checkDocxBytes(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toThrow(/older Word file/);
    expect(() => checkDocxBytes(new TextEncoder().encode('just some text'))).toThrow(DocxError);
    expect(() => checkDocxBytes(Uint8Array.from([0x50, 0x4b, 3, 4, 0, 0]))).not.toThrow();
  });
});

describe('docx helpers', () => {
  it('merges repeated warnings and counts them', () => {
    expect(mergeWarnings(['a', 'b', 'a', ' ', 'a'])).toEqual(['a (3x)', 'b']);
  });

  it('counts words, headings, tables and images from the sanitised HTML', () => {
    const stats = countStats('<h1>T</h1><table><tr><td>x</td></tr></table><img src="data:x"><img src="data:y">', 'Hello big world', 1);
    expect(stats).toMatchObject({ words: 3, headings: 1, tables: 1, images: 2, skippedImages: 1 });
  });
});

describe('convertDocx', () => {
  it('turns headings, paragraphs and tables into HTML and text', async () => {
    const result = await convertDocx(
      toBuffer(buildDocx({ paragraphs: [{ text: 'Quarterly report', style: 'Heading1' }, { text: 'Revenue grew <fast> & steady.' }], table: [['Region', 'Sales'], ['EU', '12']] })),
    );
    expect(result.html).toContain('<h1>Quarterly report</h1>');
    expect(result.html).toContain('&lt;fast&gt;');
    expect(result.html).toContain('<table>');
    expect(result.text).toContain('Quarterly report');
    expect(result.text).toContain('Region\tSales');
    expect(result.stats).toMatchObject({ headings: 1, tables: 1 });
    expect(result.stats.words).toBeGreaterThan(5);
  });

  it('embeds PNG images as data URLs and never keeps scripts or event handlers', async () => {
    const result = await convertDocx(toBuffer(buildDocx({ image: true, paragraphs: [{ text: '<script>alert(1)</script><img src=x onerror=alert(1)>' }] })));
    expect(result.html).toMatch(/<img[^>]+src="data:image\/png;base64,/);
    // The hostile text was typed as text, so it appears escaped and is never live markup.
    expect(result.html).not.toMatch(/<script|<img[^>]+onerror|javascript:/i);
    expect(result.stats.images).toBe(1);
  });

  it('reports a damaged zip as a readable error', async () => {
    const broken = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(convertDocx(toBuffer(broken))).rejects.toThrow(/Could not read this document/);
  });
});
