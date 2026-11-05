import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

export type PdfJs = typeof import('pdfjs-dist');

let library: Promise<PdfJs> | null = null;

/**
 * Loads pdf.js on first use (its own lazy chunk) and points it at the worker file the build copied into the output, so no script
 * is fetched from any CDN. Browser only.
 */
export function loadPdfjs(): Promise<PdfJs> {
  library ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs', { with: { loader: 'file' } }),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(worker.default, document.baseURI).href;
    return pdfjs;
  });
  return library;
}

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  task: PDFDocumentLoadingTask;
}

export interface PasswordRequest {
  /** Sends the password to pdf.js (in this tab only). */
  submit: (password: string) => void;
  /** True when a password was already tried and was wrong. */
  wrong: boolean;
}

/**
 * Opens a PDF from bytes. When the file is encrypted, `onPassword` is called (again after a wrong password)
 * and the returned promise waits until the user submits one. WebAssembly decoders are off (they would need extra files), so a few rare image types may stay blank.
 */
export async function openPdf(
  bytes: Uint8Array,
  onPassword: (request: PasswordRequest) => void,
  onTask?: (task: PDFDocumentLoadingTask) => void,
): Promise<OpenedPdf> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: bytes,
    useWasm: false,
    stopAtErrors: false,
  });
  onTask?.(task);
  task.onPassword = (submit: (password: string) => void, reason: number) => {
    onPassword({ submit, wrong: reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD });
  };
  try {
    return { doc: await task.promise, task };
  } catch (error) {
    void task.destroy();
    throw error;
  }
}
