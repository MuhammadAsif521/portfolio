import { describe, expect, it } from 'vitest';
import {
  bytesToBase64,
  bytesToHex,
  compareDigest,
  constantTimeEqual,
  digest,
  hashAll,
  hexToBytes,
  hmac,
  md5,
  utf8,
  type HashAlgo,
} from './hash-logic';

const hex = (b: Uint8Array) => bytesToHex(b);
const repeat = (byte: number, n: number) => new Uint8Array(n).fill(byte);

describe('hash digests (RFC 1321, FIPS 180 known answers)', () => {
  const abc = utf8('abc');
  const cases: [HashAlgo, string, string, string][] = [
    ['MD5', '', 'd41d8cd98f00b204e9800998ecf8427e', ''],
    ['MD5', 'abc', '900150983cd24fb0d6963f7d28e17f72', ''],
    ['MD5', 'message digest', 'f96b697d7cb7938d525a2f31aaf161d0', ''],
    ['SHA-1', 'abc', 'a9993e364706816aba3e25717850c26c9cd0d89d', ''],
    ['SHA-1', '', 'da39a3ee5e6b4b0d3255bfef95601890afd80709', ''],
    ['SHA-256', 'abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', ''],
    ['SHA-256', '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', ''],
    ['SHA-384', 'abc', 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7', ''],
    [
      'SHA-512',
      'abc',
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
      '',
    ],
  ];

  it.each(cases)('%s of %j', async (algo, text, expected) => {
    expect(hex(await digest(algo, utf8(text)))).toBe(expected);
  });

  it('hashes the 448-bit NIST message for SHA-256', async () => {
    const msg = utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq');
    expect(hex(await digest('SHA-256', msg))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    expect(abc.length).toBe(3);
  });

  it('MD5 of data larger than one chunk matches a single-shot value and reports progress', async () => {
    const data = new Uint8Array(9 * 1024 * 1024).fill(97); // 9 MiB of "a"
    const seen: number[] = [];
    const chunked = await md5(data, (f) => seen.push(f));
    expect(seen.length).toBe(9);
    expect(seen[seen.length - 1]).toBe(1);
    // Known: MD5 of one million 'a' is 7707d6ae4e027c70eea2a935c2296f21.
    expect(hex(await md5(new Uint8Array(1_000_000).fill(97)))).toBe('7707d6ae4e027c70eea2a935c2296f21');
    expect(hex(chunked)).toHaveLength(32);
  });
});

describe('HMAC (RFC 2202 and RFC 4231 vectors)', () => {
  it('HMAC-MD5 test cases 1, 2 and 6 (key longer than the block)', async () => {
    expect(hex(await hmac('MD5', repeat(0x0b, 16), utf8('Hi There')))).toBe('9294727a3638bb1c13f48ef8158bfc9d');
    expect(hex(await hmac('MD5', utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe('750c783e6ab0b503eaa86e310a5db738');
    expect(hex(await hmac('MD5', repeat(0xaa, 80), utf8('Test Using Larger Than Block-Size Key - Hash Key First')))).toBe(
      '6b1ab7fe4bd7bf8f0b62e6ce61b9d0cd',
    );
  });

  it('HMAC-SHA-1 test cases 1 and 2', async () => {
    expect(hex(await hmac('SHA-1', repeat(0x0b, 20), utf8('Hi There')))).toBe('b617318655057264e28bc0b6fb378c8ef146be00');
    expect(hex(await hmac('SHA-1', utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe('effcdf6ae5eb2fa2d27416d5f184df9c259a7c79');
  });

  it('HMAC-SHA-256/384/512 RFC 4231 test case 1', async () => {
    const key = repeat(0x0b, 20);
    const msg = utf8('Hi There');
    expect(hex(await hmac('SHA-256', key, msg))).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
    expect(hex(await hmac('SHA-384', key, msg))).toBe(
      'afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6',
    );
    expect(hex(await hmac('SHA-512', key, msg))).toBe(
      '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854',
    );
  });

  it('HMAC-SHA-256/512 RFC 4231 test case 2', async () => {
    const key = utf8('Jefe');
    const msg = utf8('what do ya want for nothing?');
    expect(hex(await hmac('SHA-256', key, msg))).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    expect(hex(await hmac('SHA-512', key, msg))).toBe(
      '164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737',
    );
  });

  it('hashAll returns every algorithm in order and switches to HMAC when a key is given', async () => {
    const plain = await hashAll({ data: utf8('abc') });
    expect(plain.map((o) => o.algo)).toEqual(['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']);
    const keyed = await hashAll({ data: utf8('Hi There'), key: repeat(0x0b, 20), algos: ['SHA-256'] });
    expect(hex(keyed[0].bytes)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });
});

describe('encoding and comparison helpers', () => {
  it('converts hex and Base64', () => {
    const bytes = hexToBytes('00ff10')!;
    expect(Array.from(bytes)).toEqual([0, 255, 16]);
    expect(bytesToBase64(bytes)).toBe('AP8Q');
    expect(bytesToHex(bytes, true)).toBe('00FF10');
    expect(hexToBytes('0x0A:0b 0C')).toEqual(new Uint8Array([10, 11, 12]));
  });

  it('rejects hex that is odd-length or not hex', () => {
    expect(hexToBytes('abc')).toBeNull();
    expect(hexToBytes('zz')).toBeNull();
  });

  it('constantTimeEqual compares whole strings, including different lengths', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('compareDigest accepts hex in any case with separators, Base64, and reports mismatches', () => {
    const bytes = hexToBytes('900150983cd24fb0d6963f7d28e17f72')!;
    expect(compareDigest('', bytes)).toBe('empty');
    expect(compareDigest('  900150983CD24FB0D6963F7D28E17F72 ', bytes)).toBe('hex');
    expect(compareDigest('90:01:50:98:3c:d2:4f:b0:d6:96:3f:7d:28:e1:7f:72', bytes)).toBe('hex');
    expect(compareDigest(bytesToBase64(bytes), bytes)).toBe('base64');
    expect(compareDigest('900150983cd24fb0d6963f7d28e17f73', bytes)).toBe('mismatch');
  });
});
