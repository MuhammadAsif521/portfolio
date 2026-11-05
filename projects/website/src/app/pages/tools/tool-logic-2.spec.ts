import { TOOLS } from '@shared/tools/tools.manifest';
import { describe, expect, it } from 'vitest';
import {
  createUuidV7Generator,
  decodeBase64,
  encodeBase64,
  encodeWav,
  formatJson,
  highlightSegments,
  inspectUuid,
  parseEpoch,
  runRegex,
  uuidV4,
} from './tool-logic-2';
import { TOOLS_ROUTES } from './tools.routes';

describe('epoch', () => {
  it('detects seconds vs milliseconds and parses dates', () => {
    expect(parseEpoch('1767225600')).toMatchObject({ unit: 'seconds', iso: '2026-01-01T00:00:00.000Z' });
    expect(parseEpoch('1767225600000')).toMatchObject({ unit: 'milliseconds', seconds: 1767225600 });
    expect(parseEpoch('2026-01-01T00:00:00Z')).toMatchObject({ unit: 'date', ms: 1767225600000 });
    expect(parseEpoch('not a date')).toBeNull();
  });
});

describe('base64', () => {
  it('round-trips UTF-8 (emoji, Urdu) and supports Base64url', () => {
    expect(encodeBase64('Héllo, Pakistan 👋')).toBe('SMOpbGxvLCBQYWtpc3RhbiDwn5GL');
    const text = 'اردو ✓ <>?';
    expect(decodeBase64(encodeBase64(text, true))).toEqual({ ok: true, text });
    expect(encodeBase64('??>', true)).not.toMatch(/[+/=]/);
  });

  it('rejects invalid input', () => {
    expect(decodeBase64('***')).toMatchObject({ ok: false });
    expect(decodeBase64('abcde')).toMatchObject({ ok: false });
    expect(decodeBase64('  ')).toBeNull();
  });
});

describe('uuid', () => {
  it('v4 has the right version and variant', () => {
    const info = inspectUuid(uuidV4());
    expect(info).toMatchObject({ version: 4, variant: 'RFC 9562' });
  });

  it('v7 embeds the time and stays ordered within one millisecond', () => {
    const at = Date.parse('2026-11-05T10:00:00Z');
    const next = createUuidV7Generator(() => at);
    const ids = Array.from({ length: 50 }, next);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
    expect(ids[0].startsWith('01a1ab26-a900-7')).toBe(true);
    expect(inspectUuid(ids[0])).toMatchObject({ version: 7, createdAt: '2026-11-05T10:00:00.000Z' });
    expect(inspectUuid('nope')).toBeNull();
  });
});

describe('json formatter', () => {
  it('formats, minifies and sorts keys', () => {
    expect(formatJson('{"b":1,"a":[1,2]}', { indent: 'minify', sortKeys: true })).toMatchObject({ ok: true, code: '{"a":[1,2],"b":1}' });
    const pretty = formatJson('{"a":1}', { indent: 2, sortKeys: false });
    expect(pretty && pretty.ok && pretty.code).toBe('{\n  "a": 1\n}');
  });

  it('reports line and column of errors', () => {
    const result = formatJson('{\n  "a": 1,\n}', { indent: 2, sortKeys: false });
    expect(result).toMatchObject({ ok: false, line: 3, column: 1 });
  });
});

describe('regex', () => {
  it('lists matches with numbered and named groups, and replaces', () => {
    const r = runRegex('(?<user>\\w+)@(\\w+)', 'g', 'a@b and c@d', '$<user>');
    expect(r.matches.map((m) => m.text)).toEqual(['a@b', 'c@d']);
    expect(r.matches[0].groups).toEqual([
      { name: '1', value: 'a' },
      { name: '2', value: 'b' },
      { name: 'user', value: 'a' },
    ]);
    expect(r.replaced).toBe('a and c');
  });

  it('does not loop forever on empty matches and highlights segments', () => {
    const r = runRegex('x*', 'g', 'axb', null);
    expect(r.matches.length).toBeGreaterThan(0);
    const hl = highlightSegments('axb', runRegex('x', 'g', 'axb', null).matches);
    expect(hl).toEqual([
      { text: 'a', match: false },
      { text: 'x', match: true },
      { text: 'b', match: false },
    ]);
  });
});

describe('wav', () => {
  it('writes a valid 16-bit PCM header', () => {
    const wav = new DataView(encodeWav([new Float32Array([0, 1, -1])], 16000));
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(o + i)));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(wav.getUint32(24, true)).toBe(16000);
    expect(wav.getUint32(40, true)).toBe(6);
    expect(wav.getInt16(46, true)).toBe(0x7fff);
  });
});

describe('tool routes', () => {
  it('every manifest tool has a guarded route', () => {
    const paths = new Map(TOOLS_ROUTES.map((r) => [r.path, r]));
    for (const tool of TOOLS) {
      const route = paths.get(tool.slug);
      expect(route, tool.slug).toBeTruthy();
      expect(route?.canMatch?.length, tool.slug).toBe(1);
    }
  });
});
