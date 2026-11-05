/**
 * Colour parsing, conversion and contrast.
 * Sources: CSS Color Module Level 4 (sRGB transfer function, sRGB / XYZ D65 / OKLab matrices, HSL and HWB
 * conversions) and WCAG 2.2 (relative luminance and contrast ratio).
 */

/** sRGB colour: channels 0-255 (not rounded), alpha 0-1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
};

// Named colours --------------------------------------------------------------------------------------------------

const NAMED_SOURCE =
  'aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32';

export const NAMED_COLORS: ReadonlyMap<string, string> = new Map(
  NAMED_SOURCE.split(',').map((pair) => {
    const [name, hex] = pair.split(':');
    return [name, hex] as [string, string];
  }),
);

// Parsing --------------------------------------------------------------------------------------------------------

const rgba = (r: number, g: number, b: number, a = 1): Rgba => ({ r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) });

function parseHex(body: string): Rgba | null {
  if (!/^[0-9a-f]+$/i.test(body) || ![3, 4, 6, 8].includes(body.length)) return null;
  const full = body.length <= 4 ? [...body].map((c) => c + c).join('') : body;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return rgba(n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1);
}

/** A number or percentage argument. `scale` is what 100% means. Returns null for anything else ("none" = 0). */
function arg(text: string, scale: number): number | null {
  if (text === 'none') return 0;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/i.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] ? (n / 100) * scale : n;
}

function hueArg(text: string): number | null {
  if (text === 'none') return 0;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? 'deg').toLowerCase();
  const deg = unit === 'rad' ? (n * 180) / Math.PI : unit === 'grad' ? n * 0.9 : unit === 'turn' ? n * 360 : n;
  return ((deg % 360) + 360) % 360;
}

function alphaArg(text: string | undefined): number | null {
  if (text === undefined) return 1;
  const v = arg(text, 1);
  return v === null ? null : clamp(v, 0, 1);
}

/** Parses a CSS colour string (hex, named, rgb/hsl/hwb/oklab/oklch) or the tool notations hsv() and cmyk(). */
export function parseColor(input: string): Rgba | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  if (text === 'transparent') return rgba(0, 0, 0, 0);
  if (text.startsWith('#')) return parseHex(text.slice(1));
  const named = NAMED_COLORS.get(text);
  if (named) return parseHex(named);
  const fn = /^([a-z]+)\(\s*([^)]*?)\s*\)$/.exec(text);
  if (!fn) return /^[0-9a-f]{6}$/.test(text) ? parseHex(text) : null;
  const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  const alphaText = fn[1] !== 'cmyk' && parts.length === 4 ? parts[3] : undefined;
  const a = alphaArg(alphaText);
  if (a === null) return null;
  switch (fn[1]) {
    case 'rgb':
    case 'rgba': {
      if (parts.length < 3 || parts.length > 4) return null;
      const [r, g, b] = parts.slice(0, 3).map((p) => arg(p, 255));
      return r === null || g === null || b === null ? null : rgba(r, g, b, a);
    }
    case 'hsl':
    case 'hsla': {
      if (parts.length < 3 || parts.length > 4) return null;
      const h = hueArg(parts[0]);
      const s = arg(parts[1], 100);
      const l = arg(parts[2], 100);
      return h === null || s === null || l === null ? null : { ...hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100)), a };
    }
    case 'hwb': {
      if (parts.length < 3 || parts.length > 4) return null;
      const h = hueArg(parts[0]);
      const w = arg(parts[1], 100);
      const bk = arg(parts[2], 100);
      return h === null || w === null || bk === null ? null : { ...hwbToRgb(h, clamp(w, 0, 100), clamp(bk, 0, 100)), a };
    }
    case 'hsv':
    case 'hsb': {
      if (parts.length < 3 || parts.length > 4) return null;
      const h = hueArg(parts[0]);
      const s = arg(parts[1], 100);
      const v = arg(parts[2], 100);
      return h === null || s === null || v === null ? null : { ...hsvToRgb(h, clamp(s, 0, 100), clamp(v, 0, 100)), a };
    }
    case 'cmyk': {
      if (parts.length < 4 || parts.length > 5) return null;
      const [c, m, y, k] = parts.slice(0, 4).map((p) => arg(p, 100));
      if (c === null || m === null || y === null || k === null) return null;
      const f = (v: number) => clamp(v, 0, 100) / 100;
      const al = parts.length === 5 ? alphaArg(parts[4]) : 1;
      if (al === null) return null;
      return rgba(255 * (1 - f(c)) * (1 - f(k)), 255 * (1 - f(m)) * (1 - f(k)), 255 * (1 - f(y)) * (1 - f(k)), al);
    }
    case 'oklab': {
      if (parts.length < 3 || parts.length > 4) return null;
      const l = arg(parts[0], 1);
      const aa = arg(parts[1], 0.4);
      const bb = arg(parts[2], 0.4);
      if (l === null || aa === null || bb === null) return null;
      return { ...oklabToRgb(clamp(l, 0, 1), aa, bb).rgb, a };
    }
    case 'oklch': {
      if (parts.length < 3 || parts.length > 4) return null;
      const l = arg(parts[0], 1);
      const c = arg(parts[1], 0.4);
      const h = hueArg(parts[2]);
      if (l === null || c === null || h === null) return null;
      return { ...oklchToRgb(clamp(l, 0, 1), Math.max(0, c), h).rgb, a };
    }
    default:
      return null;
  }
}

// RGB <-> HSL / HWB / HSV / CMYK ---------------------------------------------------------------------------------

type Rgb = Pick<Rgba, 'r' | 'g' | 'b'>;

/** CSS Color 4 sample code: h in degrees, s and l in percent. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = sat * Math.min(light, 1 - light);
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (min + max) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
    h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: h % 360, s: s * 100, l: l * 100 };
}

export function hwbToRgb(h: number, w: number, bk: number): Rgb {
  if (w + bk >= 100) {
    const gray = (w / (w + bk)) * 255;
    return { r: gray, g: gray, b: gray };
  }
  const base = hslToRgb(h, 100, 50);
  const f = (c: number) => (c / 255) * (1 - w / 100 - bk / 100) * 255 + (w / 100) * 255;
  return { r: f(base.r), g: f(base.g), b: f(base.b) };
}

export function rgbToHsv({ r, g, b }: Rgb): { h: number; s: number; v: number } {
  const { h } = rgbToHsl({ r, g, b });
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return { h, s: max === 0 ? 0 : ((max - min) / max) * 100, v: max * 100 };
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const sat = s / 100;
  const val = v / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (val - val * sat * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: f(5), g: f(3), b: f(1) };
}

/** Plain arithmetic RGB to CMYK. It is not colour-managed: real print profiles give different numbers. */
export function rgbToCmyk({ r, g, b }: Rgb): { c: number; m: number; y: number; k: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: ((1 - rn - k) / (1 - k)) * 100, m: ((1 - gn - k) / (1 - k)) * 100, y: ((1 - bn - k) / (1 - k)) * 100, k: k * 100 };
}

// sRGB <-> OKLab / OKLCH (CSS Color 4 sample code) ----------------------------------------------------------------

type M3 = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

const LIN_SRGB_TO_XYZ: M3 = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const XYZ_TO_LIN_SRGB: M3 = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const XYZ_TO_LMS: M3 = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB: M3 = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const LMS_TO_XYZ: M3 = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const OKLAB_TO_LMS: M3 = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];

const mul = (m: M3, v: readonly [number, number, number]): [number, number, number] => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

/** sRGB transfer function, channel 0-1 to linear light. */
export const toLinear = (c: number): number => {
  const abs = Math.abs(c);
  return abs <= 0.04045 ? c / 12.92 : Math.sign(c) * ((abs + 0.055) / 1.055) ** 2.4;
};

export const fromLinear = (c: number): number => {
  const abs = Math.abs(c);
  return abs > 0.0031308 ? Math.sign(c) * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * c;
};

export interface Oklab {
  l: number;
  a: number;
  b: number;
}

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const xyz = mul(LIN_SRGB_TO_XYZ, [toLinear(r / 255), toLinear(g / 255), toLinear(b / 255)]);
  const lms = mul(XYZ_TO_LMS, xyz).map(Math.cbrt) as [number, number, number];
  const [l, a, bb] = mul(LMS_TO_OKLAB, lms);
  return { l, a, b: bb };
}

/** Raw (unclamped) linear sRGB of an OKLab colour; values outside 0-1 mean it is outside the sRGB gamut. */
function oklabToLinear(l: number, a: number, b: number): [number, number, number] {
  const lms = mul(OKLAB_TO_LMS, [l, a, b]).map((v) => v ** 3) as [number, number, number];
  return mul(XYZ_TO_LIN_SRGB, mul(LMS_TO_XYZ, lms));
}

const EPS = 1e-4;
const inGamut = (lin: readonly number[]): boolean => lin.every((c) => c >= -EPS && c <= 1 + EPS);
const linearToRgb = (lin: readonly number[]): Rgb => ({
  r: clamp(fromLinear(lin[0]), 0, 1) * 255,
  g: clamp(fromLinear(lin[1]), 0, 1) * 255,
  b: clamp(fromLinear(lin[2]), 0, 1) * 255,
});

export interface GamutResult {
  rgb: Rgb;
  /** False when the colour was outside sRGB and its chroma was reduced to fit. */
  inGamut: boolean;
}

export function oklabToRgb(l: number, a: number, b: number): GamutResult {
  const lin = oklabToLinear(l, a, b);
  if (inGamut(lin)) return { rgb: linearToRgb(lin), inGamut: true };
  const chroma = Math.hypot(a, b);
  return oklchToRgb(l, chroma, ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360);
}

/**
 * OKLCH to sRGB. Colours outside the sRGB gamut keep their lightness and hue and have their chroma reduced
 * (binary search) until they fit. This is a simplified form of the CSS Color 4 gamut mapping, not the full
 * deltaEOK algorithm, so a browser may pick a very slightly different in-gamut colour.
 */
export function oklchToRgb(l: number, c: number, h: number): GamutResult {
  if (l <= 0) return { rgb: { r: 0, g: 0, b: 0 }, inGamut: c === 0 };
  if (l >= 1) return { rgb: { r: 255, g: 255, b: 255 }, inGamut: c === 0 };
  const rad = (h * Math.PI) / 180;
  const at = (chroma: number) => oklabToLinear(l, chroma * Math.cos(rad), chroma * Math.sin(rad));
  const full = at(c);
  if (inGamut(full)) return { rgb: linearToRgb(full), inGamut: true };
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid;
    else hi = mid;
  }
  return { rgb: linearToRgb(at(lo)), inGamut: false };
}

export function rgbToOklch(rgb: Rgb): { l: number; c: number; h: number } {
  const { l, a, b } = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  // Below this chroma the hue is numerical noise (the colour is achromatic).
  const h = c < 0.0004 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h };
}

// Formatting -----------------------------------------------------------------------------------------------------

const hex2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

export function toHex({ r, g, b, a }: Rgba, withAlpha = a < 1): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${withAlpha ? hex2(a * 255) : ''}`;
}

const alphaPart = (a: number): string => (a < 1 ? ` / ${round(a, 3)}` : '');

export interface ColorFormats {
  hex: string;
  rgb: string;
  hsl: string;
  hwb: string;
  hsv: string;
  cmyk: string;
  oklch: string;
  oklab: string;
  name: string | null;
}

/** Every output format as a string, rounded for display (the stored colour keeps full precision). */
export function formatColor(color: Rgba): ColorFormats {
  const r = Math.round(color.r);
  const g = Math.round(color.g);
  const b = Math.round(color.b);
  const hsl = rgbToHsl(color);
  const hsv = rgbToHsv(color);
  const cmyk = rgbToCmyk(color);
  const lch = rgbToOklch(color);
  const lab = rgbToOklab(color);
  const w = Math.min(color.r, color.g, color.b) / 255;
  const bk = 1 - Math.max(color.r, color.g, color.b) / 255;
  const a = alphaPart(color.a);
  const hex = toHex(color);
  const hex6 = toHex(color, false).slice(1);
  const name = [...NAMED_COLORS].find(([, v]) => v === hex6)?.[0] ?? null;
  return {
    hex,
    rgb: `rgb(${r} ${g} ${b}${a})`,
    hsl: `hsl(${round(hsl.h)} ${round(hsl.s)}% ${round(hsl.l)}%${a})`,
    hwb: `hwb(${round(hsl.h)} ${round(w * 100)}% ${round(bk * 100)}%${a})`,
    hsv: `hsv(${round(hsv.h)}, ${round(hsv.s)}%, ${round(hsv.v)}%)`,
    cmyk: `cmyk(${round(cmyk.c)}%, ${round(cmyk.m)}%, ${round(cmyk.y)}%, ${round(cmyk.k)}%)`,
    oklch: `oklch(${round(lch.l, 4)} ${round(lch.c, 4)} ${round(lch.h, 2)}${a})`,
    oklab: `oklab(${round(lab.l, 4)} ${round(lab.a, 4)} ${round(lab.b, 4)}${a})`,
    name: color.a === 1 ? name : null,
  };
}

/** The CSS named colour closest to this one (distance in OKLab), with whether it is an exact match. */
export function nearestNamed(color: Rgba): { name: string; hex: string; exact: boolean } {
  const target = rgbToOklab(color);
  let best = { name: 'black', hex: '#000000', dist: Infinity };
  for (const [name, hex] of NAMED_COLORS) {
    const c = parseHex(hex)!;
    const o = rgbToOklab(c);
    const dist = (o.l - target.l) ** 2 + (o.a - target.a) ** 2 + (o.b - target.b) ** 2;
    if (dist < best.dist) best = { name, hex: `#${hex}`, dist };
  }
  return { name: best.name, hex: best.hex, exact: best.dist < 1e-9 };
}

// WCAG contrast --------------------------------------------------------------------------------------------------

/** WCAG 2.2 relative luminance of an sRGB colour (alpha ignored). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
}

/** WCAG contrast ratio, 1 to 21, from the lighter and darker luminances. Not rounded. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Puts a translucent colour over an opaque background, in sRGB (what browsers do for plain rgba()). */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

export interface WcagResult {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  /** WCAG 1.4.11: user-interface components and graphics need 3:1. */
  nonText: boolean;
}

/** Thresholds from WCAG 2.2 SC 1.4.3, 1.4.6 and 1.4.11. The ratio is compared unrounded (4.499 fails 4.5). */
export function wcagLevels(ratio: number): WcagResult {
  return { ratio, aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5, nonText: ratio >= 3 };
}

// Palettes -------------------------------------------------------------------------------------------------------

/** Linear mix in gamma-encoded sRGB (like Sass mix()): weight 0 is `from`, 1 is `to`. */
export function mix(from: Rgba, to: Rgba, weight: number): Rgba {
  const m = (x: number, y: number) => x + (y - x) * weight;
  return { r: m(from.r, to.r), g: m(from.g, to.g), b: m(from.b, to.b), a: from.a };
}

export interface Swatch {
  /** Percentage of white or black mixed in (0 is the base colour). */
  percent: number;
  hex: string;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

export function tints(base: Rgba, steps = 9): Swatch[] {
  return Array.from({ length: steps }, (_, i) => {
    const percent = Math.round(((i + 1) / (steps + 1)) * 100);
    return { percent, hex: toHex(mix(base, WHITE, percent / 100), false) };
  });
}

export function shades(base: Rgba, steps = 9): Swatch[] {
  return Array.from({ length: steps }, (_, i) => {
    const percent = Math.round(((i + 1) / (steps + 1)) * 100);
    return { percent, hex: toHex(mix(base, BLACK, percent / 100), false) };
  });
}

/** CSS custom properties for a colour and its palette, ready to paste into :root. */
export function cssVariables(name: string, base: Rgba, tintList: Swatch[], shadeList: Swatch[]): string {
  const slug = name.replace(/[^a-z0-9-]/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'color';
  const f = formatColor(base);
  const lines = [
    `--${slug}: ${toHex(base)};`,
    `--${slug}-rgb: ${Math.round(base.r)} ${Math.round(base.g)} ${Math.round(base.b)};`,
    `--${slug}-hsl: ${f.hsl.slice(4, -1).split(' / ')[0]};`,
    `--${slug}-oklch: ${f.oklch.slice(6, -1)};`,
    ...tintList.map((t) => `--${slug}-tint-${t.percent}: ${t.hex};`),
    ...shadeList.map((s) => `--${slug}-shade-${s.percent}: ${s.hex};`),
  ];
  return `:root {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;
}
