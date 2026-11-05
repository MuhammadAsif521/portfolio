/** Meta tag generation, validation and the length estimates behind the live previews. */

export const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeText = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface MetaForm {
  title: string;
  description: string;
  canonical: string;
  /** Noindex when false. */
  index: boolean;
  /** Nofollow when false. */
  follow: boolean;
  /** '' leaves it out; a number limits snippet characters; -1 lets Google choose. */
  maxSnippet: string;
  maxImagePreview: '' | 'none' | 'standard' | 'large';
  charset: boolean;
  viewport: boolean;
  themeColor: string;
  themeColorDark: string;
  ogEnabled: boolean;
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  ogSiteName: string;
  ogLocale: string;
  ogImage: string;
  ogImageAlt: string;
  twitterCard: '' | 'summary' | 'summary_large_image';
  twitterSite: string;
  twitterCreator: string;
  faviconIco: string;
  faviconSvg: string;
  appleTouchIcon: string;
  manifest: string;
}

export const EMPTY_META_FORM: MetaForm = {
  title: '',
  description: '',
  canonical: '',
  index: true,
  follow: true,
  maxSnippet: '',
  maxImagePreview: '',
  charset: true,
  viewport: true,
  themeColor: '',
  themeColorDark: '',
  ogEnabled: true,
  ogTitle: '',
  ogDescription: '',
  ogType: 'website',
  ogSiteName: '',
  ogLocale: '',
  ogImage: '',
  ogImageAlt: '',
  twitterCard: 'summary_large_image',
  twitterSite: '',
  twitterCreator: '',
  faviconIco: '',
  faviconSvg: '',
  appleTouchIcon: '',
  manifest: '',
};

export const SAMPLE_META_FORM: MetaForm = {
  ...EMPTY_META_FORM,
  title: 'Handmade Ceramic Mugs | Clay & Co.',
  description: 'Small-batch ceramic mugs, thrown and glazed by hand in Lahore. Dishwasher safe, free shipping over $50.',
  canonical: 'https://example.com/mugs',
  ogSiteName: 'Clay & Co.',
  ogLocale: 'en_US',
  ogImage: 'https://example.com/images/mugs-1200x630.jpg',
  ogImageAlt: 'Three glazed ceramic mugs on a wooden table',
  twitterSite: '@clayandco',
  themeColor: '#1d4ed8',
  faviconIco: '/favicon.ico',
  faviconSvg: '/favicon.svg',
  appleTouchIcon: '/apple-touch-icon.png',
};

const trim = (v: string): string => v.trim();

/** The robots meta content, or '' when the defaults (index, follow, no extra directives) apply. */
export function robotsContent(f: Pick<MetaForm, 'index' | 'follow' | 'maxSnippet' | 'maxImagePreview'>): string {
  const parts: string[] = [];
  if (!f.index) parts.push('noindex');
  if (!f.follow) parts.push('nofollow');
  const snippet = trim(f.maxSnippet);
  if (/^-?\d+$/.test(snippet)) parts.push(`max-snippet:${snippet}`);
  if (f.maxImagePreview) parts.push(`max-image-preview:${f.maxImagePreview}`);
  return parts.join(', ');
}

/** Builds the <head> snippet. Empty fields produce no tag. */
export function buildMetaTags(f: MetaForm): string {
  const out: string[] = [];
  const meta = (name: string, content: string) => out.push(`<meta name="${name}" content="${escapeAttr(content)}">`);
  const prop = (property: string, content: string) => out.push(`<meta property="${property}" content="${escapeAttr(content)}">`);

  if (f.charset) out.push('<meta charset="utf-8">');
  if (f.viewport) out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  if (trim(f.title)) out.push(`<title>${escapeText(trim(f.title))}</title>`);
  if (trim(f.description)) meta('description', trim(f.description));
  const robots = robotsContent(f);
  if (robots) meta('robots', robots);
  if (trim(f.canonical)) out.push(`<link rel="canonical" href="${escapeAttr(trim(f.canonical))}">`);
  if (trim(f.themeColor) && trim(f.themeColorDark)) {
    out.push(`<meta name="theme-color" content="${escapeAttr(trim(f.themeColor))}" media="(prefers-color-scheme: light)">`);
    out.push(`<meta name="theme-color" content="${escapeAttr(trim(f.themeColorDark))}" media="(prefers-color-scheme: dark)">`);
  } else if (trim(f.themeColor) || trim(f.themeColorDark)) {
    meta('theme-color', trim(f.themeColor) || trim(f.themeColorDark));
  }

  if (f.ogEnabled) {
    const ogTitle = trim(f.ogTitle) || trim(f.title);
    const ogDescription = trim(f.ogDescription) || trim(f.description);
    if (ogTitle) prop('og:title', ogTitle);
    if (ogDescription) prop('og:description', ogDescription);
    if (trim(f.ogType)) prop('og:type', trim(f.ogType));
    if (trim(f.canonical)) prop('og:url', trim(f.canonical));
    if (trim(f.ogSiteName)) prop('og:site_name', trim(f.ogSiteName));
    if (trim(f.ogLocale)) prop('og:locale', trim(f.ogLocale));
    if (trim(f.ogImage)) {
      prop('og:image', trim(f.ogImage));
      if (trim(f.ogImageAlt)) prop('og:image:alt', trim(f.ogImageAlt));
    }
  }

  if (f.twitterCard) {
    meta('twitter:card', f.twitterCard);
    if (trim(f.twitterSite)) meta('twitter:site', normalizeHandle(f.twitterSite));
    if (trim(f.twitterCreator)) meta('twitter:creator', normalizeHandle(f.twitterCreator));
    // Title, description and image come from the Open Graph tags when those are on; otherwise write them out.
    if (!f.ogEnabled) {
      const title = trim(f.ogTitle) || trim(f.title);
      const description = trim(f.ogDescription) || trim(f.description);
      if (title) meta('twitter:title', title);
      if (description) meta('twitter:description', description);
      if (trim(f.ogImage)) {
        meta('twitter:image', trim(f.ogImage));
        if (trim(f.ogImageAlt)) meta('twitter:image:alt', trim(f.ogImageAlt));
      }
    } else if (trim(f.ogImage) && trim(f.ogImageAlt)) {
      meta('twitter:image:alt', trim(f.ogImageAlt));
    }
  }

  if (trim(f.faviconIco)) out.push(`<link rel="icon" href="${escapeAttr(trim(f.faviconIco))}" sizes="32x32">`);
  if (trim(f.faviconSvg)) out.push(`<link rel="icon" href="${escapeAttr(trim(f.faviconSvg))}" type="image/svg+xml">`);
  if (trim(f.appleTouchIcon)) out.push(`<link rel="apple-touch-icon" href="${escapeAttr(trim(f.appleTouchIcon))}">`);
  if (trim(f.manifest)) out.push(`<link rel="manifest" href="${escapeAttr(trim(f.manifest))}">`);
  return out.join('\n');
}

/** Adds the leading @ to a handle when it is missing. */
export const normalizeHandle = (handle: string): string => {
  const h = handle.trim();
  return h && !h.startsWith('@') ? `@${h}` : h;
};

export const isAbsoluteHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export interface MetaIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Problems worth fixing, in plain language. */
export function validateMeta(f: MetaForm): MetaIssue[] {
  const issues: MetaIssue[] = [];
  const title = trim(f.title);
  const description = trim(f.description);
  if (!title) issues.push({ level: 'error', message: 'Add a title. Every page should have a descriptive <title>.' });
  if (!description) issues.push({ level: 'warning', message: 'No meta description. Google may write its own snippet from the page text, which is fine if the page is clear.' });
  if (trim(f.canonical) && !isAbsoluteHttpUrl(f.canonical)) issues.push({ level: 'error', message: 'The canonical URL must be absolute, including https://.' });
  if (trim(f.ogImage) && !isAbsoluteHttpUrl(f.ogImage)) issues.push({ level: 'error', message: 'The social image must be an absolute URL starting with https://.' });
  if (trim(f.ogImage) && !trim(f.ogImageAlt)) issues.push({ level: 'warning', message: 'Add alt text for the social image; the Open Graph protocol asks for it whenever an image is set.' });
  if (f.ogEnabled && !trim(f.ogImage)) issues.push({ level: 'info', message: 'No social image set: shared links will show as text-only cards on most platforms.' });
  if (f.ogEnabled && !trim(f.canonical)) issues.push({ level: 'info', message: 'og:url is taken from the canonical URL. Add one so link previews point at the right address.' });
  if (!f.index) issues.push({ level: 'warning', message: 'noindex asks search engines to keep this page out of results. Do not use it on pages you want found, and do not also block the page in robots.txt, or crawlers never see the tag.' });
  if (trim(f.maxSnippet) && !/^-?\d+$/.test(trim(f.maxSnippet))) issues.push({ level: 'error', message: 'max-snippet must be a whole number (-1 means no limit, 0 means no snippet).' });
  for (const [label, value] of [['theme colour', f.themeColor], ['dark theme colour', f.themeColorDark]] as const) {
    if (trim(value) && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trim(value))) issues.push({ level: 'warning', message: `The ${label} should be a hex colour such as #1d4ed8.` });
  }
  if (/[<>]/.test(title)) issues.push({ level: 'info', message: 'Angle brackets in the title are escaped in the output.' });
  return issues;
}

// Length estimates --------------------------------------------------------------------------------------------------

/** Arial advance widths in 1/1000 em for the characters that matter in titles. */
const ARIAL: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333, '{': 334, '|': 260, '}': 334, '~': 584,
  '–': 556, '—': 1000, '·': 278, '•': 350, '…': 1000,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
};

/** Characters outside the table: digits are 556; CJK and emoji are about a full em; everything else is an average letter. */
function glyphWidth(ch: string): number {
  const known = ARIAL[ch];
  if (known !== undefined) return known;
  if (ch >= '0' && ch <= '9') return 556;
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x2e80 || code >= 0x1f000) return 1000;
  return 556;
}

/**
 * Rough rendered width in pixels of text in Arial at the given size. Google does not publish a pixel limit and uses
 * its own fonts and layout, so this is an estimate for orientation only.
 */
export function estimateWidth(text: string, fontPx: number): number {
  let units = 0;
  for (const ch of text) units += glyphWidth(ch);
  return Math.round((units * fontPx) / 1000);
}

/** Rule-of-thumb desktop title width commonly cited by SEO tools. It is not a Google rule. */
export const TITLE_PX_LIMIT = 600;
export const TITLE_FONT_PX = 20;

/** Cuts text with an ellipsis so that its estimated width stays inside `maxPx`. */
export function truncateToWidth(text: string, maxPx: number, fontPx: number): { text: string; truncated: boolean } {
  if (estimateWidth(text, fontPx) <= maxPx) return { text, truncated: false };
  let out = '';
  let units = glyphWidth('…');
  for (const ch of text) {
    const next = units + glyphWidth(ch);
    if ((next * fontPx) / 1000 > maxPx) break;
    out += ch;
    units = next;
  }
  return { text: `${out.trimEnd()}…`, truncated: true };
}

export type MeterState = 'empty' | 'short' | 'good' | 'long';

export interface Meter {
  state: MeterState;
  chars: number;
  pixels?: number;
  label: string;
}

/** Title meter: characters plus the estimated pixel width against the common ~600 px desktop display width. */
export function titleMeter(title: string): Meter {
  const text = title.trim();
  const chars = [...text].length;
  const pixels = estimateWidth(text, TITLE_FONT_PX);
  if (!chars) return { state: 'empty', chars, pixels, label: 'Empty' };
  if (pixels > TITLE_PX_LIMIT) return { state: 'long', chars, pixels, label: 'Likely to be cut off in results (estimate)' };
  if (chars < 25) return { state: 'short', chars, pixels, label: 'Short: room for a more descriptive title' };
  return { state: 'good', chars, pixels, label: 'Fits the usual display width (estimate)' };
}

/** Description meter: Google sets no limit; results cut snippets to fit the screen, commonly about 150-160 characters on desktop. */
export function descriptionMeter(description: string): Meter {
  const chars = [...description.trim()].length;
  if (!chars) return { state: 'empty', chars, label: 'Empty' };
  if (chars < 70) return { state: 'short', chars, label: 'Short: could say more about the page' };
  if (chars > 160) return { state: 'long', chars, label: 'May be cut off in results (typical display about 160 characters)' };
  return { state: 'good', chars, label: 'Fits the typical display length' };
}

/** "example.com › path › page" as Google shows a result URL. */
export function breadcrumbUrl(canonical: string): string {
  try {
    const url = new URL(canonical.trim());
    const segments = url.pathname.split('/').filter(Boolean).map(decodeSafe);
    return [url.hostname, ...segments].join(' › ');
  } catch {
    return 'example.com';
  }
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Host name for the social card footer. */
export function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return '';
  }
}
