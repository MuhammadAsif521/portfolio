import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crc32, encodeIndexedPng, quantizeRgba } from './png-quantize';

function rgba(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return data;
}

/** Reads every chunk of a PNG, checking the signature and each CRC. */
function chunks(png: Uint8Array): { type: string; data: Uint8Array }[] {
  expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const out: { type: string; data: Uint8Array }[] = [];
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    expect(view.getUint32(at + 8 + length), `CRC of ${type}`).toBe(crc32(png.subarray(at + 4, at + 8 + length)));
    out.push({ type, data });
    at += 12 + length;
  }
  return out;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('quantizeRgba', () => {
  it('keeps a flat-colour image exactly, with one palette entry per colour', async () => {
    const red: [number, number, number, number] = [200, 10, 10, 255];
    const green: [number, number, number, number] = [10, 180, 40, 255];
    const data = rgba(16, 16, (x) => (x < 8 ? red : green));
    const q = await quantizeRgba(data, 256);
    expect(q.palette.length / 4).toBe(2);
    for (let i = 0; i < 256; i++) {
      const entry = q.indices[i];
      expect(Array.from(q.palette.subarray(entry * 4, entry * 4 + 4))).toEqual(i % 16 < 8 ? red : green);
    }
  });

  it('never exceeds the requested palette size and stays close to the original on a gradient', async () => {
    const data = rgba(128, 128, (x, y) => [x * 2, y * 2, (x + y) % 256, 255]);
    for (const limit of [256, 64, 16]) {
      const q = await quantizeRgba(data, limit);
      expect(q.palette.length / 4).toBeLessThanOrEqual(limit);
      let error = 0;
      for (let i = 0; i < 128 * 128; i++) {
        const p = q.indices[i] * 4;
        error += Math.abs(q.palette[p] - data[i * 4]) + Math.abs(q.palette[p + 1] - data[i * 4 + 1]) + Math.abs(q.palette[p + 2] - data[i * 4 + 2]);
        expect(q.indices[i]).toBeLessThan(q.palette.length / 4);
      }
      const mean = error / (128 * 128 * 3);
      expect(mean, `mean error with ${limit} colours`).toBeLessThan(limit === 16 ? 45 : 22);
    }
  });

  it('keeps fully transparent pixels transparent and semi-transparent ones semi-transparent', async () => {
    const data = rgba(8, 8, (x) => (x < 4 ? [0, 0, 0, 0] : [255, 255, 255, 128]));
    const q = await quantizeRgba(data, 256);
    const alphaAt = (pixel: number) => q.palette[q.indices[pixel] * 4 + 3];
    expect(alphaAt(0)).toBe(0);
    expect(alphaAt(7)).toBe(128);
  });

  it('handles a single colour and tiny images', async () => {
    const q = await quantizeRgba(rgba(1, 1, () => [1, 2, 3, 255]), 256);
    expect(q.palette.length).toBe(4);
    expect(Array.from(q.palette)).toEqual([1, 2, 3, 255]);
    expect(Array.from(q.indices)).toEqual([0]);
  });

  it('clamps nonsensical palette sizes', async () => {
    const data = rgba(4, 4, (x, y) => [x * 60, y * 60, 0, 255]);
    expect((await quantizeRgba(data, 1000)).palette.length / 4).toBeLessThanOrEqual(256);
    expect((await quantizeRgba(data, 0)).palette.length / 4).toBeLessThanOrEqual(2);
  });
});

describe('encodeIndexedPng', () => {
  it('writes a structurally valid indexed PNG whose pixels round-trip', async () => {
    const width = 20;
    const height = 7;
    const data = rgba(width, height, (x, y) => [x * 12, y * 30, 99, x === 0 ? 0 : 255]);
    const q = await quantizeRgba(data, 64);
    const png = await encodeIndexedPng(width, height, q);
    const list = chunks(png);
    expect(list.map((c) => c.type)).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

    const header = new DataView(list[0].data.buffer, list[0].data.byteOffset, 13);
    expect([header.getUint32(0), header.getUint32(4), list[0].data[8], list[0].data[9]]).toEqual([width, height, 8, 3]);
    expect(list[1].data.length).toBe((q.palette.length / 4) * 3);
    expect(list[2].data.length).toBe(q.palette.length / 4);

    const raw = unzlibSync(list[3].data);
    expect(raw.length).toBe((width + 1) * height);
    for (let y = 0; y < height; y++) {
      expect(raw[y * (width + 1)]).toBe(0); // filter type None
      expect(Array.from(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)))).toEqual(Array.from(q.indices.subarray(y * width, (y + 1) * width)));
    }
  });

  it('omits tRNS for fully opaque images', async () => {
    const q = await quantizeRgba(rgba(4, 4, () => [9, 9, 9, 255]), 256);
    const types = chunks(await encodeIndexedPng(4, 4, q)).map((c) => c.type);
    expect(types).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
  });

  it('is much smaller than raw RGBA for flat graphics', async () => {
    const width = 200;
    const height = 200;
    const data = rgba(width, height, (x) => (x < 100 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const png = await encodeIndexedPng(width, height, await quantizeRgba(data, 256));
    expect(png.length).toBeLessThan(width * height * 4 * 0.05);
  });
});
