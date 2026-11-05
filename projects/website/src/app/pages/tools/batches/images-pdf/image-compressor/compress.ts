import { baseName, fileExt, withExt, type ImageKind } from '../shared/files';
import {
  EXT,
  FORMAT_LABEL,
  type OutFormat,
  decodeImage,
  releaseSurface,
  renderPlan,
  surfaceToBlob,
  surfacePixels,
} from '../shared/image-codec';
import { encodeIndexedPng, quantizeRgba } from '../shared/png-quantize';
import { type DrawPlan, planMaxSide, searchTargetSize } from '../shared/size-math';

export interface CompressOptions {
  /** 'auto' keeps the format of each file (GIF and BMP become PNG, AVIF becomes WebP when AVIF cannot be written). */
  format: 'auto' | OutFormat;
  /** 0 to 1; JPEG, WebP and AVIF. */
  quality: number;
  /** Longest side in pixels; 0 keeps the size. */
  maxSide: number;
  /** PNG palette size (2 to 256), or 0 for a lossless canvas re-encode. */
  pngColors: number;
  /** Aim for at most this many bytes by lowering quality (and size if needed); null to use `quality`. */
  targetBytes: number | null;
  /** Fills transparent pixels when writing JPEG. */
  background: string;
}

export interface CompressResult {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  note: string;
  /** The original file was returned because re-encoding would not have made it smaller. */
  keptOriginal: boolean;
  format: OutFormat;
}

const KIND_TO_FORMAT: Partial<Record<ImageKind, OutFormat>> = { png: 'png', jpeg: 'jpeg', webp: 'webp', avif: 'avif' };

export function resolveFormat(choice: CompressOptions['format'], kind: ImageKind, support: Record<OutFormat, boolean>): OutFormat {
  if (choice !== 'auto') return support[choice] ? choice : 'png';
  const own = KIND_TO_FORMAT[kind];
  if (own && support[own]) return own;
  if (kind === 'avif') return support.webp ? 'webp' : 'jpeg';
  return 'png';
}

/** Quality (0.1 to 0.95) as a palette size between 16 and 256 colours, so target-size search works for PNG too. */
export function colorsForQuality(quality: number): number {
  const t = Math.min(1, Math.max(0, (quality - 0.1) / 0.85));
  return Math.round(2 ** (4 + 4 * t));
}

/**
 * Compresses one image: decode (EXIF orientation applied), optional downscale, re-encode. With `targetBytes` it
 * searches for the best quality that fits. Falls back to the original bytes when re-encoding would not help.
 */
export async function compressImage(
  file: File,
  options: CompressOptions,
  support: Record<OutFormat, boolean>,
  report: (text: string) => void = () => undefined,
): Promise<CompressResult> {
  const decoded = await decodeImage(file);
  try {
    const format = resolveFormat(options.format, decoded.kind, support);
    const base = planMaxSide(decoded.width, decoded.height, options.maxSide);
    const background = format === 'jpeg' ? options.background : null;

    const encodeAt = async (quality: number, scale: number): Promise<{ value: { blob: Blob; width: number; height: number }; bytes: number }> => {
      const plan: DrawPlan =
        scale === 1
          ? base
          : { ...base, width: Math.max(1, Math.round(base.width * scale)), height: Math.max(1, Math.round(base.height * scale)), dw: Math.max(1, Math.round(base.width * scale)), dh: Math.max(1, Math.round(base.height * scale)) };
      const surface = renderPlan(decoded, plan, 'high', background);
      try {
        const colors = options.targetBytes ? (options.pngColors === 0 ? 0 : colorsForQuality(quality)) : options.pngColors;
        const blob = await encodeSurface(surface, format, quality, colors, report);
        return { value: { blob, width: plan.width, height: plan.height }, bytes: blob.size };
      } finally {
        releaseSurface(surface);
      }
    };

    let encoded: { blob: Blob; width: number; height: number };
    let note = '';
    if (options.targetBytes) {
      const target = options.targetBytes;
      const found = await searchTargetSize(encodeAt, target, {
        onTry: (q, s) => report(`Trying ${Math.round(q * 100)}% quality${s < 1 ? ` at ${Math.round(s * 100)}% size` : ''}…`),
      });
      encoded = found.value;
      note = found.reached
        ? `${found.scale < 1 ? `reduced to ${encoded.width} x ${encoded.height}, ` : ''}${format === 'png' ? `${colorsForQuality(found.quality)} colours` : `quality ${Math.round(found.quality * 100)}%`}`
        : 'could not reach the target size; this is the smallest result';
    } else {
      report('Compressing…');
      encoded = (await encodeAt(options.quality, 1)).value;
      note = format === 'png' ? (options.pngColors ? `${options.pngColors} colours` : 'lossless re-encode') : `quality ${Math.round(options.quality * 100)}%`;
    }

    const sameFormat = KIND_TO_FORMAT[decoded.kind] === format;
    const resized = encoded.width !== decoded.width || encoded.height !== decoded.height;
    if (sameFormat && !resized && encoded.blob.size >= file.size) {
      return {
        blob: file,
        name: file.name,
        width: decoded.width,
        height: decoded.height,
        note: 'kept the original: re-encoding would not make it smaller',
        keptOriginal: true,
        format,
      };
    }
    const notes = [`${FORMAT_LABEL[format]}, ${note}`];
    if (format === 'jpeg' && decoded.kind !== 'jpeg') notes.push(`transparent areas filled with ${options.background}`);
    if (decoded.kind === 'gif') notes.push('first frame only');
    const outName = sameFormat && fileExt(file.name) === EXT[format] ? `${baseName(file.name)}-compressed.${EXT[format]}` : withExt(file.name, EXT[format]);
    return { blob: encoded.blob, name: outName, width: encoded.width, height: encoded.height, note: notes.join(', '), keptOriginal: false, format };
  } finally {
    decoded.close();
  }
}

async function encodeSurface(
  surface: Parameters<typeof surfaceToBlob>[0],
  format: OutFormat,
  quality: number,
  pngColors: number,
  report: (text: string) => void,
): Promise<Blob> {
  if (format !== 'png' || pngColors === 0) return surfaceToBlob(surface, format, quality);
  report('Reducing colours…');
  const palette = await quantizeRgba(surfacePixels(surface), pngColors);
  report('Writing PNG…');
  const bytes = await encodeIndexedPng(surface.width, surface.height, palette);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' });
}
