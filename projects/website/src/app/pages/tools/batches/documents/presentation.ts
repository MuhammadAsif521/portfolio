import type { ToolPresentation } from '../../tool-meta';

/** Card icon (a key of DOCUMENTS_ICONS, or an icon already registered) and one-line tagline per tool slug. */
export const DOCUMENTS_PRESENTATION: Record<string, ToolPresentation> = {
  'docx-viewer': { icon: 'file-text', tagline: 'Read a Word file, copy its text or save it as HTML.' },
  'pdf-viewer': { icon: 'file-type', tagline: 'View, search and extract text from a PDF.' },
  'xlsx-viewer': { icon: 'file-spreadsheet', tagline: 'Browse Excel sheets and export them as CSV or JSON.' },
  'csv-viewer': { icon: 'table', tagline: 'Open big CSV and TSV files, sort, filter, export.' },
  'pptx-viewer': { icon: 'presentation', tagline: 'List slides, notes and images, export the text.' },
  'markdown-viewer': { icon: 'notebook-text', tagline: 'Write Markdown with a live, sanitised preview.' },
};
