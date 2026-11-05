import { LIMITS } from './files';

/** Pure geometry and search helpers for the image tools. */

export type FitMode = 'contain' | 'cover' | 'stretch';
export type Smoothing = 'none' | 'low' | 'medium' | 'high';

/** Where to read from the source and where to draw on a canvas of `width` x `height`. */
export interface DrawPlan {
  width: number;
  height: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

const px = (value: number): number => Math.max(1, Math.round(value));

/** Output of `planX` when the request cannot be satisfied. */
export function checkOutputSize(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return 'Enter a width and height of at least 1 pixel.';
  if (width > LIMITS.side || height > LIMITS.side) return `The longest side can be at most ${LIMITS.side.toLocaleString('en-US')} pixels.`;
  if (width * height > LIMITS.pixels) return `That is ${Math.round((width * height) / 1e6)} megapixels. The limit is ${LIMITS.pixels / 1e6} megapixels.`;
  return null;
}

const full = (w: number, h: number, srcW: number, srcH: number): DrawPlan => ({
  width: w,
  height: h,
  sx: 0,
  sy: 0,
  sw: srcW,
  sh: srcH,
  dx: 0,
  dy: 0,
  dw: w,
  dh: h,
});

/** Scale by a percentage of the original (10 to 400). */
export function planPercent(srcW: number, srcH: number, percent: number): DrawPlan {
  const k = Math.min(Math.max(percent, 1), 1000) / 100;
  return full(px(srcW * k), px(srcH * k), srcW, srcH);
}

/** Longest side at most `maxSide`, ratio kept, never enlarged. A `maxSide` of 0 or less keeps the size. */
export function planMaxSide(srcW: number, srcH: number, maxSide: number): DrawPlan {
  if (!(maxSide > 0) || Math.max(srcW, srcH) <= maxSide) return full(srcW, srcH, srcW, srcH);
  const k = maxSide / Math.max(srcW, srcH);
  return full(px(srcW * k), px(srcH * k), srcW, srcH);
}

/** Fit inside a width x height box, ratio kept. The result is at most the box; it is enlarged only if `upscale`. */
export function planBox(srcW: number, srcH: number, boxW: number, boxH: number, upscale: boolean): DrawPlan {
  let k = Math.min(boxW / srcW, boxH / srcH);
  if (!upscale) k = Math.min(k, 1);
  return full(px(srcW * k), px(srcH * k), srcW, srcH);
}

/** Exactly width x height: letterbox (contain), crop to fill (cover) or distort (stretch). */
export function planExact(srcW: number, srcH: number, w: number, h: number, fit: FitMode): DrawPlan {
  const width = px(w);
  const height = px(h);
  if (fit === 'stretch') return full(width, height, srcW, srcH);
  if (fit === 'contain') {
    const k = Math.min(width / srcW, height / srcH);
    const dw = px(srcW * k);
    const dh = px(srcH * k);
    return { width, height, sx: 0, sy: 0, sw: srcW, sh: srcH, dx: Math.round((width - dw) / 2), dy: Math.round((height - dh) / 2), dw, dh };
  }
  const k = Math.max(width / srcW, height / srcH);
  const sw = Math.min(srcW, width / k);
  const sh = Math.min(srcH, height / k);
  return { width, height, sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: 0, dy: 0, dw: width, dh: height };
}

/** Height that keeps the ratio for a new width (and the reverse). Empty or invalid input gives ''. */
export function linkedSide(value: string, ratio: number, from: 'width' | 'height'): string {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n) || n <= 0 || !(ratio > 0)) return '';
  return String(Math.max(1, Math.round(from === 'width' ? n / ratio : n * ratio)));
}

export interface ResizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

/** Commonly used pixel sizes. Platforms change them; the UI says so. */
export const RESIZE_PRESETS: readonly ResizePreset[] = [
  { id: 'ig-square', name: 'Instagram square, 1080 x 1080', width: 1080, height: 1080 },
  { id: 'ig-portrait', name: 'Instagram portrait, 1080 x 1350', width: 1080, height: 1350 },
  { id: 'story', name: 'Story / Reel / TikTok, 1080 x 1920', width: 1080, height: 1920 },
  { id: 'og', name: 'Open Graph / Facebook link, 1200 x 630', width: 1200, height: 630 },
  { id: 'x-post', name: 'X (Twitter) post, 1600 x 900', width: 1600, height: 900 },
  { id: 'x-header', name: 'X (Twitter) header, 1500 x 500', width: 1500, height: 500 },
  { id: 'linkedin-post', name: 'LinkedIn post, 1200 x 627', width: 1200, height: 627 },
  { id: 'linkedin-banner', name: 'LinkedIn banner, 1584 x 396', width: 1584, height: 396 },
  { id: 'yt-thumb', name: 'YouTube thumbnail, 1280 x 720', width: 1280, height: 720 },
  { id: 'hd', name: 'Full HD, 1920 x 1080', width: 1920, height: 1080 },
  { id: '4k', name: '4K UHD, 3840 x 2160', width: 3840, height: 2160 },
  { id: 'icon', name: 'App / site icon, 512 x 512', width: 512, height: 512 },
];

export interface SearchResult<T> {
  value: T;
  quality: number;
  scale: number;
  /** Whether the target size was met. */
  reached: boolean;
  /** How many encodes it took. */
  tries: number;
}

/**
 * Finds the highest quality whose encoded size is within `targetBytes`: first the best quality, then the lowest,
 * then a binary search between them. If even the lowest quality is too big it shrinks the pixel size by 15% steps
 * (`scale`) and tries again, and finally returns the smallest result it saw with `reached: false`.
 * `encode` returns the encoded value and its size; it is injected so this stays testable.
 */
export async function searchTargetSize<T>(
  encode: (quality: number, scale: number) => Promise<{ value: T; bytes: number }>,
  targetBytes: number,
  options: { maxQuality?: number; minQuality?: number; steps?: number; minScale?: number; onTry?: (quality: number, scale: number) => void } = {},
): Promise<SearchResult<T>> {
  const maxQ = options.maxQuality ?? 0.95;
  const minQ = options.minQuality ?? 0.1;
  const steps = options.steps ?? 6;
  const minScale = options.minScale ?? 0.25;
  let tries = 0;
  const run = async (quality: number, scale: number) => {
    options.onTry?.(quality, scale);
    tries++;
    return encode(quality, scale);
  };

  let smallest: { value: T; bytes: number; quality: number; scale: number } | null = null;
  const remember = (r: { value: T; bytes: number }, quality: number, scale: number) => {
    if (!smallest || r.bytes < smallest.bytes) smallest = { ...r, quality, scale };
  };

  for (let scale = 1; scale >= minScale - 1e-9; scale = Math.round(scale * 0.85 * 1000) / 1000) {
    const best = await run(maxQ, scale);
    remember(best, maxQ, scale);
    if (best.bytes <= targetBytes) return { value: best.value, quality: maxQ, scale, reached: true, tries };
    const worst = await run(minQ, scale);
    remember(worst, minQ, scale);
    if (worst.bytes <= targetBytes) {
      let lo = minQ;
      let hi = maxQ;
      let fit = { ...worst, quality: minQ };
      for (let i = 0; i < steps; i++) {
        const mid = (lo + hi) / 2;
        const r = await run(mid, scale);
        remember(r, mid, scale);
        if (r.bytes <= targetBytes) {
          fit = { ...r, quality: mid };
          lo = mid;
        } else hi = mid;
      }
      return { value: fit.value, quality: fit.quality, scale, reached: true, tries };
    }
  }
  const s = smallest as unknown as { value: T; quality: number; scale: number };
  return { value: s.value, quality: s.quality, scale: s.scale, reached: false, tries };
}

/** Parses "250", "250 KB", "1.5mb" into bytes; null when it is not a positive size. */
export function parseSizeInput(text: string, defaultUnit: 'kb' | 'mb' = 'kb'): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(kb|k|mb|m)?\s*$/i.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  const unit = (m[2] ?? defaultUnit).toLowerCase();
  const bytes = Math.round(value * (unit.startsWith('m') ? 1024 * 1024 : 1024));
  return bytes > 0 ? bytes : null;
}

export interface ResizeOptions {
  mode: 'pixels' | 'percent' | 'preset';
  /** pixels mode; NaN or 0 means "not set". */
  width: number;
  height: number;
  /** pixels mode: keep the ratio, fitting inside the width x height box. */
  lock: boolean;
  percent: number;
  presetId: string;
  fit: FitMode;
  /** Enlarge images smaller than the box (pixels mode with lock). Presets and exact sizes always reach their size. */
  upscale: boolean;
}

/** The plan for one source size, or a message saying what to fix in the settings. */
export function planResize(o: ResizeOptions, srcW: number, srcH: number): { plan: DrawPlan } | { error: string } {
  let plan: DrawPlan;
  if (o.mode === 'percent') {
    if (!(o.percent >= 1)) return { error: 'Enter a percentage of at least 1.' };
    plan = planPercent(srcW, srcH, o.percent);
  } else if (o.mode === 'preset') {
    const preset = RESIZE_PRESETS.find((p) => p.id === o.presetId);
    if (!preset) return { error: 'Choose a preset size.' };
    plan = planExact(srcW, srcH, preset.width, preset.height, o.fit);
  } else {
    const w = o.width > 0 ? o.width : 0;
    const h = o.height > 0 ? o.height : 0;
    if (o.lock) {
      if (!w && !h) return { error: 'Enter a width, a height or both.' };
      plan = planBox(srcW, srcH, w || 1e9, h || 1e9, o.upscale);
    } else {
      if (!w || !h) return { error: 'Enter both a width and a height, or turn on "Keep aspect ratio".' };
      plan = planExact(srcW, srcH, w, h, o.fit);
    }
  }
  const problem = checkOutputSize(plan.width, plan.height);
  return problem ? { error: problem } : { plan };
}
