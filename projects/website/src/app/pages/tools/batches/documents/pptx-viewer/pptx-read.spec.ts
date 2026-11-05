import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildPptx } from '../shared/office-fixtures';
import { PptxError, checkPptxBytes, deckToMarkdown, deckToText, readPptx, resolveTarget } from './pptx-read';

const buf = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('pptx input checks', () => {
  it('explains empty, legacy and non-zip files', () => {
    expect(() => checkPptxBytes(new Uint8Array())).toThrow(/empty/);
    expect(() => checkPptxBytes(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]))).toThrow(/\.ppt\)/);
    expect(() => checkPptxBytes(new TextEncoder().encode('hello there'))).toThrow(PptxError);
  });

  it('resolves relationship targets', () => {
    expect(resolveTarget('ppt/slides/', '../media/image1.png')).toBe('ppt/media/image1.png');
    expect(resolveTarget('ppt/', 'slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
    expect(resolveTarget('ppt/slides/', '/ppt/media/a.png')).toBe('ppt/media/a.png');
    expect(resolveTarget('ppt/slides/', 'https://example.com/x.png')).toBe('');
  });
});

describe('readPptx', () => {
  const deckBytes = () =>
    buildPptx([
      { title: 'Launch plan', body: ['Goals & scope', 'Budget <approved>'], notes: 'Say hello first.' },
      { title: 'Numbers', table: [['Quarter', 'Revenue'], ['Q1', '10 | 12']], image: true },
      { body: ['Untitled slide text'] },
    ]);

  it('lists slides in order with titles, body, tables, notes and images', async () => {
    const deck = await readPptx(buf(deckBytes()));
    expect(deck.slides.map((s) => s.title)).toEqual(['Launch plan', 'Numbers', '']);
    expect(deck.slides[0].body.map((p) => p.text)).toEqual(['Goals & scope', 'Budget <approved>']);
    expect(deck.slides[0].body[0].bullet).toBe(true);
    expect(deck.slides[0].notes).toBe('Say hello first.');
    expect(deck.slides[1].tables).toEqual([[['Quarter', 'Revenue'], ['Q1', '10 | 12']]]);
    expect(deck.slides[1].images).toHaveLength(1);
    expect(deck.slides[1].images[0].src).toMatch(/^data:image\/png;base64,/);
    expect(deck.slides[1].images[0].alt).toBe('Team photo');
    expect(deck.stats).toMatchObject({ slides: 3, images: 1, tables: 1, notes: 1 });
    expect(deck.stats.words).toBeGreaterThan(8);
  });

  it('follows the order in presentation.xml, not the file names', async () => {
    const bytes = buildPptx([{ title: 'First' }, { title: 'Second' }]);
    const files = (await import('fflate')).unzipSync(bytes);
    const xml = new TextDecoder().decode(files['ppt/presentation.xml']);
    const swapped = xml.replace('r:id="rId1"', 'r:id="TMP"').replace('r:id="rId2"', 'r:id="rId1"').replace('r:id="TMP"', 'r:id="rId2"');
    files['ppt/presentation.xml'] = strToU8(swapped);
    const deck = await readPptx(buf(zipSync(files)));
    expect(deck.slides.map((s) => s.title)).toEqual(['Second', 'First']);
  });

  it('skips pictures it cannot show instead of failing', async () => {
    const files = (await import('fflate')).unzipSync(buildPptx([{ title: 'Pic', image: true }]));
    const rels = new TextDecoder().decode(files['ppt/slides/_rels/slide1.xml.rels']).replace('image1.png', 'image1.emf');
    files['ppt/slides/_rels/slide1.xml.rels'] = strToU8(rels);
    files['ppt/media/image1.emf'] = new Uint8Array([1, 2, 3]);
    const deck = await readPptx(buf(zipSync(files)));
    expect(deck.slides[0].images).toHaveLength(0);
    expect(deck.slides[0].skippedImages).toBe(1);
  });

  it('rejects a zip that is not a presentation and a damaged zip', async () => {
    const notPpt = zipSync({ 'hello.txt': strToU8('hi') });
    await expect(readPptx(buf(notPpt))).rejects.toThrow(/does not contain a PowerPoint/);
    await expect(readPptx(buf(Uint8Array.from([0x50, 0x4b, 3, 4, 9, 9, 9, 9, 9, 9])))).rejects.toThrow(/Could not read this presentation/);
  });
});

describe('deck exports', () => {
  it('writes plain text and Markdown', async () => {
    const deck = await readPptx(
      buf(buildPptx([{ title: 'Plan', body: ['One', 'Two'], table: [['A', 'B'], ['x|y', '2']], notes: 'Remember\nthis' }])),
    );
    const text = deckToText(deck);
    expect(text).toContain('Slide 1: Plan');
    expect(text).toContain('- One');
    expect(text).toContain('A\tB');
    expect(text).toContain('Notes: Remember\nthis');

    const md = deckToMarkdown(deck);
    expect(md).toContain('## Slide 1: Plan');
    expect(md).toContain('- One\n- Two');
    expect(md).toContain('| A | B |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| x\\|y | 2 |');
    expect(md).toContain('> Remember\n> this');
  });
});
