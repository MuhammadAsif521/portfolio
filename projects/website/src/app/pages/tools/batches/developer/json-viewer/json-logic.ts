/**
 * Engine of the JSON viewer. A JsonStore parses a document once and then answers small questions (children of a
 * node, search, stats), so the page only ever receives the rows it shows. It runs inside a Web Worker for big
 * files and on the main thread as a fallback; the class itself has no DOM or worker dependencies.
 */

export type JsonPath = (string | number)[];
export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonErrorInfo {
  /** 0-based offset into the text. */
  offset: number;
  line: number;
  column: number;
  message: string;
}

export interface JsonStats {
  bytes: number;
  depth: number;
  /** Total number of values (containers and primitives). */
  nodes: number;
  /** Object keys, counted across the whole document. */
  keys: number;
  objects: number;
  arrays: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  /** Longest array and its path. */
  longestArray: { length: number; path: string } | null;
}

export interface JsonRow {
  /** Key (objects) or index (arrays). */
  key: string | number;
  type: JsonType;
  /** Short display text: the value for primitives, "{ n keys }" or "[ n items ]" for containers. */
  preview: string;
  /** Number of children for containers. */
  count: number;
}

export interface JsonSearchHit {
  path: JsonPath;
  /** Where it matched. */
  in: 'key' | 'value';
}

export interface JsonSearchResult {
  hits: JsonSearchHit[];
  /** True when more matches exist than were returned. */
  truncated: boolean;
}

const PREVIEW_MAX = 160;

export const typeOf = (value: unknown): JsonType =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : (typeof value as 'object' | 'string' | 'number' | 'boolean');

const isContainer = (value: unknown): value is Record<string, unknown> | unknown[] => typeof value === 'object' && value !== null;

// Paths ------------------------------------------------------------------------------------------------------------

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** JSONPath (RFC 9535 style): $.users[0].name, with $['odd key'] for keys that are not plain identifiers. */
export function toJsonPath(path: JsonPath): string {
  let out = '$';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else if (IDENT.test(part)) out += `.${part}`;
    else out += `['${part.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
  }
  return out;
}

/** Dot path as JavaScript would write it: users[0].name, with ["odd key"] where needed. Empty for the root. */
export function toDotPath(path: JsonPath): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else if (IDENT.test(part)) out += out ? `.${part}` : part;
    else out += `[${JSON.stringify(part)}]`;
  }
  return out;
}

// Error location ---------------------------------------------------------------------------------------------------

export function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return { line, column: end - last };
}

/**
 * Finds the first syntax error of a JSON text with a position. It is a small strict validator used only after
 * JSON.parse has failed, because engines report positions in different ways (or not at all).
 */
export function findJsonError(text: string): JsonErrorInfo | null {
  const n = text.length;
  let i = 0;
  const fail = (offset: number, message: string): JsonErrorInfo => ({ offset, ...lineColumn(text, offset), message });
  const ws = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const describe = (at: number) => (at >= n ? 'the end of the text' : `"${text[at]}"`);

  const stack: ('o' | 'a')[] = [];
  // State machine: expecting a value, a key, a colon, or a comma / closer.
  type Expect = 'value' | 'valueOrClose' | 'key' | 'keyOrClose' | 'colon' | 'commaOrClose';
  let expect: Expect = 'value';
  let done = false;

  while (true) {
    ws();
    if (i >= n) {
      if (done) return null;
      return fail(n, stack.length ? `Unexpected end of JSON: a ${stack[stack.length - 1] === 'o' ? '"}"' : '"]"'} is missing` : 'Empty input: expected a JSON value');
    }
    if (done) return fail(i, `Unexpected ${describe(i)} after the end of the JSON value`);
    const ch = text[i];

    if (expect === 'colon') {
      if (ch !== ':') return fail(i, `Expected ":" after the key but found ${describe(i)}`);
      i++;
      expect = 'value';
      continue;
    }
    if (expect === 'commaOrClose') {
      const top = stack[stack.length - 1];
      if (ch === ',') {
        i++;
        expect = top === 'o' ? 'key' : 'value';
        continue;
      }
      if ((ch === '}' && top === 'o') || (ch === ']' && top === 'a')) {
        i++;
        stack.pop();
        if (!stack.length) done = true;
        continue;
      }
      return fail(i, `Expected "," or "${top === 'o' ? '}' : ']'}" but found ${describe(i)}`);
    }
    if (expect === 'key' || expect === 'keyOrClose') {
      if (ch === '}' && expect === 'keyOrClose') {
        i++;
        stack.pop();
        expect = stack.length ? 'commaOrClose' : 'value';
        if (!stack.length) done = true;
        continue;
      }
      if (ch === '}') return fail(i, 'Trailing comma: remove the comma before "}"');
      if (ch !== '"') return fail(i, `Expected a key in double quotes but found ${describe(i)}${ch === "'" ? ' (JSON does not allow single quotes)' : ''}`);
      const err = scanString();
      if (err) return err;
      expect = 'colon';
      continue;
    }
    // value or valueOrClose
    if (ch === ']' && expect === 'valueOrClose') {
      i++;
      stack.pop();
      expect = stack.length ? 'commaOrClose' : 'value';
      if (!stack.length) done = true;
      continue;
    }
    if (ch === ']' && stack[stack.length - 1] === 'a') return fail(i, 'Trailing comma: remove the comma before "]"');
    if (ch === '{') {
      i++;
      stack.push('o');
      expect = 'keyOrClose';
      continue;
    }
    if (ch === '[') {
      i++;
      stack.push('a');
      expect = 'valueOrClose';
      continue;
    }
    if (ch === '"') {
      const err = scanString();
      if (err) return err;
    } else {
      const lit = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 400));
      if (!lit) return fail(i, `Unexpected ${describe(i)}: expected a value (string, number, true, false, null, object or array)`);
      const after = text[i + lit[0].length];
      if (after !== undefined && /[\w.+-]/.test(after) && /^-?\d/.test(lit[0])) return fail(i + lit[0].length, `Unexpected ${describe(i + lit[0].length)} in a number`);
      i += lit[0].length;
    }
    if (stack.length) expect = 'commaOrClose';
    else done = true;
  }

  function scanString(): JsonErrorInfo | null {
    const start = i;
    i++;
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return null;
      }
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) return fail(i, 'Invalid \\u escape: it needs four hexadecimal digits');
          i += 6;
          continue;
        }
        if (e === undefined || !'"\\/bfnrt'.includes(e)) return fail(i, `Invalid escape sequence "\\${e ?? ''}"`);
        i += 2;
        continue;
      }
      if (c.charCodeAt(0) < 0x20) return fail(i, 'Unescaped line break or control character inside a string');
      i++;
    }
    return fail(start, 'The string is not closed: a closing double quote is missing');
  }
}

// The store --------------------------------------------------------------------------------------------------------

export type LoadResult = { ok: true; stats: JsonStats; rootType: JsonType; rootCount: number } | { ok: false; error: JsonErrorInfo };

const MAX_STRING_PREVIEW = PREVIEW_MAX;

function preview(value: unknown): { type: JsonType; preview: string; count: number } {
  const type = typeOf(value);
  if (type === 'object') {
    const count = Object.keys(value as object).length;
    return { type, count, preview: `{ ${count} ${count === 1 ? 'key' : 'keys'} }` };
  }
  if (type === 'array') {
    const count = (value as unknown[]).length;
    return { type, count, preview: `[ ${count} ${count === 1 ? 'item' : 'items'} ]` };
  }
  if (type === 'string') {
    const s = value as string;
    const shown = s.length > MAX_STRING_PREVIEW ? `${s.slice(0, MAX_STRING_PREVIEW)}…` : s;
    return { type, count: 0, preview: JSON.stringify(shown) };
  }
  return { type, count: 0, preview: String(value) };
}

export class JsonStore {
  private root: unknown = undefined;
  private text = '';

  load(text: string): LoadResult {
    this.text = text;
    try {
      this.root = JSON.parse(text);
    } catch {
      this.root = undefined;
      return { ok: false, error: findJsonError(text) ?? { offset: 0, line: 1, column: 1, message: 'This is not valid JSON.' } };
    }
    const p = preview(this.root);
    return { ok: true, stats: this.computeStats(), rootType: p.type, rootCount: p.count };
  }

  /** The value at a path, or undefined when the path does not exist. */
  private at(path: JsonPath): unknown {
    let cur: unknown = this.root;
    for (const part of path) {
      if (!isContainer(cur)) return undefined;
      cur = (cur as Record<string | number, unknown>)[part];
    }
    return cur;
  }

  rootRow(): JsonRow {
    return { key: '$', ...preview(this.root) };
  }

  /** A page of children of the node at `path`. */
  children(path: JsonPath, offset = 0, limit = 200): { rows: JsonRow[]; total: number } {
    const node = this.at(path);
    if (Array.isArray(node)) {
      const rows: JsonRow[] = [];
      for (let i = offset; i < Math.min(node.length, offset + limit); i++) rows.push({ key: i, ...preview(node[i]) });
      return { rows, total: node.length };
    }
    if (isContainer(node)) {
      const keys = Object.keys(node);
      const rows = keys.slice(offset, offset + limit).map((key) => ({ key, ...preview((node as Record<string, unknown>)[key]) }));
      return { rows, total: keys.length };
    }
    return { rows: [], total: 0 };
  }

  /** The value at a path as pretty JSON, cut at `maxChars` (flagged) so copying a huge node cannot freeze the page. */
  stringify(path: JsonPath, maxChars = 2_000_000): { text: string; truncated: boolean } {
    const node = this.at(path);
    const text = JSON.stringify(node, null, 2) ?? '';
    return text.length > maxChars ? { text: text.slice(0, maxChars), truncated: true } : { text, truncated: false };
  }

  /** Depth-first search of keys and/or values. Iterative, so deep documents cannot overflow the stack. */
  search(query: string, scope: 'keys' | 'values' | 'both', caseSensitive: boolean, limit = 500): JsonSearchResult {
    const needle = caseSensitive ? query : query.toLowerCase();
    const hits: JsonSearchHit[] = [];
    if (!needle) return { hits, truncated: false };
    const norm = (s: string) => (caseSensitive ? s : s.toLowerCase());
    const stack: { value: unknown; path: JsonPath }[] = [{ value: this.root, path: [] }];
    while (stack.length) {
      const { value, path } = stack.pop()!;
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) stack.push({ value: value[i], path: [...path, i] });
      } else if (isContainer(value)) {
        const keys = Object.keys(value);
        for (let k = keys.length - 1; k >= 0; k--) {
          const key = keys[k];
          const child = (value as Record<string, unknown>)[key];
          const childPath = [...path, key];
          if (scope !== 'values' && norm(key).includes(needle)) {
            if (hits.length >= limit) return { hits, truncated: true };
            hits.push({ path: childPath, in: 'key' });
          }
          stack.push({ value: child, path: childPath });
        }
      } else if (scope !== 'keys' && value !== undefined && norm(String(value)).includes(needle)) {
        if (hits.length >= limit) return { hits, truncated: true };
        hits.push({ path, in: 'value' });
      }
    }
    return { hits, truncated: false };
  }

  private computeStats(): JsonStats {
    const stats: JsonStats = {
      bytes: new TextEncoder().encode(this.text).length,
      depth: 0,
      nodes: 0,
      keys: 0,
      objects: 0,
      arrays: 0,
      strings: 0,
      numbers: 0,
      booleans: 0,
      nulls: 0,
      longestArray: null,
    };
    const stack: { value: unknown; depth: number; path: JsonPath }[] = [{ value: this.root, depth: 0, path: [] }];
    while (stack.length) {
      const { value, depth, path } = stack.pop()!;
      stats.nodes++;
      stats.depth = Math.max(stats.depth, depth);
      if (Array.isArray(value)) {
        stats.arrays++;
        if (!stats.longestArray || value.length > stats.longestArray.length) stats.longestArray = { length: value.length, path: toJsonPath(path) };
        for (let i = 0; i < value.length; i++) stack.push({ value: value[i], depth: depth + 1, path: [...path, i] });
      } else if (isContainer(value)) {
        stats.objects++;
        const keys = Object.keys(value);
        stats.keys += keys.length;
        for (const key of keys) stack.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1, path: [...path, key] });
      } else if (typeof value === 'string') stats.strings++;
      else if (typeof value === 'number') stats.numbers++;
      else if (typeof value === 'boolean') stats.booleans++;
      else stats.nulls++;
    }
    return stats;
  }
}
