import { describe, expect, it } from 'vitest';
import {
  RESIZE_PRESETS,
  checkOutputSize,
  linkedSide,
  parseSizeInput,
  planBox,
  planExact,
  planMaxSide,
  planPercent,
  planResize,
  searchTargetSize,
  type ResizeOptions,
} from './size-math';

describe('draw plans', () => {
  it('scales by percent and never returns a zero side', () => {
    expect(planPercent(1000, 500, 50)).toMatchObject({ width: 500, height: 250, dw: 500, dh: 250 });
    expect(planPercent(3, 3, 5)).toMatchObject({ width: 1, height: 1 });
    expect(planPercent(100, 100, 400)).toMatchObject({ width: 400, height: 400 });
  });

  it('limits the longest side without enlarging', () => {
    expect(planMaxSide(4000, 3000, 2000)).toMatchObject({ width: 2000, height: 1500 });
    expect(planMaxSide(3000, 4000, 2000)).toMatchObject({ width: 1500, height: 2000 });
    expect(planMaxSide(800, 600, 2000)).toMatchObject({ width: 800, height: 600 });
    expect(planMaxSide(800, 600, 0)).toMatchObject({ width: 800, height: 600 });
  });

  it('fits inside a box with the ratio kept, enlarging only when asked', () => {
    expect(planBox(4000, 3000, 1200, 1200, false)).toMatchObject({ width: 1200, height: 900 });
    expect(planBox(400, 300, 1200, 1200, false)).toMatchObject({ width: 400, height: 300 });
    expect(planBox(400, 300, 1200, 1200, true)).toMatchObject({ width: 1200, height: 900 });
    expect(planBox(1000, 2000, 1e9, 500, false)).toMatchObject({ width: 250, height: 500 });
  });

  it('contain letterboxes inside the exact size', () => {
    const p = planExact(2000, 1000, 1000, 1000, 'contain');
    expect(p).toMatchObject({ width: 1000, height: 1000, dw: 1000, dh: 500, dx: 0, dy: 250, sx: 0, sy: 0, sw: 2000, sh: 1000 });
  });

  it('cover crops the source centrally to fill the exact size', () => {
    const p = planExact(2000, 1000, 1000, 1000, 'cover');
    expect(p).toMatchObject({ width: 1000, height: 1000, dx: 0, dy: 0, dw: 1000, dh: 1000, sw: 1000, sh: 1000, sx: 500, sy: 0 });
    const tall = planExact(1000, 2000, 500, 500, 'cover');
    expect(tall).toMatchObject({ sw: 1000, sh: 1000, sx: 0, sy: 500 });
  });

  it('stretch uses the whole source', () => {
    expect(planExact(2000, 1000, 300, 600, 'stretch')).toMatchObject({ width: 300, height: 600, sx: 0, sy: 0, sw: 2000, sh: 1000, dw: 300, dh: 600 });
  });
});

describe('output limits', () => {
  it('accepts normal sizes and explains why others are refused', () => {
    expect(checkOutputSize(1920, 1080)).toBeNull();
    expect(checkOutputSize(0, 100)).toMatch(/at least 1/);
    expect(checkOutputSize(NaN, 100)).toMatch(/at least 1/);
    expect(checkOutputSize(20000, 100)).toMatch(/16,384/);
    expect(checkOutputSize(10000, 10000)).toMatch(/megapixels/);
  });
});

describe('linkedSide and parseSizeInput', () => {
  it('derives the other side from a ratio', () => {
    expect(linkedSide('1200', 4 / 3, 'width')).toBe('900');
    expect(linkedSide('900', 4 / 3, 'height')).toBe('1200');
    expect(linkedSide('', 1.5, 'width')).toBe('');
    expect(linkedSide('abc', 1.5, 'width')).toBe('');
    expect(linkedSide('-5', 1.5, 'width')).toBe('');
    expect(linkedSide('10', 0, 'width')).toBe('');
  });

  it('parses sizes with units', () => {
    expect(parseSizeInput('200')).toBe(200 * 1024);
    expect(parseSizeInput('200 KB')).toBe(200 * 1024);
    expect(parseSizeInput('1.5mb')).toBe(Math.round(1.5 * 1024 * 1024));
    expect(parseSizeInput('1,5 MB')).toBe(Math.round(1.5 * 1024 * 1024));
    expect(parseSizeInput('2', 'mb')).toBe(2 * 1024 * 1024);
    expect(parseSizeInput('0')).toBeNull();
    expect(parseSizeInput('abc')).toBeNull();
    expect(parseSizeInput('-3 KB')).toBeNull();
    expect(parseSizeInput('')).toBeNull();
  });
});

describe('planResize', () => {
  const base: ResizeOptions = { mode: 'pixels', width: 1200, height: NaN, lock: true, percent: 50, presetId: 'ig-square', fit: 'cover', upscale: false };

  it('locked pixels mode fits inside the box', () => {
    expect(planResize(base, 4000, 3000)).toMatchObject({ plan: { width: 1200, height: 900 } });
    expect(planResize({ ...base, width: NaN, height: 600 }, 4000, 3000)).toMatchObject({ plan: { width: 800, height: 600 } });
    expect(planResize({ ...base, width: NaN }, 4000, 3000)).toHaveProperty('error');
  });

  it('unlocked pixels mode needs both sides and uses the fit', () => {
    expect(planResize({ ...base, lock: false }, 4000, 3000)).toHaveProperty('error');
    expect(planResize({ ...base, lock: false, height: 600, fit: 'stretch' }, 4000, 3000)).toMatchObject({ plan: { width: 1200, height: 600 } });
  });

  it('percent and preset modes', () => {
    expect(planResize({ ...base, mode: 'percent', percent: 25 }, 4000, 3000)).toMatchObject({ plan: { width: 1000, height: 750 } });
    expect(planResize({ ...base, mode: 'percent', percent: 0 }, 4000, 3000)).toHaveProperty('error');
    expect(planResize({ ...base, mode: 'preset', presetId: 'og', fit: 'cover' }, 4000, 3000)).toMatchObject({ plan: { width: 1200, height: 630 } });
    expect(planResize({ ...base, mode: 'preset', presetId: 'nope' }, 4000, 3000)).toHaveProperty('error');
  });

  it('refuses results beyond the canvas limits', () => {
    expect(planResize({ ...base, lock: false, width: 20000, height: 20000 }, 100, 100)).toHaveProperty('error');
  });

  it('has unique presets with real sizes', () => {
    expect(new Set(RESIZE_PRESETS.map((p) => p.id)).size).toBe(RESIZE_PRESETS.length);
    for (const p of RESIZE_PRESETS) expect(p.width * p.height).toBeGreaterThan(0);
  });
});

describe('searchTargetSize', () => {
  /** A fake encoder: size grows with quality and with the square of the scale. */
  const fake = (full: number) => async (quality: number, scale: number) => {
    const bytes = Math.round(full * quality * scale * scale);
    return { value: { quality, scale }, bytes };
  };

  it('returns the best quality straight away when it already fits', async () => {
    const result = await searchTargetSize(fake(1000), 5000);
    expect(result).toMatchObject({ reached: true, quality: 0.95, scale: 1, tries: 1 });
  });

  it('finds the highest quality that fits by binary search', async () => {
    const result = await searchTargetSize(fake(100_000), 50_000);
    expect(result.reached).toBe(true);
    expect(result.scale).toBe(1);
    const size = Math.round(100_000 * result.quality);
    expect(size).toBeLessThanOrEqual(50_000);
    expect(size).toBeGreaterThan(44_000); // close to the limit, not wastefully low
    expect(result.tries).toBeLessThanOrEqual(10);
  });

  it('shrinks the pixel size when even the lowest quality is too big', async () => {
    const result = await searchTargetSize(fake(100_000), 4_000);
    expect(result.reached).toBe(true);
    expect(result.scale).toBeLessThan(1);
    expect(Math.round(100_000 * result.quality * result.scale * result.scale)).toBeLessThanOrEqual(4_000);
  });

  it('reports failure and the smallest result when nothing can fit', async () => {
    const result = await searchTargetSize(async () => ({ value: 'x', bytes: 10_000 }), 10);
    expect(result.reached).toBe(false);
    expect(result.value).toBe('x');
  });

  it('reports progress through onTry', async () => {
    const seen: number[] = [];
    await searchTargetSize(fake(100_000), 50_000, { onTry: (q) => seen.push(q) });
    expect(seen.length).toBeGreaterThan(2);
  });
});
