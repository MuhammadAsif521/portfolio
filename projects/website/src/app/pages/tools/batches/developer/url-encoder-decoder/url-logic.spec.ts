import { describe, expect, it } from 'vitest';
import {
  decodeLenient,
  decodeText,
  detectDoubleEncoding,
  encodeText,
  findMalformed,
  hostToUnicode,
  parseUrl,
  punycodeDecode,
  punycodeEncode,
  rebuildUrl,
} from './url-logic';

const text = (r: { ok: boolean; text?: string }) => (r.ok ? r.text : undefined);

describe('encodeText', () => {
  const sample = 'a b&c=d/e?f#g+é';

  it('component mode escapes reserved characters', () => {
    expect(text(encodeText(sample, 'component'))).toBe('a%20b%26c%3Dd%2Fe%3Ff%23g%2B%C3%A9');
  });

  it('uri mode keeps the URL structure', () => {
    expect(text(encodeText('https://x.com/a b?q=1&r=é#top', 'uri'))).toBe('https://x.com/a%20b?q=1&r=%C3%A9#top');
  });

  it('form mode turns spaces into + and encodes ! ~ ( ) \' like the URL standard', () => {
    expect(text(encodeText('a b+c', 'form'))).toBe('a+b%2Bc');
    expect(text(encodeText("it's (ok)! ~", 'form'))).toBe('it%27s+%28ok%29%21+%7E');
    expect(text(encodeText('é', 'form'))).toBe('%C3%A9');
  });

  it('encodes emoji as four UTF-8 bytes', () => {
    expect(text(encodeText('😀', 'component'))).toBe('%F0%9F%98%80');
  });

  it('reports a lone surrogate instead of throwing', () => {
    for (const mode of ['component', 'uri', 'form'] as const) {
      const r = encodeText('ab\ud800', mode);
      expect(r.ok).toBe(false);
    }
  });

  it('handles the empty string', () => {
    expect(text(encodeText('', 'component'))).toBe('');
    expect(text(encodeText('', 'form'))).toBe('');
  });
});

describe('decodeText', () => {
  it('decodes in each mode', () => {
    expect(text(decodeText('a%20b%26c', 'component'))).toBe('a b&c');
    expect(text(decodeText('a+b%2Bc', 'form'))).toBe('a b+c');
    expect(text(decodeText('a+b', 'component'))).toBe('a+b');
    // decodeURI leaves reserved characters encoded.
    expect(text(decodeText('https://x.com/a%20b?q=%26', 'uri'))).toBe('https://x.com/a b?q=%26');
    expect(text(decodeText('%F0%9F%98%80', 'component'))).toBe('😀');
  });

  it('points at a "%" that is not followed by two hex digits', () => {
    const r = decodeText('100% sure', 'component');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.at).toMatchObject({ index: 3, sequence: '% s' });
      expect(r.error).toContain('position 4');
      expect(r.error).toContain('%25');
    }
  });

  it('points at an incomplete escape at the end', () => {
    const r = decodeText('abc%2', 'component');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.at?.index).toBe(3);
  });

  it('explains bytes that are not valid UTF-8 (Latin-1 %E9)', () => {
    const r = decodeText('caf%E9 au lait', 'component');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.at).toMatchObject({ index: 3, sequence: '%E9' });
      expect(r.error).toMatch(/UTF-8/);
    }
  });

  it('finds the exact bad escape inside a longer valid run', () => {
    const m = findMalformed('ok%C3%A9%FFend');
    expect(m).toMatchObject({ index: 8, sequence: '%FF' });
    expect(findMalformed('fine%20text')).toBeNull();
  });

  it('decodeLenient decodes what it can and keeps the rest', () => {
    expect(decodeLenient('caf%E9 %C3%A9 100%')).toBe('caf%E9 é 100%');
    expect(decodeLenient('a%20b')).toBe('a b');
    expect(decodeLenient('a+b%20c', 'form')).toBe('a b c');
  });
});

describe('double encoding', () => {
  it('detects %2520 as a space encoded twice', () => {
    const d = detectDoubleEncoding('hello%2520world');
    expect(d).toMatchObject({ layers: 2, suspicious: true });
    expect(d.steps).toEqual(['hello%2520world', 'hello%20world', 'hello world']);
  });

  it('detects three layers', () => {
    expect(detectDoubleEncoding('%252520').layers).toBe(3);
  });

  it('does not flag ordinary single encoding or a literal percent sign', () => {
    expect(detectDoubleEncoding('hello%20world')).toMatchObject({ layers: 1, suspicious: false });
    expect(detectDoubleEncoding('sale%2050%25')).toMatchObject({ suspicious: false });
    expect(detectDoubleEncoding('plain')).toMatchObject({ layers: 0, suspicious: false });
  });

  it('stops on malformed text instead of throwing', () => {
    expect(detectDoubleEncoding('%E9%2520').layers).toBe(0);
  });
});

describe('punycode', () => {
  it('encodes and decodes known IDN labels', () => {
    expect(punycodeEncode('münchen')).toBe('mnchen-3ya');
    expect(punycodeEncode('bücher')).toBe('bcher-kva');
    expect(punycodeEncode('日本語')).toBe('wgv71a119e');
    expect(punycodeDecode('mnchen-3ya')).toBe('münchen');
    expect(punycodeDecode('bcher-kva')).toBe('bücher');
    expect(punycodeDecode('wgv71a119e')).toBe('日本語');
  });

  it('round-trips mixed scripts', () => {
    for (const label of ['ドメイン名例', 'правда', 'café-münchen', '😀']) {
      expect(punycodeDecode(punycodeEncode(label))).toBe(label);
    }
  });

  it('rejects invalid punycode', () => {
    expect(punycodeDecode('!!!')).toBeNull();
    expect(punycodeDecode('abc-é')).toBeNull();
  });

  it('shows hostnames in Unicode', () => {
    expect(hostToUnicode('xn--mnchen-3ya.example.com')).toBe('münchen.example.com');
    expect(hostToUnicode('example.com')).toBe('example.com');
    expect(hostToUnicode('xn--!!!.com')).toBe('xn--!!!.com');
  });
});

describe('parseUrl', () => {
  it('splits a full URL into its parts', () => {
    const r = parseUrl('https://user:p%40ss@Example.com:8080/a/b%20c?x=1&y=two%20words&x=3#frag');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url).toMatchObject({
      protocol: 'https:',
      username: 'user',
      password: 'p@ss',
      hostname: 'example.com',
      port: '8080',
      pathname: '/a/b%20c',
      hash: '#frag',
      origin: 'https://example.com:8080',
      isInternational: false,
    });
    expect(r.url.params).toEqual([
      { key: 'x', value: '1' },
      { key: 'y', value: 'two words' },
      { key: 'x', value: '3' },
    ]);
  });

  it('drops default ports and shows international hostnames in both forms', () => {
    const r = parseUrl('https://münchen.de:443/straße');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url.port).toBe('');
    expect(r.url.hostname).toBe('xn--mnchen-3ya.de');
    expect(r.url.unicodeHost).toBe('münchen.de');
    expect(r.url.isInternational).toBe(true);
    expect(r.url.pathname).toBe('/stra%C3%9Fe');
  });

  it('keeps + as plus in the path but reads it as a space in the query', () => {
    const r = parseUrl('https://x.com/a+b?q=a+b');
    expect(r.ok && r.url.pathname).toBe('/a+b');
    expect(r.ok && r.url.params[0].value).toBe('a b');
  });

  it('explains failures', () => {
    expect(parseUrl('')).toEqual({ ok: false, error: 'Enter a URL.' });
    expect(parseUrl('example.com/path')).toMatchObject({ ok: false, error: expect.stringContaining('no scheme') });
    expect(parseUrl('https://')).toMatchObject({ ok: false });
    expect(parseUrl('http://exa mple.com')).toMatchObject({ ok: false });
  });

  it('parses non-http schemes', () => {
    const r = parseUrl('mailto:a@example.com?subject=Hi%20there');
    expect(r.ok && r.url.protocol).toBe('mailto:');
    expect(r.ok && r.url.params).toEqual([{ key: 'subject', value: 'Hi there' }]);
  });
});

describe('rebuildUrl', () => {
  it('writes edited parameters back and keeps the rest', () => {
    const out = rebuildUrl('https://x.com/p?a=1#h', [
      { key: 'a', value: '2' },
      { key: 'q', value: 'two words & more' },
    ]);
    expect(out).toBe('https://x.com/p?a=2&q=two+words+%26+more#h');
  });

  it('removes the query when no parameters are left and skips empty rows', () => {
    expect(rebuildUrl('https://x.com/p?a=1', [])).toBe('https://x.com/p');
    expect(rebuildUrl('https://x.com/p', [{ key: '', value: '' }])).toBe('https://x.com/p');
    expect(rebuildUrl('not a url', [])).toBeNull();
  });
});
