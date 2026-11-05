import { jsonErrorLocation } from '../../../tool-logic-2';

/*
 * Pure helpers shared by every converter: result and error types, line/column maths, a JSON parser with
 * exact error locations and exact big integers, and the helpers that put those integers back into the
 * output. Nothing here touches the DOM, so it also runs inside the Web Workers.
 */

/** Where a parse error happened, 1-based. */
export interface SourceLocation {
  line: number;
  column: number;
}

export interface ConvertError extends Partial<SourceLocation> {
  /** Plain-language message, without a stack trace. */
  message: string;
  /** A few source lines around the error with a caret under the column (monospace text). */
  snippet?: string;
}

export interface ConvertSuccess {
  ok: true;
  output: string;
  /** Short facts for the status line, e.g. "120 rows", "9 columns". */
  meta: string[];
  /** Things that changed or were dropped on the way (renamed keys, rounded numbers, ...). */
  warnings: string[];
  /** The download should start with a UTF-8 byte order mark (Excel). It is not part of `output`. */
  bom?: boolean;
}

export interface ConvertFailure {
  ok: false;
  error: ConvertError;
  warnings?: string[];
}

export type ConvertResult = ConvertSuccess | ConvertFailure;

/** The function every converter exposes, and every Web Worker serves. */
export type Converter<O> = (text: string, options: O) => Promise<ConvertResult>;

/** Inputs above this many characters are converted in a Web Worker instead of on the page. */
export const WORKER_THRESHOLD = 1_000_000;
/** Largest text file the converters accept. Bigger files need a command-line tool. */
export const MAX_INPUT_MB = 50;
/** Output longer than this is shown truncated; copy and download still use the full text. */
export const PREVIEW_LIMIT = 200_000;

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 1-based line and column of a character offset. \n, \r\n and a lone \r each end a line. */
export function offsetToLocation(text: string, offset: number): SourceLocation {
  const end = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: end - lineStart + 1 };
}

/** Offset of the start of a 1-based line (text.length when the text has fewer lines). */
export function lineStartOffset(text: string, line: number): number {
  let current = 1;
  for (let i = 0; i < text.length && current < line; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) {
      current++;
      if (current === line) return i + 1;
    }
  }
  return current === line ? 0 : text.length;
}

const SNIPPET_WIDTH = 110;

/** The failing line (plus one line of context each side) with a caret under the column. */
export function snippetAt(text: string, line: number, column?: number): string {
  const first = Math.max(1, line - 1);
  const rows: string[] = [];
  let offset = lineStartOffset(text, first);
  const gutter = String(line + 1).length;
  for (let n = first; n <= line + 1 && offset <= text.length; n++) {
    let end = offset;
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
    let content = text.slice(offset, end);
    let shift = 0;
    if (n === line && column && column > SNIPPET_WIDTH) {
      shift = column - SNIPPET_WIDTH / 2;
      content = '…' + content.slice(shift);
    }
    if (content.length > SNIPPET_WIDTH * 1.5) content = content.slice(0, SNIPPET_WIDTH * 1.5) + '…';
    rows.push(`${String(n).padStart(gutter)} | ${content}`);
    if (n === line && column) {
      const caretAt = shift ? column - shift + 1 : column;
      rows.push(`${' '.repeat(gutter)} | ${' '.repeat(Math.max(0, caretAt - 1))}^`);
    }
    if (text[end] === '\r' && text[end + 1] === '\n') end++;
    offset = end + 1;
    if (end >= text.length) break;
  }
  return rows.join('\n');
}

export function failAt(message: string, source: string, at?: Partial<SourceLocation> | null, warnings?: string[]): ConvertFailure {
  const error: ConvertError = { message };
  if (at?.line) {
    error.line = at.line;
    if (at.column) error.column = at.column;
    error.snippet = snippetAt(source, at.line, at.column);
  }
  return { ok: false, error, ...(warnings?.length ? { warnings } : {}) };
}

export function fail(message: string): ConvertFailure {
  return { ok: false, error: { message } };
}

/** Never let an unexpected exception reach the UI as a stack trace. */
export function failFromException(error: unknown, what: string): ConvertFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (/Invalid string length|Array buffer allocation|out of memory|Maximum call stack/i.test(message)) {
    return fail(`This input is too large or too deeply nested to convert in the browser. Split it into smaller pieces. (${what})`);
  }
  return fail(`Could not convert this input: ${message}`);
}

export function plural(count: number, one: string, many = one + 's'): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

// ── JSON input ───────────────────────────────────────────────────────────────

export interface ParsedJson {
  ok: true;
  value: unknown;
  /** Integers beyond 2^53 that were kept exact (as bigint) or, on old browsers, would be rounded. */
  bigInts: number;
  warnings: string[];
}

/**
 * Error position when the engine's message has none (Safari): a small recursive-descent check that finds
 * the first character that cannot be valid JSON. Returns null when the text is valid.
 */
export function findJsonError(text: string): { offset: number; message: string } | null {
  let i = 0;
  const ws = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const bad = (message: string) => ({ offset: i, message });
  const value = (depth: number): { offset: number; message: string } | null => {
    if (depth > 400) return bad('Nesting is too deep');
    ws();
    const c = text[i];
    if (c === undefined) return bad('Unexpected end of JSON input');
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') return (i++, null);
      for (;;) {
        ws();
        if (text[i] !== '"') return bad('Expected a property name in double quotes');
        const s = string();
        if (s) return s;
        ws();
        if (text[i] !== ':') return bad("Expected ':' after the property name");
        i++;
        const v = value(depth + 1);
        if (v) return v;
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') return (i++, null);
        return bad("Expected ',' or '}' after the property value");
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') return (i++, null);
      for (;;) {
        const v = value(depth + 1);
        if (v) return v;
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') return (i++, null);
        return bad("Expected ',' or ']' after the array element");
      }
    }
    if (c === '"') return string();
    const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 400));
    if (literal) return (i += literal[0].length, null);
    return bad(`Unexpected character '${c}'`);
  };
  const string = (): { offset: number; message: string } | null => {
    i++;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') return (i++, null);
      if (c === '\\') {
        const next = text[i + 1];
        if (next === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) return bad('Bad \\u escape in string');
          i += 6;
        } else if (next !== undefined && '"\\/bfnrt'.includes(next)) i += 2;
        else return bad('Bad escape character in string');
        continue;
      }
      if (c !== undefined && c < ' ') return bad('Control characters must be escaped in strings');
      i++;
    }
    return bad('Unterminated string');
  };
  const first = value(0);
  if (first) return first;
  ws();
  return i < text.length ? { offset: i, message: `Unexpected character '${text[i]}' after the end of the data` } : null;
}

const SOURCE_REVIVER_SUPPORTED = (() => {
  try {
    let seen = '';
    JSON.parse('1', (_key, value, context?: { source?: string }) => ((seen = context?.source ?? ''), value));
    return seen === '1';
  } catch {
    return false;
  }
})();

const UNSAFE_INT = /(?<![\d.eE+-])-?\d{16,}(?![\d.eE])/;

/**
 * JSON.parse with exact error locations. Integers beyond 2^53 become bigint when the browser can give the
 * source text of a number (Chrome 114+, Firefox 135+, Safari 18+); otherwise they are rounded by JSON.parse
 * and a warning says so. Callers decide how to print a bigint (see bigIntMarker).
 */
export function parseJson(raw: string, keepBigInts = true): ParsedJson | ConvertFailure {
  const text = stripBom(raw);
  if (!text.trim()) return fail('There is nothing to convert yet.');
  const maybeBig = UNSAFE_INT.test(text);
  let bigInts = 0;
  try {
    const value =
      maybeBig && keepBigInts && SOURCE_REVIVER_SUPPORTED
        ? JSON.parse(text, (_key, v, context?: { source?: string }) => {
            if (typeof v === 'number' && context?.source && /^-?\d+$/.test(context.source) && !Number.isSafeInteger(v)) {
              bigInts++;
              return BigInt(context.source);
            }
            return v;
          })
        : JSON.parse(text);
    const warnings: string[] = [];
    if (maybeBig && !(keepBigInts && SOURCE_REVIVER_SUPPORTED)) {
      const rounded = countRoundedInts(text);
      if (rounded) {
        warnings.push(
          `${plural(rounded, 'integer')} larger than 9,007,199,254,740,991 (2^53) were rounded by this browser's JSON parser. Quote them as strings to keep every digit.`,
        );
      }
    }
    return { ok: true, value, bigInts, warnings };
  } catch (error) {
    const message = (error as Error).message ?? 'Invalid JSON';
    let at: SourceLocation | null = jsonErrorLocation(text, message);
    let reason = message.replace(/\s*\(line \d+ column \d+\)/i, '').replace(/\s+at line \d+ column \d+ of the JSON data/i, '');
    if (!at) {
      const found = findJsonError(text);
      if (found) {
        at = offsetToLocation(text, found.offset);
        reason = found.message;
      }
    }
    return failAt(`Invalid JSON: ${reason}`, text, at);
  }
}

function countRoundedInts(text: string): number {
  let count = 0;
  const pattern = new RegExp(UNSAFE_INT.source, 'g');
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (!Number.isSafeInteger(Number(m[0]))) count++;
  }
  return count;
}

/** Narrow the result of parseJson. */
export function isParsedJson(result: ParsedJson | ConvertFailure): result is ParsedJson {
  return result.ok;
}

// ── Exact big integers in text outputs ───────────────────────────────────────

/**
 * A serializer (JSON.stringify, YAML dump, XML builder) cannot print a bigint as a bare number. This swaps
 * each bigint for a placeholder string that no serializer will quote or escape, and `restore` puts the
 * digits back afterwards, so 12345678901234567890 comes out exact.
 */
export function createBigIntMarker() {
  const nonce = Math.random().toString(36).slice(2, 10);
  const prefix = `__BIGINT_${nonce}_`;
  const pattern = new RegExp(`(["']?)${prefix}(-?\\d+)__\\1`, 'g');
  return {
    mark: (value: bigint): string => `${prefix}${value.toString()}__`,
    restore: (text: string): string => text.replace(pattern, '$2'),
  };
}

/** Deep copy with every bigint replaced via `replace` (for libraries that cannot take a bigint). */
export function mapBigInts(value: unknown, replace: (v: bigint) => unknown): unknown {
  if (typeof value === 'bigint') return replace(value);
  if (Array.isArray(value)) return value.map((v) => mapBigInts(v, replace));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) defineOwn(out, key, mapBigInts((value as Record<string, unknown>)[key], replace));
    return out;
  }
  return value;
}

/** Assign a key without ever touching the prototype ("__proto__" becomes an ordinary key). */
export function defineOwn(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) defineOwn(out, key, sortKeysDeep((value as Record<string, unknown>)[key]));
    return out;
  }
  return value;
}

export type IndentChoice = '2' | '4' | 'tab' | 'minify';

export function jsonIndent(choice: IndentChoice): number | string | undefined {
  return choice === 'minify' ? undefined : choice === 'tab' ? '\t' : Number(choice);
}

/** JSON.stringify that prints bigint values as exact numbers. Throws only on circular data (not possible from parsers). */
export function stringifyJson(value: unknown, indent: number | string | undefined): string {
  const marker = createBigIntMarker();
  const text = JSON.stringify(
    value,
    (_key, v) => (typeof v === 'bigint' ? marker.mark(v) : v),
    indent,
  );
  return marker.restore(text ?? 'null');
}

/** Rough UTF-8 size for the status line. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
