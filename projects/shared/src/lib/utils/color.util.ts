/** Colour helpers for runtime theming (WCAG 2.x relative luminance and contrast). */

const HEX = /^#([0-9a-f]{6})$/i;

export const LIGHT_TEXT = '#FFFFFF';
export const DARK_TEXT = '#141414';

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value.trim());
}

function channels(hex: string): [number, number, number] {
  const value = hex.trim().slice(1);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two colours, 1 … 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * White or near-black, whichever reads better on `background`. Used for text on brand colours so
 * every admin-chosen palette stays legible (e.g. the default orange #FF7A3D gets near-black, ~7:1).
 */
export function readableTextOn(background: string): typeof LIGHT_TEXT | typeof DARK_TEXT {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** Page surfaces that brand-coloured text sits on: the lightest-contrast light surface (#F2F4F7 band) and
 *  the lightest dark-mode surface (#1F1F1F). Keep in sync with --band-b / --surface-muted. */
export const LIGHT_SURFACE = '#F2F4F7';
export const DARK_SURFACE = '#1F1F1F';

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * `color` itself when it already reaches `minRatio` against `background`, otherwise the smallest
 * sRGB mix towards black (light backgrounds) or white (dark backgrounds) that does — the same mix
 * as CSS `color-mix(in srgb, …)`. Used for brand-coloured text (links, accents) on page surfaces,
 * so any admin palette stays legible without changing the brand colour itself.
 */
export function readableShade(color: string, background: string, minRatio = 4.5): string {
  const base = channels(color);
  const target = relativeLuminance(background) > 0.18 ? 0 : 1;
  for (let step = 0; step <= 100; step++) {
    const t = step / 100;
    const hex = toHex(base.map((c) => c * (1 - t) + target * t));
    if (contrastRatio(hex, background) >= minRatio) return hex;
  }
  return target === 0 ? '#000000' : '#FFFFFF';
}
