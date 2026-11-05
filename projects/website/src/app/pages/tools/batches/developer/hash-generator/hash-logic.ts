/** Pure hashing helpers: MD5 (spark-md5), SHA-1/256/384/512 (Web Crypto), HMAC for all five, digest comparison. */

export type HashAlgo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
export const HASH_ALGOS: readonly HashAlgo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

/** HMAC block size in bytes (RFC 2104): 64 for MD5, SHA-1 and SHA-256; 128 for SHA-384 and SHA-512. */
export const blockSize = (algo: HashAlgo): number => (algo === 'SHA-384' || algo === 'SHA-512' ? 128 : 64);

/** Largest message hashed in one go (SHA via Web Crypto needs the whole message in memory). */
export const MAX_HASH_BYTES = 512 * 1024 * 1024;
const MD5_CHUNK = 1024 * 1024;

export function bytesToHex(bytes: Uint8Array, upper = false): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return upper ? out.toUpperCase() : out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Parses hex (spaces, colons and a 0x prefix are tolerated). Returns null when it is not whole bytes of hex. */
export function hexToBytes(input: string): Uint8Array | null {
  const hex = input.replace(/^0x/i, '').replace(/[\s:]/g, '');
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Compares two strings in time that depends only on their length, not on where they first differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type CompareResult = 'empty' | 'hex' | 'base64' | 'mismatch';

/** Checks a pasted expected digest against a computed one, as hex (any case, colons allowed) or Base64. */
export function compareDigest(expected: string, actual: Uint8Array): CompareResult {
  const text = expected.trim();
  if (!text) return 'empty';
  const hex = text.replace(/[\s:]/g, '').toLowerCase();
  if (constantTimeEqual(hex, bytesToHex(actual))) return 'hex';
  const b64 = text.replace(/\s/g, '');
  const normalise = (s: string) => s.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (constantTimeEqual(normalise(b64), normalise(bytesToBase64(actual)))) return 'base64';
  return 'mismatch';
}

interface SparkHasher {
  append(buf: ArrayBuffer): unknown;
  end(raw: boolean): string;
}
type SparkModule = { ArrayBuffer: new () => SparkHasher };

async function loadSpark(): Promise<SparkModule> {
  const mod = (await import('spark-md5')) as unknown as { default?: SparkModule } & SparkModule;
  return mod.default ?? mod;
}

const binaryToBytes = (binary: string): Uint8Array => Uint8Array.from(binary, (c) => c.charCodeAt(0));
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const toBuffer = (part: Uint8Array): ArrayBuffer => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;

/**
 * MD5 in 4 MB chunks (spark-md5 is incremental), yielding between chunks so a big file never freezes the page.
 * `prefix` is hashed first (used for the HMAC inner pad).
 */
export async function md5(data: Uint8Array, onProgress?: (fraction: number) => void, prefix?: Uint8Array): Promise<Uint8Array> {
  const Spark = await loadSpark();
  const hasher = new Spark.ArrayBuffer();
  if (prefix) hasher.append(toBuffer(prefix));
  for (let offset = 0; offset < data.length; offset += MD5_CHUNK) {
    hasher.append(toBuffer(data.subarray(offset, Math.min(offset + MD5_CHUNK, data.length))));
    onProgress?.(Math.min(1, (offset + MD5_CHUNK) / data.length));
    if (data.length > MD5_CHUNK) await tick();
  }
  return binaryToBytes(hasher.end(true));
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser does not provide Web Crypto here. Open the page over HTTPS or localhost.');
  return s;
}

/** Hashes `data` with one algorithm. */
export async function digest(algo: HashAlgo, data: Uint8Array, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
  if (algo === 'MD5') return md5(data, onProgress);
  return new Uint8Array(await subtle().digest(algo, toBuffer(data)));
}

/** HMAC (RFC 2104) with the given key. MD5 is built by hand because Web Crypto has no MD5; SHA uses native HMAC. */
export async function hmac(algo: HashAlgo, key: Uint8Array, data: Uint8Array, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
  if (algo !== 'MD5') {
    const cryptoKey = await subtle().importKey('raw', toBuffer(key), { name: 'HMAC', hash: algo }, false, ['sign']);
    return new Uint8Array(await subtle().sign('HMAC', cryptoKey, toBuffer(data)));
  }
  const size = blockSize(algo);
  const k = key.length > size ? await md5(key) : key;
  const ipad = new Uint8Array(size).fill(0x36);
  const opad = new Uint8Array(size).fill(0x5c);
  k.forEach((byte, i) => {
    ipad[i] ^= byte;
    opad[i] ^= byte;
  });
  const inner = await md5(data, onProgress, ipad);
  return md5(inner, undefined, opad);
}

export interface HashRequest {
  data: Uint8Array;
  /** When set, results are HMACs under this key. */
  key?: Uint8Array;
  algos?: readonly HashAlgo[];
  onProgress?: (algo: HashAlgo, fraction: number) => void;
}

export interface HashOutcome {
  algo: HashAlgo;
  bytes: Uint8Array;
}

/** Computes every requested algorithm for one message. */
export async function hashAll(req: HashRequest): Promise<HashOutcome[]> {
  const out: HashOutcome[] = [];
  for (const algo of req.algos ?? HASH_ALGOS) {
    const progress = (f: number) => req.onProgress?.(algo, f);
    const bytes = req.key ? await hmac(algo, req.key, req.data, progress) : await digest(algo, req.data, progress);
    progress(1);
    out.push({ algo, bytes });
  }
  return out;
}

/** Reads a File into one buffer in 8 MB slices (so progress can be shown and the page stays responsive). */
export async function readFileBytes(file: Blob, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
  const out = new Uint8Array(file.size);
  const slice = 8 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += slice) {
    const part = new Uint8Array(await file.slice(offset, offset + slice).arrayBuffer());
    out.set(part, offset);
    onProgress?.(Math.min(1, (offset + slice) / file.size));
    await tick();
  }
  return out;
}
