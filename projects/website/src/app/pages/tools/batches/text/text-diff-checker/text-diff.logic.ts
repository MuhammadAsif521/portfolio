import type { diffArrays as DiffArrays } from 'diff';
import { countGraphemes, graphemes, splitLines } from '../text-utils';

/**
 * Text comparison on top of jsdiff's Myers diff (diffArrays), so it can compare lines, words or user-perceived
 * characters (grapheme clusters: an emoji or an accented letter is never split) with the same engine. The
 * module takes the `diffArrays` function as a parameter, so jsdiff is loaded lazily by the component and the
 * pure logic stays testable.
 */

export type DiffMode = 'lines' | 'words' | 'chars';
export type DiffFn = typeof DiffArrays;

export interface DiffOptions {
  mode: DiffMode;
  /** Whitespace differences do not count: lines are trimmed and runs of spaces collapsed; in word and character mode all whitespace compares equal. */
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  /** Time budget per diff run in ms; when it runs out the affected block is reported as replaced as a whole. */
  budgetMs?: number;
}

export interface Seg {
  type: 'eq' | 'add' | 'del';
  text: string;
}

export interface LineOp {
  type: 'eq' | 'add' | 'del';
  text: string;
  /** 1-based line number in the original text (null for added lines). */
  oldNo: number | null;
  /** 1-based line number in the modified text (null for removed lines). */
  newNo: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
  unit: 'lines' | 'words' | 'characters';
}

export interface DiffResult {
  mode: DiffMode;
  /** Equal under the chosen options. */
  identical: boolean;
  /** Line level changes, always present (the patch is built from them). */
  ops: LineOp[];
  /** Inline segments for word and character mode, null in line mode. */
  segments: Seg[] | null;
  stats: DiffStats;
  lineStats: DiffStats;
  /** True when the time budget ran out and some changed blocks are shown as fully replaced. */
  approximate: boolean;
}

const DEFAULT_BUDGET_MS = 2500;
/** Above this combined size word and character diffs first split the text by lines, then refine each changed block. */
export const DIRECT_INLINE_LIMIT = 60_000;
/** A changed block bigger than this (per mode) is shown as replaced as a whole instead of diffed inside. */
export const BLOCK_REFINE_LIMIT = { words: 4_000_000, chars: 800_000 };

/** Lines of a text for comparison: CRLF/LF/CR all split alike, and one final line break does not add an empty line. */
export function toLines(text: string): string[] {
  if (text === '') return [];
  const lines = splitLines(text);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const WS_RUN = /\s+/g;

function lineKey(line: string, o: DiffOptions): string {
  let k = line;
  if (o.ignoreWhitespace) k = k.replace(WS_RUN, ' ').trim();
  if (o.ignoreCase) k = k.toLowerCase();
  return k;
}

/** Tokens of a text for word mode: runs of letters/digits, single punctuation marks, whitespace runs. */
export function wordTokens(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}\p{M}_]+(?:['’][\p{L}\p{N}\p{M}]+)*|[^\s\p{L}\p{N}\p{M}_]/gu) ?? [];
}

type Change = { count?: number; added?: boolean; removed?: boolean };

/** Runs jsdiff on key arrays and maps the result back to the original tokens. null when the budget ran out. */
function diffTokens(
  diffArrays: DiffFn,
  a: readonly string[],
  b: readonly string[],
  keyA: readonly string[],
  keyB: readonly string[],
  deadline: number,
): Seg[][] | null {
  // Common prefix and suffix are cut off first: it is cheap and makes the usual "small edit in a big text" case instant.
  let start = 0;
  const minLen = Math.min(keyA.length, keyB.length);
  while (start < minLen && keyA[start] === keyB[start]) start++;
  let endA = keyA.length;
  let endB = keyB.length;
  while (endA > start && endB > start && keyA[endA - 1] === keyB[endB - 1]) {
    endA--;
    endB--;
  }
  const out: Seg[][] = [];
  if (start > 0) out.push([{ type: 'eq', text: b.slice(0, start).join('') }]);
  const midA = keyA.slice(start, endA);
  const midB = keyB.slice(start, endB);
  if (midA.length || midB.length) {
    const remaining = deadline - Date.now();
    let changes: Change[] | undefined;
    if (remaining > 0 && midA.length && midB.length) {
      changes = diffArrays(midA as string[], midB as string[], { timeout: remaining }) as Change[] | undefined;
    } else if (!midA.length || !midB.length) {
      changes = [midA.length ? { count: midA.length, removed: true } : { count: midB.length, added: true }];
    }
    if (!changes) return null;
    let i = start;
    let j = start;
    for (const c of changes) {
      const n = c.count ?? 0;
      if (c.added) {
        out.push([{ type: 'add', text: b.slice(j, j + n).join('') }]);
        j += n;
      } else if (c.removed) {
        out.push([{ type: 'del', text: a.slice(i, i + n).join('') }]);
        i += n;
      } else {
        out.push([{ type: 'eq', text: b.slice(j, j + n).join('') }]);
        i += n;
        j += n;
      }
    }
  }
  if (endB < b.length) out.push([{ type: 'eq', text: b.slice(endB).join('') }]);
  return out;
}

const isBlank = (s: string): boolean => /^\s+$/.test(s);

/**
 * Cleans up a segment list for reading: a whitespace-only unchanged gap between two changes is folded into
 * them, each run of changes becomes one removal followed by one addition, and neighbours of the same type merge.
 */
export function tidySegments(segs: readonly Seg[]): Seg[] {
  const folded: Seg[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.type === 'eq' && isBlank(s.text) && i > 0 && i < segs.length - 1 && segs[i - 1].type !== 'eq' && segs[i + 1].type !== 'eq') {
      folded.push({ type: 'del', text: s.text }, { type: 'add', text: s.text });
    } else if (s.text !== '') folded.push(s);
  }
  const out: Seg[] = [];
  let del = '';
  let add = '';
  const flush = () => {
    if (del) out.push({ type: 'del', text: del });
    if (add) out.push({ type: 'add', text: add });
    del = add = '';
  };
  for (const s of folded) {
    if (s.type === 'del') del += s.text;
    else if (s.type === 'add') add += s.text;
    else {
      flush();
      const last = out[out.length - 1];
      if (last && last.type === 'eq') last.text += s.text;
      else out.push({ ...s });
    }
  }
  flush();
  return out;
}

/** Word or character level segments for two texts; null when the time budget ran out. */
export function inlineSegments(diffArrays: DiffFn, a: string, b: string, o: DiffOptions, deadline: number): Seg[] | null {
  const chars = o.mode === 'chars';
  const ta = chars ? graphemes(a) : wordTokens(a);
  const tb = chars ? graphemes(b) : wordTokens(b);
  const key = (t: string): string => {
    let k = t;
    if (o.ignoreWhitespace && isBlank(k)) k = ' ';
    if (o.ignoreCase) k = k.toLowerCase();
    return k;
  };
  const parts = diffTokens(diffArrays, ta, tb, ta.map(key), tb.map(key), deadline);
  if (!parts) return null;
  return tidySegments(parts.flat());
}

/** Line level operations. Returns approximate=true when the budget ran out (the changed middle is shown replaced). */
export function diffLineOps(diffArrays: DiffFn, a: readonly string[], b: readonly string[], o: DiffOptions, deadline: number): { ops: LineOp[]; approximate: boolean } {
  const keyA = a.map((l) => lineKey(l, o));
  const keyB = b.map((l) => lineKey(l, o));
  const parts = diffTokens(diffArrays, a.map((l) => l + '\n'), b.map((l) => l + '\n'), keyA, keyB, deadline);
  const ops: LineOp[] = [];
  let approximate = false;
  let oldNo = 1;
  let newNo = 1;
  const emit = (type: LineOp['type'], text: string) => {
    // Segments are joined lines each ending in "\n": split them back into lines.
    const lines = text.split('\n');
    lines.pop();
    for (const line of lines) {
      if (type === 'eq') ops.push({ type, text: line, oldNo: oldNo++, newNo: newNo++ });
      else if (type === 'del') ops.push({ type, text: line, oldNo: oldNo++, newNo: null });
      else ops.push({ type, text: line, oldNo: null, newNo: newNo++ });
    }
  };
  if (!parts) {
    approximate = true;
    // Budget ran out: keep the identical head and tail, replace everything in between.
    let s = 0;
    while (s < a.length && s < b.length && keyA[s] === keyB[s]) s++;
    let ea = a.length;
    let eb = b.length;
    while (ea > s && eb > s && keyA[ea - 1] === keyB[eb - 1]) {
      ea--;
      eb--;
    }
    emit('eq', b.slice(0, s).map((l) => l + '\n').join(''));
    emit('del', a.slice(s, ea).map((l) => l + '\n').join(''));
    emit('add', b.slice(s, eb).map((l) => l + '\n').join(''));
    emit('eq', b.slice(eb).map((l) => l + '\n').join(''));
    return { ops, approximate };
  }
  // jsdiff reports a run of changes as removed then added; consecutive parts of the same kind are fine as they are.
  const flat = parts.flat();
  for (let i = 0; i < flat.length; i++) {
    const p = flat[i];
    if (p.type === 'add' && flat[i + 1]?.type === 'del') {
      // Normalise "added, removed" to "removed, added" so a block of changes always lists removals first.
      emit('del', flat[i + 1].text);
      emit('add', p.text);
      i++;
    } else emit(p.type, p.text);
  }
  return { ops, approximate };
}

const countTokens = (text: string, mode: DiffMode): number => (mode === 'words' ? (text.match(/\S+/g) ?? []).length : mode === 'chars' ? countGraphemes(text) : 0);

function statsFromOps(ops: readonly LineOp[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'del') removed++;
    else unchanged++;
  }
  return { added, removed, unchanged, unit: 'lines' };
}

function statsFromSegments(segs: readonly Seg[], mode: DiffMode): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const s of segs) {
    const n = countTokens(s.text, mode);
    if (s.type === 'add') added += n;
    else if (s.type === 'del') removed += n;
    else unchanged += n;
  }
  return { added, removed, unchanged, unit: mode === 'words' ? 'words' : 'characters' };
}

/** Builds the inline segment list of a large text by diffing lines first and refining only the changed blocks. */
function refineByBlocks(diffArrays: DiffFn, ops: readonly LineOp[], o: DiffOptions, deadline: number): { segs: Seg[]; approximate: boolean } {
  const segs: Seg[] = [];
  const limit = o.mode === 'chars' ? BLOCK_REFINE_LIMIT.chars : BLOCK_REFINE_LIMIT.words;
  let approximate = false;
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'eq') {
      segs.push({ type: 'eq', text: ops[i].text + '\n' });
      i++;
      continue;
    }
    const dels: string[] = [];
    const adds: string[] = [];
    while (i < ops.length && ops[i].type !== 'eq') {
      (ops[i].type === 'del' ? dels : adds).push(ops[i].text + '\n');
      i++;
    }
    const delText = dels.join('');
    const addText = adds.join('');
    let inner: Seg[] | null = null;
    if (delText && addText && delText.length + addText.length <= limit) inner = inlineSegments(diffArrays, delText, addText, o, deadline);
    if (inner) segs.push(...inner);
    else {
      if (delText && addText && delText.length + addText.length > limit) approximate = true;
      if (delText) segs.push({ type: 'del', text: delText });
      if (addText) segs.push({ type: 'add', text: addText });
    }
  }
  return { segs: tidySegments(segs), approximate };
}

/** Compares two texts. Never throws on large input: at worst the result is flagged approximate. */
export function computeDiff(diffArrays: DiffFn, original: string, modified: string, o: DiffOptions): DiffResult {
  const deadline = Date.now() + (o.budgetMs ?? DEFAULT_BUDGET_MS);
  const { ops, approximate: lineApprox } = diffLineOps(diffArrays, toLines(original), toLines(modified), o, deadline);
  const lineStats = statsFromOps(ops);
  let segments: Seg[] | null = null;
  let approximate = lineApprox;
  let stats = lineStats;
  if (o.mode !== 'lines') {
    const small = original.length + modified.length <= DIRECT_INLINE_LIMIT;
    const direct = small ? inlineSegments(diffArrays, original, modified, o, deadline) : null;
    if (direct) segments = direct;
    else {
      const refined = refineByBlocks(diffArrays, ops, o, deadline);
      segments = refined.segs;
      approximate = approximate || refined.approximate || small;
    }
    stats = statsFromSegments(segments, o.mode);
  }
  return { mode: o.mode, identical: stats.added === 0 && stats.removed === 0 && lineStats.added === 0 && lineStats.removed === 0, ops, segments, stats, lineStats, approximate };
}

/* ---------- Views ---------- */

export interface SkipRow {
  skip: number;
}
export type WithSkips<T> = (T | SkipRow)[];
export const isSkip = (row: unknown): row is SkipRow => typeof row === 'object' && row !== null && 'skip' in row;

/** Keeps rows within `context` rows of a change and replaces long unchanged stretches with a skip marker. */
export function collapseUnchanged<T>(rows: readonly T[], isChange: (row: T) => boolean, context: number): WithSkips<T> {
  const keep = new Uint8Array(rows.length);
  rows.forEach((row, i) => {
    if (isChange(row)) for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = 1;
  });
  const out: WithSkips<T> = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    if (keep[i]) {
      if (skipped) out.push({ skip: skipped });
      skipped = 0;
      out.push(row);
    } else skipped++;
  });
  if (skipped) out.push({ skip: skipped });
  return out;
}

export interface SideCell {
  no: number;
  type: 'eq' | 'add' | 'del';
  text: string;
  /** Inline highlighting inside a changed line that has a counterpart on the other side. */
  segs?: Seg[];
}
export interface SideRow {
  left: SideCell | null;
  right: SideCell | null;
}

/** Rows for the side-by-side view: removed and added lines of a block are paired up row by row. */
export function sideBySideRows(diffArrays: DiffFn | null, ops: readonly LineOp[], o: DiffOptions): SideRow[] {
  const rows: SideRow[] = [];
  const inlineOpts: DiffOptions = { ...o, mode: 'words' };
  let pairBudget = 400;
  const stopAt = Date.now() + 400; // total time allowed for the word highlighting inside changed lines
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'eq') {
      rows.push({ left: { no: op.oldNo as number, type: 'eq', text: op.text }, right: { no: op.newNo as number, type: 'eq', text: op.text } });
      i++;
      continue;
    }
    const dels: LineOp[] = [];
    const adds: LineOp[] = [];
    while (i < ops.length && ops[i].type !== 'eq') {
      (ops[i].type === 'del' ? dels : adds).push(ops[i]);
      i++;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const d = dels[k];
      const a = adds[k];
      const left: SideCell | null = d ? { no: d.oldNo as number, type: 'del', text: d.text } : null;
      const right: SideCell | null = a ? { no: a.newNo as number, type: 'add', text: a.text } : null;
      if (left && right && diffArrays && pairBudget > 0 && Date.now() < stopAt && left.text.length + right.text.length <= 2000) {
        pairBudget--;
        const segs = inlineSegments(diffArrays, left.text, right.text, inlineOpts, Date.now() + 50);
        if (segs && segs.some((s) => s.type === 'eq' && s.text.trim() !== '')) {
          left.segs = segs.filter((s) => s.type !== 'add');
          right.segs = segs.filter((s) => s.type !== 'del');
        }
      }
      rows.push({ left, right });
    }
  }
  return rows;
}

/** Splits segments into the two sides of a side-by-side view: left keeps equal and removed text, right equal and added. */
export function sideSegments(segs: readonly Seg[]): { left: Seg[]; right: Seg[] } {
  return { left: segs.filter((s) => s.type !== 'add'), right: segs.filter((s) => s.type !== 'del') };
}

/** Caps the number of segments to render. */
export function limitSegments(segs: readonly Seg[], max: number): { segs: Seg[]; hidden: number } {
  if (segs.length <= max) return { segs: segs as Seg[], hidden: 0 };
  return { segs: segs.slice(0, max), hidden: segs.length - max };
}

/* ---------- Unified patch ---------- */

export interface PatchOptions {
  oldName?: string;
  newName?: string;
  context?: number;
}

const range = (start: number, count: number): string => (count === 1 ? `${start}` : `${start},${count}`);

/**
 * A unified diff (the format of `diff -u` and `git diff`) from line operations. A final line break is ignored in
 * the comparison and line endings are normalised, so the patch describes lines, not invisible characters.
 * Returns '' for identical texts.
 */
export function buildUnifiedPatch(ops: readonly LineOp[], opts: PatchOptions = {}): string {
  const context = opts.context ?? 3;
  const changed: number[] = [];
  ops.forEach((op, i) => {
    if (op.type !== 'eq') changed.push(i);
  });
  if (!changed.length) return '';
  // Running counts of old/new lines before each op.
  const oldBefore = new Int32Array(ops.length + 1);
  const newBefore = new Int32Array(ops.length + 1);
  ops.forEach((op, i) => {
    oldBefore[i + 1] = oldBefore[i] + (op.type !== 'add' ? 1 : 0);
    newBefore[i + 1] = newBefore[i] + (op.type !== 'del' ? 1 : 0);
  });
  const ranges: [number, number][] = [];
  for (const idx of changed) {
    const s = Math.max(0, idx - context);
    const e = Math.min(ops.length, idx + context + 1);
    const last = ranges[ranges.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else ranges.push([s, e]);
  }
  const lines = [`--- ${opts.oldName ?? 'original'}`, `+++ ${opts.newName ?? 'modified'}`];
  for (const [s, e] of ranges) {
    const slice = ops.slice(s, e);
    const oldCount = slice.filter((o) => o.type !== 'add').length;
    const newCount = slice.filter((o) => o.type !== 'del').length;
    const oldStart = oldCount === 0 ? oldBefore[s] : oldBefore[s] + 1;
    const newStart = newCount === 0 ? newBefore[s] : newBefore[s] + 1;
    lines.push(`@@ -${range(oldStart, oldCount)} +${range(newStart, newCount)} @@`);
    for (const op of slice) lines.push((op.type === 'add' ? '+' : op.type === 'del' ? '-' : ' ') + op.text);
  }
  return lines.join('\n') + '\n';
}
