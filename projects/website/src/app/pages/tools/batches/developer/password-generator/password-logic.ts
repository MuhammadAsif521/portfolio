/**
 * Password and passphrase generation. All randomness comes from crypto.getRandomValues, and every pick uses
 * rejection sampling so no character is more likely than another (no modulo bias).
 */

export type FillRandom = (array: Uint32Array<ArrayBuffer>) => void;

export const defaultRandom: FillRandom = (array) => {
  globalThis.crypto.getRandomValues(array);
};

/**
 * A uniform integer in [0, max) from 32-bit random words. Words at or above the largest multiple of `max`
 * that fits in 2^32 are thrown away, which is what removes the modulo bias.
 */
export function randomInt(max: number, fill: FillRandom = defaultRandom): number {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('max must be an integer from 1 to 2^32');
  if (max === 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const word = new Uint32Array(1);
  for (;;) {
    fill(word);
    if (word[0] < limit) return word[0] % max;
  }
}

export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';
export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~';
/** Characters that are easy to misread in many fonts. */
export const SIMILAR = 'iIlL1oO0|';

export type ClassKey = 'lower' | 'upper' | 'digits' | 'symbols';
export const CLASS_CHARS: Record<ClassKey, string> = { lower: LOWER, upper: UPPER, digits: DIGITS, symbols: SYMBOLS };

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop characters from SIMILAR (i I l L 1 o O 0 |). */
  excludeSimilar: boolean;
  /** Extra characters to leave out. */
  exclude: string;
  /** Guarantee at least one character from every ticked class. */
  requireEach: boolean;
}

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeSimilar: false,
  exclude: '',
  requireEach: true,
};

/** The usable characters of each ticked class after exclusions, de-duplicated. */
export function activePools(opts: PasswordOptions): string[][] {
  const removed = new Set((opts.excludeSimilar ? SIMILAR : '') + opts.exclude);
  const pools: string[][] = [];
  for (const key of Object.keys(CLASS_CHARS) as ClassKey[]) {
    if (!opts[key]) continue;
    const chars = [...new Set(CLASS_CHARS[key])].filter((c) => !removed.has(c));
    if (chars.length) pools.push(chars);
  }
  return pools;
}

export type PasswordProblem = 'no-classes' | 'length' | 'require-each';

export function checkOptions(opts: PasswordOptions): PasswordProblem | null {
  const pools = activePools(opts);
  if (!pools.length) return 'no-classes';
  if (!Number.isInteger(opts.length) || opts.length < MIN_LENGTH || opts.length > MAX_LENGTH) return 'length';
  if (opts.requireEach && opts.length < pools.length) return 'require-each';
  return null;
}

/**
 * One password. Characters are drawn uniformly from the combined pool; with `requireEach` a draw that misses a
 * ticked class is discarded and redrawn, so the result is uniform over all valid passwords (a "pick one of each
 * class, then fill" shortcut would not be).
 */
export function generatePassword(opts: PasswordOptions, fill: FillRandom = defaultRandom): string {
  const problem = checkOptions(opts);
  if (problem) throw new RangeError(`Invalid options: ${problem}`);
  const pools = activePools(opts);
  const all = pools.flat();
  for (let attempt = 0; attempt < 10_000; attempt++) {
    let out = '';
    for (let i = 0; i < opts.length; i++) out += all[randomInt(all.length, fill)];
    if (!opts.requireEach || pools.every((pool) => pool.some((c) => out.includes(c)))) return out;
  }
  throw new Error('Could not satisfy the character rules; try a longer password or fewer classes.');
}

/**
 * log2 of the number of distinct passwords this generator can produce.
 * Without requireEach it is length x log2(pool size). With requireEach the passwords that miss a class are
 * removed, counted exactly by inclusion-exclusion over the classes.
 */
export function passwordEntropyBits(opts: PasswordOptions): number {
  const pools = activePools(opts);
  if (!pools.length || checkOptions(opts) === 'length') return 0;
  const total = pools.reduce((sum, p) => sum + p.length, 0);
  const plain = opts.length * Math.log2(total);
  if (!opts.requireEach || pools.length < 2) return plain;
  // count = sum over subsets S of classes of (-1)^|S| * (total - size(S))^length, done as sums of exp in log space.
  const n = pools.length;
  const terms: { sign: number; exp: number }[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    let size = 0;
    let bits = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        size += pools[i].length;
        bits++;
      }
    }
    const base = total - size;
    if (base <= 0) continue;
    terms.push({ sign: bits % 2 ? -1 : 1, exp: opts.length * Math.log2(base) });
  }
  // Largest term is the full pool; factor it out to avoid overflow for long passwords.
  const top = terms[0].exp;
  const sum = terms.reduce((acc, t) => acc + t.sign * 2 ** (t.exp - top), 0);
  return sum > 0 ? top + Math.log2(sum) : 0;
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  /** Append one random digit to a random word. */
  addNumber: boolean;
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = { words: 6, separator: '-', capitalize: false, addNumber: false };
export const MIN_WORDS = 3;
export const MAX_WORDS = 12;

export function generatePassphrase(opts: PassphraseOptions, list: readonly string[], fill: FillRandom = defaultRandom): string {
  if (!Number.isInteger(opts.words) || opts.words < MIN_WORDS || opts.words > MAX_WORDS) throw new RangeError('words out of range');
  if (list.length < 2) throw new RangeError('word list is empty');
  const picked: string[] = [];
  for (let i = 0; i < opts.words; i++) {
    const w = list[randomInt(list.length, fill)];
    picked.push(opts.capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  }
  if (opts.addNumber) {
    const at = randomInt(picked.length, fill);
    picked[at] += String(randomInt(10, fill));
  }
  return picked.join(opts.separator);
}

/** log2 of the guess space of a passphrase built from `listSize` words (+ one digit and its position when added). */
export function passphraseEntropyBits(opts: PassphraseOptions, listSize: number): number {
  const base = opts.words * Math.log2(listSize);
  return opts.addNumber ? base + Math.log2(10) + Math.log2(opts.words) : base;
}

export type Strength = 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';

/** Labels from the entropy of the generator, not from a guessed attacker speed. */
export function strengthLabel(bits: number): Strength {
  if (bits < 40) return 'very-weak';
  if (bits < 60) return 'weak';
  if (bits < 80) return 'fair';
  if (bits < 110) return 'strong';
  return 'very-strong';
}
