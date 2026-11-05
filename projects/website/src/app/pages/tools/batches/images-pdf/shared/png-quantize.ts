import { createYielder } from './async';

/**
 * Real PNG size reduction: reduce the image to a palette of at most 256 colours (median cut) and write an
 * indexed PNG. This is lossy (flat colours survive exactly, gradients and photos can show banding), which the
 * tool says. Works on RGBA pixels from a canvas, so it never touches the file's metadata.
 */

export interface Quantized {
  /** RGBA, 4 bytes per palette entry. */
  palette: Uint8Array;
  /** One palette index per pixel, row by row. */
  indices: Uint8Array;
}

const BUCKETS = 1 << 19; // 5 bits each for R, G, B and 4 bits for alpha

const bucketOf = (r: number, g: number, b: number, a: number): number =>
  a === 0 ? 0 : ((r >> 3) << 14) | ((g >> 3) << 9) | ((b >> 3) << 4) | (a >> 4);

/** Reduces RGBA pixels to `maxColors` (2 to 256) colours. Yields to the browser every ~30 ms. */
export async function quantizeRgba(rgba: Uint8ClampedArray | Uint8Array, maxColors = 256): Promise<Quantized> {
  const limit = Math.min(256, Math.max(2, Math.floor(maxColors)));
  const pixels = rgba.length >> 2;
  const turn = createYielder();

  const count = new Uint32Array(BUCKETS);
  const sumR = new Float64Array(BUCKETS);
  const sumG = new Float64Array(BUCKETS);
  const sumB = new Float64Array(BUCKETS);
  const sumA = new Float64Array(BUCKETS);
  for (let i = 0, p = 0; i < pixels; i++, p += 4) {
    const a = rgba[p + 3];
    const r = a === 0 ? 0 : rgba[p];
    const g = a === 0 ? 0 : rgba[p + 1];
    const b = a === 0 ? 0 : rgba[p + 2];
    const k = bucketOf(r, g, b, a);
    count[k]++;
    sumR[k] += r;
    sumG[k] += g;
    sumB[k] += b;
    sumA[k] += a;
    if ((i & 0x3ffff) === 0) await turn();
  }

  const keys: number[] = [];
  for (let k = 0; k < BUCKETS; k++) if (count[k] > 0) keys.push(k);
  const avg = (sum: Float64Array, k: number) => sum[k] / count[k];

  // Boxes of bucket keys; split the busiest box along its widest channel until there are `limit` boxes.
  type Box = { items: number[]; total: number; range: number; channel: 0 | 1 | 2 | 3 };
  const measure = (items: number[]): Box => {
    const lo = [255, 255, 255, 255];
    const hi = [0, 0, 0, 0];
    let total = 0;
    for (const k of items) {
      const v = [avg(sumR, k), avg(sumG, k), avg(sumB, k), avg(sumA, k)];
      for (let c = 0; c < 4; c++) {
        if (v[c] < lo[c]) lo[c] = v[c];
        if (v[c] > hi[c]) hi[c] = v[c];
      }
      total += count[k];
    }
    let channel: 0 | 1 | 2 | 3 = 0;
    let range = -1;
    for (let c = 0; c < 4; c++) {
      const r = hi[c] - lo[c];
      if (r > range) {
        range = r;
        channel = c as 0 | 1 | 2 | 3;
      }
    }
    return { items, total, range, channel };
  };

  let boxes: Box[] = [measure(keys)];
  while (boxes.length < limit) {
    let pick = -1;
    let best = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.items.length < 2 || b.range <= 0) continue;
      const priority = b.total * (b.range + 1);
      if (priority > best) {
        best = priority;
        pick = i;
      }
    }
    if (pick < 0) break;
    const box = boxes[pick];
    const sums = [sumR, sumG, sumB, sumA][box.channel];
    const sorted = [...box.items].sort((a, b) => avg(sums, a) - avg(sums, b));
    let running = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      running += count[sorted[i]];
      cut = i + 1;
      if (running * 2 >= box.total) break;
    }
    boxes.splice(pick, 1, measure(sorted.slice(0, cut)), measure(sorted.slice(cut)));
    if (boxes.length % 16 === 0) await turn();
  }
  boxes = boxes.filter((b) => b.items.length > 0);

  const palette = new Uint8Array(boxes.length * 4);
  const bucketToIndex = new Int16Array(BUCKETS).fill(-1);
  boxes.forEach((box, index) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (const k of box.items) {
      r += sumR[k];
      g += sumG[k];
      b += sumB[k];
      a += sumA[k];
      bucketToIndex[k] = index;
    }
    const n = box.total;
    palette[index * 4] = Math.round(r / n);
    palette[index * 4 + 1] = Math.round(g / n);
    palette[index * 4 + 2] = Math.round(b / n);
    palette[index * 4 + 3] = Math.round(a / n);
  });

  const indices = new Uint8Array(pixels);
  for (let i = 0, p = 0; i < pixels; i++, p += 4) {
    const a = rgba[p + 3];
    indices[i] = bucketToIndex[a === 0 ? 0 : bucketOf(rgba[p], rgba[p + 1], rgba[p + 2], a)];
    if ((i & 0x3ffff) === 0) await turn();
  }
  return { palette, indices };
}

let crcTable: Uint32Array | null = null;
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Writes an 8-bit indexed PNG (colour type 3) with a tRNS chunk when any palette entry is not opaque. */
export async function encodeIndexedPng(width: number, height: number, q: Quantized): Promise<Uint8Array> {
  const { zlibSync } = await import('fflate');
  const n = q.palette.length >> 2;
  const plte = new Uint8Array(n * 3);
  const trns = new Uint8Array(n);
  let transparent = false;
  for (let i = 0; i < n; i++) {
    plte[i * 3] = q.palette[i * 4];
    plte[i * 3 + 1] = q.palette[i * 4 + 1];
    plte[i * 3 + 2] = q.palette[i * 4 + 2];
    trns[i] = q.palette[i * 4 + 3];
    if (trns[i] !== 255) transparent = true;
  }
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 3; // indexed colour

  const stride = width + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) raw.set(q.indices.subarray(y * width, (y + 1) * width), y * stride + 1); // filter byte 0
  const idat = zlibSync(raw, { level: 9 });

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('PLTE', plte),
    ...(transparent ? [chunk('tRNS', trns)] : []),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
