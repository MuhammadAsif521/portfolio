import type { Routes } from '@angular/router';
import { toolEnabled } from '../../tool-enabled.guard';

/** Lazy routes of the documents tools, spread into TOOLS_ROUTES. One entry per tool, each guarded by toolEnabled(slug). */
export const DOCUMENTS_ROUTES: Routes = [
  {
    path: 'docx-viewer',
    canMatch: [toolEnabled('docx-viewer')],
    loadComponent: () => import('./docx-viewer/docx-viewer').then((m) => m.DocxViewerTool),
  },
  {
    path: 'pdf-viewer',
    canMatch: [toolEnabled('pdf-viewer')],
    loadComponent: () => import('./pdf-viewer/pdf-viewer').then((m) => m.PdfViewerTool),
  },
  {
    path: 'xlsx-viewer',
    canMatch: [toolEnabled('xlsx-viewer')],
    loadComponent: () => import('./xlsx-viewer/xlsx-viewer').then((m) => m.XlsxViewerTool),
  },
  {
    path: 'csv-viewer',
    canMatch: [toolEnabled('csv-viewer')],
    loadComponent: () => import('./csv-viewer/csv-viewer').then((m) => m.CsvViewerTool),
  },
  {
    path: 'pptx-viewer',
    canMatch: [toolEnabled('pptx-viewer')],
    loadComponent: () => import('./pptx-viewer/pptx-viewer').then((m) => m.PptxViewerTool),
  },
  {
    path: 'markdown-viewer',
    canMatch: [toolEnabled('markdown-viewer')],
    loadComponent: () => import('./markdown-viewer/markdown-viewer').then((m) => m.MarkdownViewerTool),
  },
];
