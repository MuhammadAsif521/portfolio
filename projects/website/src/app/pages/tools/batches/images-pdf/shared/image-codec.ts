import { LIMITS, probeImageSize, sniffImageKind, type ImageKind } from './files';
import { checkOutputSize, type DrawPlan, type Smoothing } from './size-math';

/** Browser-side image decoding and encoding through ImageBitmap and canvas. Call only from event handlers. */

export type OutFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export const MIME: Record<OutFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' };
export const EXT: Record<OutFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif' };
export const FORMAT_LABEL: Record<OutFormat, string> = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', avif: 'AVIF' };

/** An error whose message is already written for the person using the tool. */
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

const HEAD_BYTES = 2 * 1024 * 1024;

export async function readHead(file: Blob, bytes = HEAD_BYTES): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, bytes).arrayBuffer());
}

export interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  kind: ImageKind;
  close(): void;
}

/** Validates the file (size, real type, pixel count from the header) and decodes it with EXIF orientation applied. */
export async function decodeImage(file: File): Promise<Decoded> {
  if (file.size === 0) throw new ImageError('This file is empty.');
  if (file.size > LIMITS.imageFileBytes) throw new ImageError(`This file is over ${LIMITS.imageFileBytes / 1024 / 1024} MB. Use a smaller image.`);
  const head = await readHead(file);
  const kind = sniffImageKind(head);
  if (kind === 'unknown') throw new ImageError('This does not look like a PNG, JPEG, WebP, GIF, BMP or AVIF image.');
  if (kind === 'svg') throw new ImageError('SVG files are not supported here.');
  const size = probeImageSize(head);
  if (size) assertPixels(size.width, size.height, 'This image');

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = null;
  }
  if (bitmap) {
    assertPixels(bitmap.width, bitmap.height, 'This image');
    const b = bitmap;
    return { source: b, width: b.width, height: b.height, kind, close: () => b.close() };
  }
  // Older browsers: an <img> element (browsers apply the EXIF orientation when drawing it).
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    assertPixels(img.naturalWidth, img.naturalHeight, 'This image');
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, kind, close: () => undefined };
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError('This browser could not read this image. It may be damaged or in a format the browser does not support.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function assertPixels(width: number, height: number, subject: string): void {
  if (!(width >= 1 && height >= 1)) throw new ImageError(`${subject} has no pixels.`);
  if (width * height > LIMITS.pixels) {
    throw new ImageError(`${subject} is ${Math.round((width * height) / 1e6)} megapixels. The limit is ${LIMITS.pixels / 1e6} megapixels, to keep your browser from running out of memory.`);
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Surface {
  canvas: AnyCanvas;
  ctx: AnyContext;
  width: number;
  height: number;
}

export function createSurface(width: number, height: number): Surface {
  const problem = checkOutputSize(width, height);
  if (problem) throw new ImageError(problem);
  const canvas: AnyCanvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { willReadFrequently: false }) as AnyContext | null;
  if (!ctx) throw new ImageError('Your browser could not allocate an image this large. Try a smaller size.');
  return { canvas, ctx, width, height };
}

/** Frees the pixel memory of a canvas right away instead of waiting for garbage collection. */
export function releaseSurface(surface: Surface): void {
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

function applySmoothing(ctx: AnyContext, smoothing: Smoothing): void {
  ctx.imageSmoothingEnabled = smoothing !== 'none';
  ctx.imageSmoothingQuality = smoothing === 'none' ? 'low' : smoothing;
}

/**
 * Draws source rectangle (sx, sy, sw, sh) into (dx, dy, dw, dh). With high smoothing and a reduction of more than
 * 2x it halves the image step by step first, which avoids the aliasing a single big reduction can cause.
 */
export function drawScaled(ctx: AnyContext, src: CanvasImageSource, plan: DrawPlan, smoothing: Smoothing): void {
  let current: CanvasImageSource = src;
  let { sx, sy, sw, sh } = plan;
  const temps: Surface[] = [];
  if (smoothing === 'high') {
    while (sw / plan.dw > 2 || sh / plan.dh > 2) {
      const nw = Math.max(plan.dw, Math.ceil(sw / 2));
      const nh = Math.max(plan.dh, Math.ceil(sh / 2));
      const step = createSurface(nw, nh);
      applySmoothing(step.ctx, 'high');
      step.ctx.drawImage(current, sx, sy, sw, sh, 0, 0, nw, nh);
      temps.push(step);
      current = step.canvas as CanvasImageSource;
      sx = 0;
      sy = 0;
      sw = nw;
      sh = nh;
    }
  }
  applySmoothing(ctx, smoothing);
  ctx.drawImage(current, sx, sy, sw, sh, plan.dx, plan.dy, plan.dw, plan.dh);
  temps.forEach(releaseSurface);
}

/** Renders a decoded image onto a new canvas following `plan`, on `background` (a CSS colour) or transparent. */
export function renderPlan(decoded: Decoded, plan: DrawPlan, smoothing: Smoothing, background: string | null): Surface {
  const surface = createSurface(plan.width, plan.height);
  if (background) {
    surface.ctx.fillStyle = background;
    surface.ctx.fillRect(0, 0, plan.width, plan.height);
  }
  drawScaled(surface.ctx, decoded.source, plan, smoothing);
  return surface;
}

export async function surfaceToBlob(surface: Surface, format: OutFormat, quality: number): Promise<Blob> {
  const type = MIME[format];
  const q = format === 'png' ? undefined : Math.min(1, Math.max(0, quality));
  let blob: Blob | null;
  try {
    const canvas = surface.canvas;
    blob =
      typeof OffscreenCanvas === 'function' && canvas instanceof OffscreenCanvas
        ? await canvas.convertToBlob({ type, quality: q })
        : await new Promise<Blob | null>((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, q));
  } catch {
    blob = null;
  }
  if (!blob || blob.size === 0) throw new ImageError('The browser could not write this image. Try a smaller size or another format.');
  if (blob.type !== type) throw new ImageError(`This browser cannot write ${FORMAT_LABEL[format]} files.`);
  return blob;
}

/** RGBA pixels of a canvas (for the palette PNG encoder). */
export function surfacePixels(surface: Surface): Uint8ClampedArray {
  return surface.ctx.getImageData(0, 0, surface.width, surface.height).data;
}

let formats: Promise<Record<OutFormat, boolean>> | null = null;

/** Which formats this browser can really write (it silently falls back to PNG for ones it cannot). */
export function supportedFormats(): Promise<Record<OutFormat, boolean>> {
  formats ??= (async () => {
    const result: Record<OutFormat, boolean> = { png: true, jpeg: false, webp: false, avif: false };
    try {
      const surface = createSurface(2, 2);
      for (const format of ['jpeg', 'webp', 'avif'] as const) {
        try {
          await surfaceToBlob(surface, format, 0.8);
          result[format] = true;
        } catch {
          result[format] = false;
        }
      }
    } catch {
      /* no canvas at all: only PNG is claimed, and the tools will report the failure */
    }
    return result;
  })();
  return formats;
}
