import { contrastRatio, parseColor, type Rgba } from '../color-converter/color-logic';

/** Payload builders for the QR presets, plus colour checks. The QR image itself comes from the qrcode library. */

export type QrKind = 'text' | 'wifi' | 'vcard' | 'email' | 'sms' | 'geo';

/** Escapes the characters that have a meaning inside a WIFI: payload (backslash, semicolon, comma, colon, quote). */
export const escapeWifi = (value: string): string => value.replace(/([\\;,:"])/g, '\\$1');

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WifiInput {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

/** WIFI:T:WPA;S:name;P:secret;H:true;; as read by the Android and iOS camera apps. */
export function wifiPayload(input: WifiInput): string {
  const parts = [`T:${input.security}`, `S:${escapeWifi(input.ssid)}`];
  if (input.security !== 'nopass') parts.push(`P:${escapeWifi(input.password)}`);
  if (input.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export interface VcardInput {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
}

/** Escapes vCard 3.0 text values (backslash, comma, semicolon, newline). */
export const escapeVcard = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

/** vCard 3.0 (RFC 2426) with CRLF line endings; empty fields are left out. */
export function vcardPayload(v: VcardInput): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escapeVcard(v.lastName)};${escapeVcard(v.firstName)};;;`);
  lines.push(`FN:${escapeVcard([v.firstName, v.lastName].filter(Boolean).join(' '))}`);
  if (v.organization) lines.push(`ORG:${escapeVcard(v.organization)}`);
  if (v.title) lines.push(`TITLE:${escapeVcard(v.title)}`);
  if (v.phone) lines.push(`TEL;TYPE=CELL:${v.phone.replace(/[^\d+()\-.\s]/g, '').trim()}`);
  if (v.email) lines.push(`EMAIL:${v.email.trim()}`);
  if (v.url) lines.push(`URL:${v.url.trim()}`);
  if (v.address) lines.push(`ADR;TYPE=WORK:;;${escapeVcard(v.address)};;;;`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/** mailto: with a percent-encoded subject and body (RFC 6068). */
export function emailPayload(to: string, subject = '', body = ''): string {
  const query: string[] = [];
  if (subject) query.push(`subject=${encodeURIComponent(subject)}`);
  if (body) query.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to.trim()}${query.length ? `?${query.join('&')}` : ''}`;
}

/** sms: URI (RFC 5724). Spaces in the number are dropped; the message is percent-encoded. */
export function smsPayload(phone: string, message = ''): string {
  const number = phone.replace(/[\s()\-.]/g, '');
  return `sms:${number}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
}

/** geo: URI (RFC 5870). Returns null when latitude or longitude is not a number in range. */
export function geoPayload(lat: string, lng: string): string | null {
  const la = Number(lat.trim());
  const lo = Number(lng.trim());
  if (!lat.trim() || !lng.trim() || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return `geo:${la},${lo}`;
}

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// Colour checks --------------------------------------------------------------------------------------------------

export interface QrColorCheck {
  ok: boolean;
  /** Plain-language problems, empty when the pair looks safe. */
  warnings: string[];
  ratio: number | null;
}

/**
 * Scanners expect dark modules on a light background. This flags low contrast and inverted codes. The 4:1
 * floor is a practical rule of thumb for phone cameras, not a standard.
 */
export function checkQrColors(foreground: string, background: string): QrColorCheck {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return { ok: false, warnings: ['One of the colours is not a valid hex value.'], ratio: null };
  const ratio = contrastRatio(fg, bg);
  const warnings: string[] = [];
  const lum = (c: Rgba) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum(fg) > lum(bg)) warnings.push('The code is lighter than its background (inverted). Many scanners cannot read inverted codes.');
  if (ratio < 3) warnings.push(`Contrast is only ${ratio.toFixed(1)}:1. Phones will probably fail to scan this.`);
  else if (ratio < 4) warnings.push(`Contrast is ${ratio.toFixed(1)}:1. Aim for 4:1 or more for reliable scans.`);
  if (bg.a < 1 || fg.a < 1) warnings.push('Transparent colours are not supported; use solid colours.');
  return { ok: warnings.length === 0, warnings, ratio };
}

export const MIN_QUIET_ZONE = 4;

/** Rough count of characters a QR code can hold at version 40 for each level (alphanumeric-safe approximations use bytes). */
export const QR_MAX_BYTES: Record<'L' | 'M' | 'Q' | 'H', number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

export const utf8Length = (text: string): number => new TextEncoder().encode(text).length;
