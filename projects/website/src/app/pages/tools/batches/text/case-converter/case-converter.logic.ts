/**
 * Case conversion: prose styles (UPPER, lower, Title, Sentence, Capitalize Each Word, aLtErNaTiNg, iNVERT) and
 * code identifier styles (camel, Pascal, snake, kebab, CONSTANT, dot). Everything is Unicode-aware (accents,
 * Cyrillic, Greek, Turkish dotted/dotless i via a locale) and keeps line breaks.
 */

export type TitleStyle = 'chicago' | 'ap-apa';
export interface CaseOptions {
  /** BCP 47 tag for case mapping. 'en' means no language specific rules; 'tr' and 'lt' change i and I. */
  locale: string;
  titleStyle: TitleStyle;
}
export const DEFAULT_CASE_OPTIONS: CaseOptions = { locale: 'en', titleStyle: 'chicago' };

export type CaseId =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'capitalize'
  | 'alternating'
  | 'invert'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'dot';

export interface CaseVariant {
  id: CaseId;
  label: string;
  group: 'text' | 'code';
  value: string;
}

export const CASE_META: readonly { id: CaseId; label: string; group: 'text' | 'code' }[] = [
  { id: 'upper', label: 'UPPER CASE', group: 'text' },
  { id: 'lower', label: 'lower case', group: 'text' },
  { id: 'title', label: 'Title Case', group: 'text' },
  { id: 'sentence', label: 'Sentence case', group: 'text' },
  { id: 'capitalize', label: 'Capitalize Each Word', group: 'text' },
  { id: 'alternating', label: 'aLtErNaTiNg', group: 'text' },
  { id: 'invert', label: 'iNVERT cASE', group: 'text' },
  { id: 'camel', label: 'camelCase', group: 'code' },
  { id: 'pascal', label: 'PascalCase', group: 'code' },
  { id: 'snake', label: 'snake_case', group: 'code' },
  { id: 'kebab', label: 'kebab-case', group: 'code' },
  { id: 'constant', label: 'CONSTANT_CASE', group: 'code' },
  { id: 'dot', label: 'dot.case', group: 'code' },
];

// "en" has no tailoring, so the plain (much faster) toUpperCase / toLowerCase give the same result.
const upper = (s: string, o: CaseOptions) => (o.locale === 'en' ? s.toUpperCase() : s.toLocaleUpperCase(o.locale));
const lower = (s: string, o: CaseOptions) => (o.locale === 'en' ? s.toLowerCase() : s.toLocaleLowerCase(o.locale));

/** First character (a whole code point) in upper case, the rest in lower case. */
export function capitalizeWord(word: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  if (!word) return '';
  const n = (word.codePointAt(0) as number) > 0xffff ? 2 : 1;
  return upper(word.slice(0, n), o) + lower(word.slice(n), o);
}

/* ---------- Identifier styles ---------- */

const ALNUM_RUN = /[\p{L}\p{N}\p{M}]+/gu;
const CAMEL_BOUNDARY = /\p{Ll}\p{M}*\p{Lu}|\p{N}\p{Lu}\p{Ll}|\p{Lu}\p{Lu}\p{Ll}/u;
const INNER_APOSTROPHE = /(?<=[\p{L}\p{N}])['’](?=[\p{L}\p{N}])/gu;

function splitCamel(run: string): string[] {
  if (!CAMEL_BOUNDARY.test(run)) return [run];
  return run
    .replace(/(\p{Ll}\p{M}*)(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{N})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(' ');
}

/**
 * Splits one line into words, whatever the source style: spaces, punctuation, snake_case, kebab-case,
 * camelCase, PascalCase, CONSTANT_CASE and acronym runs ("HTTPServer" -> HTTP, Server). Digits stay with the
 * word before them ("version2" is one word) but split off before a capitalised word ("v2Beta" -> v2, Beta).
 * Apostrophes inside a word are dropped ("don't" -> dont).
 */
export function splitWords(line: string): string[] {
  const src = line.includes("'") || line.includes('’') ? line.replace(INNER_APOSTROPHE, '') : line;
  const runs = src.match(ALNUM_RUN);
  if (!runs) return [];
  const out: string[] = [];
  for (const run of runs) {
    if (run.length > 1) for (const w of splitCamel(run)) out.push(w);
    else out.push(run);
  }
  return out;
}

/** Applies a per-line conversion while keeping every line break exactly as it was. */
function perLine(text: string, fn: (line: string) => string): string {
  if (!/[\r\n]/.test(text)) return fn(text);
  const out: string[] = [];
  const re = /\r\n|\r|\n/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(fn(text.slice(last, m.index)), m[0]);
    last = m.index + m[0].length;
  }
  out.push(fn(text.slice(last)));
  return out.join('');
}

function identifier(text: string, join: (words: string[]) => string): string {
  return perLine(text, (line) => join(splitWords(line)));
}

/* ---------- Prose styles ---------- */

const WORD = "[\\p{L}\\p{N}\\p{M}]+(?:['’\\u2010\\u2011\\-][\\p{L}\\p{N}\\p{M}]+)*";
/** Things that must be left alone: URLs, emails, dotted abbreviations (e.g., U.S.A.) and domain or file names. */
const PROTECTED =
  '(?:https?:\\/\\/|www\\.)[^\\s]+|[\\p{L}\\p{N}._%+\\-]+@[\\p{L}\\p{N}.\\-]+|(?:\\p{L}\\.){2,}\\p{L}?|\\p{L}[\\p{L}\\p{N}\\-]*(?:\\.[\\p{L}\\p{N}\\-]+)+';
const WORD_ONLY = new RegExp(`()(${WORD})`, 'gu');
const WORD_OR_PROTECTED = new RegExp(`(${PROTECTED})|(${WORD})`, 'gu');
/** A cheap test that decides whether the slower protected-token pattern is needed at all. */
const MAY_PROTECT = /:\/\/|@|\p{L}\.[\p{L}\p{N}]/u;

interface Piece {
  /** Text before this word or token (separators, punctuation, spaces). */
  before: string;
  text: string;
  protectedToken: boolean;
}

/** Splits text into words and protected tokens with the separators between them, plus the trailing text. */
function pieces(text: string): { items: Piece[]; tail: string } {
  const re = MAY_PROTECT.test(text) ? WORD_OR_PROTECTED : WORD_ONLY;
  re.lastIndex = 0;
  const items: Piece[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    items.push({ before: text.slice(last, m.index), text: m[0], protectedToken: m[1] !== undefined && m[1] !== '' });
    last = m.index + m[0].length;
  }
  return { items, tail: text.slice(last) };
}

/** A capital after the first letter: NASA, iPhone, McDonald, JavaScript. */
function hasInnerCapital(word: string): boolean {
  const n = (word.codePointAt(0) as number) > 0xffff ? 2 : 1;
  return /\p{Lu}/u.test(word.slice(n));
}
/** Letters present and none lower case: the text was typed (or pasted) in capitals. */
const isShouting = (text: string): boolean => /\p{L}/u.test(text) && !/\p{Ll}/u.test(text);

const ARTICLES = ['a', 'an', 'the'];
const COORDINATING = ['and', 'but', 'for', 'nor', 'or', 'so', 'yet'];
const SHORT_PREPOSITIONS = ['as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'v'];
const LONG_PREPOSITIONS = [
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'before', 'behind', 'below', 'beneath', 'beside',
  'between', 'beyond', 'during', 'from', 'inside', 'into', 'near', 'onto', 'outside', 'over', 'past', 'through', 'toward', 'towards',
  'under', 'underneath', 'until', 'upon', 'with', 'within', 'without',
];
/**
 * Words kept in lower case in the middle of a title.
 * Chicago: articles, coordinating conjunctions and all prepositions whatever their length.
 * AP / APA: those of three letters or fewer, plus "if"; four letters and up are capitalised.
 * Neither can tell a preposition from an adverb ("Look Up", "Turn Over"): the tool applies the word list.
 */
export const TITLE_LOWERCASE: Readonly<Record<TitleStyle, ReadonlySet<string>>> = {
  chicago: new Set([...ARTICLES, ...COORDINATING, ...SHORT_PREPOSITIONS, ...LONG_PREPOSITIONS]),
  'ap-apa': new Set([...ARTICLES, ...COORDINATING.filter((w) => w.length <= 3), 'yet', 'if', ...SHORT_PREPOSITIONS]),
};
/** Parts after a hyphen stay lower case only when they are these (Mother-in-Law, Up-to-Date). */
const HYPHEN_LOWER = new Set([...ARTICLES, 'and', 'but', 'or', 'nor', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'as', 'up']);

function titleWord(word: string, edge: boolean, o: CaseOptions, shouting: boolean): string {
  if (!shouting && hasInnerCapital(word)) return word;
  const lowerSet = TITLE_LOWERCASE[o.titleStyle];
  if (!/[‐‑-]/.test(word)) {
    return edge || !lowerSet.has(lower(word, o).replace(/’/g, "'")) ? capitalizeWord(word, o) : lower(word, o);
  }
  const parts = word.split(/([‐‑-])/);
  let out = '';
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i];
    const sep = parts[i + 1] ?? '';
    const lc = lower(part, o);
    const piece = i === 0 ? (edge || !lowerSet.has(lc) ? capitalizeWord(part, o) : lc) : HYPHEN_LOWER.has(lc) ? lc : capitalizeWord(part, o);
    out += piece + sep;
  }
  return out;
}

/** Title Case in Chicago or AP/APA style, line by line. See TITLE_LOWERCASE for the rules and their limits. */
export function toTitleCase(text: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  return perLine(text, (line) => {
    if (!line) return line;
    const { items, tail } = pieces(line);
    const wordCount = items.reduce((n, p) => n + (p.protectedToken ? 0 : 1), 0);
    const shouting = isShouting(line) && wordCount > 1;
    const out: string[] = [];
    let afterBreak = true; // the first word and the first word after a colon, dash or sentence end are always capitalised
    let lastWord = -1;
    let lastBreak = true;
    for (const p of items) {
      if (!afterBreak && /[:?!.—–]|\s-\s/.test(p.before)) afterBreak = true;
      out.push(p.before);
      if (p.protectedToken) {
        out.push(p.text);
      } else {
        lastWord = out.length;
        lastBreak = afterBreak;
        out.push(titleWord(p.text, afterBreak, o, shouting));
      }
      afterBreak = false;
    }
    // The last word of a title is capitalised whatever it is ("What are you waiting For").
    if (lastWord >= 0) {
      const word = items.filter((p) => !p.protectedToken).pop() as Piece;
      if (!lastBreak) out[lastWord] = titleWord(word.text, true, o, shouting);
    }
    out.push(tail);
    return out.join('');
  });
}

const SENTENCE_ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'fig', 'vol']);
const SENTENCE_END = /[.!?…]["'”’)\]»]*\s|[。！？]/u;

/**
 * Sentence case: first letter of each sentence (and of each line) capitalised, the rest lower case; the
 * pronoun "I" and its contractions are capitalised; words with a capital after the first letter (NASA,
 * iPhone) are kept unless the whole text was in capitals; URLs and emails are left alone.
 */
export function toSentenceCase(text: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  if (!text) return text;
  const shouting = isShouting(text);
  const { items, tail } = pieces(text);
  const out: string[] = [];
  let atStart = true;
  let prevWord = '';
  for (const p of items) {
    const sep = p.before;
    if (sep) {
      if (/[\r\n]/.test(sep)) atStart = true;
      else if (SENTENCE_END.test(sep) && !(sep.startsWith('.') && SENTENCE_ABBREVIATIONS.has(prevWord))) atStart = true;
    }
    out.push(sep);
    if (p.protectedToken) {
      out.push(p.text);
      prevWord = '';
    } else {
      const lc = lower(p.text, o);
      prevWord = lc;
      if (lc.length <= 4 && /^i(['’](m|ll|d|ve))?$/.test(lc)) out.push('I' + lc.slice(1));
      else if (!shouting && hasInnerCapital(p.text)) out.push(p.text);
      else out.push(atStart ? capitalizeWord(p.text, o) : lc);
    }
    atStart = false;
  }
  out.push(tail);
  return out.join('');
}

/** Capitalize Each Word: every word starts with a capital, the rest is lower case. No style rules. */
export function toCapitalizeEach(text: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  const { items, tail } = pieces(text);
  const out: string[] = [];
  for (const p of items) {
    out.push(p.before);
    if (p.protectedToken) out.push(p.text);
    else if (!/[‐‑-]/.test(p.text)) out.push(capitalizeWord(p.text, o));
    else out.push(p.text.split(/([‐‑-])/).map((s, i) => (i % 2 ? s : capitalizeWord(s, o))).join(''));
  }
  out.push(tail);
  return out.join('');
}

/** aLtErNaTiNg: lower, upper, lower... counting only letters that have a case; everything else is untouched. */
export function toAlternating(text: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  let i = 0;
  const out: string[] = [];
  for (const ch of text) {
    const up = upper(ch, o);
    const low = lower(ch, o);
    if (up === low) {
      out.push(ch);
      continue;
    }
    out.push(i % 2 === 0 ? low : up);
    i++;
  }
  return out.join('');
}

/** iNVERT cASE: every upper case letter becomes lower case and vice versa. */
export function toInverted(text: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  const out: string[] = [];
  for (const ch of text) {
    const up = upper(ch, o);
    const low = lower(ch, o);
    if (ch === low && up !== ch) out.push(up);
    else if (ch === up && low !== ch) out.push(low);
    else out.push(ch);
  }
  return out.join('');
}

/** Converts text to one case style. */
export function convertCase(text: string, id: CaseId, o: CaseOptions = DEFAULT_CASE_OPTIONS): string {
  switch (id) {
    case 'upper':
      return upper(text, o);
    case 'lower':
      return lower(text, o);
    case 'title':
      return toTitleCase(text, o);
    case 'sentence':
      return toSentenceCase(text, o);
    case 'capitalize':
      return toCapitalizeEach(text, o);
    case 'alternating':
      return toAlternating(text, o);
    case 'invert':
      return toInverted(text, o);
    case 'camel':
      return identifier(text, (w) => w.map((x, i) => (i === 0 ? lower(x, o) : capitalizeWord(x, o))).join(''));
    case 'pascal':
      return identifier(text, (w) => w.map((x) => capitalizeWord(x, o)).join(''));
    case 'snake':
      return identifier(text, (w) => w.map((x) => lower(x, o)).join('_'));
    case 'kebab':
      return identifier(text, (w) => w.map((x) => lower(x, o)).join('-'));
    case 'constant':
      return identifier(text, (w) => w.map((x) => upper(x, o)).join('_'));
    case 'dot':
      return identifier(text, (w) => w.map((x) => lower(x, o)).join('.'));
  }
}

/** Every variant at once (used by tests and small inputs; the page converts them one at a time). */
export function allVariants(text: string, o: CaseOptions = DEFAULT_CASE_OPTIONS): CaseVariant[] {
  return CASE_META.map((m) => ({ ...m, value: convertCase(text, m.id, o) }));
}

export const CASE_LOCALES = [
  { id: 'en', name: 'Default (no language rules)' },
  { id: 'tr', name: 'Turkish / Azeri (i and İ, ı and I)' },
  { id: 'lt', name: 'Lithuanian' },
];
