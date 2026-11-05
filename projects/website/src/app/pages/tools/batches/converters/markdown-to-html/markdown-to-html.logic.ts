import { type ConvertResult, byteLength, failFromException, fail, plural, stripBom } from '../shared/convert-common';

/*
 * Markdown → HTML with marked. The HTML this returns is exactly what marked produced (plus heading ids and the
 * optional document wrapper): marked does not sanitise, so a <script> in the Markdown is a <script> in the
 * output. The on-page preview is sanitised separately (see markdown-preview.ts); the output is not.
 */

export interface MarkdownOptions {
  /** GitHub Flavored Markdown: tables, task lists, strikethrough and autolinks. */
  gfm: boolean;
  /** A single line break inside a paragraph becomes <br>. */
  breaks: boolean;
  /** Add an id to every heading (lowercase, hyphenated, unique) so #links work. */
  headingIds: boolean;
  /** Wrap the HTML in a complete page with a small stylesheet. */
  fullDocument: boolean;
}

export const DEFAULT_MARKDOWN: MarkdownOptions = { gfm: true, breaks: false, headingIds: true, fullDocument: false };

/** Minimal, readable page styles for the full-document wrapper: system fonts, a reading width, tidy code and tables. */
export const DOCUMENT_CSS = `body{margin:0;padding:2rem 1rem;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2328;background:#fff}
article{max-width:46rem;margin:0 auto}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .6em}
h1{font-size:2em}h2{font-size:1.5em;border-bottom:1px solid #d8dee4;padding-bottom:.3em}
a{color:#0b5fff}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
code{background:#f3f4f6;padding:.15em .35em;border-radius:4px}
pre{background:#f3f4f6;padding:1rem;overflow:auto;border-radius:6px}
pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:0 1em;color:#59636e;border-left:4px solid #d8dee4}
table{border-collapse:collapse;display:block;overflow:auto}
th,td{border:1px solid #d8dee4;padding:.4em .8em}
img{max-width:100%}
hr{border:0;border-top:1px solid #d8dee4}`;

const TEXT_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** "Hello, World! 2024" to "hello-world-2024". Letters and digits of any script are kept. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Things in the HTML that run code or navigate when the page is opened, found by a quick scan. */
export function activeContentIn(html: string): string[] {
  const found: string[] = [];
  if (/<script[\s>]/i.test(html)) found.push('a <script> element');
  if (/<(?:iframe|object|embed|form)[\s>]/i.test(html)) found.push('an <iframe>, <object>, <embed> or <form>');
  if (/\son[a-z]+\s*=/i.test(html)) found.push('an inline event handler (onclick=, onerror=, ...)');
  if (/(?:href|src|action)\s*=\s*["']?\s*(?:javascript|vbscript):/i.test(html)) found.push('a javascript: link');
  if (/<style[\s>]|<link[\s>]|<meta[\s>]/i.test(html)) found.push('a <style>, <link> or <meta> element');
  return found;
}

export async function convertMarkdown(raw: string, options: MarkdownOptions): Promise<ConvertResult> {
  const text = stripBom(raw);
  if (!text.trim()) return fail('There is nothing to convert yet.');
  try {
    const { Marked } = await import('marked');
    const marked = new Marked({ gfm: options.gfm, breaks: options.breaks, async: false });
    const ids = new Map<string, number>();
    let headings = 0;
    let firstH1 = '';
    marked.use({
      renderer: {
        heading({ tokens, depth }) {
          headings++;
          const inner = this.parser.parseInline(tokens);
          if (depth === 1 && !firstH1) firstH1 = inner.replace(/<[^>]*>/g, '');
          if (!options.headingIds) return `<h${depth}>${inner}</h${depth}>\n`;
          const base = slugify(inner) || 'section';
          const seen = ids.get(base) ?? 0;
          ids.set(base, seen + 1);
          const id = seen === 0 ? base : `${base}-${seen}`;
          return `<h${depth} id="${escapeHtml(id)}">${inner}</h${depth}>\n`;
        },
      },
    });
    const html = (marked.parse(text, { async: false }) as string).replace(/\n+$/, '\n');

    const warnings: string[] = [];
    const active = activeContentIn(html);
    if (active.length) {
      warnings.push(
        `The Markdown contains ${active.join(', ')}. The HTML output keeps it exactly as written; only the preview removes it. Sanitise untrusted Markdown before you publish it.`,
      );
    }
    let output = html;
    if (options.fullDocument) {
      const plainTitle = firstH1.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => TEXT_ENTITIES[e]).trim();
      const title = escapeHtml(plainTitle || 'Document');
      output = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>\n${DOCUMENT_CSS}\n</style>\n</head>\n<body>\n<article>\n${html}</article>\n</body>\n</html>\n`;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const meta = [plural(headings, 'heading'), plural(words, 'word'), `${byteLength(output).toLocaleString('en-US')} bytes`];
    return { ok: true, output, meta, warnings };
  } catch (error) {
    return failFromException(error, 'markdown-to-html');
  }
}
