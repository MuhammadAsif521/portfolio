/**
 * SVG handling for svg-to-png. Untrusted SVG is never put into the page: it is parsed into a detached document,
 * cleaned with DOMPurify's SVG profile plus stricter rules (no scripts, no foreignObject, no animation, no external
 * references, no remote CSS), serialised again and only ever shown or drawn through an <img> element, which cannot
 * run scripts or load other files.
 */

export const MAX_SVG_BYTES = 5 * 1024 * 1024;
const DEFAULT_SIZE = { width: 300, height: 150 };

/** CSS pixels per unit. */
const UNITS: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, q: 96 / 101.6 };

/** "120", "12.5px", "3cm" to pixels; null for percentages, em/ex units, empty or invalid values. */
export function parseSvgLength(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i.exec(value);
  if (!m) return null;
  const unit = m[2].toLowerCase();
  if (!(unit in UNITS)) return null;
  const px = Number(m[1]) * UNITS[unit];
  return Number.isFinite(px) && px > 0 ? px : null;
}

export function parseViewBox(value: string | null | undefined): { x: number; y: number; width: number; height: number } | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts[2] > 0 && parts[3] > 0 ? { x: parts[0], y: parts[1], width: parts[2], height: parts[3] } : null;
}

export interface SvgSize {
  width: number;
  height: number;
  /** False when the SVG declares neither a usable width/height nor a viewBox: a default was used. */
  known: boolean;
}

/** The size the SVG would have as an image: width/height if both are usable, else from the viewBox, else a default. */
export function intrinsicSize(width: string | null, height: string | null, viewBox: string | null): SvgSize {
  const w = parseSvgLength(width);
  const h = parseSvgLength(height);
  const vb = parseViewBox(viewBox);
  if (w && h) return { width: w, height: h, known: true };
  if (vb) {
    if (w) return { width: w, height: (w * vb.height) / vb.width, known: true };
    if (h) return { width: (h * vb.width) / vb.height, height: h, known: true };
    return { width: vb.width, height: vb.height, known: true };
  }
  if (w) return { width: w, height: w, known: false };
  if (h) return { width: h, height: h, known: false };
  return { ...DEFAULT_SIZE, known: false };
}

/** Removes CSS that could fetch something: @import and any url() that is not a #fragment reference. */
export function neutraliseCss(css: string): string {
  return css
    .replace(/@import[^;{]*;?/gi, '')
    .replace(/url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi, 'url(#)')
    .replace(/expression\s*\(/gi, '(');
}

/** Early checks on pasted or loaded text, before any parsing. Returns a message or null. */
export function checkSvgText(text: string): string | null {
  if (!text.trim()) return 'Paste or load SVG code first.';
  if (text.length > MAX_SVG_BYTES) return `This SVG is over ${MAX_SVG_BYTES / 1024 / 1024} MB. Simplify it first.`;
  if (!/<svg[\s>]/i.test(text)) return 'This does not look like SVG: there is no <svg> element.';
  // Entity declarations can be used to blow up a document ("billion laughs"); real icons and logos do not need them.
  if (/<!ENTITY/i.test(text)) return 'SVG files with custom ENTITY declarations are not supported. Export the SVG again without a DOCTYPE.';
  return null;
}

export interface PreparedSvg {
  /** Sanitised, re-serialised SVG source (never inserted into the page). */
  markup: string;
  size: SvgSize;
  /** Names of what the sanitiser removed, e.g. "script", "onclick", "foreignObject". */
  removed: string[];
}

export class SvgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SvgError';
  }
}

const FORBIDDEN_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'set', 'animate', 'animateMotion', 'animateTransform', 'handler', 'listener'];

/** Sanitises SVG text and measures it. Needs a DOM (browser, or jsdom in tests). */
export async function prepareSvg(text: string): Promise<PreparedSvg> {
  const problem = checkSvgText(text);
  if (problem) throw new SvgError(problem);

  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (parsed.getElementsByTagName('parsererror').length || parsed.documentElement.localName !== 'svg') {
    throw new SvgError('This is not valid SVG: the XML could not be parsed. Check for unclosed tags or missing quotes.');
  }

  const { default: DOMPurify } = await import('dompurify');
  const purify = DOMPurify(window);
  purify.addHook('uponSanitizeElement', (node) => {
    if (node.nodeName.toLowerCase() === 'style') node.textContent = neutraliseCss(node.textContent ?? '');
  });
  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (name === 'style') data.attrValue = neutraliseCss(data.attrValue);
    // Links inside the file may point only to another part of the same file, or to an embedded raster image.
    if (name === 'href' || name === 'xlink:href') {
      const v = data.attrValue.trim();
      if (!(v.startsWith('#') || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v))) data.keepAttr = false;
    }
  });
  const clean = purify.sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // <use> is safe here: the href hook below keeps only #fragment references.
    ADD_TAGS: ['style', 'use'],
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onfocus', 'onbegin', 'onend', 'onrepeat'],
    PARSER_MEDIA_TYPE: 'image/svg+xml',
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  const removed = purify.removed.map((r) => ('element' in r ? (r.element as Element).nodeName : (r.attribute as Attr | null)?.name) ?? '').filter((name) => name && !['BODY', 'HTML', 'HEAD', '#text'].includes(name.toUpperCase()));
  purify.removeAllHooks();

  const cleanDoc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  const root = cleanDoc.documentElement;
  if (cleanDoc.getElementsByTagName('parsererror').length || root.localName !== 'svg') {
    throw new SvgError('Nothing drawable is left after removing unsafe parts of this SVG.');
  }
  const size = intrinsicSize(root.getAttribute('width'), root.getAttribute('height'), root.getAttribute('viewBox'));
  return { markup: new XMLSerializer().serializeToString(root), size, removed: [...new Set(removed)] };
}

/** The sanitised SVG with its root sized to `width` x `height` (and a viewBox, so the drawing scales to fit). */
export function svgAtSize(prepared: PreparedSvg, width: number, height: number): string {
  const doc = new DOMParser().parseFromString(prepared.markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!parseViewBox(root.getAttribute('viewBox'))) {
    root.setAttribute('viewBox', `0 0 ${round(prepared.size.width)} ${round(prepared.size.height)}`);
  }
  root.setAttribute('width', String(Math.round(width)));
  root.setAttribute('height', String(Math.round(height)));
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(root);
}

const round = (n: number) => Math.round(n * 1000) / 1000;
