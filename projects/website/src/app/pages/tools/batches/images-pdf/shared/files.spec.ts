import { describe, expect, it } from 'vitest';
import {
  baseName,
  fileExt,
  isPdf,
  percentSaved,
  probeImageSize,
  readJpegOrientation,
  safeFileName,
  savingLabel,
  sniffImageKind,
  uniqueName,
  withExt,
} from './files';

const bytes = (...parts: (number | string)[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : [p])));

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16le = (n: number) => [n & 255, (n >> 8) & 255];

const png = (w: number, h: number) =>
  bytes(0x89, 'PNG\r\n', 0x1a, 0x0a, ...u32(13), 'IHDR', ...u32(w), ...u32(h), 8, 6, 0, 0, 0);

/** A JPEG skeleton: SOI, optional EXIF APP1 with an orientation tag, SOF0, SOS. */
function jpeg(w: number, h: number, orientation?: number, order: 'II' | 'MM' = 'MM', components = 3): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  if (orientation !== undefined) {
    const little = order === 'II';
    const u16 = (n: number) => (little ? u16le(n) : [(n >> 8) & 255, n & 255]);
    const u32w = (n: number) => (little ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255] : u32(n));
    const tiff = [...bytes(order), ...u16(42), ...u32w(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32w(1), ...u16(orientation), 0, 0, ...u32w(0)];
    const body = [...bytes('Exif\0\0'), ...tiff];
    parts.push(0xff, 0xe1, ...[(body.length + 2) >> 8, (body.length + 2) & 255], ...body);
  }
  const sof = [8, ...[h >> 8, h & 255], ...[w >> 8, w & 255], components, ...Array(components * 3).fill(1)];
  parts.push(0xff, 0xc0, ...[(sof.length + 2) >> 8, (sof.length + 2) & 255], ...sof, 0xff, 0xda, 0, 2);
  return Uint8Array.from(parts);
}

describe('sniffImageKind', () => {
  it('identifies formats by their first bytes, not by name', () => {
    expect(sniffImageKind(png(1, 1))).toBe('png');
    expect(sniffImageKind(jpeg(1, 1))).toBe('jpeg');
    expect(sniffImageKind(bytes('GIF89a', 1, 0, 1, 0))).toBe('gif');
    expect(sniffImageKind(bytes('RIFF', 0, 0, 0, 0, 'WEBP', 'VP8 '))).toBe('webp');
    expect(sniffImageKind(Uint8Array.from([0, 0, 0, 24, ...bytes('ftypavif')]))).toBe('avif');
    expect(sniffImageKind(bytes('BM', ...Array(24).fill(0)))).toBe('bmp');
  });

  it('returns unknown for text, empty and executable content', () => {
    expect(sniffImageKind(bytes('<svg xmlns="..."'))).toBe('unknown');
    expect(sniffImageKind(new Uint8Array())).toBe('unknown');
    expect(sniffImageKind(bytes('MZ', 0x90, 0))).toBe('unknown');
  });
});

describe('isPdf', () => {
  it('accepts a header at the start or after a few junk bytes, and rejects others', () => {
    expect(isPdf(bytes('%PDF-1.7\n'))).toBe(true);
    expect(isPdf(bytes('\n\n  %PDF-1.4'))).toBe(true);
    expect(isPdf(bytes('PK\u0003\u0004 not a pdf'))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });
});

describe('probeImageSize', () => {
  it('reads PNG, JPEG, GIF and BMP dimensions from the header', () => {
    expect(probeImageSize(png(4000, 3000))).toEqual({ width: 4000, height: 3000 });
    expect(probeImageSize(jpeg(640, 480))).toMatchObject({ width: 640, height: 480, components: 3 });
    expect(probeImageSize(jpeg(10, 20, 6))).toMatchObject({ width: 10, height: 20 });
    expect(probeImageSize(bytes('GIF89a', ...u16le(320), ...u16le(200)))).toEqual({ width: 320, height: 200 });
    const bmp = bytes('BM', ...Array(16).fill(0), ...[100, 0, 0, 0], ...[0xf4, 0xff, 0xff, 0xff]); // height -12 (top-down)
    expect(probeImageSize(bmp)).toEqual({ width: 100, height: 12 });
  });

  it('reads WebP VP8X, VP8L and VP8 sizes', () => {
    const head = (chunk: string, payload: number[]) => bytes('RIFF', 0, 0, 0, 0, 'WEBP', chunk, 0, 0, 0, 0, ...payload, ...Array(12).fill(0));
    const vp8x = head('VP8X', [0, 0, 0, 0, ...[(1920 - 1) & 255, ((1920 - 1) >> 8) & 255, 0], ...[(1080 - 1) & 255, ((1080 - 1) >> 8) & 255, 0]]);
    expect(probeImageSize(vp8x)).toEqual({ width: 1920, height: 1080 });
    const bits = (300 - 1) | ((200 - 1) << 14);
    const vp8l = head('VP8L', [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]);
    expect(probeImageSize(vp8l)).toEqual({ width: 300, height: 200 });
    const vp8 = head('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(800), ...u16le(600)]);
    expect(probeImageSize(vp8)).toEqual({ width: 800, height: 600 });
  });

  it('returns null for truncated or unsupported data instead of throwing', () => {
    expect(probeImageSize(bytes(0xff, 0xd8, 0xff))).toBeNull();
    expect(probeImageSize(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBeNull();
    expect(probeImageSize(new Uint8Array())).toBeNull();
  });

  it('exposes a pixel count large enough to refuse a decompression bomb before decoding', () => {
    const size = probeImageSize(png(60000, 60000));
    expect(size && size.width * size.height).toBeGreaterThan(64_000_000);
  });
});

describe('readJpegOrientation', () => {
  it('reads the EXIF orientation in both byte orders', () => {
    expect(readJpegOrientation(jpeg(4, 3, 6, 'MM'))).toBe(6);
    expect(readJpegOrientation(jpeg(4, 3, 8, 'II'))).toBe(8);
    expect(readJpegOrientation(jpeg(4, 3, 3, 'II'))).toBe(3);
  });

  it('defaults to 1 without EXIF, for invalid values and for non-JPEG data', () => {
    expect(readJpegOrientation(jpeg(4, 3))).toBe(1);
    expect(readJpegOrientation(jpeg(4, 3, 9))).toBe(1);
    expect(readJpegOrientation(png(2, 2))).toBe(1);
    expect(readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff))).toBe(1);
  });
});

describe('file names', () => {
  it('splits names and extensions', () => {
    expect(fileExt('Photo.JPG')).toBe('jpg');
    expect(fileExt('archive')).toBe('');
    expect(fileExt('.hidden')).toBe('');
    expect(baseName('C:\\pics\\a.b.png')).toBe('a.b');
    expect(baseName('noext')).toBe('noext');
  });

  it('makes names safe for any file system', () => {
    expect(safeFileName('a/b\\c:d*e?.pdf')).toBe('a-b-c-d-e-.pdf');
    expect(safeFileName('  ..hidden  ')).toBe('hidden');
    expect(safeFileName('CON')).toBe('file');
    expect(safeFileName('', 'x')).toBe('x');
    expect(safeFileName('x'.repeat(300)).length).toBe(120);
  });

  it('replaces extensions and keeps names unique inside a ZIP', () => {
    expect(withExt('holiday photo.png', 'webp')).toBe('holiday photo.webp');
    const used = new Set<string>();
    expect(uniqueName('a.png', used)).toBe('a.png');
    expect(uniqueName('a.png', used)).toBe('a (2).png');
    expect(uniqueName('A.PNG', used)).toBe('A (3).PNG');
    expect(uniqueName('noext', used)).toBe('noext');
    expect(uniqueName('noext', used)).toBe('noext (2)');
  });
});

describe('size labels', () => {
  it('reports savings in plain words', () => {
    expect(savingLabel(1000, 380)).toBe('62% smaller');
    expect(savingLabel(1000, 1200)).toBe('20% larger');
    expect(savingLabel(1000, 1000)).toBe('no change');
    expect(savingLabel(0, 5)).toBe('');
    expect(percentSaved(200, 50)).toBe(75);
    expect(percentSaved(0, 5)).toBe(0);
  });
});
