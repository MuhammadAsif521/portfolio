import type { Routes } from '@angular/router';
import { toolEnabled } from '../../tool-enabled.guard';

/** Lazy routes of the images-pdf tools, spread into TOOLS_ROUTES. One entry per tool, each guarded by toolEnabled(slug). */
export const IMAGES_PDF_ROUTES: Routes = [
  {
    path: 'image-converter',
    canMatch: [toolEnabled('image-converter')],
    loadComponent: () => import('./image-converter/image-converter').then((m) => m.ImageConverterTool),
  },
  {
    path: 'image-compressor',
    canMatch: [toolEnabled('image-compressor')],
    loadComponent: () => import('./image-compressor/image-compressor').then((m) => m.ImageCompressorTool),
  },
  {
    path: 'image-resizer',
    canMatch: [toolEnabled('image-resizer')],
    loadComponent: () => import('./image-resizer/image-resizer').then((m) => m.ImageResizerTool),
  },
  {
    path: 'svg-to-png',
    canMatch: [toolEnabled('svg-to-png')],
    loadComponent: () => import('./svg-to-png/svg-to-png').then((m) => m.SvgToPngTool),
  },
  {
    path: 'images-to-pdf',
    canMatch: [toolEnabled('images-to-pdf')],
    loadComponent: () => import('./images-to-pdf/images-to-pdf').then((m) => m.ImagesToPdfTool),
  },
  {
    path: 'pdf-to-images',
    canMatch: [toolEnabled('pdf-to-images')],
    loadComponent: () => import('./pdf-to-images/pdf-to-images').then((m) => m.PdfToImagesTool),
  },
  {
    path: 'merge-pdf',
    canMatch: [toolEnabled('merge-pdf')],
    loadComponent: () => import('./merge-pdf/merge-pdf').then((m) => m.MergePdfTool),
  },
  {
    path: 'split-pdf',
    canMatch: [toolEnabled('split-pdf')],
    loadComponent: () => import('./split-pdf/split-pdf').then((m) => m.SplitPdfTool),
  },
];
