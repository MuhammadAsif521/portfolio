import { describe, expect, it } from 'vitest';
import { HTTP_STATUSES } from '@shared/tools/http-status.data';
import { TOOLS } from '@shared/tools/tools.manifest';
import { decodeJwt, decodeObjectId, explainCron, jsonToMongoose, jsonToTypeScript, objectIdFromDate } from './tool-logic';

describe('JSON to Mongoose', () => {
  it('maps types, dates, ObjectIds, arrays and nested sub-schemas', () => {
    const result = jsonToMongoose(
      '{"_id":"507f1f77bcf86cd799439011","name":"A","owner":"507f1f77bcf86cd799439011","born":"2026-01-01T00:00:00Z","tags":["x"],"address":{"city":"P"},"createdAt":"2026-01-01"}',
      { modelName: 'User' },
    );
    const code = result && result.ok ? result.code : '';
    expect(code).toContain('const addressSchema = new Schema(');
    expect(code).toContain('{ _id: false }');
    expect(code).toContain('name: { type: String, required: true },');
    expect(code).toContain('owner: { type: Schema.Types.ObjectId, required: true },');
    expect(code).toContain('born: { type: Date, required: true },');
    expect(code).toContain('tags: { type: [String], default: [] },');
    expect(code).toContain('address: { type: addressSchema, required: true },');
    expect(code).toContain('{ timestamps: true }');
    expect(code).toContain("export const User = model('User', userSchema);");
    expect(code).not.toMatch(/^\s+_id:/m);
    expect(code).not.toContain('createdAt:');
  });

  it('does not require keys missing from some array items or null values', () => {
    const result = jsonToMongoose('[{"a":1,"b":null},{"a":2}]', { modelName: 'Thing' });
    const code = result && result.ok ? result.code : '';
    expect(code).toContain('a: { type: Number, required: true },');
    expect(code).toContain('b: { type: Schema.Types.Mixed },');
  });

  it('rejects non-objects and invalid JSON', () => {
    expect(jsonToMongoose('[1,2]')).toMatchObject({ ok: false });
    expect(jsonToMongoose('{oops')).toMatchObject({ ok: false });
  });
});

describe('cron explainer', () => {
  const from = new Date(2026, 10, 5, 10, 0); // Thursday 5 Nov 2026, 10:00 local

  it('describes weekday schedules and lists the next runs', () => {
    const result = explainCron('0 9 * * 1-5', from);
    expect(result).toMatchObject({ ok: true });
    if (result?.ok) {
      expect(result.value.description).toBe('At 09:00, on Monday through Friday.');
      expect(result.value.next.map((d) => d.getDate())).toEqual([6, 9, 10, 11, 12]);
    }
  });

  it('handles steps, hour ranges, macros and Sunday as 7', () => {
    expect(explainCron('*/15 9-17 * * *', from)).toMatchObject({
      ok: true,
      value: { description: 'Every 15 minutes, between 09:00 and 17:59.' },
    });
    const daily = explainCron('@daily', from);
    expect(daily?.ok && daily.value.next[0]).toEqual(new Date(2026, 10, 6, 0, 0));
    const sunday = explainCron('0 0 * * 7', from);
    expect(sunday?.ok && sunday.value.next[0].getDay()).toBe(0);
  });

  it('uses OR when both day fields are set, and reports bad input', () => {
    const result = explainCron('0 9 1 * 1', from);
    expect(result?.ok && result.value.description).toBe('At 09:00, on day 1 of the month or on Monday.');
    expect(explainCron('0 9 * *')).toMatchObject({ ok: false });
    expect(explainCron('61 * * * *')).toMatchObject({ ok: false });
  });
});

describe('tools content', () => {
  it('every tool has 300+ words, 3+ FAQs, short title/description and resolvable related links', () => {
    const slugs = new Set(TOOLS.map((t) => t.slug));
    for (const tool of TOOLS) {
      const words = tool.sections.flatMap((s) => s.paragraphs).join(' ').split(/\s+/).length;
      expect(words, tool.slug).toBeGreaterThanOrEqual(300);
      expect(tool.faq.length, tool.slug).toBeGreaterThanOrEqual(3);
      expect(tool.title.length, tool.slug).toBeLessThanOrEqual(60);
      expect(tool.description.length, tool.slug).toBeLessThanOrEqual(155);
      for (const r of tool.related) expect(slugs.has(r), `${tool.slug} -> ${r}`).toBe(true);
    }
  });

  it('every HTTP status page has unique content', () => {
    const codes = HTTP_STATUSES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(HTTP_STATUSES.map((s) => s.meaning)).size).toBe(codes.length);
    for (const s of HTTP_STATUSES) expect(`HTTP ${s.code} ${s.name}: Meaning and Fix | Asif Dev`.length).toBeLessThanOrEqual(60);
  });
});

describe('ObjectId', () => {
  it('reads the creation date from the first 4 bytes', () => {
    const info = decodeObjectId('507f1f77bcf86cd799439011');
    expect(info?.seconds).toBe(1350508407);
    expect(info?.iso).toBe('2012-10-17T21:13:27.000Z');
  });

  it('rejects anything that is not 24 hex characters', () => {
    expect(decodeObjectId('nope')).toBeNull();
    expect(decodeObjectId('507f1f77bcf86cd79943901')).toBeNull();
  });

  it('builds a boundary ObjectId from an ISO date or Unix seconds', () => {
    expect(objectIdFromDate('2012-10-17T21:13:27Z')).toBe('507f1f770000000000000000');
    expect(objectIdFromDate('1350508407')).toBe('507f1f770000000000000000');
    expect(objectIdFromDate('not a date')).toBeNull();
  });
});

describe('JWT', () => {
  const b64 = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = (payload: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;

  it('decodes header and payload and flags expiry', () => {
    const result = decodeJwt(token({ sub: '1', exp: 100 }), 200_000);
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.value.header).toEqual({ alg: 'HS256', typ: 'JWT' });
      expect(result.value.expired).toBe(true);
      expect(result.value.times[0]).toEqual({ claim: 'exp', iso: '1970-01-01T00:01:40.000Z' });
    }
  });

  it('reports malformed tokens instead of throwing', () => {
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('a.b')).toMatchObject({ ok: false });
    expect(decodeJwt('x.y.z')).toMatchObject({ ok: false });
  });
});

describe('JSON to TypeScript', () => {
  it('creates nested interfaces and arrays', () => {
    const result = jsonToTypeScript('{"id":1,"tags":["a"],"address":{"city":"Lahore"}}');
    expect(result).toMatchObject({ ok: true });
    const code = result && result.ok ? result.code : '';
    expect(code).toContain('export interface Root {');
    expect(code).toContain('id: number;');
    expect(code).toContain('tags: string[];');
    expect(code).toContain('address: Address;');
    expect(code).toContain('export interface Address {');
  });

  it('marks keys missing from some array items as optional and unions differing types', () => {
    const result = jsonToTypeScript('{"items":[{"a":1,"b":"x"},{"a":"y"}]}');
    const code = result && result.ok ? result.code : '';
    expect(code).toContain('a: number | string;');
    expect(code).toContain('b?: string;');
  });

  it('supports type aliases, custom names, and reports invalid JSON', () => {
    const aliased = jsonToTypeScript('{"a":1}', 'User', 'type');
    expect(aliased && aliased.ok && aliased.code).toContain('export type User = {');
    expect(jsonToTypeScript('{oops')).toMatchObject({ ok: false });
    expect(jsonToTypeScript('  ')).toBeNull();
  });
});
