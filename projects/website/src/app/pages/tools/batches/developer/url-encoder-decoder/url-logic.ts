/** URL encoding, decoding, parsing and punycode helpers. Everything is synchronous and DOM-free. */

export type EncodeMode = 'component' | 'uri' | 'form';

export type EncodeResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * component: encodeURIComponent (escapes everything except A-Z a-z 0-9 - _ . ! ~ * ' ( )).
 * uri: encodeURI (keeps ; , / ? : @ & = + $ # so a whole URL stays a URL).
 * form: application/x-www-form-urlencoded as the WHATWG URL standard defines it: spaces become +, and only
 * A-Z a-z 0-9 * - . _ stay unescaped.
 */
export function encodeText(input: string, mode: EncodeMode): EncodeResult {
  try {
    if (mode === 'uri') return { ok: true, text: encodeURI(input) };
    if (mode === 'component') return { ok: true, text: encodeURIComponent(input) };
    if (hasLoneSurrogate(input)) throw new URIError('lone surrogate');
    return { ok: true, text: new URLSearchParams([['', input]]).toString().slice(1) };
  } catch {
    return { ok: false, error: 'This text contains a lone UTF-16 surrogate (half of an emoji or other broken character), which has no valid UTF-8 form. Remove or replace it.' };
  }
}

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
      else return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

export interface MalformedSequence {
  /** Zero-based index in the input. */
  index: number;
  /** The offending text, e.g. "%G1" or "%E9". */
  sequence: string;
  reason: string;
}

/** Finds the first percent-escape problem: a % without two hex digits, or bytes that are not valid UTF-8. */
export function findMalformed(input: string): MalformedSequence | null {
  const bad = /%(?![0-9a-fA-F]{2})/.exec(input);
  if (bad) {
    return {
      index: bad.index,
      sequence: input.slice(bad.index, bad.index + 3),
      reason: '"%" must be followed by two hexadecimal digits. If it is a literal percent sign, write it as %25.',
    };
  }
  // Runs of valid escapes: decode each run on its own to see where the UTF-8 breaks.
  const run = /(?:%[0-9a-fA-F]{2})+/g;
  for (let m = run.exec(input); m; m = run.exec(input)) {
    try {
      decodeURIComponent(m[0]);
    } catch {
      const at = firstBadByte(m[0]);
      return {
        index: m.index + at,
        sequence: m[0].slice(at, at + 3),
        reason: 'These bytes are not valid UTF-8. The text was probably encoded in another character set (such as Latin-1 or Windows-1252), which uses %E9 for "é" instead of %C3%A9.',
      };
    }
  }
  return null;
}

/** Index (in characters) of the first escape in a run of %XX groups where UTF-8 decoding fails. */
function firstBadByte(run: string): number {
  const bytes = run.match(/%[0-9a-fA-F]{2}/g) ?? [];
  let i = 0;
  while (i < bytes.length) {
    const first = parseInt(bytes[i].slice(1), 16);
    const len = first < 0x80 ? 1 : first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
    if (len === 0 || i + len > bytes.length) return i * 3;
    try {
      decodeURIComponent(bytes.slice(i, i + len).join(''));
    } catch {
      return i * 3;
    }
    i += len;
  }
  return 0;
}

export type DecodeResult = { ok: true; text: string } | { ok: false; error: string; at: MalformedSequence | null };

export function decodeText(input: string, mode: EncodeMode): DecodeResult {
  const source = mode === 'form' ? input.replace(/\+/g, ' ') : input;
  try {
    return { ok: true, text: mode === 'uri' ? decodeURI(source) : decodeURIComponent(source) };
  } catch {
    const at = findMalformed(source);
    const where = at ? ` at position ${at.index + 1} ("${at.sequence}")` : '';
    return { ok: false, at, error: `Malformed percent-encoding${where}. ${at?.reason ?? ''}`.trim() };
  }
}

/** Decodes each valid %XX run and leaves anything malformed untouched, so a half-broken URL is still readable. */
export function decodeLenient(input: string, mode: EncodeMode = 'component'): string {
  const source = mode === 'form' ? input.replace(/\+/g, ' ') : input;
  return source.replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
    try {
      return mode === 'uri' ? decodeURI(run) : decodeURIComponent(run);
    } catch {
      // Decode what decodes: go escape by escape and keep the invalid ones.
      return run.replace(/%[0-9a-fA-F]{2}/g, (one) => {
        try {
          return decodeURIComponent(one);
        } catch {
          return one;
        }
      });
    }
  });
}

export interface DoubleEncoding {
  /** How many times decoding changes the text before it settles (1 means normally encoded, 2+ means encoded again). */
  layers: number;
  steps: string[];
  /** True when the input looks encoded more than once, e.g. %2520 or %253A. */
  suspicious: boolean;
}

/**
 * Detects text that was percent-encoded more than once. "%2520" is "%20" with its percent sign encoded.
 * A bare "%25" at the end of ordinary text (a literal percent sign) is not flagged.
 */
export function detectDoubleEncoding(input: string): DoubleEncoding {
  const steps = [input];
  let current = input;
  for (let i = 0; i < 5; i++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      break;
    }
    if (next === current) break;
    steps.push(next);
    current = next;
  }
  const layers = steps.length - 1;
  return { layers, steps, suspicious: /%25[0-9a-fA-F]{2}/i.test(input) && layers >= 2 };
}

// Punycode (RFC 3492) -----------------------------------------------------------------------------------------------

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function adapt(delta: number, numPoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * delta) / (delta + SKEW));
}

const digitToCode = (d: number): number => d + 22 + 75 * Number(d < 26);

/** Decodes one punycode label body (the part after "xn--"). Returns null if it is not valid punycode. */
export function punycodeDecode(input: string): string | null {
  const output: number[] = [];
  const basic = input.lastIndexOf('-');
  for (let j = 0; j < Math.max(basic, 0); j++) {
    const code = input.charCodeAt(j);
    if (code >= 0x80) return null;
    output.push(code);
  }
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length; ) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= input.length) return null;
      const code = input.charCodeAt(index++);
      const digit =
        code >= 48 && code <= 57 ? code - 22 : code >= 65 && code <= 90 ? code - 65 : code >= 97 && code <= 122 ? code - 97 : BASE;
      if (digit >= BASE) return null;
      i += digit * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    n += Math.floor(i / out);
    i %= out;
    if (n > 0x10ffff) return null;
    output.splice(i++, 0, n);
  }
  try {
    return String.fromCodePoint(...output);
  } catch {
    return null;
  }
}

/** Encodes a Unicode label to punycode (without the xn-- prefix). */
export function punycodeEncode(input: string): string {
  const codePoints = Array.from(input, (c) => c.codePointAt(0)!);
  const output: string[] = codePoints.filter((c) => c < 0x80).map((c) => String.fromCharCode(c));
  const basicLength = output.length;
  let handled = basicLength;
  if (basicLength) output.push('-');
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  while (handled < codePoints.length) {
    const m = Math.min(...codePoints.filter((c) => c >= n));
    delta += (m - n) * (handled + 1);
    n = m;
    for (const c of codePoints) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
          if (q < t) break;
          output.push(String.fromCharCode(digitToCode(t + ((q - t) % (BASE - t)))));
          q = Math.floor((q - t) / (BASE - t));
        }
        output.push(String.fromCharCode(digitToCode(q)));
        bias = adapt(delta, handled + 1, handled === basicLength);
        delta = 0;
        handled++;
      }
    }
    delta++;
    n++;
  }
  return output.join('');
}

/** Converts a hostname with xn-- labels to Unicode for display (labels that fail to decode are kept as they are). */
export function hostToUnicode(hostname: string): string {
  return hostname
    .split('.')
    .map((label) => (label.toLowerCase().startsWith('xn--') ? (punycodeDecode(label.slice(4)) ?? label) : label))
    .join('.');
}

// URL parsing --------------------------------------------------------------------------------------------------------

export interface QueryParam {
  key: string;
  value: string;
}

export interface ParsedUrl {
  href: string;
  protocol: string;
  username: string;
  password: string;
  /** ASCII form as the URL API normalises it (punycode for international names). */
  hostname: string;
  /** Unicode form for display. */
  unicodeHost: string;
  isInternational: boolean;
  port: string;
  pathname: string;
  hash: string;
  origin: string;
  params: QueryParam[];
}

export type ParseUrlResult = { ok: true; url: ParsedUrl } | { ok: false; error: string };

export function parseUrl(input: string): ParseUrlResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter a URL.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    // A bare "example.com/path" has no scheme: say so instead of guessing silently.
    return { ok: false, error: /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(text) ? 'This URL has no scheme. Add https:// in front of it.' : 'This is not a valid absolute URL.' };
  }
  const unicodeHost = hostToUnicode(url.hostname);
  return {
    ok: true,
    url: {
      href: url.href,
      protocol: url.protocol,
      username: decodeLenient(url.username),
      password: decodeLenient(url.password),
      hostname: url.hostname,
      unicodeHost,
      isInternational: unicodeHost !== url.hostname,
      port: url.port,
      pathname: url.pathname,
      hash: url.hash,
      origin: url.origin,
      params: Array.from(url.searchParams, ([key, value]) => ({ key, value })),
    },
  };
}

/** Rebuilds a URL after the query parameters were edited. Parameters are written in form encoding (spaces as +). */
export function rebuildUrl(href: string, params: QueryParam[]): string | null {
  try {
    const url = new URL(href);
    const search = new URLSearchParams();
    for (const { key, value } of params) if (key !== '' || value !== '') search.append(key, value);
    url.search = search.toString();
    return url.href;
  } catch {
    return null;
  }
}
