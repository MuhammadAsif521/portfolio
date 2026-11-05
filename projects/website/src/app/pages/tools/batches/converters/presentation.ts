import type { ToolPresentation } from '../../tool-meta';

/** Card icon (a key of CONVERTERS_ICONS, or an icon already registered) and one-line tagline per tool slug. */
export const CONVERTERS_PRESENTATION: Record<string, ToolPresentation> = {
  'json-to-csv': { icon: 'table', tagline: 'Flatten JSON into CSV for Excel and Sheets.' },
  'csv-to-json': { icon: 'sheet', tagline: 'Turn CSV or TSV into typed JSON, any size.' },
  'json-to-yaml': { icon: 'file-code', tagline: 'Convert JSON to clean YAML with your style.' },
  'yaml-to-json': { icon: 'brackets', tagline: 'Safely parse YAML, anchors included, to JSON.' },
  'xml-to-json': { icon: 'code-xml', tagline: 'Parse XML to JSON with attribute control.' },
  'json-to-xml': { icon: 'arrow-left-right', tagline: 'Build well-formed XML from any JSON.' },
  'markdown-to-html': { icon: 'file-text', tagline: 'Render Markdown to HTML with a safe preview.' },
  'excel-to-json': { icon: 'file-spreadsheet', tagline: 'Read an .xlsx sheet as JSON or CSV.' },
};
