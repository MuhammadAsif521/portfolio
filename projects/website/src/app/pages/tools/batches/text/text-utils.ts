/**
 * Pure helpers shared by the text tools: line splitting, Unicode-aware grapheme handling (Intl.Segmenter where
 * the runtime has it, a regex fallback otherwise), a UTF-8 byte counter and small async utilities that keep the
 * UI responsive on large pastes. Nothing here touches window or document, so it is safe during SSR.
 */

/** Splits on CRLF, LF or a lone CR. An empty string gives [''] (one empty line), like String.split. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/** The line ending used most in a text: CRLF only when every line break is CRLF, otherwise LF. */
export function detectEol(text: string): '\r\n' | '\n' {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/\n/g) ?? []).length;
  return crlf > 0 && crlf === lf ? '\r\n' : '\n';
}

/** Number of UTF-8 bytes the text takes (what a .txt file or an HTTP body would weigh). */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      i++;
    } else bytes += 3; // BMP, or a lone surrogate (encoded as U+FFFD, 3 bytes)
  }
  return bytes;
}

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
}
type SegmenterCtor = new (locale?: string | string[], options?: { granularity: 'grapheme' | 'word' | 'sentence' }) => SegmenterLike;

function segmenterCtor(): SegmenterCtor | null {
  const ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  return typeof ctor === 'function' ? ctor : null;
}

/** True when the runtime has Intl.Segmenter (all current browsers and Node 16+). */
export const hasSegmenter = (): boolean => segmenterCtor() !== null;

let graphemeSegmenter: SegmenterLike | null | undefined;
const getGraphemeSegmenter = (): SegmenterLike | null => {
  if (graphemeSegmenter === undefined) {
    const Ctor = segmenterCtor();
    graphemeSegmenter = Ctor ? new Ctor(undefined, { granularity: 'grapheme' }) : null;
  }
  return graphemeSegmenter;
};

/** Test hook: forces the regex fallback (pass false) or restores Intl.Segmenter (pass true). */
export function setSegmenterEnabled(enabled: boolean): void {
  if (enabled) graphemeSegmenter = undefined;
  else graphemeSegmenter = null;
}

const EXTEND = '[\\p{M}\\u{1F3FB}-\\u{1F3FF}\\u{E0020}-\\u{E007F}]';
const FALLBACK_CLUSTER = new RegExp(
  `\\r\\n|[\\u{1F1E6}-\\u{1F1FF}]{2}|[\\s\\S]${EXTEND}*(?:\\u200d[\\s\\S]${EXTEND}*)*\\u200d?`,
  'gu',
);

/** Splits text into user-perceived characters: "é", family emoji, flags and CRLF are one each. */
export function graphemes(text: string): string[] {
  const seg = getGraphemeSegmenter();
  if (seg) return Array.from(seg.segment(text), (s) => s.segment);
  return text.match(FALLBACK_CLUSTER) ?? [];
}

/** Text made only of characters that can never join a cluster (no marks, ZWJ, surrogates, Hangul, Indic...). */
const SIMPLE = /^[\u0000-˿Ͱ-҂Ҋ-ԯ -‌‎-⃏℀-⯿]*$/;

function countCrlf(text: string): number {
  let n = 0;
  let i = text.indexOf('\r\n');
  while (i !== -1) {
    n++;
    i = text.indexOf('\r\n', i + 2);
  }
  return n;
}

/** Number of user-perceived characters. Fast path for plain Latin/Cyrillic/Greek text (length minus CRLF pairs). */
export function countGraphemes(text: string): number {
  if (SIMPLE.test(text)) return text.length - countCrlf(text);
  const seg = getGraphemeSegmenter();
  if (seg) {
    let n = 0;
    for (const _ of seg.segment(text)) n++;
    return n;
  }
  return graphemes(text).length;
}

/** Resolves on the next task so the browser can paint and handle input between chunks of work. */
export const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Cuts text into chunks of about `size` characters at points where no grapheme cluster can span the cut:
 * right after a line feed (a Control character always ends a cluster), else after a plain space that is
 * followed by an ordinary character. As a last resort the whole remainder is one chunk.
 */
export function chunkText(text: string, size = 200_000): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    if (text.length - start <= size) {
      chunks.push(text.slice(start));
      break;
    }
    let cut = text.indexOf('\n', start + size);
    if (cut === -1 || cut - start > size * 2) {
      cut = -1;
      for (let i = start + size; i < Math.min(text.length - 1, start + size * 2); i++) {
        if (text.charCodeAt(i) === 0x20 && text.charCodeAt(i + 1) < 0x300) {
          cut = i;
          break;
        }
      }
    }
    if (cut === -1) {
      chunks.push(text.slice(start));
      break;
    }
    chunks.push(text.slice(start, cut + 1));
    start = cut + 1;
  }
  return chunks;
}

/** Counts graphemes in chunks, yielding between them. Returns null when `cancelled()` becomes true. */
export async function countGraphemesAsync(text: string, cancelled: () => boolean = () => false, size = 200_000): Promise<number | null> {
  if (SIMPLE.test(text)) return text.length - countCrlf(text);
  let total = 0;
  for (const chunk of chunkText(text, size)) {
    if (cancelled()) return null;
    total += countGraphemes(chunk);
    await yieldToBrowser();
  }
  return cancelled() ? null : total;
}

let wordSegmenter: SegmenterLike | null | undefined;
/** Words of a run of text via Intl.Segmenter (needed for scripts written without spaces); null if unavailable. */
export function segmentWords(text: string): string[] | null {
  if (wordSegmenter === undefined) {
    const Ctor = segmenterCtor();
    wordSegmenter = Ctor ? new Ctor(undefined, { granularity: 'word' }) : null;
  }
  if (!wordSegmenter) return null;
  const out: string[] = [];
  for (const s of wordSegmenter.segment(text)) if (s.isWordLike) out.push(s.segment);
  return out;
}

/** Test hook mirroring setSegmenterEnabled for word segmentation. */
export function setWordSegmenterEnabled(enabled: boolean): void {
  wordSegmenter = enabled ? undefined : null;
}

/** Runs `fn` after `ms` of silence; returns a cancel function. Thin helper so debouncing stays testable. */
export function debounceTimer(ms: number): { run(fn: () => void): void; cancel(): void } {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    run(fn) {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    },
    cancel() {
      clearTimeout(t);
    },
  };
}

/** How long to wait after the last keystroke before recomputing: instant for small text, longer for huge text. */
export function debounceFor(length: number): number {
  if (length > 500_000) return 450;
  if (length > 100_000) return 250;
  if (length > 20_000) return 120;
  return 0;
}

/** Human readable file size. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
