/** Page-range parsing for the PDF tools. Pages are 1-based in text and in results. */

export type RangeResult = { ok: true; groups: number[][]; pages: number[] } | { ok: false; error: string };

/**
 * Parses "1-3,5,8-" against a page count. Each comma-separated part is one group (`groups`), `pages` is every page
 * in the order typed (duplicates kept). An empty text means all pages as a single group.
 * Accepts: 5, 2-4, 8- (to the last page). Rejects zero, reversed ranges, pages past the end and stray characters.
 */
export function parsePageRanges(text: string, total: number): RangeResult {
  if (!(total >= 1)) return { ok: false, error: 'This file has no pages.' };
  const source = text.trim();
  if (!source) {
    const all = Array.from({ length: total }, (_, i) => i + 1);
    return { ok: true, groups: [all], pages: all };
  }
  const groups: number[][] = [];
  for (const raw of source.split(/[,;]/)) {
    const part = raw.replace(/\s+/g, '');
    if (!part) continue;
    const match = /^(\d+)(?:(-)(\d*))?$/.exec(part);
    if (!match) return { ok: false, error: `"${raw.trim()}" is not a page or a range. Use numbers like 1-3,5,8-.` };
    const from = Number(match[1]);
    const to = match[2] ? (match[3] === '' ? total : Number(match[3])) : from;
    if (from < 1 || to < 1) return { ok: false, error: 'Page numbers start at 1.' };
    if (from > total) return { ok: false, error: `Page ${from} does not exist: this file has ${total} page${total === 1 ? '' : 's'}.` };
    if (to > total) return { ok: false, error: `Page ${to} does not exist: this file has ${total} page${total === 1 ? '' : 's'}.` };
    if (to < from) return { ok: false, error: `"${part}" goes backwards. Write it as ${to}-${from}.` };
    const group: number[] = [];
    for (let p = from; p <= to; p++) group.push(p);
    groups.push(group);
  }
  if (!groups.length) return { ok: false, error: 'Enter at least one page or range.' };
  return { ok: true, groups, pages: groups.flat() };
}

/** [1,2,3,5,8,9] gives "1-3,5,8-9". Sorted, duplicates dropped. */
export function formatRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return parts.join(',');
}

/** Groups of `size` consecutive pages: 7 pages by 3 gives [1-3],[4-6],[7]. */
export function everyN(total: number, size: number): number[][] {
  if (!(total >= 1) || !(size >= 1)) return [];
  const groups: number[][] = [];
  for (let start = 1; start <= total; start += size) {
    groups.push(Array.from({ length: Math.min(size, total - start + 1) }, (_, i) => start + i));
  }
  return groups;
}

/** "pages-3-5" / "page-7": the file-name part for a group of pages. */
export function groupLabel(group: readonly number[]): string {
  if (!group.length) return 'pages';
  const first = group[0];
  const last = group[group.length - 1];
  const contiguous = group.every((p, i) => p === first + i);
  if (group.length === 1) return `page-${first}`;
  return contiguous ? `pages-${first}-${last}` : `pages-${formatRanges(group).replace(/,/g, '_')}`;
}
