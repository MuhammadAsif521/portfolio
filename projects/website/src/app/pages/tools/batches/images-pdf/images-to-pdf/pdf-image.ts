import { type ImageKind, readJpegOrientation, probeImageSize } from '../shared/files';
import { decodeImage, readHead, releaseSurface, renderPlan, surfaceToBlob } from '../shared/image-codec';
import type { PdfImage } from '../shared/pdf-ops';
import { planMaxSide } from '../shared/size-math';

/**
 * The bytes to embed for one image file. `direct` passes JPEG and PNG files through untouched (no quality loss, no
 * size growth); a JPEG that carries an EXIF rotation, a CMYK JPEG or any other format throws so the caller asks for
 * `safe`, which redraws the image on a canvas (EXIF orientation applied) and writes PNG, or JPEG for JPEG sources.
 */
export async function loadPdfImage(file: File, kind: ImageKind, mode: 'direct' | 'safe'): Promise<PdfImage> {
  if (mode === 'direct') {
    if (kind === 'png') return { bytes: new Uint8Array(await file.arrayBuffer()), format: 'png' };
    if (kind === 'jpeg') {
      const head = await readHead(file);
      const info = probeImageSize(head);
      if (readJpegOrientation(head) === 1 && (info?.components ?? 3) <= 3) return { bytes: new Uint8Array(await file.arrayBuffer()), format: 'jpeg' };
    }
    throw new Error('needs re-encoding');
  }
  const decoded = await decodeImage(file);
  try {
    const asJpeg = kind === 'jpeg';
    const surface = renderPlan(decoded, planMaxSide(decoded.width, decoded.height, 0), 'low', asJpeg ? '#ffffff' : null);
    try {
      const blob = await surfaceToBlob(surface, asJpeg ? 'jpeg' : 'png', 0.92);
      return { bytes: new Uint8Array(await blob.arrayBuffer()), format: asJpeg ? 'jpeg' : 'png' };
    } finally {
      releaseSurface(surface);
    }
  } finally {
    decoded.close();
  }
}
