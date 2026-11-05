import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_OPTIONS,
  DIGITS,
  LOWER,
  SIMILAR,
  UPPER,
  activePools,
  checkOptions,
  generatePassphrase,
  generatePassword,
  passphraseEntropyBits,
  passwordEntropyBits,
  randomInt,
  strengthLabel,
  type FillRandom,
  type PasswordOptions,
} from './password-logic';

/** A deterministic "random" source that replays the given 32-bit words, then repeats them. */
const replay = (words: number[]): FillRandom => {
  let i = 0;
  return (array) => {
    array[0] = words[i++ % words.length];
  };
};

/** xorshift32: a small seeded generator for statistical checks. */
const seeded = (seed: number): FillRandom => {
  let x = seed >>> 0 || 1;
  return (array) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    array[0] = x;
  };
};

const opts = (over: Partial<PasswordOptions> = {}): PasswordOptions => ({ ...DEFAULT_PASSWORD_OPTIONS, ...over });

describe('randomInt', () => {
  it('discards words in the biased tail (rejection sampling)', () => {
    // max 10: limit = floor(2^32 / 10) * 10 = 4294967290; words 4294967290..4294967295 must be rejected.
    expect(randomInt(10, replay([4294967295, 4294967290, 7]))).toBe(7);
    expect(randomInt(10, replay([4294967289]))).toBe(9);
  });

  it('stays in range and is roughly uniform', () => {
    const fill = seeded(12345);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[randomInt(6, fill)]++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it('handles 1 and rejects bad bounds', () => {
    expect(randomInt(1)).toBe(0);
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });
});

describe('generatePassword', () => {
  it('honours length and classes, and requireEach', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword(opts({ length: 8 }), seeded(i + 1));
      expect(pw).toHaveLength(8);
      expect(/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)).toBe(true);
    }
  });

  it('uses only ticked classes', () => {
    const pw = generatePassword(opts({ length: 64, upper: false, symbols: false, digits: true }));
    expect(pw).toMatch(/^[a-z0-9]{64}$/);
  });

  it('can exclude similar-looking and custom characters', () => {
    const pw = generatePassword(opts({ length: 128, excludeSimilar: true, exclude: 'abc' }));
    for (const c of SIMILAR + 'abc') expect(pw.includes(c)).toBe(false);
  });

  it('reports invalid settings', () => {
    expect(checkOptions(opts({ lower: false, upper: false, digits: false, symbols: false }))).toBe('no-classes');
    expect(checkOptions(opts({ length: 3 }))).toBe('length');
    expect(checkOptions(opts({ length: 129 }))).toBe('length');
    expect(checkOptions(opts({ length: 4 }))).toBeNull();
    expect(() => generatePassword(opts({ length: 3 }))).toThrow();
    // A class with every character excluded is dropped, not an error.
    expect(activePools(opts({ digits: true, exclude: DIGITS })).length).toBe(3);
  });

  it('two calls with the real RNG differ', () => {
    expect(generatePassword(opts({ length: 32 }))).not.toBe(generatePassword(opts({ length: 32 })));
  });
});

describe('entropy', () => {
  it('is length x log2(pool) without requireEach', () => {
    expect(passwordEntropyBits(opts({ length: 10, upper: false, digits: false, symbols: false, requireEach: false }))).toBeCloseTo(10 * Math.log2(26), 6);
    const all = opts({ length: 20, requireEach: false });
    const pool = LOWER.length + UPPER.length + DIGITS.length + 27;
    expect(passwordEntropyBits(all)).toBeCloseTo(20 * Math.log2(pool), 6);
  });

  it('counts requireEach exactly (4 classes, length 4: one of each, 4! orders)', () => {
    const bits = passwordEntropyBits(opts({ length: 4 }));
    expect(bits).toBeCloseTo(Math.log2(24 * 26 * 26 * 10 * 27), 6);
  });

  it('matches a brute-force count on a tiny alphabet', () => {
    // Pools {a,b} and {0,1}: strings of length 3 using both classes = 4^3 - 2^3 - 2^3 = 48.
    const tiny = opts({ length: 3, upper: false, symbols: false, exclude: 'cdefghijklmnopqrstuvwxyz23456789' });
    expect(passwordEntropyBits({ ...tiny, length: 4 })).toBeCloseTo(Math.log2(4 ** 4 - 2 * 2 ** 4), 6);
    let valid = 0;
    const chars = ['a', 'b', '0', '1'];
    for (const x of chars) for (const y of chars) for (const z of chars) {
      const s = x + y + z;
      if (/[ab]/.test(s) && /[01]/.test(s)) valid++;
    }
    expect(valid).toBe(48);
    expect(passwordEntropyBits({ ...tiny, length: 4 })).toBeGreaterThan(passwordEntropyBits({ ...tiny, length: 3 }));
  });

  it('stays finite for the longest password', () => {
    const bits = passwordEntropyBits(opts({ length: 128 }));
    expect(Number.isFinite(bits)).toBe(true);
    expect(bits).toBeGreaterThan(700);
  });

  it('maps bits to labels', () => {
    expect(strengthLabel(20)).toBe('very-weak');
    expect(strengthLabel(45)).toBe('weak');
    expect(strengthLabel(70)).toBe('fair');
    expect(strengthLabel(95)).toBe('strong');
    expect(strengthLabel(130)).toBe('very-strong');
  });
});

describe('passphrases', () => {
  const list = ['alpha', 'bravo', 'charlie', 'delta'];

  it('joins the chosen words and can capitalise or add a number', () => {
    expect(generatePassphrase({ words: 3, separator: '-', capitalize: false, addNumber: false }, list, replay([0, 1, 2]))).toBe('alpha-bravo-charlie');
    expect(generatePassphrase({ words: 3, separator: ' ', capitalize: true, addNumber: false }, list, replay([3, 3, 0]))).toBe('Delta Delta Alpha');
    const withNumber = generatePassphrase({ words: 3, separator: '-', capitalize: false, addNumber: true }, list, seeded(9));
    expect(withNumber).toMatch(/\d/);
  });

  it('rejects bad word counts', () => {
    expect(() => generatePassphrase({ words: 2, separator: '-', capitalize: false, addNumber: false }, list)).toThrow();
    expect(() => generatePassphrase({ words: 13, separator: '-', capitalize: false, addNumber: false }, list)).toThrow();
  });

  it('computes entropy as words x log2(list size)', () => {
    expect(passphraseEntropyBits({ words: 6, separator: '-', capitalize: false, addNumber: false }, 7776)).toBeCloseTo(77.55, 2);
    expect(passphraseEntropyBits({ words: 4, separator: '-', capitalize: true, addNumber: false }, 7776)).toBeCloseTo(51.7, 1);
    expect(passphraseEntropyBits({ words: 4, separator: '-', capitalize: false, addNumber: true }, 1024)).toBeCloseTo(40 + Math.log2(10) + 2, 6);
  });

  it('the bundled EFF list has 7,776 unique words', async () => {
    const { EFF_LARGE_WORDLIST } = await import('./eff-wordlist');
    expect(EFF_LARGE_WORDLIST).toHaveLength(7776);
    expect(new Set(EFF_LARGE_WORDLIST).size).toBe(7776);
    expect(EFF_LARGE_WORDLIST[0]).toBe('abacus');
    expect(EFF_LARGE_WORDLIST[7775]).toBe('zoom');
  });
});
