import { describe, expect, it } from 'vitest';
import {
  NAMED_COLORS,
  compositeOver,
  contrastRatio,
  cssVariables,
  formatColor,
  hslToRgb,
  mix,
  nearestNamed,
  oklchToRgb,
  parseColor,
  relativeLuminance,
  rgbToCmyk,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  shades,
  tints,
  toHex,
  wcagLevels,
  type Rgba,
} from './color-logic';

const c = (input: string): Rgba => {
  const parsed = parseColor(input);
  if (!parsed) throw new Error(`could not parse ${input}`);
  return parsed;
};

describe('parseColor', () => {
  it('reads hex in 3, 4, 6 and 8 digits', () => {
    expect(c('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(c('#FF000080').a).toBeCloseTo(128 / 255, 6);
    expect(c('#0f08').a).toBeCloseTo(136 / 255, 6);
    expect(c('336699')).toMatchObject({ r: 51, g: 102, b: 153 });
    expect(parseColor('#12')).toBeNull();
    expect(parseColor('#ggg')).toBeNull();
  });

  it('reads named colours and transparent', () => {
    expect(c('RebeccaPurple')).toMatchObject({ r: 102, g: 51, b: 153 });
    expect(c('transparent').a).toBe(0);
    expect(NAMED_COLORS.size).toBe(148);
    expect(parseColor('notacolour')).toBeNull();
  });

  it('reads rgb() in comma and space syntax, with percentages and alpha', () => {
    expect(c('rgb(255, 128, 0)')).toMatchObject({ r: 255, g: 128, b: 0 });
    expect(c('rgb(100% 0% 0% / 50%)')).toMatchObject({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(c('rgba(0,0,0,0.25)').a).toBe(0.25);
    expect(c('rgb(300 -5 0)')).toMatchObject({ r: 255, g: 0 });
    expect(parseColor('rgb(1 2)')).toBeNull();
    expect(parseColor('rgb(a b c)')).toBeNull();
  });

  it('reads hsl(), hwb(), hsv() and cmyk()', () => {
    expect(c('hsl(120 100% 50%)')).toMatchObject({ r: 0, g: 255, b: 0 });
    expect(c('hsl(0.5turn, 100%, 50%)')).toMatchObject({ r: 0, g: 255, b: 255 });
    expect(c('hwb(0 0% 0%)')).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(c('hwb(0 50% 50%)')).toMatchObject({ r: 127.5, g: 127.5, b: 127.5 });
    expect(c('hsv(120, 100%, 100%)')).toMatchObject({ r: 0, g: 255, b: 0 });
    expect(c('cmyk(0%, 100%, 100%, 0%)')).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(c('cmyk(0 0 0 100)')).toMatchObject({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('OKLab and OKLCH (CSS Color 4 matrices)', () => {
  it('matches the published OKLCH values of the sRGB primaries', () => {
    const red = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(red.l).toBeCloseTo(0.6280, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const green = rgbToOklch({ r: 0, g: 255, b: 0 });
    expect(green.l).toBeCloseTo(0.8664, 3);
    expect(green.c).toBeCloseTo(0.2948, 3);
    expect(green.h).toBeCloseTo(142.5, 0);
    const blue = rgbToOklch({ r: 0, g: 0, b: 255 });
    expect(blue.l).toBeCloseTo(0.452, 3);
    expect(blue.c).toBeCloseTo(0.3132, 3);
    expect(blue.h).toBeCloseTo(264.05, 1);
  });

  it('white is L 1 and black is L 0 with no chroma', () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(white.l).toBeCloseTo(1, 4);
    expect(white.c).toBeLessThan(0.0001);
    expect(rgbToOklch({ r: 0, g: 0, b: 0 })).toMatchObject({ l: 0, c: 0 });
  });

  it('round-trips colours through OKLCH', () => {
    for (const hex of ['#ff0000', '#1d4ed8', '#fd853a', '#808080', '#0ea5e9', '#123456']) {
      const src = c(hex);
      const lch = rgbToOklch(src);
      const back = oklchToRgb(lch.l, lch.c, lch.h);
      expect(back.inGamut).toBe(true);
      expect(back.rgb.r).toBeCloseTo(src.r, 0);
      expect(back.rgb.g).toBeCloseTo(src.g, 0);
      expect(back.rgb.b).toBeCloseTo(src.b, 0);
    }
  });

  it('parses oklch() and oklab() and reports out-of-gamut colours', () => {
    const red = c('oklch(0.628 0.2577 29.23)');
    expect(red.r).toBeCloseTo(255, 0);
    expect(red.g).toBeLessThan(2);
    expect(c('oklch(62.8% 0.2577 29.23deg / 0.5)').a).toBe(0.5);
    const white = c('oklab(1 0 0)');
    expect(white.r).toBeCloseTo(255, 4);
    expect(white.b).toBeCloseTo(255, 4);
    const wild = oklchToRgb(0.7, 0.4, 150);
    expect(wild.inGamut).toBe(false);
    expect(wild.rgb.g).toBeGreaterThan(wild.rgb.r);
    expect(wild.rgb.r).toBeGreaterThanOrEqual(0);
    expect(wild.rgb.g).toBeLessThanOrEqual(255);
  });
});

describe('RGB to HSL, HSV, CMYK', () => {
  it('converts known colours', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    const hsl = rgbToHsl(c('#1d4ed8'));
    expect(hsl.h).toBeCloseTo(224.3, 0);
    expect(hsl.s).toBeCloseTo(76.3, 0);
    expect(hsl.l).toBeCloseTo(48.0, 0);
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toMatchObject({ h: 0, s: 0 });
    expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, v: 100 });
    expect(rgbToCmyk({ r: 255, g: 0, b: 0 })).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(hslToRgb(240, 100, 50)).toMatchObject({ r: 0, g: 0, b: 255 });
  });
});

describe('formatColor', () => {
  it('produces every format and the CSS name when there is one', () => {
    const f = formatColor(c('#ff0000'));
    expect(f).toMatchObject({
      hex: '#ff0000',
      rgb: 'rgb(255 0 0)',
      hsl: 'hsl(0 100% 50%)',
      hwb: 'hwb(0 0% 0%)',
      hsv: 'hsv(0, 100%, 100%)',
      cmyk: 'cmyk(0%, 100%, 100%, 0%)',
      name: 'red',
    });
    expect(f.oklch).toBe('oklch(0.628 0.2577 29.23)');
  });

  it('adds alpha and drops the name for translucent colours', () => {
    const f = formatColor(c('rgb(255 0 0 / 50%)'));
    expect(f.hex).toBe('#ff000080');
    expect(f.rgb).toBe('rgb(255 0 0 / 0.5)');
    expect(f.name).toBeNull();
  });

  it('finds the nearest CSS colour', () => {
    expect(nearestNamed(c('#ff7f50'))).toMatchObject({ name: 'coral', exact: true });
    expect(nearestNamed(c('#fe7f50')).exact).toBe(false);
    expect(nearestNamed(c('#fe7f50')).name).toBe('coral');
  });

  it('toHex rounds and can omit alpha', () => {
    expect(toHex({ r: 254.6, g: 0.4, b: 0, a: 1 })).toBe('#ff0000');
    expect(toHex({ r: 0, g: 0, b: 0, a: 0.5 }, false)).toBe('#000000');
  });
});

describe('WCAG 2.2 contrast', () => {
  it('relative luminance of black and white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 6);
  });

  it('black on white is 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 6);
    expect(contrastRatio(c('#fff'), c('#000'))).toBeCloseTo(21, 6);
    expect(contrastRatio(c('#abc'), c('#abc'))).toBe(1);
  });

  it('#777 on white is 4.48:1 and fails AA for normal text; #767676 passes', () => {
    const white = c('#fff');
    const grey777 = contrastRatio(c('#777777'), white);
    expect(grey777).toBeCloseTo(4.478, 2);
    expect(wcagLevels(grey777)).toMatchObject({ aaNormal: false, aaLarge: true, aaaNormal: false, aaaLarge: false });
    const grey767676 = contrastRatio(c('#767676'), white);
    expect(grey767676).toBeCloseTo(4.542, 2);
    expect(wcagLevels(grey767676).aaNormal).toBe(true);
  });

  it('thresholds are not rounded up', () => {
    expect(wcagLevels(4.499).aaNormal).toBe(false);
    expect(wcagLevels(4.5).aaNormal).toBe(true);
    expect(wcagLevels(2.999).nonText).toBe(false);
    expect(wcagLevels(7).aaaNormal).toBe(true);
    expect(wcagLevels(6.99).aaaNormal).toBe(false);
    expect(wcagLevels(4.5).aaaLarge).toBe(true);
  });

  it('composites a translucent foreground over its background first', () => {
    const over = compositeOver(c('rgb(0 0 0 / 50%)'), c('#fff'));
    expect(over).toMatchObject({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });
});

describe('palettes and CSS variables', () => {
  it('mixes in sRGB', () => {
    expect(mix(c('#000'), c('#fff'), 0.5)).toMatchObject({ r: 127.5 });
  });

  it('builds tints towards white and shades towards black', () => {
    const t = tints(c('#ff0000'), 3);
    expect(t.map((s) => s.percent)).toEqual([25, 50, 75]);
    expect(t[1].hex).toBe('#ff8080');
    const s = shades(c('#ff0000'), 1);
    expect(s).toEqual([{ percent: 50, hex: '#800000' }]);
    expect(tints(c('#ff0000')).length).toBe(9);
  });

  it('writes :root variables', () => {
    const css = cssVariables('Brand Blue', c('#1d4ed8'), tints(c('#1d4ed8'), 1), shades(c('#1d4ed8'), 1));
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain('--brand-blue: #1d4ed8;');
    expect(css).toContain('--brand-blue-rgb: 29 78 216;');
    expect(css).toContain('--brand-blue-tint-50:');
    expect(css).toContain('--brand-blue-shade-50:');
    expect(css).toMatch(/--brand-blue-oklch: [\d.]+ [\d.]+ [\d.]+;/);
  });
});
