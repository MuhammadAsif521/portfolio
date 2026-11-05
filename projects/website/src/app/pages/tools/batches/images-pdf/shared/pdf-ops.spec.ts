import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { encodeIndexedPng, quantizeRgba } from './png-quantize';
import { ImageEmbedError, PdfLibError, extractPages, imagesToPdf, mergePdfs, openPdfLib, pageCountOf, planPage, type PagePlanOptions } from './pdf-ops';

/** A real PDF: one page per [width, height, rotation] with its number drawn on it. */
async function makePdf(pages: [number, number, number?][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  pages.forEach(([w, h, rotation], i) => {
    const page = doc.addPage([w, h]);
    page.drawText(`Page ${i + 1}`, { x: 20, y: h - 40, size: 18 });
    if (rotation) page.setRotation(degrees(rotation));
  });
  return doc.save();
}

/** A PDF whose trailer declares an /Encrypt dictionary: pdf-lib refuses it the way it refuses a password-protected file. */
async function makeEncryptedStyle(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const bytes = await doc.save({ useObjectStreams: false });
  const text = Array.from(bytes, (c) => String.fromCharCode(c)).join('');
  // The trailer follows the cross-reference table, so adding a key there does not move any offsets.
  const info = new RegExp('/Info (\\d+) 0 R').exec(text)?.[1] ?? '1';
  const patched = text.replace('/Root ', `/Encrypt ${info} 0 R /Root `);
  return Uint8Array.from(patched, (c) => c.charCodeAt(0));
}

/** A solid 8-bit indexed PNG made by the tool's own encoder. */
async function makePng(width: number, height: number, color: [number, number, number, number] = [30, 120, 220, 255]): Promise<Uint8Array> {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(color, i * 4);
  return encodeIndexedPng(width, height, await quantizeRgba(data, 16));
}

const sizes = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);

describe('openPdfLib', () => {
  it('opens a valid multi-page PDF and counts its pages', async () => {
    const bytes = await makePdf([[300, 400], [300, 400], [500, 200]]);
    expect(await pageCountOf(bytes)).toBe(3);
  });

  it('flags encrypted PDFs with a message that says what to do', async () => {
    const bytes = await makeEncryptedStyle();
    await expect(openPdfLib(bytes)).rejects.toMatchObject({ name: 'PdfLibError', kind: 'encrypted', message: expect.stringContaining('password') });
  });

  it('flags corrupt, truncated, empty and non-PDF input as invalid', async () => {
    const good = await makePdf([[300, 400]]);
    for (const bad of [good.subarray(0, Math.floor(good.length / 3)), new TextEncoder().encode('hello, this is not a pdf'), new Uint8Array(), Uint8Array.from({ length: 500 }, (_, i) => (i * 37) % 251)]) {
      await expect(openPdfLib(bad)).rejects.toBeInstanceOf(PdfLibError);
    }
  });

  it('rejects a PDF with no pages', async () => {
    const empty = await (await PDFDocument.create()).save({ addDefaultPage: false });
    await expect(openPdfLib(empty)).rejects.toMatchObject({ kind: 'empty' });
  });
});

describe('extractPages', () => {
  it('copies the chosen pages in the requested order and keeps page size and rotation', async () => {
    const source = await openPdfLib(await makePdf([[100, 200], [300, 400, 90], [500, 600]]));
    const out = await PDFDocument.load(await extractPages(source, [3, 2]));
    expect(out.getPageCount()).toBe(2);
    expect(out.getPage(0).getWidth()).toBe(500);
    expect(out.getPage(1).getWidth()).toBe(300);
    expect(out.getPage(1).getRotation().angle).toBe(90);
  });

  it('can repeat a page', async () => {
    const source = await openPdfLib(await makePdf([[100, 200], [300, 400]]));
    expect((await PDFDocument.load(await extractPages(source, [1, 1, 2]))).getPageCount()).toBe(3);
  });

  it('refuses a page that does not exist instead of writing a broken file', async () => {
    const source = await openPdfLib(await makePdf([[100, 200]]));
    await expect(extractPages(source, [5])).rejects.toBeDefined();
  });
});

describe('mergePdfs', () => {
  const read = (bytes: Uint8Array) => async () => bytes;

  it('merges in order with per-file page selections and reports the page total', async () => {
    const a = await makePdf([[100, 100], [110, 110], [120, 120]]);
    const b = await makePdf([[200, 200], [210, 210, 180]]);
    const progress: string[] = [];
    const { bytes, pages } = await mergePdfs(
      [
        { name: 'a.pdf', read: read(a), pages: [1, 3] },
        { name: 'b.pdf', read: read(b), pages: null },
      ],
      (done, total, name) => progress.push(`${done}/${total}:${name}`),
    );
    expect(pages).toBe(4);
    expect(await sizes(bytes)).toEqual([[100, 100], [120, 120], [200, 200], [210, 210]]);
    expect((await PDFDocument.load(bytes)).getPage(3).getRotation().angle).toBe(180);
    expect(progress[0]).toBe('0/2:a.pdf');
    expect(progress.at(-1)).toBe('2/2:');
  });

  it('names the file when one cannot be merged', async () => {
    const good = await makePdf([[100, 100]]);
    await expect(
      mergePdfs([
        { name: 'ok.pdf', read: read(good), pages: null },
        { name: 'locked.pdf', read: read(await makeEncryptedStyle()), pages: null },
      ]),
    ).rejects.toMatchObject({ kind: 'encrypted', message: expect.stringMatching(/^locked\.pdf: /) });
    await expect(mergePdfs([{ name: 'broken.pdf', read: read(new Uint8Array([1, 2, 3])), pages: null }])).rejects.toMatchObject({ kind: 'invalid', message: expect.stringContaining('broken.pdf') });
  });

  it('merges a file with itself (the same page twice) without sharing state', async () => {
    const a = await makePdf([[100, 100]]);
    const { pages } = await mergePdfs([
      { name: 'a', read: read(a), pages: null },
      { name: 'a again', read: read(a), pages: null },
    ]);
    expect(pages).toBe(2);
  });
});

describe('planPage', () => {
  const base: PagePlanOptions = { size: 'a4', orientation: 'auto', marginMm: 10, fit: 'contain' };
  const mm = 72 / 25.4;

  it('chooses the page orientation from the image shape in auto mode', () => {
    expect(planPage(1000, 500, base)).toMatchObject({ pageWidth: 841.89, pageHeight: 595.28 });
    expect(planPage(500, 1000, base)).toMatchObject({ pageWidth: 595.28, pageHeight: 841.89 });
    expect(planPage(1000, 500, { ...base, orientation: 'portrait' })).toMatchObject({ pageWidth: 595.28 });
    expect(planPage(500, 1000, { ...base, orientation: 'landscape' })).toMatchObject({ pageWidth: 841.89 });
    expect(planPage(500, 500, { ...base, size: 'letter' })).toMatchObject({ pageWidth: 612, pageHeight: 792 });
  });

  it('contain centres the image inside the margins without distortion', () => {
    const p = planPage(1000, 500, base);
    expect(p.width / p.height).toBeCloseTo(2, 5);
    expect(p.x).toBeGreaterThanOrEqual(10 * mm - 1e-9);
    expect(p.x + p.width).toBeLessThanOrEqual(p.pageWidth - 10 * mm + 1e-9);
    expect(p.y + p.height).toBeLessThanOrEqual(p.pageHeight - 10 * mm + 1e-9);
    expect(p.clip).toBeNull();
    expect(p.x + p.width / 2).toBeCloseTo(p.pageWidth / 2, 5);
    expect(p.y + p.height / 2).toBeCloseTo(p.pageHeight / 2, 5);
  });

  it('cover fills the margin box and clips to it', () => {
    const p = planPage(1000, 500, { ...base, orientation: 'portrait', fit: 'cover' });
    expect(p.clip).not.toBeNull();
    expect(p.height).toBeCloseTo(p.clip!.height, 5);
    expect(p.width).toBeGreaterThan(p.clip!.width);
  });

  it('fit-to-image sizes the page from the pixels at 96 DPI plus the margin', () => {
    const p = planPage(800, 400, { ...base, size: 'fit', marginMm: 0 });
    expect(p).toMatchObject({ pageWidth: 600, pageHeight: 300, x: 0, y: 0, width: 600, height: 300, clip: null });
    const withMargin = planPage(800, 400, { ...base, size: 'fit', marginMm: 5 });
    expect(withMargin.pageWidth).toBeCloseTo(600 + 10 * mm, 5);
  });

  it('never lets a huge margin swallow the page', () => {
    const p = planPage(100, 100, { ...base, marginMm: 500 });
    expect(p.width).toBeGreaterThan(50);
    expect(p.height).toBeGreaterThan(50);
  });
});

describe('imagesToPdf', () => {
  const opts: PagePlanOptions = { size: 'a4', orientation: 'auto', marginMm: 0, fit: 'contain' };

  it('creates one page per image in order, with the orientation chosen per image', async () => {
    const wide = await makePng(40, 20);
    const tall = await makePng(20, 40);
    const seen: number[] = [];
    const bytes = await imagesToPdf(2, async (i) => ({ bytes: i === 0 ? wide : tall, format: 'png' }), opts, (done) => seen.push(done), 'My title');
    expect(await sizes(bytes)).toEqual([[842, 595], [595, 842]]);
    expect(seen).toEqual([0, 1, 2]);
    expect((await PDFDocument.load(bytes)).getTitle()).toBe('My title');
  });

  it('follows the image size in fit mode and supports cover with clipping', async () => {
    const png = await makePng(96, 48);
    const fit = await imagesToPdf(1, async () => ({ bytes: png, format: 'png' }), { ...opts, size: 'fit' });
    expect(await sizes(fit)).toEqual([[72, 36]]);
    const cover = await imagesToPdf(1, async () => ({ bytes: png, format: 'png' }), { ...opts, fit: 'cover', marginMm: 10 });
    expect((await PDFDocument.load(cover)).getPageCount()).toBe(1);
  });

  it('asks for the safe version when the direct one cannot be embedded', async () => {
    const png = await makePng(10, 10);
    const modes: string[] = [];
    const bytes = await imagesToPdf(
      1,
      async (_i, mode) => {
        modes.push(mode);
        return mode === 'direct' ? { bytes: new Uint8Array([1, 2, 3]), format: 'png' } : { bytes: png, format: 'png' };
      },
      opts,
    );
    expect(modes).toEqual(['direct', 'safe']);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('names the failing image when neither version works', async () => {
    const png = await makePng(10, 10);
    await expect(imagesToPdf(2, async (i) => ({ bytes: i === 1 ? new Uint8Array([9, 9]) : png, format: 'png' }), opts)).rejects.toMatchObject({ name: 'ImageEmbedError', index: 1 });
    expect(new ImageEmbedError(0, 'x').index).toBe(0);
  });
});
