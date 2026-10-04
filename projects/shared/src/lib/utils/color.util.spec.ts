import { contrastRatio, DARK_SURFACE, DARK_TEXT, isHexColor, LIGHT_SURFACE, LIGHT_TEXT, readableShade, readableTextOn, relativeLuminance } from './color.util';

describe('color.util', () => {
  it('validates #RRGGBB colours only', () => {
    expect(isHexColor('#FF7A3D')).toBe(true);
    expect(isHexColor('#ff7a3d')).toBe(true);
    expect(isHexColor('#FFF')).toBe(false);
    expect(isHexColor('orange')).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });

  it('computes WCAG luminance and contrast', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FF7A3D', LIGHT_TEXT)).toBeCloseTo(2.6, 1); // why white on the Figma orange fails AA
  });

  it('picks readable text for the default palette and for dark/light brand colours', () => {
    expect(readableTextOn('#FF7A3D')).toBe(DARK_TEXT); // default primary
    expect(readableTextOn('#141414')).toBe(LIGHT_TEXT); // default secondary
    expect(readableTextOn('#FF9A5C')).toBe(DARK_TEXT); // default accent
    expect(readableTextOn('#1D4ED8')).toBe(LIGHT_TEXT); // a deep blue admin theme
    expect(contrastRatio('#FF7A3D', readableTextOn('#FF7A3D'))).toBeGreaterThan(4.5);
  });
});

describe('readableShade', () => {
  it('keeps a colour that already passes and shades one that does not, just past AA', () => {
    expect(readableShade('#1D4ED8', LIGHT_SURFACE)).toBe('#1D4ED8');
    const ink = readableShade('#D97706', LIGHT_SURFACE);
    expect(ink).not.toBe('#D97706');
    expect(contrastRatio(ink, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink, LIGHT_SURFACE)).toBeLessThan(5);
  });

  it('lightens towards white on dark surfaces', () => {
    const ink = readableShade('#1D4ED8', DARK_SURFACE);
    expect(relativeLuminance(ink)).toBeGreaterThan(relativeLuminance('#1D4ED8'));
    expect(contrastRatio(ink, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('matches the CSS defaults for the Default theme', () => {
    expect(readableShade('#FD853A', LIGHT_SURFACE)).toBe('#AA5927');
    expect(readableShade('#FD853A', DARK_SURFACE)).toBe('#FD853A');
  });
});
