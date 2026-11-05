/** Pure logic for the second batch of tools. No DOM, no network: testable and SSR-safe. */

// ── Epoch ────────────────────────────────────────────────────────────────────

export interface EpochInfo {
  ms: number;
  seconds: number;
  iso: string;
  /** How the input was read. */
  unit: 'seconds' | 'milliseconds' | 'date';
}

/** A number (seconds below 13 digits, else milliseconds) or a date string → the instant in every form. */
export function parseEpoch(input: string): EpochInfo | null {
  const value = input.trim();
  if (!value) return null;
  let ms: number;
  let unit: EpochInfo['unit'];
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    const digits = value.replace(/^-/, '').split('.')[0].length;
    unit = digits >= 13 ? 'milliseconds' : 'seconds';
    ms = unit === 'milliseconds' ? n : n * 1000;
  } else {
    ms = Date.parse(value);
    unit = 'date';
  }
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return null;
  const date = new Date(ms);
  return { ms: Math.trunc(ms), seconds: Math.floor(ms / 1000), iso: date.toISOString(), unit };
}

/** "3 days ago", "in 2 hours". */
export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(diff) >= size || unit === 'second') return rtf.format(Math.round(diff / size), unit);
  }
  return '';
}

// ── Base64 ───────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export const toUrlSafe = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** UTF-8 text → Base64 (or Base64url without padding). */
export function encodeBase64(text: string, urlSafe = false): string {
  const b64 = bytesToBase64(new TextEncoder().encode(text));
  return urlSafe ? toUrlSafe(b64) : b64;
}

export function encodeBytes(bytes: Uint8Array, urlSafe = false): string {
  const b64 = bytesToBase64(bytes);
  return urlSafe ? toUrlSafe(b64) : b64;
}

/** Base64 or Base64url (padding optional, whitespace ignored) → UTF-8 text. */
export function decodeBase64(input: string): { ok: true; text: string } | { ok: false; error: string } | null {
  const clean = input.replace(/\s+/g, '');
  if (!clean) return null;
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(clean)) return { ok: false, error: 'Not Base64: only A-Z, a-z, 0-9, +, /, -, _ and = padding are allowed.' };
  const standard = clean.replace(/-/g, '+').replace(/_/g, '/');
  if (standard.replace(/=+$/, '').length % 4 === 1) return { ok: false, error: 'The Base64 string has an invalid length (one character too many or too few).' };
  try {
    const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: 'Decoded bytes are not valid UTF-8 text (this may be binary data such as an image).' };
  }
}

// ── UUID ─────────────────────────────────────────────────────────────────────

type Bytes = Uint8Array<ArrayBuffer>;

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const format = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

export function uuidV4(random: (bytes: Bytes) => Bytes = (b) => crypto.getRandomValues(b)): string {
  const b = random(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(hex(b));
}

/**
 * UUID v7 (RFC 9562): 48-bit Unix ms timestamp, version 7, 12-bit counter seeded randomly per millisecond
 * (keeps values from the same millisecond in order), variant 10, 62 random bits.
 */
export function createUuidV7Generator(
  now: () => number = Date.now,
  random: (bytes: Bytes) => Bytes = (b) => crypto.getRandomValues(b),
): () => string {
  let lastMs = -1;
  let counter = 0;
  return () => {
    let ms = now();
    if (ms <= lastMs) {
      ms = lastMs;
      counter++;
      if (counter > 0xfff) {
        ms = ++lastMs; // counter exhausted: borrow the next millisecond
        counter = 0;
      }
    } else {
      counter = random(new Uint8Array(2)).reduce((a, b) => (a << 8) | b, 0) & 0x7ff; // headroom to increment
    }
    lastMs = ms;
    const b = random(new Uint8Array(16));
    const t = BigInt(ms);
    for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 0xffn);
    b[6] = 0x70 | ((counter >> 8) & 0x0f);
    b[7] = counter & 0xff;
    b[8] = (b[8] & 0x3f) | 0x80;
    return format(hex(b));
  };
}

export interface UuidInfo {
  version: number;
  variant: string;
  /** v7 (and v1/v6 are not decoded): creation time. */
  createdAt?: string;
}

export function inspectUuid(input: string): UuidInfo | null {
  const v = input.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) return null;
  const version = parseInt(v[14], 16);
  const variantNibble = parseInt(v[19], 16);
  const variant = variantNibble >= 8 && variantNibble <= 0xb ? 'RFC 9562' : variantNibble < 8 ? 'NCS (legacy)' : 'Microsoft / reserved';
  const info: UuidInfo = { version, variant };
  if (version === 7) info.createdAt = new Date(parseInt(v.replace(/-/g, '').slice(0, 12), 16)).toISOString();
  return info;
}

// ── JSON formatter ───────────────────────────────────────────────────────────

export type JsonFormat = { indent: number | '\t' | 'minify'; sortKeys: boolean };

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Line/column of a JSON.parse error, from "line X column Y" or "position N" in the engine message. */
export function jsonErrorLocation(source: string, message: string): { line: number; column: number } | null {
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  const pos = /position (\d+)/i.exec(message);
  if (!pos) return /unexpected end/i.test(message) ? locate(source, source.length) : null;
  return locate(source, Number(pos[1]));
}

function locate(source: string, index: number) {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return { line, column };
}

export function formatJson(
  source: string,
  options: JsonFormat = { indent: 2, sortKeys: false },
):
  | { ok: true; code: string; stats: { bytes: number; keys: number } }
  | { ok: false; error: string; line?: number; column?: number; snippet?: string }
  | null {
  if (!source.trim()) return null;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const message = (error as Error).message;
    const at = jsonErrorLocation(source, message);
    const snippet = at ? source.split('\n')[at.line - 1] : undefined;
    return { ok: false, error: message.replace(/\s*\(line \d+ column \d+\)/i, ''), ...at, snippet };
  }
  const data = options.sortKeys ? sortDeep(value) : value;
  const code = options.indent === 'minify' ? JSON.stringify(data) : JSON.stringify(data, null, options.indent);
  let keys = 0;
  const count = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(count);
    else if (v && typeof v === 'object') for (const [, inner] of Object.entries(v)) (keys++, count(inner));
  };
  count(value);
  return { ok: true, code, stats: { bytes: new TextEncoder().encode(code).length, keys } };
}

// ── Regex (runs inside a worker; this is the worker's logic) ─────────────────

export interface RegexMatch {
  index: number;
  text: string;
  groups: { name: string; value: string | undefined }[];
}

export interface RegexResult {
  matches: RegexMatch[];
  replaced: string | null;
  truncated: boolean;
}

export const MAX_MATCHES = 1000;

export function runRegex(pattern: string, flags: string, text: string, replacement: string | null): RegexResult {
  const re = new RegExp(pattern, flags);
  const matches: RegexMatch[] = [];
  let truncated = false;
  const toMatch = (m: RegExpExecArray): RegexMatch => ({
    index: m.index,
    text: m[0],
    groups: [
      ...m.slice(1).map((value, i) => ({ name: String(i + 1), value })),
      ...Object.entries(m.groups ?? {}).map(([name, value]) => ({ name, value })),
    ],
  });
  if (re.global || re.sticky) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      matches.push(toMatch(m));
      if (m[0] === '') re.lastIndex++; // never loop on empty matches
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
      if (!re.global) break;
    }
  } else {
    const m = re.exec(text);
    if (m) matches.push(toMatch(m));
  }
  const replaced = replacement === null ? null : text.replace(new RegExp(pattern, flags), replacement);
  return { matches, replaced, truncated };
}

/** Text split into plain and matched segments, for highlighting. */
export function highlightSegments(text: string, matches: RegexMatch[]): { text: string; match: boolean }[] {
  const out: { text: string; match: boolean }[] = [];
  let at = 0;
  for (const m of matches) {
    if (!m.text) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index), match: false });
    if (m.index >= at) out.push({ text: m.text, match: true });
    at = Math.max(at, m.index + m.text.length);
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false });
  return out;
}

// ── WAV encoder ──────────────────────────────────────────────────────────────

/** 16-bit PCM WAV from planar float samples (-1..1). */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const count = channels.length;
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * count * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true); // byte rate
  view.setUint16(32, count * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

/** Bytes → "12.3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
