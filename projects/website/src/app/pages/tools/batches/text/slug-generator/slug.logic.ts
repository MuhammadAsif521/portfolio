/**
 * URL slug generation: transliteration of Latin letters with accents, Cyrillic (Russian, Ukrainian, Serbian),
 * Greek and a basic Arabic / Persian / Urdu mapping to ASCII, then word splitting, optional stop-word removal,
 * a separator, a length limit cut at a word boundary and unique suffixes for batches.
 */

export type SlugLanguage = 'auto' | 'de' | 'ru' | 'uk' | 'sr';
export type Separator = '-' | '_' | '.' | '';

export interface SlugOptions {
  separator: Separator;
  lowercase: boolean;
  /** 0 = no limit. The slug is cut at a word boundary where possible. */
  maxLength: number;
  removeStopWords: boolean;
  /** false keeps letters of every script (a Unicode slug); true converts to ASCII. */
  transliterate: boolean;
  language: SlugLanguage;
  /** "&" becomes the word "and". */
  ampersandToAnd: boolean;
  /** In batches, repeated slugs get -2, -3... */
  uniqueSuffix: boolean;
}

export const DEFAULT_SLUG_OPTIONS: SlugOptions = {
  separator: '-',
  lowercase: true,
  maxLength: 0,
  removeStopWords: false,
  transliterate: true,
  language: 'auto',
  ampersandToAnd: true,
  uniqueSuffix: true,
};

/** Common English filler words dropped when "remove stop words" is on. Short on purpose: not a search ranking tool. */
export const SLUG_STOP_WORDS: ReadonlySet<string> = new Set(
  'a an the and or but nor of to in on at for with by from as is are was were be been it its this that these those into onto up out over about so than then'.split(' '),
);

/* ---------- Transliteration tables (lower case; upper case is derived) ---------- */

const LATIN: Record<string, string> = {
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ı: 'i', ħ: 'h', ŋ: 'ng', ĸ: 'k', ſ: 's', ŧ: 't', ĳ: 'ij', ŉ: 'n', ǆ: 'dz', ǉ: 'lj', ǌ: 'nj',
};
const GERMAN: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue' };

const RUSSIAN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
// Ukrainian national transliteration (2010), simplified: г is h, и is y, and є ї й ю я have a word-initial form.
const UKRAINIAN: Record<string, string> = {
  ...RUSSIAN,
  г: 'h', ґ: 'g', е: 'e', є: 'ie', и: 'y', і: 'i', ї: 'i', й: 'i', ю: 'iu', я: 'ia', ё: 'yo', ъ: '', ы: 'y', э: 'e', ʼ: '', "'": '', '’': '',
};
const UKRAINIAN_INITIAL: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };
// Serbian Cyrillic to the standard Latin alphabet, without diacritics (š -> s, č -> c, ž -> z).
const SERBIAN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
};
const GREEK: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's',
  τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
/**
 * Arabic, Persian and Urdu letters to a consonant skeleton. These scripts do not write short vowels, so the
 * result is readable but not a proper romanisation (محمد becomes mhmd). Marks (harakat) are dropped.
 */
const ARABIC: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'a', آ: 'a', ٱ: 'a', ب: 'b', ة: 'a', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh',
  ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a', ء: '', ئ: 'y', ؤ: 'w',
  ـ: '', پ: 'p', چ: 'ch', ژ: 'zh', گ: 'g', ک: 'k', ی: 'y', ں: 'n', ہ: 'h', ھ: 'h', ٹ: 't', ڈ: 'd', ڑ: 'r', ے: 'e', ۓ: 'e', ۃ: 'a', ۀ: 'h', ڤ: 'v', ڭ: 'ng',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

const capitalise = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TABLES = new Map<string, Map<string, string>>();
function buildTable(language: SlugLanguage, cyrillic: 'ru' | 'uk' | 'sr'): Map<string, string> {
  const cacheKey = `${language === 'de' ? 'de' : '-'}|${cyrillic}`;
  const cached = TABLES.get(cacheKey);
  if (cached) return cached;
  const table = new Map<string, string>();
  TABLES.set(cacheKey, table);
  const add = (src: Record<string, string>) => {
    for (const [k, v] of Object.entries(src)) {
      table.set(k, v);
      const up = k.toUpperCase();
      if (up !== k) table.set(up, capitalise(v));
    }
  };
  add(LATIN);
  add(GREEK);
  add(ARABIC);
  add(cyrillic === 'uk' ? UKRAINIAN : cyrillic === 'sr' ? SERBIAN : RUSSIAN);
  if (language === 'de') add(GERMAN);
  return table;
}

/** Which Cyrillic alphabet a text uses, from letters only that language has. Russian when in doubt. */
export function detectCyrillic(text: string): 'ru' | 'uk' | 'sr' {
  if (/[іїєґІЇЄҐ]/.test(text)) return 'uk';
  if (/[ђјљњћџЂЈЉЊЋЏ]/.test(text)) return 'sr';
  return 'ru';
}

export interface Transliterated {
  text: string;
  /** Letters or digits of scripts without a mapping (Chinese, Hindi, Hebrew...) that were replaced by a separator. */
  dropped: string[];
}

/**
 * Converts text to ASCII letters and digits where a mapping exists. Accents are removed (é -> e, ñ -> n, ş -> s,
 * ą -> a, ł -> l). Characters of unmapped scripts become a space and are listed in `dropped`. Other symbols pass
 * through unchanged for the caller to treat as separators.
 */
export function transliterate(text: string, language: SlugLanguage = 'auto'): Transliterated {
  if (/^[\x00-\x7f]*$/.test(text)) return { text, dropped: [] };
  const cyrillic = language === 'uk' || language === 'sr' || language === 'ru' ? language : detectCyrillic(text);
  const table = buildTable(language, cyrillic);
  const dropped = new Set<string>();
  let out = '';
  let prevLetter = false;

  const handle = (ch: string): void => {
    if (ch < '\u0080') {
      out += ch;
      prevLetter = /[A-Za-z0-9]/.test(ch);
      return;
    }
    let mapped = table.get(ch);
    if (mapped !== undefined && cyrillic === 'uk' && !prevLetter) {
      const initial = UKRAINIAN_INITIAL[ch.toLowerCase()];
      if (initial) mapped = ch === ch.toLowerCase() ? initial : capitalise(initial);
    }
    if (mapped !== undefined) {
      out += mapped;
      prevLetter = mapped !== '' ? /[A-Za-z0-9]$/.test(mapped) : prevLetter;
      return;
    }
    const decomposed = ch.normalize('NFD');
    if (decomposed !== ch) {
      for (const part of Array.from(decomposed)) handle(part);
      return;
    }
    if (/\p{M}/u.test(ch)) return; // a combining mark: dropped on purpose
    if (/[\p{L}\p{N}]/u.test(ch)) {
      dropped.add(ch);
      out += ' ';
      prevLetter = false;
      return;
    }
    out += ch; // punctuation, symbols, emoji: left to the word splitter
    prevLetter = false;
  };
  for (const ch of Array.from(text.normalize('NFC'))) handle(ch);
  return { text: out, dropped: Array.from(dropped) };
}

/** Words of a text: letters and digits only; punctuation and symbols separate them, apostrophes inside a word vanish. */
function splitSlugWords(text: string, ascii: boolean): string[] {
  const noApostrophes = text.replace(/(?<=[\p{L}\p{N}])['’ʼ`´](?=[\p{L}\p{N}])/gu, '');
  const re = ascii ? /[^A-Za-z0-9]+/ : /[^\p{L}\p{N}\p{M}]+/u;
  return noApostrophes.split(re).filter(Boolean);
}

/** Cuts at a word boundary: as many whole words as fit; a first word longer than the limit is cut hard. */
export function joinWithLimit(words: readonly string[], separator: string, maxLength: number): string {
  if (!(maxLength > 0)) return words.join(separator);
  let out = '';
  for (const w of words) {
    const next = out ? out + separator + w : w;
    if (next.length > maxLength) {
      if (!out) return Array.from(w).slice(0, maxLength).join('');
      break;
    }
    out = next;
  }
  return out;
}

export interface SlugResult {
  slug: string;
  dropped: string[];
}

/** One slug from one piece of text (line breaks count as separators). */
export function slugify(text: string, options: Partial<SlugOptions> = {}): SlugResult {
  const o: SlugOptions = { ...DEFAULT_SLUG_OPTIONS, ...options };
  let source = text;
  if (o.ampersandToAnd) source = source.replace(/\s*&\s*/g, ' and ');
  let dropped: string[] = [];
  if (o.transliterate) {
    const t = transliterate(source, o.language);
    source = t.text;
    dropped = t.dropped;
  }
  if (o.lowercase) source = source.toLowerCase();
  // toLowerCase can add a combining dot (İ -> i̇): remove stray marks left in ASCII mode.
  if (o.transliterate && /[^\x00-\x7f]/.test(source)) source = source.normalize('NFD').replace(/\p{M}/gu, '');
  let words = splitSlugWords(source, o.transliterate);
  if (o.removeStopWords) {
    const kept = words.filter((w) => !SLUG_STOP_WORDS.has(w.toLowerCase()));
    if (kept.length) words = kept; // never remove every word
  }
  return { slug: joinWithLimit(words, o.separator, o.maxLength), dropped };
}

export interface BatchResult {
  slugs: string[];
  dropped: string[];
  /** Number of lines that got a numeric suffix to stay unique. */
  suffixed: number;
}

/** One slug per line. Empty lines stay empty so the output lines up with the input. */
export function slugifyLines(text: string, options: Partial<SlugOptions> = {}): BatchResult {
  const o: SlugOptions = { ...DEFAULT_SLUG_OPTIONS, ...options };
  const lines = text.split(/\r\n|\r|\n/);
  const taken = new Set<string>();
  const nextSuffix = new Map<string, number>();
  const dropped = new Set<string>();
  let suffixed = 0;
  const slugs = lines.map((line) => {
    if (!line.trim()) return '';
    const r = slugify(line, o);
    r.dropped.forEach((d) => dropped.add(d));
    let slug = r.slug;
    if (!slug) return '';
    if (o.uniqueSuffix) {
      if (taken.has(slug)) {
        const base = slug;
        let n = nextSuffix.get(base) ?? 2;
        let candidate: string;
        do {
          const suffix = `${o.separator}${n}`;
          const room = o.maxLength > 0 ? o.maxLength - suffix.length : Infinity;
          candidate = (base.length > room ? joinTrim(base, room, o.separator) : base) + suffix;
          n++;
        } while (taken.has(candidate));
        nextSuffix.set(base, n);
        slug = candidate;
        suffixed++;
      }
      taken.add(slug);
    }
    return slug;
  });
  return { slugs, dropped: Array.from(dropped), suffixed };
}

/** Shortens an existing slug to `max` characters at a separator when possible. */
function joinTrim(slug: string, max: number, separator: string): string {
  if (max <= 0) return '';
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  if (separator) {
    const i = cut.lastIndexOf(separator);
    if (i > 0) return cut.slice(0, i);
  }
  return cut;
}
