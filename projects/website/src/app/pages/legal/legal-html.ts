/** One entry of the table of contents, built from the page's <h2> headings. */
export interface TocItem {
  id: string;
  label: string;
}

const H2 = /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi;
const ID_ATTR = /\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Escapes text for HTML element content and quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Heading markup → plain text for the TOC (rendered with interpolation, so it is escaped again). */
export function headingText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === '#') {
        const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** "3. Your rights (GDPR)" → "your-rights-gdpr". Only [a-z0-9-], so it is safe inside an id attribute. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Gives every <h2> a unique, slug-only id (replacing any id it had) and returns the TOC built from them.
 * Runs on already-sanitised HTML: it only adds `id="[a-z0-9-]+"` attributes, so it can't reintroduce
 * markup. String based (no DOM), so it works the same during SSR and in the browser.
 */
export function withHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();

  const out = html.replace(H2, (_match, attrs: string | undefined, inner: string) => {
    const label = headingText(inner);
    if (!label) return `<h2${attrs ?? ''}>${inner}</h2>`;

    const base = slugify(label) || 'section';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    toc.push({ id, label });

    const rest = (attrs ?? '').replace(ID_ATTR, '');
    return `<h2 id="${id}"${rest}>${inner}</h2>`;
  });

  return { html: out, toc };
}
