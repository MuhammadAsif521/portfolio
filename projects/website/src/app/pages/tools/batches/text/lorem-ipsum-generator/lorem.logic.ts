import { countWords } from '../word-counter/word-counter.logic';
import { utf8ByteLength } from '../text-utils';

/**
 * Lorem ipsum generator. The random sentences use only words that occur in Cicero's "De finibus bonorum et
 * malorum" (45 BC, public domain), sections 1.10.32 and 1.10.33, the passage the classic filler text was cut
 * from. The traditional opening line ("Lorem ipsum dolor sit amet, consectetur adipiscing elit") is the familiar
 * altered version and is only used when the "start with Lorem ipsum" option is on. Output is a pure function of
 * the options and the seed, so the same seed always gives the same text.
 */
export const LATIN_WORDS: readonly string[] = Array.from(
  new Set(
    (
      // De finibus 1.10.32: "Sed ut perspiciatis ... quo voluptas nulla pariatur"
      'sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo ' +
      'inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo nemo enim ipsam quia voluptas aspernatur aut odit fugit ' +
      'consequuntur magni dolores eos qui ratione sequi nesciunt neque porro quisquam est dolorem ipsum dolor amet consectetur adipisci velit ' +
      'non numquam eius modi tempora incidunt labore dolore magnam aliquam quaerat ad minima veniam quis nostrum exercitationem ullam corporis ' +
      'suscipit laboriosam nisi aliquid ex ea commodi consequatur autem vel eum iure reprehenderit in voluptate esse quam nihil molestiae illum ' +
      'quo fugiat nulla pariatur ' +
      // De finibus 1.10.33: "At vero eos et accusamus ... asperiores repellat"
      'at vero accusamus iusto odio dignissimos ducimus blanditiis praesentium voluptatum deleniti atque corrupti quos quas molestias excepturi ' +
      'sint occaecati cupiditate provident similique culpa officia deserunt mollitia animi id laborum dolorum fuga harum quidem rerum facilis ' +
      'expedita distinctio nam libero tempore cum soluta nobis eligendi optio cumque impedit minus quod maxime placeat facere possimus omnis ' +
      'assumenda repellendus temporibus quibusdam officiis debitis necessitatibus saepe eveniet voluptates repudiandae recusandae itaque earum ' +
      'hic tenetur sapiente delectus reiciendis voluptatibus maiores alias perferendis doloribus asperiores repellat'
    ).split(' '),
  ),
);

/** The classic opening, used when "start with Lorem ipsum" is on. */
export const CLASSIC_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';
const CLASSIC_WORDS = CLASSIC_START.replace(',', '').toLowerCase().split(' ');

export type LoremUnit = 'paragraphs' | 'sentences' | 'words' | 'bytes';
export type LoremLayout = 'plain' | 'headings' | 'list' | 'numbered';
export type LoremFormat = 'text' | 'html' | 'markdown';

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  startWithClassic: boolean;
  /** Only used when the unit is paragraphs. */
  layout: LoremLayout;
  format: LoremFormat;
  /** Any text; the same seed always gives the same output. */
  seed: string;
}

export const LOREM_LIMITS: Readonly<Record<LoremUnit, number>> = { paragraphs: 200, sentences: 2000, words: 50_000, bytes: 1_000_000 };

/** A small, fast, seedable generator (mulberry32) with a string hash (xmur3) to turn any seed text into a number. */
export function createRng(seed: string | number): () => number {
  let a: number;
  if (typeof seed === 'number') a = seed >>> 0;
  else {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    a = (h ^ (h >>> 16)) >>> 0;
  }
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Words that follow the classic opening, or a random start, never repeating the previous word. */
function pickWords(rng: Rng, n: number, prev = ''): string[] {
  const out: string[] = [];
  let last = prev;
  for (let i = 0; i < n; i++) {
    let w = LATIN_WORDS[int(rng, 0, LATIN_WORDS.length - 1)];
    if (w === last) w = LATIN_WORDS[(LATIN_WORDS.indexOf(w) + 1) % LATIN_WORDS.length];
    out.push(w);
    last = w;
  }
  return out;
}

/** One sentence of 6-16 words: capitalised, ending in a full stop, with a comma or two in the longer ones. The classic one is fixed. */
export function sentence(rng: Rng, opts: { classic?: boolean; minWords?: number; maxWords?: number } = {}): string {
  if (opts.classic) return CLASSIC_START + '.';
  const target = int(rng, opts.minWords ?? 6, opts.maxWords ?? 16);
  const words = pickWords(rng, target);
  let text = words.join(' ');
  if (target >= 9) {
    const commas = target >= 13 ? 2 : 1;
    const marks = new Set<number>();
    for (let c = 0; c < commas; c++) marks.add(int(rng, 3, target - 3));
    const arr = words.map((w, i) => (marks.has(i) && !marks.has(i - 1) ? w + ',' : w));
    text = arr.join(' ');
  }
  return cap(text) + '.';
}

/** A heading: 2-6 words in title case without a full stop. */
export function heading(rng: Rng): string {
  return pickWords(rng, int(rng, 2, 6)).map(cap).join(' ');
}

function paragraph(rng: Rng, classic: boolean): string {
  const n = int(rng, 3, 7);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(sentence(rng, { classic: classic && i === 0 }));
  return out.join(' ');
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface LoremResult {
  text: string;
  words: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
}

const clamp = (n: number, max: number): number => (Number.isFinite(n) ? Math.min(max, Math.max(1, Math.floor(n))) : 1);

function stats(text: string): LoremResult {
  const body = text.replace(/<[^>]+>/g, ' ');
  return {
    text,
    words: countWords(body),
    sentences: (body.match(/[.!?](?:\s|$)/g) ?? []).length,
    paragraphs: text === '' ? 0 : Math.max(1, text.split(/\n\s*\n|<\/p>|<\/li>/).filter((s) => s.trim()).length),
    bytes: utf8ByteLength(text),
  };
}

/** Generates the text. Counts are clamped to LOREM_LIMITS. */
export function generateLorem(o: LoremOptions): LoremResult {
  const rng = createRng(o.seed);
  const count = clamp(o.count, LOREM_LIMITS[o.unit]);
  const html = o.format === 'html';
  const md = o.format === 'markdown';

  if (o.unit === 'words') {
    const words = o.startWithClassic ? [...CLASSIC_WORDS] : [];
    if (words.length < count) words.push(...pickWords(rng, count - words.length, words[words.length - 1] ?? ''));
    let text = words.slice(0, count).join(' ');
    text = cap(text) + '.';
    return stats(html ? `<p>${text}</p>` : text);
  }

  if (o.unit === 'bytes') {
    // Latin text is plain ASCII, so one character is one byte; the text ends in a full stop at exactly `count` bytes.
    const parts: string[] = [];
    let len = 0;
    let first = true;
    while (len < count) {
      const s = sentence(rng, { classic: o.startWithClassic && first });
      first = false;
      parts.push(s);
      len += s.length + 1;
    }
    let text = parts.join(' ').slice(0, count);
    if (count >= 2 && !text.endsWith('.')) text = text.slice(0, -1) + '.';
    const wrapped = html ? `<p>${text}</p>` : text;
    return { ...stats(wrapped), text: wrapped, bytes: utf8ByteLength(wrapped) };
  }

  if (o.unit === 'sentences') {
    const list: string[] = [];
    for (let i = 0; i < count; i++) list.push(sentence(rng, { classic: o.startWithClassic && i === 0 }));
    const text = list.join(' ');
    return stats(html ? `<p>${text}</p>` : text);
  }

  // Paragraphs, with the chosen structure.
  const classicFirst = o.startWithClassic;
  const out: string[] = [];
  if (o.layout === 'list' || o.layout === 'numbered') {
    const items: string[] = [];
    for (let i = 0; i < count; i++) items.push(sentence(rng, { classic: classicFirst && i === 0, minWords: 4, maxWords: 11 }));
    if (html) {
      const tag = o.layout === 'numbered' ? 'ol' : 'ul';
      return stats(`<${tag}>\n${items.map((s) => `  <li>${s}</li>`).join('\n')}\n</${tag}>`);
    }
    return stats(items.map((s, i) => (o.layout === 'numbered' ? `${i + 1}. ${s}` : `- ${s}`)).join('\n'));
  }
  for (let i = 0; i < count; i++) {
    const p = paragraph(rng, classicFirst && i === 0);
    if (o.layout === 'headings') {
      const h = heading(rng);
      if (html) out.push(`<h2>${escapeHtml(h)}</h2>\n<p>${p}</p>`);
      else if (md) out.push(`## ${h}\n\n${p}`);
      else out.push(`${h}\n\n${p}`);
    } else out.push(html ? `<p>${p}</p>` : p);
  }
  return stats(out.join(html ? '\n' : '\n\n'));
}
