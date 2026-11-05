import { countGraphemes, countGraphemesAsync, graphemes, segmentWords, splitLines, utf8ByteLength, yieldToBrowser } from '../text-utils';

/** Silent reading speed for adults reading English non-fiction: 238 wpm (Brysbaert 2019, meta-analysis of 190 studies). */
export const READING_WPM = 238;
/** Speaking pace used for speeches and voice-overs. A common planning figure, not a measured average. */
export const SPEAKING_WPM = 150;

/** English stop words ignored in the keyword list (function words that carry no topic). */
export const STOP_WORDS: ReadonlySet<string> = new Set(
  (
    'a about above after again against all also am an and any are aren\'t as at be because been before being below between both but by ' +
    'can can\'t cannot could couldn\'t did didn\'t do does doesn\'t doing don\'t down during each few for from further had hadn\'t has hasn\'t ' +
    'have haven\'t having he he\'d he\'ll he\'s her here here\'s hers herself him himself his how how\'s i i\'d i\'ll i\'m i\'ve if in into is ' +
    'isn\'t it it\'s its itself just let\'s me more most mustn\'t my myself no nor not of off on once only or other ought our ours ourselves out ' +
    'over own same shan\'t she she\'d she\'ll she\'s should shouldn\'t so some such than that that\'s the their theirs them themselves then there ' +
    'there\'s these they they\'d they\'ll they\'re they\'ve this those through to too under until up very was wasn\'t we we\'d we\'ll we\'re we\'ve ' +
    'were weren\'t what what\'s when when\'s where where\'s which while who who\'s whom why why\'s will with won\'t would wouldn\'t you you\'d ' +
    'you\'ll you\'re you\'ve your yours yourself yourselves'
  ).split(' '),
);

/** Scripts written without spaces between words: counted with Intl.Segmenter, or per character as a fallback. */
const NO_SPACE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}\p{M}]+$/gu;

export interface WordToken {
  /** The word without surrounding punctuation, in its original case. */
  word: string;
  /** True when a sentence, clause or line ends right after this word (keyword phrases do not cross it). */
  breakAfter: boolean;
}

/**
 * Words of a text. Whitespace and dashes (em dash, en dash) separate words; punctuation around a word is
 * dropped; a token without a letter or digit ("-", "&", "...") is not a word. Apostrophes and hyphens inside
 * a word stay ("don't", "well-known"). Scripts written without spaces are split with Intl.Segmenter.
 */
export function wordTokens(text: string): WordToken[] {
  const out: WordToken[] = [];
  const re = /[^\s—–―]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const clean = raw.replace(EDGE_PUNCT, '');
    if (!clean) {
      if (out.length && /[.!?…;:]/.test(raw)) out[out.length - 1].breakAfter = true;
      continue;
    }
    // A break follows when the raw token ends with sentence/clause punctuation or the next character is a line break.
    const after = text.charAt(m.index + raw.length);
    const breakAfter = /[.!?…;:。！？]["'”’)\]]*$/.test(raw) || after === '\n' || after === '\r';
    if (NO_SPACE_SCRIPT.test(clean)) {
      const parts = segmentWords(clean) ?? Array.from(clean).filter((c) => /[\p{L}\p{N}]/u.test(c));
      parts.forEach((p, i) => out.push({ word: p, breakAfter: i === parts.length - 1 ? breakAfter : false }));
    } else {
      out.push({ word: clean, breakAfter });
    }
  }
  return out;
}

/** Just the words. */
export const countWords = (text: string): number => wordTokens(text).length;

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'e.g', 'i.e', 'fig', 'vol']);

/**
 * Number of sentences. A sentence ends at . ! ? … (or the CJK 。！？) followed by whitespace, a closing quote or
 * bracket, or the end of the text. A "." after a known abbreviation (Dr., e.g.) and decimals
 * ("3.14") do not end a sentence. Text without a final terminator still counts its last sentence. It is an
 * approximation: no regex can be right for every abbreviation in every language.
 */
export function countSentences(text: string): number {
  let count = 0;
  let hasContent = false;
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text.charAt(i);
    if (/[\p{L}\p{N}]/u.test(ch)) hasContent = true;
    if (/[.!?…。！？]/.test(ch)) {
      let j = i;
      while (j + 1 < n && /[.!?…。！？]/.test(text.charAt(j + 1))) j++;
      let k = j;
      while (k + 1 < n && /["'”’)\]»]/.test(text.charAt(k + 1))) k++;
      const next = k + 1 < n ? text.charAt(k + 1) : '';
      const boundary = next === '' || /\s/.test(next) || /[。！？]/.test(ch);
      if (boundary && hasContent) {
        let isAbbr = false;
        if (ch === '.' && j === i) {
          const lastWord = (text.slice(Math.max(0, i - 10), i).match(/[\p{L}.]+$/u)?.[0] ?? '').toLowerCase();
          isAbbr = ABBREVIATIONS.has(lastWord);
        }
        if (!isAbbr) {
          count++;
          hasContent = false;
        }
      }
      i = k + 1;
      continue;
    }
    i++;
  }
  if (hasContent) count++;
  return count;
}

/** Paragraphs: blocks of text separated by one or more blank (or whitespace-only) lines. */
export function countParagraphs(text: string): number {
  let count = 0;
  let inBlock = false;
  for (const line of splitLines(text)) {
    if (line.trim() === '') inBlock = false;
    else if (!inBlock) {
      inBlock = true;
      count++;
    }
  }
  return count;
}

/** Lines in the text; a trailing line break does not add an empty line, and an empty text has none. */
export function countLines(text: string): { lines: number; nonEmpty: number } {
  if (text === '') return { lines: 0, nonEmpty: 0 };
  const lines = splitLines(text);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return { lines: lines.length, nonEmpty: lines.filter((l) => l.trim() !== '').length };
}

/** "3 min 12 sec", "45 sec", "less than 1 sec" or "0 sec". */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 sec';
  if (seconds < 1) return 'less than 1 sec';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} hr ${m} min`;
  if (m) return s ? `${m} min ${s} sec` : `${m} min`;
  return `${s} sec`;
}

export interface KeywordRow {
  phrase: string;
  count: number;
  /** Share of all words in the text (not of the phrase count), in percent. */
  density: number;
}

export interface KeywordOptions {
  /** 1 = single words, 2 and 3 = phrases of that many words. */
  size: 1 | 2 | 3;
  excludeStopWords: boolean;
  limit: number;
}

/**
 * Most frequent words or phrases (case-insensitive). Numbers alone and one-letter words are skipped. With stop
 * words excluded, a phrase may not start or end with a stop word. Phrases do not span a sentence or line break.
 * Density = occurrences / all words x 100; it describes your text, it is not a target.
 */
export function topKeywords(tokens: readonly WordToken[], totalWords: number, opts: KeywordOptions): KeywordRow[] {
  const counts = new Map<string, number>();
  const words = tokens.map((t) => t.word.toLowerCase());
  const ignorable = (w: string) => /^\p{N}+$/u.test(w) || (w.length < 2 && !NO_SPACE_SCRIPT.test(w));
  const isStop = (w: string) => STOP_WORDS.has(w.replace(/’/g, "'"));
  for (let i = 0; i + opts.size <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < opts.size; k++) {
      const w = words[i + k];
      if (ignorable(w)) ok = false;
      if (k < opts.size - 1 && tokens[i + k].breakAfter) ok = false;
      if (!ok) break;
    }
    if (!ok) continue;
    if (opts.excludeStopWords) {
      if (isStop(words[i]) || isStop(words[i + opts.size - 1])) continue;
      if (opts.size === 1 && isStop(words[i])) continue;
    }
    const key = words.slice(i, i + opts.size).join(' ');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows: KeywordRow[] = [];
  for (const [phrase, count] of counts) {
    if (opts.size > 1 && count < 2) continue; // phrases seen once are noise
    rows.push({ phrase, count, density: totalWords ? (count / totalWords) * 100 : 0 });
  }
  rows.sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
  return rows.slice(0, opts.limit);
}

export interface TextStats {
  words: number;
  uniqueWords: number;
  /** User-perceived characters, spaces and line breaks included (an emoji or an accented letter is one). */
  characters: number;
  charactersNoSpaces: number;
  /** UTF-16 code units, what JavaScript's .length reports. */
  codeUnits: number;
  bytes: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  nonEmptyLines: number;
  readingSeconds: number;
  speakingSeconds: number;
  longestWord: string;
  /** Average length of a word in characters, one decimal. */
  averageWordLength: number;
}

const WHITESPACE_RUN = /[\s​⁠﻿]+/gu;

/** Counts that need the whole text but no grapheme segmentation; graphemes are supplied by the caller. */
function baseStats(text: string, tokens: readonly WordToken[], characters: number, charactersNoSpaces: number): TextStats {
  const words = tokens.length;
  let longest = '';
  let longestLen = 0;
  let totalLen = 0;
  const unique = new Set<string>();
  for (const t of tokens) {
    const len = t.word.length > 40 ? graphemes(t.word).length : countGraphemes(t.word);
    totalLen += len;
    if (len > longestLen) {
      longestLen = len;
      longest = t.word;
    }
    unique.add(t.word.toLowerCase());
  }
  const { lines, nonEmpty } = countLines(text);
  return {
    words,
    uniqueWords: unique.size,
    characters,
    charactersNoSpaces,
    codeUnits: text.length,
    bytes: utf8ByteLength(text),
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    lines,
    nonEmptyLines: nonEmpty,
    readingSeconds: (words / READING_WPM) * 60,
    speakingSeconds: (words / SPEAKING_WPM) * 60,
    longestWord: longest,
    averageWordLength: words ? Math.round((totalLen / words) * 10) / 10 : 0,
  };
}

/** Characters excluding whitespace. Computed by removing whitespace first so combined clusters stay intact. */
export function countCharactersNoSpaces(text: string): number {
  return countGraphemes(text.replace(WHITESPACE_RUN, ''));
}

/** Synchronous analysis (used for selections and tests). */
export function analyzeText(text: string): { stats: TextStats; tokens: WordToken[] } {
  const tokens = wordTokens(text);
  return { stats: baseStats(text, tokens, countGraphemes(text), countCharactersNoSpaces(text)), tokens };
}

/**
 * Analysis for the live page: heavy parts are split up with yields so a multi-megabyte paste never blocks input.
 * Returns null if `cancelled()` turned true (a newer edit made this result stale).
 */
export async function analyzeTextAsync(
  text: string,
  cancelled: () => boolean,
): Promise<{ stats: TextStats; tokens: WordToken[] } | null> {
  if (text.length < 60_000) return analyzeText(text);
  const tokens = wordTokens(text);
  await yieldToBrowser();
  if (cancelled()) return null;
  const characters = await countGraphemesAsync(text, cancelled);
  if (characters === null) return null;
  const compact = text.replace(WHITESPACE_RUN, '');
  const noSpaces = await countGraphemesAsync(compact, cancelled);
  if (noSpaces === null) return null;
  await yieldToBrowser();
  if (cancelled()) return null;
  return { stats: baseStats(text, tokens, characters, noSpaces), tokens };
}

/* ---------- Character limits ---------- */

export interface LimitPreset {
  id: string;
  name: string;
  /** null for custom (user supplied) or SMS (computed per segment). */
  limit: number | null;
  note: string;
}

export const LIMIT_PRESETS: readonly LimitPreset[] = [
  { id: 'none', name: 'No limit', limit: null, note: '' },
  { id: 'x', name: 'X post (280)', limit: 280, note: 'Weighted like X: most Latin characters count 1, CJK and emoji count 2, every link counts 23. An approximation of the published rules.' },
  { id: 'meta', name: 'Meta description (155)', limit: 155, note: 'A rule of thumb: Google shortens snippets by pixel width, not by a fixed character count.' },
  { id: 'title', name: 'Title tag (60)', limit: 60, note: 'A rule of thumb: Google shortens titles by pixel width, so wide letters fit fewer characters.' },
  { id: 'sms', name: 'SMS (160 / 70 per message)', limit: null, note: 'Plain GSM-7 text fits 160 characters (153 when split into parts); any other character switches the message to Unicode: 70 (67 per part).' },
  { id: 'instagram', name: 'Instagram caption (2,200)', limit: 2200, note: 'Plain character count.' },
  { id: 'youtube', name: 'YouTube title (100)', limit: 100, note: 'Plain character count.' },
  { id: 'custom', name: 'Custom limit', limit: null, note: 'Counts characters including spaces.' },
];

/** X (Twitter) weighted length following the published twitter-text rules, approximated: see LIMIT_PRESETS. */
export function xWeightedLength(text: string): number {
  const URL_RE = /https?:\/\/[^\s]+/g;
  const urls = text.match(URL_RE) ?? [];
  const rest = text.replace(URL_RE, '');
  let weight = urls.length * 23;
  for (const g of graphemes(rest.normalize('NFC'))) {
    const cp = g.codePointAt(0) ?? 0;
    const light = cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037);
    weight += g.length === 1 && light ? 1 : 2;
  }
  return weight;
}

const GSM_BASIC = new Set(
  Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
  ),
);
const GSM_EXTENDED = new Set(Array.from('^{}\\[~]|€\f'));

export interface SmsInfo {
  encoding: 'GSM-7' | 'Unicode (UCS-2)';
  /** Characters, with the GSM extension characters counting twice, or UTF-16 code units for Unicode. */
  units: number;
  segments: number;
  /** Capacity of one message (single) and of each part when the text needs several. */
  single: number;
  perPart: number;
  /** Units left in the current message or part. */
  remaining: number;
}

/** SMS length: GSM-7 vs Unicode encoding and how many message parts the text needs. */
export function smsInfo(text: string): SmsInfo {
  let gsm = true;
  let units = 0;
  for (const ch of text) {
    if (GSM_BASIC.has(ch)) units += 1;
    else if (GSM_EXTENDED.has(ch)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (!gsm) units = text.length;
  const single = gsm ? 160 : 70;
  const perPart = gsm ? 153 : 67;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / perPart);
  const capacity = segments <= 1 ? single : perPart * segments;
  return { encoding: gsm ? 'GSM-7' : 'Unicode (UCS-2)', units, segments, single, perPart, remaining: capacity - units };
}

export interface LimitStatus {
  used: number;
  limit: number;
  remaining: number;
  over: boolean;
  label: string;
}

/** Usage against a preset (or custom) limit; null when there is no limit or SMS (see smsInfo). */
export function limitStatus(text: string, presetId: string, custom: number): LimitStatus | null {
  const preset = LIMIT_PRESETS.find((p) => p.id === presetId);
  if (!preset || presetId === 'none' || presetId === 'sms') return null;
  const limit = presetId === 'custom' ? Math.floor(custom) : (preset.limit ?? 0);
  if (!(limit > 0)) return null;
  const used = presetId === 'x' ? xWeightedLength(text) : countGraphemes(text);
  const remaining = limit - used;
  return {
    used,
    limit,
    remaining,
    over: remaining < 0,
    label: remaining >= 0 ? `${remaining} left of ${limit}` : `${-remaining} over the limit of ${limit}`,
  };
}
