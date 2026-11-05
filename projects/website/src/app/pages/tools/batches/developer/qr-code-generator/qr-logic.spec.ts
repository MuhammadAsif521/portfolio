import { describe, expect, it } from 'vitest';
import {
  checkQrColors,
  emailPayload,
  escapeVcard,
  escapeWifi,
  geoPayload,
  isEmail,
  smsPayload,
  utf8Length,
  vcardPayload,
  wifiPayload,
} from './qr-logic';

describe('WiFi payload', () => {
  it('builds the standard string', () => {
    expect(wifiPayload({ ssid: 'HomeNet', password: 'secret123', security: 'WPA', hidden: false })).toBe('WIFI:T:WPA;S:HomeNet;P:secret123;;');
    expect(wifiPayload({ ssid: 'HomeNet', password: 'secret123', security: 'WPA', hidden: true })).toBe('WIFI:T:WPA;S:HomeNet;P:secret123;H:true;;');
    expect(wifiPayload({ ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: false })).toBe('WIFI:T:nopass;S:Cafe;;');
    expect(wifiPayload({ ssid: 'Old', password: 'abcde', security: 'WEP', hidden: false })).toBe('WIFI:T:WEP;S:Old;P:abcde;;');
  });

  it('escapes the special characters \\ ; , : "', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
    expect(wifiPayload({ ssid: 'My;Net', password: 'p:w,d', security: 'WPA', hidden: false })).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:w\\,d;;');
  });
});

describe('vCard payload', () => {
  const base = { firstName: 'Asif', lastName: 'Khan', organization: '', title: '', phone: '', email: '', url: '', address: '' };

  it('builds a minimal 3.0 card with CRLF line endings', () => {
    expect(vcardPayload(base)).toBe('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Khan;Asif;;;\r\nFN:Asif Khan\r\nEND:VCARD');
  });

  it('includes optional fields and escapes commas, semicolons and newlines', () => {
    const card = vcardPayload({
      ...base,
      organization: 'Acme, Inc.',
      title: 'Engineer',
      phone: '+92 300 1234567',
      email: 'a@example.com',
      url: 'https://example.com',
      address: '1 Main St; Lahore\nPakistan',
    });
    expect(card).toContain('ORG:Acme\\, Inc.');
    expect(card).toContain('TITLE:Engineer');
    expect(card).toContain('TEL;TYPE=CELL:+92 300 1234567');
    expect(card).toContain('EMAIL:a@example.com');
    expect(card).toContain('URL:https://example.com');
    expect(card).toContain('ADR;TYPE=WORK:;;1 Main St\\; Lahore\\nPakistan;;;;');
    expect(escapeVcard('a\\b')).toBe('a\\\\b');
  });
});

describe('email, SMS and geo payloads', () => {
  it('mailto with and without a query', () => {
    expect(emailPayload('hi@example.com')).toBe('mailto:hi@example.com');
    expect(emailPayload('hi@example.com', 'Hello there', 'Line 1 & 2')).toBe('mailto:hi@example.com?subject=Hello%20there&body=Line%201%20%26%202');
    expect(emailPayload(' hi@example.com ', '', 'x')).toBe('mailto:hi@example.com?body=x');
    expect(isEmail('hi@example.com')).toBe(true);
    expect(isEmail('hi@')).toBe(false);
  });

  it('sms: strips number punctuation and encodes the body', () => {
    expect(smsPayload('+1 (510) 555-0101')).toBe('sms:+15105550101');
    expect(smsPayload('+15105550101', 'hello there')).toBe('sms:+15105550101?body=hello%20there');
  });

  it('geo: validates ranges', () => {
    expect(geoPayload('48.8584', '2.2945')).toBe('geo:48.8584,2.2945');
    expect(geoPayload('-33.86', '151.21')).toBe('geo:-33.86,151.21');
    expect(geoPayload('91', '0')).toBeNull();
    expect(geoPayload('0', '181')).toBeNull();
    expect(geoPayload('', '1')).toBeNull();
    expect(geoPayload('north', '1')).toBeNull();
  });
});

describe('colour check', () => {
  it('accepts black on white', () => {
    expect(checkQrColors('#000000', '#ffffff')).toMatchObject({ ok: true, warnings: [] });
  });

  it('warns about inverted codes', () => {
    const r = checkQrColors('#ffffff', '#000000');
    expect(r.ok).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/inverted/);
  });

  it('warns about low contrast and flags the ratio', () => {
    const r = checkQrColors('#999999', '#ffffff');
    expect(r.ratio).toBeCloseTo(2.85, 1);
    expect(r.warnings.join(' ')).toMatch(/probably fail/);
    expect(checkQrColors('#767676', '#ffffff').ok).toBe(true);
  });

  it('handles invalid colours', () => {
    expect(checkQrColors('nope', '#fff')).toMatchObject({ ok: false, ratio: null });
  });
});

describe('qrcode library integration', () => {
  it('encodes a short string as a version 1 symbol and produces SVG', async () => {
    const QRCode = (await import('qrcode')).default;
    const qr = QRCode.create('hello', { errorCorrectionLevel: 'M' });
    expect(qr.version).toBe(1);
    expect(qr.modules.size).toBe(21);
    const svg = await QRCode.toString('hello', { type: 'svg', margin: 4, color: { dark: '#000000', light: '#ffffff' } });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 29 29"');
  });

  it('refuses data that does not fit, and counts UTF-8 bytes', async () => {
    const QRCode = (await import('qrcode')).default;
    expect(() => QRCode.create('x'.repeat(3000), { errorCorrectionLevel: 'L' })).toThrow();
    expect(utf8Length('é')).toBe(2);
  });
});
