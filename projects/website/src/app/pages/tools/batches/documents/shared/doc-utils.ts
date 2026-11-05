/** Small pure helpers shared by the documents tools (no Angular, safe to import anywhere). */

export const MB = 1024 * 1024;

/** Lets the browser paint and handle input between two chunks of work. */
export const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

/** File name without its extension ("report.final.docx" -> "report.final"). */
export function baseName(name: string, fallback = 'document'): string {
  const base = name.replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim();
  return base || fallback;
}

export function extensionOf(name: string): string {
  const match = /\.([^./\\]+)$/.exec(name);
  return match ? match[1].toLowerCase() : '';
}

/** Words as a reader counts them: runs of letters/digits (apostrophes and hyphens stay inside a word). */
export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

// ── file signatures ────────────────────────────────────────────────────────────

export const isZip = (b: Uint8Array): boolean =>
  b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6);

/** The old binary Office container (.doc, .xls, .ppt) that these viewers do not read. */
export const isOleOffice = (b: Uint8Array): boolean =>
  b.length > 7 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;

/** "%PDF-" may be preceded by a little junk, so look in the first KB like pdf.js does. */
export function isPdf(b: Uint8Array): boolean {
  const limit = Math.min(b.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (b[i] === 0x25 && b[i + 1] === 0x50 && b[i + 2] === 0x44 && b[i + 3] === 0x46 && b[i + 4] === 0x2d) return true;
  }
  return false;
}

// ── export helpers ─────────────────────────────────────────────────────────────

/** One CSV field: quoted when it holds the delimiter, a quote or a line break. */
export function csvField(value: string, delimiter = ','): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: readonly (readonly string[])[], delimiter = ','): string {
  return rows.map((row) => row.map((v) => csvField(v, delimiter)).join(delimiter)).join('\r\n');
}

/** Triggers a browser download of text or bytes (browser only; call it from a click handler). */
export function downloadFile(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A self-contained HTML file around already sanitised body HTML (no scripts, no remote resources). */
export function standaloneHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>${escapeHtml(title)}</title>
<style>
body{max-width:46rem;margin:2rem auto;padding:0 1rem;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2939}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .5em}
img{max-width:100%;height:auto}
table{border-collapse:collapse;margin:1em 0;max-width:100%;display:block;overflow-x:auto}
th,td{border:1px solid #d0d5dd;padding:.4em .7em;text-align:left;vertical-align:top}
pre{background:#171717;color:#fcfcfd;padding:1em;border-radius:6px;overflow-x:auto;white-space:pre-wrap}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em}
:not(pre)>code{background:#f2f4f7;padding:.1em .35em;border-radius:4px}
blockquote{border-left:3px solid #d0d5dd;margin:1em 0;padding:.1em 1em;color:#475467}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

/** Base64 of bytes without blowing the call stack on large images. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

/** Image formats every browser shows; anything else (EMF, WMF, TIFF, SVG) is skipped rather than rendered. */
export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
};
