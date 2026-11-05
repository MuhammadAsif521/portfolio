import { TOOLS, type ToolMeta } from '@shared/tools/tools.manifest';

/** Pure helpers for the blog post page: table of contents, related tools, share links. SSR-safe. */

export interface TocEntry {
  id: string;
  text: string;
}

const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'section'
  );
}

/** Unique ids in document order ("setup", "setup-2"); the same function names the headings in the DOM. */
export function headingIds(texts: string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const base = slugify(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** The post's <h2> headings, read from the HTML string so the TOC is in the server-rendered page. */
export function extractToc(html: string | undefined | null): TocEntry[] {
  if (!html) return [];
  const texts = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => decode(m[1])).filter(Boolean);
  const ids = headingIds(texts);
  return texts.map((text, i) => ({ id: ids[i], text }));
}

/** Tag / title keywords → tool slugs. Order matters: the first matches win. */
const TOOL_HINTS: [RegExp, string[]][] = [
  [/mongo|mongoose|objectid|aggregat/, ['json-to-mongoose-schema', 'objectid-to-date']],
  [/jwt|auth|token|totp|2fa|rbac|security/, ['jwt-decoder']],
  [/typescript|zod|type-safe|interface/, ['json-to-typescript']],
  [/cron|schedul|queue|job/, ['cron-expression-explainer']],
  [/express|node|api|ssr|server|http|seo/, ['http-status-codes']],
  [/json/, ['json-to-typescript', 'json-to-mongoose-schema']],
];

/** Up to `limit` tools that fit the post's tags and title (none when nothing fits). */
export function relatedTools(
  tags: string[],
  title: string,
  limit = 3,
  available: readonly ToolMeta[] = TOOLS,
): ToolMeta[] {
  const haystack = [...tags, title].join(' ').toLowerCase();
  const slugs: string[] = [];
  for (const [pattern, tools] of TOOL_HINTS) {
    if (pattern.test(haystack)) for (const slug of tools) if (!slugs.includes(slug)) slugs.push(slug);
  }
  return slugs
    .map((slug) => available.find((tool) => tool.slug === slug))
    .filter((tool): tool is ToolMeta => !!tool)
    .slice(0, limit);
}

export function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    x: `https://x.com/intent/post?url=${u}&text=${t}`,
  };
}
