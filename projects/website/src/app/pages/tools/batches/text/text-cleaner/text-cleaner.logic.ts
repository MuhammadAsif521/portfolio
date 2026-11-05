import { detectEol, splitLines } from '../text-utils';

/**
 * Line based text cleaning as an ordered pipeline: every step takes the list of lines the previous step
 * produced. Steps: trim, collapse spaces, remove empty lines, remove duplicates, sort, reverse, add prefix/suffix,
 * split, join, and extract emails / URLs / numbers. Pure functions, no DOM.
 */

export type StepType = 'trim' | 'collapse' | 'remove-empty' | 'dedupe' | 'sort' | 'reverse' | 'affix' | 'split' | 'join' | 'extract';
export type StepParams = Record<string, string | boolean>;

export interface Step {
  id: number;
  type: StepType;
  params: StepParams;
}

export interface StepField {
  key: string;
  label: string;
  kind: 'select' | 'text' | 'toggle';
  options?: { id: string; name: string }[];
  hint?: string;
  placeholder?: string;
}

export interface StepDef {
  label: string;
  summary: string;
  fields: StepField[];
  defaults: StepParams;
}

export const SORT_ORDERS = [
  { id: 'az', name: 'A to Z' },
  { id: 'za', name: 'Z to A' },
  { id: 'natural', name: 'Natural (file2 before file10)' },
  { id: 'natural-desc', name: 'Natural, reversed' },
  { id: 'numeric', name: 'Numeric, smallest first' },
  { id: 'numeric-desc', name: 'Numeric, largest first' },
  { id: 'length', name: 'Shortest first' },
  { id: 'length-desc', name: 'Longest first' },
  { id: 'random', name: 'Random (shuffle)' },
];

export const STEP_DEFS: Readonly<Record<StepType, StepDef>> = {
  trim: {
    label: 'Trim lines',
    summary: 'Remove spaces and tabs around each line.',
    fields: [
      {
        key: 'where',
        label: 'Trim',
        kind: 'select',
        options: [
          { id: 'both', name: 'Both ends' },
          { id: 'start', name: 'Start only' },
          { id: 'end', name: 'End only' },
        ],
      },
    ],
    defaults: { where: 'both' },
  },
  collapse: {
    label: 'Collapse spaces',
    summary: 'Turn runs of spaces and tabs inside a line into one space.',
    fields: [],
    defaults: {},
  },
  'remove-empty': {
    label: 'Remove empty lines',
    summary: 'Drop lines with nothing on them.',
    fields: [{ key: 'blank', label: 'Also remove lines with only spaces', kind: 'toggle' }],
    defaults: { blank: true },
  },
  dedupe: {
    label: 'Remove duplicate lines',
    summary: 'Keep one copy of each line.',
    fields: [
      { key: 'keep', label: 'Keep', kind: 'select', options: [{ id: 'first', name: 'First occurrence' }, { id: 'last', name: 'Last occurrence' }] },
      { key: 'ignoreCase', label: 'Ignore case', kind: 'toggle' },
      { key: 'ignoreSpace', label: 'Ignore spaces around lines', kind: 'toggle' },
    ],
    defaults: { keep: 'first', ignoreCase: false, ignoreSpace: false },
  },
  sort: {
    label: 'Sort lines',
    summary: 'Order the lines.',
    fields: [
      { key: 'order', label: 'Order', kind: 'select', options: SORT_ORDERS },
      { key: 'ignoreCase', label: 'Ignore case', kind: 'toggle', hint: 'For A to Z, Z to A and natural order.' },
    ],
    defaults: { order: 'az', ignoreCase: true },
  },
  reverse: {
    label: 'Reverse line order',
    summary: 'Last line first.',
    fields: [],
    defaults: {},
  },
  affix: {
    label: 'Add prefix or suffix',
    summary: 'Put text before and after every line.',
    fields: [
      { key: 'prefix', label: 'Prefix', kind: 'text', placeholder: '- ' },
      { key: 'suffix', label: 'Suffix', kind: 'text', placeholder: ';' },
      { key: 'skipEmpty', label: 'Skip empty lines', kind: 'toggle' },
    ],
    defaults: { prefix: '', suffix: '', skipEmpty: true },
  },
  split: {
    label: 'Split lines at a separator',
    summary: 'Turn "a, b, c" into three lines.',
    fields: [
      { key: 'separator', label: 'Separator', kind: 'text', placeholder: ',', hint: 'Use \\t for a tab and \\n for a line break.' },
      { key: 'trimParts', label: 'Trim the pieces', kind: 'toggle' },
      { key: 'dropEmpty', label: 'Drop empty pieces', kind: 'toggle' },
    ],
    defaults: { separator: ',', trimParts: true, dropEmpty: true },
  },
  join: {
    label: 'Join lines into one',
    summary: 'Turn many lines into a single line.',
    fields: [{ key: 'separator', label: 'Separator', kind: 'text', placeholder: ', ', hint: 'Use \\t for a tab. Empty joins with nothing.' }],
    defaults: { separator: ', ' },
  },
  extract: {
    label: 'Extract emails, URLs or numbers',
    summary: 'Keep only what matches, one per line.',
    fields: [
      {
        key: 'kind',
        label: 'Extract',
        kind: 'select',
        options: [
          { id: 'emails', name: 'Email addresses' },
          { id: 'urls', name: 'Web links (http, https, www)' },
          { id: 'numbers', name: 'Numbers' },
        ],
      },
    ],
    defaults: { kind: 'emails' },
  },
};

export const STEP_TYPES = Object.keys(STEP_DEFS) as StepType[];

/* ---------- Helpers ---------- */

/** Lines of a text: LF, CRLF and CR all split, one final line break adds no empty line, an empty text has none. */
export function linesOf(text: string): string[] {
  if (text === '') return [];
  const lines = splitLines(text);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** "\t", "\n", "\r" and "\\" typed in a separator field become the real characters. */
export function unescapeSeparator(value: string): string {
  return value.replace(/\\([tnr\\])/g, (_m, c: string) => (c === 't' ? '\t' : c === 'n' ? '\n' : c === 'r' ? '\r' : '\\'));
}

const codePointLength = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0xdc00 || c > 0xdfff) n++;
  }
  return n;
};

const LEADING_NUMBER = /^\s*([-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?|[-+]?\.\d+)/;

/** The number a line starts with (thousands commas allowed), or null when it does not start with one. */
export function leadingNumber(line: string): number | null {
  const m = LEADING_NUMBER.exec(line);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sortLines(lines: readonly string[], order: string, ignoreCase: boolean, rng: () => number = Math.random): string[] {
  switch (order) {
    case 'random':
      return shuffle(lines, rng);
    case 'numeric':
    case 'numeric-desc': {
      const withNumbers = lines.map((line, i) => ({ line, i, n: leadingNumber(line) }));
      const dir = order === 'numeric' ? 1 : -1;
      const collator = new Intl.Collator('en', { sensitivity: 'variant' });
      withNumbers.sort((a, b) => {
        if (a.n === null && b.n === null) return a.i - b.i; // lines without a number keep their order, at the end
        if (a.n === null) return 1;
        if (b.n === null) return -1;
        return dir * (a.n - b.n) || collator.compare(a.line, b.line) * dir || a.i - b.i;
      });
      return withNumbers.map((x) => x.line);
    }
    case 'length':
    case 'length-desc': {
      const dir = order === 'length' ? 1 : -1;
      return lines
        .map((line, i) => ({ line, i, n: codePointLength(line) }))
        .sort((a, b) => dir * (a.n - b.n) || a.i - b.i)
        .map((x) => x.line);
    }
    default: {
      const natural = order.startsWith('natural');
      const desc = order === 'za' || order === 'natural-desc';
      // "accent" sensitivity: case is ignored but é and e stay different, like a dictionary.
      const collator = new Intl.Collator('en', { numeric: natural, sensitivity: ignoreCase ? 'accent' : 'variant' });
      const sorted = lines.slice().sort((a, b) => collator.compare(a, b));
      return desc ? sorted.reverse() : sorted;
    }
  }
}

export function dedupeLines(lines: readonly string[], keep: 'first' | 'last', ignoreCase: boolean, ignoreSpace: boolean): string[] {
  const key = (l: string): string => {
    let k = ignoreSpace ? l.trim() : l;
    if (ignoreCase) k = k.toLowerCase();
    return k;
  };
  if (keep === 'first') {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of lines) {
      const k = key(l);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(l);
      }
    }
    return out;
  }
  const last = new Map<string, number>();
  lines.forEach((l, i) => last.set(key(l), i));
  return lines.filter((l, i) => last.get(key(l)) === i);
}

/* ---------- Extraction (simple, honest patterns) ---------- */

/** user@host.tld: letters, digits and . _ % + - in the name; no quoted names, comments or IP literals. */
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
/** http(s):// or www. up to the next space or quote or angle bracket; trailing punctuation is trimmed. No other schemes. */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/giu;
/** Optional sign, thousands commas, decimals and an exponent. ASCII digits only; 1.234,56 is not read as one number. */
const NUMBER = /[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?|[-+]?\.\d+/g;

function trimUrl(url: string): string {
  let u = url;
  for (;;) {
    const last = u.charAt(u.length - 1);
    if (/[.,;:!?'"]/.test(last)) u = u.slice(0, -1);
    else if (last === ')' && (u.match(/\(/g) ?? []).length < (u.match(/\)/g) ?? []).length) u = u.slice(0, -1);
    else if (last === ']' && (u.match(/\[/g) ?? []).length < (u.match(/\]/g) ?? []).length) u = u.slice(0, -1);
    else if (last === '}' && (u.match(/\{/g) ?? []).length < (u.match(/\}/g) ?? []).length) u = u.slice(0, -1);
    else return u;
  }
}

export function extractFrom(lines: readonly string[], kind: string): string[] {
  const out: string[] = [];
  const re = kind === 'urls' ? URL_RE : kind === 'numbers' ? NUMBER : EMAIL;
  for (const line of lines) {
    re.lastIndex = 0;
    for (const m of line.matchAll(re)) out.push(kind === 'urls' ? trimUrl(m[0]) : m[0]);
  }
  return out.filter(Boolean);
}

/* ---------- Pipeline ---------- */

export function defaultParams(type: StepType): StepParams {
  return { ...STEP_DEFS[type].defaults };
}

export function applyStep(lines: readonly string[], step: Step, rng: () => number = Math.random): string[] {
  const p = step.params;
  const str = (k: string): string => String(p[k] ?? '');
  const bool = (k: string): boolean => p[k] === true;
  switch (step.type) {
    case 'trim': {
      const where = str('where');
      return lines.map((l) => (where === 'start' ? l.trimStart() : where === 'end' ? l.trimEnd() : l.trim()));
    }
    case 'collapse':
      return lines.map((l) => l.replace(/[ \t ]+/g, ' '));
    case 'remove-empty':
      return lines.filter((l) => (bool('blank') ? l.trim() !== '' : l !== ''));
    case 'dedupe':
      return dedupeLines(lines, str('keep') === 'last' ? 'last' : 'first', bool('ignoreCase'), bool('ignoreSpace'));
    case 'sort':
      return sortLines(lines, str('order'), bool('ignoreCase'), rng);
    case 'reverse':
      return lines.slice().reverse();
    case 'affix': {
      const prefix = str('prefix');
      const suffix = str('suffix');
      const skip = bool('skipEmpty');
      return lines.map((l) => (skip && l === '' ? l : prefix + l + suffix));
    }
    case 'split': {
      const sep = unescapeSeparator(str('separator'));
      if (!sep) return lines.slice();
      let parts = lines.flatMap((l) => l.split(sep));
      if (bool('trimParts')) parts = parts.map((s) => s.trim());
      if (bool('dropEmpty')) parts = parts.filter((s) => s !== '');
      return parts;
    }
    case 'join':
      return lines.length ? [lines.join(unescapeSeparator(str('separator')))] : [];
    case 'extract':
      return extractFrom(lines, str('kind'));
  }
}

export interface TraceEntry {
  id: number;
  type: StepType;
  before: number;
  after: number;
}

export interface PipelineResult {
  text: string;
  lines: string[];
  inputLines: number;
  trace: TraceEntry[];
}

/** Runs the steps in order. Lines are joined with CRLF only when the input used CRLF throughout. */
export function runPipeline(text: string, steps: readonly Step[], rng: () => number = Math.random): PipelineResult {
  const eol = detectEol(text);
  let lines = linesOf(text);
  const inputLines = lines.length;
  const trace: TraceEntry[] = [];
  for (const step of steps) {
    const before = lines.length;
    lines = applyStep(lines, step, rng);
    trace.push({ id: step.id, type: step.type, before, after: lines.length });
  }
  return { text: lines.join(eol), lines, inputLines, trace };
}
