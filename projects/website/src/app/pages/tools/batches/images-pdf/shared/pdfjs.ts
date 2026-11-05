import type { PDFDocumentProxy } from 'pdfjs-dist';
import { LIMITS, isPdf } from './files';
import { assertPixels, ImageError } from './image-codec';
import { checkOutputSize } from './size-math';

/**
 * pdf.js access for the PDF tools: lazy loading, one dedicated worker per open document, password handling and
 * page-by-page rendering. Browser only: call from event handlers. The renderer cannot draw fonts a PDF does not
 * embed exactly; it substitutes the closest system font.
 */

export type PdfOpenFailure = 'password' | 'wrong-password' | 'invalid' | 'failed';

export class PdfOpenError extends Error {
  constructor(
    readonly kind: PdfOpenFailure,
    message: string,
  ) {
    super(message);
    this.name = 'PdfOpenError';
  }
}

export interface PdfHandle {
  doc: PDFDocumentProxy;
  pageCount: number;
  close(): Promise<void>;
}

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null;
const loadPdfjs = () => (pdfjs ??= import('pdfjs-dist'));

/**
 * Opens a PDF held in memory. `bytes` is copied (pdf.js transfers the buffer to its worker and would otherwise
 * empty the caller's array). Throws PdfOpenError with kind 'password' when a password is needed.
 */
export async function openPdf(bytes: Uint8Array, password?: string): Promise<PdfHandle> {
  if (!isPdf(bytes.subarray(0, 1100))) throw new PdfOpenError('invalid', 'This does not look like a PDF file.');
  const lib = await loadPdfjs();
  const port = new Worker(new URL('./pdf.worker', import.meta.url), { type: 'module' });
  const worker = new (lib.PDFWorker as unknown as new (params: { port: Worker }) => InstanceType<typeof lib.PDFWorker>)({ port });
  const task = lib.getDocument({ data: bytes.slice(), password, worker, isEvalSupported: false, enableXfa: false } as never);
  const dispose = async () => {
    try {
      await task.destroy();
    } catch {
      /* already gone */
    }
    worker.destroy();
    port.terminate();
  };
  try {
    const doc = await task.promise;
    return {
      doc,
      pageCount: doc.numPages,
      close: dispose,
    };
  } catch (error) {
    await dispose();
    const e = error as { name?: string; code?: number; message?: string };
    if (e?.name === 'PasswordException') {
      throw e.code === 2
        ? new PdfOpenError('wrong-password', 'That password is not correct. Try again.')
        : new PdfOpenError('password', 'This PDF is password protected. Enter the password to open it.');
    }
    if (e?.name === 'InvalidPDFException' || e?.name === 'FormatError') {
      throw new PdfOpenError('invalid', 'This file could not be read as a PDF. It may be damaged or not a PDF at all.');
    }
    throw new PdfOpenError('failed', 'This PDF could not be opened. It may be damaged or use a feature this viewer does not support.');
  }
}

/** Page size in PDF points (1/72 inch), with the page rotation applied. */
export async function pageSizePoints(handle: PdfHandle, pageNumber: number): Promise<{ width: number; height: number }> {
  const page = await handle.doc.getPage(pageNumber);
  const view = page.getViewport({ scale: 1 });
  page.cleanup();
  return { width: view.width, height: view.height };
}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Renders one page to an image Blob and frees the canvas before returning, so a long document never holds more than
 * one page of pixels. `scale` 1 is 72 DPI. Throws ImageError when the size would exceed the canvas limits.
 */
export async function renderPage(
  handle: PdfHandle,
  pageNumber: number,
  scale: number,
  format: 'png' | 'jpeg',
  quality: number,
): Promise<RenderedPage> {
  const page = await handle.doc.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.round(viewport.width));
    const height = Math.max(1, Math.round(viewport.height));
    const problem = checkOutputSize(width, height);
    if (problem) throw new ImageError(`Page ${pageNumber} would be ${width} x ${height} px. ${problem} Choose a lower resolution.`);
    assertPixels(width, height, `Page ${pageNumber}`);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
      await page.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, format === 'png' ? undefined : quality));
      if (!blob || blob.size === 0) throw new ImageError(`The browser could not write page ${pageNumber}. Try a lower resolution.`);
      return { blob, width, height };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    page.cleanup();
  }
}

/** A small JPEG preview of a page, longest side `maxSide` px, as an object URL the caller must revoke. */
export async function renderThumbnail(handle: PdfHandle, pageNumber: number, maxSide = 180): Promise<string> {
  const page = await handle.doc.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    try {
      await page.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      if (!blob) throw new ImageError('Could not draw a preview of this page.');
      return URL.createObjectURL(blob);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    page.cleanup();
  }
}

/** Reads a File into memory after checking its size, with a clear message when it is over the limit. */
export async function readPdfFile(file: File): Promise<Uint8Array> {
  if (file.size === 0) throw new PdfOpenError('invalid', 'This file is empty.');
  if (file.size > LIMITS.pdfFileBytes) throw new PdfOpenError('failed', `This file is over ${LIMITS.pdfFileBytes / 1024 / 1024} MB. Use a smaller PDF.`);
  return new Uint8Array(await file.arrayBuffer());
}
