/** Pure helpers for the image and PDF tools: file names, format sniffing, header parsing, size limits. No DOM. */

export const MB = 1024 * 1024;

/** Limits that keep a phone or a laptop tab from running out of memory. Messages quote them. */
export const LIMITS = {
  /** One image file. */
  imageFileBytes: 50 * MB,
  /** Images per run. */
  imageFiles: 100,
  /** Decoded pixels per image (RGBA is 4 bytes each: 64 MP is about 256 MB). */
  pixels: 64 * 1_000_000,
  /** Longest side a canvas can have in current browsers. */
  side: 16384,
  /** One PDF file. */
  pdfFileBytes: 100 * MB,
  /** PDFs per merge. */
  pdfFiles: 30,
  /** Total PDF input for a merge. */
  pdfTotalBytes: 300 * MB,
  /** Pages rendered to images in one run. */
  pagesToImages: 300,
  /** Bytes of rendered page images kept in memory at once. */
  pageImageBytes: 600 * MB,
  /** Output files from one split. */
  splitFiles: 500,
  /** Pages in a PDF the thumbnails grid will list. */
  thumbPages: 400,
} as const;

export type ImageKind = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'avif' | 'svg' | 'unknown';

const ascii = (b: Uint8Array, at: number, text: string): boolean => {
  if (b.length < at + text.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
};

/** Identifies an image by its first bytes (never by file name or the declared MIME type). */
export function sniffImageKind(head: Uint8Array): ImageKind {
  if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 'PNG\r\n') && head[6] === 0x1a && head[7] === 0x0a) return 'png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (ascii(head, 0, 'GIF87a') || ascii(head, 0, 'GIF89a')) return 'gif';
  if (ascii(head, 0, 'RIFF') && ascii(head, 8, 'WEBP')) return 'webp';
  if (ascii(head, 0, 'BM') && head.length >= 26) return 'bmp';
  if (ascii(head, 4, 'ftyp') && (ascii(head, 8, 'avif') || ascii(head, 8, 'avis'))) return 'avif';
  return 'unknown';
}

export function isPdf(head: Uint8Array): boolean {
  // The header may follow a few junk bytes; viewers accept it anywhere in the first 1024.
  const limit = Math.min(head.length - 5, 1024);
  for (let i = 0; i <= limit; i++) if (ascii(head, i, '%PDF-')) return true;
  return false;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const i32le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24);

/**
 * Pixel size read from the file header, so a huge image can be refused before it is decoded.
 * Returns null for formats without a cheap header (AVIF) and for damaged headers.
 */
export function probeImageSize(b: Uint8Array): { width: number; height: number; components?: number } | null {
  const kind = sniffImageKind(b);
  if (kind === 'png' && b.length >= 24) return { width: u32be(b, 16), height: u32be(b, 20) };
  if (kind === 'gif' && b.length >= 10) return { width: u16le(b, 6), height: u16le(b, 8) };
  if (kind === 'bmp') return { width: Math.abs(i32le(b, 18)), height: Math.abs(i32le(b, 22)) };
  if (kind === 'webp' && b.length >= 30) {
    if (ascii(b, 12, 'VP8X')) {
      return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    }
    if (ascii(b, 12, 'VP8L') && b[20] === 0x2f) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (ascii(b, 12, 'VP8 ')) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    return null;
  }
  if (kind === 'jpeg') {
    let i = 2;
    while (i + 4 < b.length) {
      if (b[i] !== 0xff) return null;
      while (b[i] === 0xff && i < b.length) i++;
      const marker = b[i++];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xd9 || marker === 0xda) return null;
      if (i + 2 > b.length) return null;
      const length = u16be(b, i);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return i + 8 <= b.length ? { height: u16be(b, i + 3), width: u16be(b, i + 5), components: b[i + 7] } : null;
      i += length;
    }
  }
  return null;
}

/** EXIF orientation (1 to 8) of a JPEG, or 1 when absent. Browsers apply it on decode; PDFs and raw embeds do not. */
export function readJpegOrientation(b: Uint8Array): number {
  if (sniffImageKind(b) !== 'jpeg') return 1;
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = u16be(b, i + 2);
    if (marker === 0xe1 && ascii(b, i + 4, 'Exif\u0000\u0000')) {
      const tiff = i + 10;
      const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
      if (!little && !(b[tiff] === 0x4d && b[tiff + 1] === 0x4d)) return 1;
      const r16 = (at: number) => (little ? u16le(b, at) : u16be(b, at));
      const r32 = (at: number) => (little ? (u16le(b, at) | (u16le(b, at + 2) << 16)) >>> 0 : u32be(b, at));
      const ifd = tiff + r32(tiff + 4);
      if (ifd + 2 > b.length) return 1;
      const count = r16(ifd);
      for (let n = 0; n < count; n++) {
        const entry = ifd + 2 + n * 12;
        if (entry + 12 > b.length) return 1;
        if (r16(entry) === 0x0112) {
          const value = r16(entry + 8);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    i += 2 + length;
  }
  return 1;
}

export function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

export function baseName(name: string): string {
  const clean = name.split(/[\\/]/).pop() ?? name;
  const dot = clean.lastIndexOf('.');
  return dot > 0 ? clean.slice(0, dot) : clean;
}

/** A file name that is safe on Windows, macOS and Linux: no path separators or reserved characters, bounded length. */
export function safeFileName(name: string, fallback = 'file'): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
  const short = cleaned.slice(0, 120);
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(short) || !short ? fallback : short;
}

/** `photo.png` + `webp` gives `photo.webp`. */
export function withExt(name: string, ext: string): string {
  return `${safeFileName(baseName(name), 'image')}.${ext}`;
}

/** Adds "(2)", "(3)" before the extension until the name is not in `used`; records the result. */
export function uniqueName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${stem} (${n++})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/** "62% smaller" / "12% larger" / "no change". */
export function savingLabel(before: number, after: number): string {
  if (before <= 0) return '';
  const change = Math.round(((after - before) / before) * 100);
  if (change === 0) return 'no change';
  return change < 0 ? `${-change}% smaller` : `${change}% larger`;
}

export function percentSaved(before: number, after: number): number {
  return before > 0 ? Math.round(((before - after) / before) * 100) : 0;
}
