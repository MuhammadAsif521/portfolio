import type { PDFDocument } from 'pdf-lib';
import { nextTask } from './async';

/** PDF editing with pdf-lib: page counting, merging, extracting pages and building a PDF from images. No DOM. */

export type PdfLibFailure = 'encrypted' | 'invalid' | 'empty';

export class PdfLibError extends Error {
  constructor(
    readonly kind: PdfLibFailure,
    message: string,
  ) {
    super(message);
    this.name = 'PdfLibError';
  }
}

export const ENCRYPTED_MESSAGE =
  'This PDF is password protected or encrypted, which this tool cannot edit. Remove the protection first (for example open it and print to PDF), then try again.';
export const INVALID_MESSAGE = 'This file could not be read as a PDF. It may be damaged, truncated or not a PDF.';

/** Loads a PDF for editing. Encrypted files are refused with a clear message (pdf-lib cannot decrypt them). */
export async function openPdfLib(bytes: Uint8Array): Promise<PDFDocument> {
  const lib = await import('pdf-lib');
  let doc: PDFDocument;
  try {
    doc = await lib.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    // pdf-lib's EncryptedPDFError does not survive transpilation (its prototype chain is lost), so match the message too.
    if (error instanceof lib.EncryptedPDFError || /is encrypted/i.test(error instanceof Error ? error.message : '')) throw new PdfLibError('encrypted', ENCRYPTED_MESSAGE);
    throw new PdfLibError('invalid', INVALID_MESSAGE);
  }
  if (doc.getPageCount() < 1) throw new PdfLibError('empty', 'This PDF has no pages.');
  return doc;
}

export async function pageCountOf(bytes: Uint8Array): Promise<number> {
  return (await openPdfLib(bytes)).getPageCount();
}

/** A new PDF holding `pages` (1-based, in the order given) of `src`. */
export async function extractPages(src: PDFDocument, pages: readonly number[]): Promise<Uint8Array> {
  const lib = await import('pdf-lib');
  const out = await lib.PDFDocument.create();
  const copied = await out.copyPages(
    src,
    pages.map((p) => p - 1),
  );
  copied.forEach((page) => out.addPage(page));
  return out.save();
}

export interface MergeSource {
  name: string;
  read(): Promise<Uint8Array>;
  /** 1-based pages to take, in order; null for all. */
  pages: readonly number[] | null;
}

/** Merges the sources in order. Only one source document is open at a time. */
export async function mergePdfs(sources: readonly MergeSource[], onProgress?: (done: number, total: number, name: string) => void): Promise<{ bytes: Uint8Array; pages: number }> {
  const lib = await import('pdf-lib');
  const out = await lib.PDFDocument.create();
  let pages = 0;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    onProgress?.(i, sources.length, source.name);
    await nextTask();
    let doc: PDFDocument;
    try {
      doc = await openPdfLib(await source.read());
    } catch (error) {
      if (error instanceof PdfLibError) throw new PdfLibError(error.kind, `${source.name}: ${error.message}`);
      throw error;
    }
    const indices = (source.pages ?? Array.from({ length: doc.getPageCount() }, (_, k) => k + 1)).map((p) => p - 1);
    const copied = await out.copyPages(doc, indices);
    copied.forEach((page) => out.addPage(page));
    pages += copied.length;
  }
  onProgress?.(sources.length, sources.length, '');
  return { bytes: await out.save(), pages };
}

// ---- Images to PDF ----------------------------------------------------------------------------------------

export type PageSize = 'a4' | 'letter' | 'fit';
export type PageOrientation = 'auto' | 'portrait' | 'landscape';

export interface PagePlanOptions {
  size: PageSize;
  orientation: PageOrientation;
  marginMm: number;
  fit: 'contain' | 'cover';
}

export interface PagePlan {
  pageWidth: number;
  pageHeight: number;
  /** Where the image is drawn (PDF points, origin bottom-left). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** For "cover": the box the image is clipped to. */
  clip: { x: number; y: number; width: number; height: number } | null;
}

const PAGE_POINTS: Record<'a4' | 'letter', [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };
const MM = 72 / 25.4;
/** Pixels to points when the page follows the image: 96 pixels per inch, the browser convention. */
const PX = 0.75;

/** Page size and image placement for one image. Pure. Units are PDF points. */
export function planPage(imageWidth: number, imageHeight: number, options: PagePlanOptions): PagePlan {
  const margin = Math.max(0, options.marginMm) * MM;
  if (options.size === 'fit') {
    const width = imageWidth * PX;
    const height = imageHeight * PX;
    return { pageWidth: width + 2 * margin, pageHeight: height + 2 * margin, x: margin, y: margin, width, height, clip: null };
  }
  let [pageWidth, pageHeight] = PAGE_POINTS[options.size];
  const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && imageWidth > imageHeight);
  if (landscape) [pageWidth, pageHeight] = [pageHeight, pageWidth];
  // Never let the margin eat the page.
  const m = Math.min(margin, Math.min(pageWidth, pageHeight) * 0.3);
  const boxWidth = pageWidth - 2 * m;
  const boxHeight = pageHeight - 2 * m;
  const k = options.fit === 'cover' ? Math.max(boxWidth / imageWidth, boxHeight / imageHeight) : Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * k;
  const height = imageHeight * k;
  return {
    pageWidth,
    pageHeight,
    x: m + (boxWidth - width) / 2,
    y: m + (boxHeight - height) / 2,
    width,
    height,
    clip: options.fit === 'cover' ? { x: m, y: m, width: boxWidth, height: boxHeight } : null,
  };
}

export interface PdfImage {
  /** Raw JPEG or PNG file bytes, embedded without re-encoding. */
  bytes: Uint8Array;
  format: 'jpeg' | 'png';
}

/** Supplies image `index`: `direct` embeds the original bytes where possible, `safe` is a re-encoded copy for when that failed. */
export type PdfImageLoader = (index: number, mode: 'direct' | 'safe') => Promise<PdfImage>;

export class ImageEmbedError extends Error {
  constructor(
    readonly index: number,
    message: string,
  ) {
    super(message);
    this.name = 'ImageEmbedError';
  }
}

/**
 * Builds a PDF with one page per image, in order. Images are loaded one at a time. If an image cannot be embedded
 * as loaded, the loader is asked again in `safe` mode; if that fails too an ImageEmbedError names the image.
 */
export async function imagesToPdf(
  count: number,
  load: PdfImageLoader,
  options: PagePlanOptions,
  onProgress?: (done: number, total: number) => void,
  title?: string,
): Promise<Uint8Array> {
  const lib = await import('pdf-lib');
  const pdf = await lib.PDFDocument.create();
  if (title) pdf.setTitle(title);
  const embed = async (source: PdfImage) => (source.format === 'jpeg' ? pdf.embedJpg(source.bytes) : pdf.embedPng(source.bytes));
  for (let i = 0; i < count; i++) {
    onProgress?.(i, count);
    await nextTask();
    let image;
    try {
      image = await embed(await load(i, 'direct'));
    } catch {
      try {
        image = await embed(await load(i, 'safe'));
      } catch {
        throw new ImageEmbedError(i, 'This image could not be added to the PDF.');
      }
    }
    const plan = planPage(image.width, image.height, options);
    const page = pdf.addPage([plan.pageWidth, plan.pageHeight]);
    if (plan.clip) {
      page.pushOperators(lib.pushGraphicsState(), lib.rectangle(plan.clip.x, plan.clip.y, plan.clip.width, plan.clip.height), lib.clip(), lib.endPath());
      page.drawImage(image, { x: plan.x, y: plan.y, width: plan.width, height: plan.height });
      page.pushOperators(lib.popGraphicsState());
    } else {
      page.drawImage(image, { x: plan.x, y: plan.y, width: plan.width, height: plan.height });
    }
  }
  onProgress?.(count, count);
  return pdf.save();
}
