import { IMAGE_TYPES, MB, countWords, isOleOffice, isZip } from '../shared/doc-utils';
import { htmlToText, sanitizeHtml } from '../shared/doc-sanitize';

export const DOCX_MAX_MB = 25;
/** One picture bigger than this stays out of the preview (it would only slow the page down). */
const MAX_IMAGE_BYTES = 8 * MB;

export class DocxError extends Error {}

export interface DocxStats {
  words: number;
  characters: number;
  headings: number;
  tables: number;
  images: number;
  /** Pictures that could not be shown (EMF/WMF/TIFF, or very large). */
  skippedImages: number;
}

export interface DocxResult {
  /** Sanitised HTML, safe to render. */
  html: string;
  text: string;
  /** Conversion notes from mammoth, repeated notes merged ("Unrecognised paragraph style: 'X' (3x)"). */
  warnings: string[];
  stats: DocxStats;
}

/** Merges identical messages and counts them, keeping first-seen order. */
export function mergeWarnings(messages: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    const clean = message.trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return Array.from(counts, ([message, n]) => (n > 1 ? `${message} (${n}x)` : message));
}

/** Throws a plain-language DocxError when the bytes are clearly not a .docx. */
export function checkDocxBytes(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new DocxError('This file is empty.');
  if (isOleOffice(bytes)) {
    throw new DocxError(
      'This looks like an older Word file (.doc) or a password-protected document. Save it as .docx in Word (without a password) and open that.',
    );
  }
  if (!isZip(bytes)) {
    throw new DocxError('This is not a .docx file. A .docx is a ZIP package that Word saves; this file is something else.');
  }
}

export function countStats(html: string, text: string, skippedImages: number): DocxStats {
  const count = (re: RegExp) => (html.match(re) ?? []).length;
  return {
    words: countWords(text),
    characters: text.replace(/\s/g, '').length,
    headings: count(/<h[1-6][\s>]/g),
    tables: count(/<table[\s>]/g),
    images: count(/<img[\s>]/g),
    skippedImages,
  };
}

/** Converts a .docx (as bytes) to sanitised HTML and plain text with mammoth. Browser/jsdom only. */
export async function convertDocx(buffer: ArrayBuffer): Promise<DocxResult> {
  checkDocxBytes(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8)));

  const loaded = await import('mammoth');
  const mammoth = (loaded as unknown as { default?: typeof loaded }).default ?? loaded;

  let skippedImages = 0;
  const convertImage = mammoth.images.imgElement(async (image) => {
    const kind = image.contentType.toLowerCase();
    const known = Object.values(IMAGE_TYPES).includes(kind);
    if (known) {
      const base64 = await image.readAsBase64String();
      if (base64.length * 0.75 <= MAX_IMAGE_BYTES) return { src: `data:${kind};base64,${base64}` };
    }
    skippedImages++;
    return { src: 'unsupported:' };
  });

  let converted;
  try {
    converted = await mammoth.convertToHtml(
      // The browser build of mammoth reads `arrayBuffer`; its Node build (unit tests) reads `buffer`.
      { arrayBuffer: buffer, buffer } as unknown as { arrayBuffer: ArrayBuffer },
      {
        convertImage,
        styleMap: ['u => u', "p[style-name='Title'] => h1.title:fresh", "p[style-name='Subtitle'] => p.subtitle:fresh"],
      },
    );
  } catch {
    throw new DocxError('Could not read this document. It may be damaged, password-protected, or not a Word .docx file.');
  }

  const clean = await sanitizeHtml(converted.value);
  const text = htmlToText(clean.html);
  return {
    html: clean.html,
    text,
    warnings: mergeWarnings(converted.messages.map((m) => m.message)),
    stats: countStats(clean.html, text, skippedImages),
  };
}
