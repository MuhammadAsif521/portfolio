import type { ToolPresentation } from '../../tool-meta';

/** Card icon (a key of IMAGES_PDF_ICONS, or an icon already registered) and one-line tagline per tool slug. */
export const IMAGES_PDF_PRESENTATION: Record<string, ToolPresentation> = {
  'image-converter': { icon: 'file-output', tagline: 'Convert images between PNG, JPG and WebP.' },
  'image-compressor': { icon: 'minimize-2', tagline: 'Shrink JPG, WebP and PNG files, in bulk.' },
  'image-resizer': { icon: 'maximize-2', tagline: 'Resize by pixels, percent or social preset.' },
  'svg-to-png': { icon: 'file-image', tagline: 'Render an SVG as a PNG at any size.' },
  'images-to-pdf': { icon: 'images', tagline: 'Combine JPG, PNG and WebP into one PDF.' },
  'pdf-to-images': { icon: 'file-down', tagline: 'Save PDF pages as PNG or JPG images.' },
  'merge-pdf': { icon: 'file-stack', tagline: 'Join several PDFs into one, in your order.' },
  'split-pdf': { icon: 'scissors', tagline: 'Split a PDF by range, every N pages or page.' },
};
