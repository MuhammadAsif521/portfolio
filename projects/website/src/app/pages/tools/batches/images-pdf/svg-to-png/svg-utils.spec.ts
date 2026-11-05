import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES, SvgError, checkSvgText, intrinsicSize, neutraliseCss, parseSvgLength, parseViewBox, prepareSvg, svgAtSize } from './svg-utils';

describe('parseSvgLength', () => {
  it('converts absolute units to CSS pixels', () => {
    expect(parseSvgLength('120')).toBe(120);
    expect(parseSvgLength(' 12.5px ')).toBe(12.5);
    expect(parseSvgLength('1in')).toBe(96);
    expect(parseSvgLength('72pt')).toBeCloseTo(96, 6);
    expect(parseSvgLength('10mm')).toBeCloseTo(37.795, 2);
    expect(parseSvgLength('1e2')).toBe(100);
  });

  it('returns null for relative, empty, negative and invalid values', () => {
    for (const v of ['50%', '2em', '3ex', '', '   ', '-5', '0', 'auto', 'abc', '12 34', '10furlongs']) expect(parseSvgLength(v), v).toBeNull();
    expect(parseSvgLength(null)).toBeNull();
    expect(parseSvgLength(undefined)).toBeNull();
  });
});

describe('parseViewBox and intrinsicSize', () => {
  it('parses viewBox with spaces or commas and rejects bad ones', () => {
    expect(parseViewBox('0 0 120 80')).toEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(parseViewBox('-5,-5,10,20')).toEqual({ x: -5, y: -5, width: 10, height: 20 });
    expect(parseViewBox('0 0 0 10')).toBeNull();
    expect(parseViewBox('0 0 10')).toBeNull();
    expect(parseViewBox('a b c d')).toBeNull();
    expect(parseViewBox(null)).toBeNull();
  });

  it('prefers width and height, then the viewBox shape, then says the size is a guess', () => {
    expect(intrinsicSize('200', '100', '0 0 10 10')).toEqual({ width: 200, height: 100, known: true });
    expect(intrinsicSize(null, null, '0 0 120 80')).toEqual({ width: 120, height: 80, known: true });
    expect(intrinsicSize('240', null, '0 0 120 80')).toEqual({ width: 240, height: 160, known: true });
    expect(intrinsicSize('100%', '100%', '0 0 50 25')).toEqual({ width: 50, height: 25, known: true });
    expect(intrinsicSize(null, '40', '0 0 100 50')).toEqual({ width: 80, height: 40, known: true });
    expect(intrinsicSize(null, null, null)).toEqual({ width: 300, height: 150, known: false });
    expect(intrinsicSize('64', null, null)).toEqual({ width: 64, height: 64, known: false });
  });
});

describe('neutraliseCss and checkSvgText', () => {
  it('removes @import and url() that is not a fragment reference', () => {
    expect(neutraliseCss('@import url("https://evil.test/a.css"); .a{fill:red}')).toBe(' .a{fill:red}');
    expect(neutraliseCss('.a{fill:url(https://evil.test/x)}')).toBe('.a{fill:url(#)}');
    expect(neutraliseCss(".a{background:url( 'data:image/svg+xml;base64,AAAA' )}")).toBe('.a{background:url(#)}');
    expect(neutraliseCss('.a{fill:url(#gradient)}')).toBe('.a{fill:url(#gradient)}');
  });

  it('rejects empty, non-SVG, oversized and entity-declaring text early', () => {
    expect(checkSvgText('')).toMatch(/Paste/);
    expect(checkSvgText('<html></html>')).toMatch(/no <svg>/);
    expect(checkSvgText('<svg>' + 'a'.repeat(MAX_SVG_BYTES))).toMatch(/over 5 MB/);
    expect(checkSvgText('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg>&a;</svg>')).toMatch(/ENTITY/);
    expect(checkSvgText('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull();
  });
});

describe('prepareSvg', () => {
  const wrap = (inner: string, attrs = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"') => `<svg ${attrs}>${inner}</svg>`;

  it('keeps drawing elements and measures the SVG', async () => {
    const result = await prepareSvg(wrap('<rect width="100" height="50" fill="#123456"/><circle cx="10" cy="10" r="5"/>'));
    expect(result.markup).toContain('<rect');
    expect(result.markup).toContain('<circle');
    expect(result.size).toEqual({ width: 100, height: 50, known: true });
    expect(result.removed).toEqual([]);
  });

  it('removes scripts, event handlers, foreignObject and animation, and reports them', async () => {
    const result = await prepareSvg(
      wrap(
        '<script>alert(1)</script><rect width="10" height="10" onclick="alert(2)" onload="x()"/><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject><set attributeName="href" to="javascript:alert(3)"/>',
      ),
    );
    expect(result.markup).not.toMatch(/script|alert|onclick|onload|foreignObject|<set/i);
    expect(result.markup).toContain('<rect');
    expect(result.removed.length).toBeGreaterThan(0);
  });

  it('drops links to other files but keeps in-file references and embedded rasters', async () => {
    const result = await prepareSvg(
      wrap(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><rect id="r" width="5" height="5"/></defs>' +
          '<use href="#r"/><image href="https://evil.test/track.png" width="5" height="5"/><image href="data:image/png;base64,iVBORw0KGgo=" width="5" height="5"/>' +
          '<a href="javascript:alert(1)"><rect width="1" height="1"/></a><rect width="9" height="9" fill="url(#g)"/>',
      ),
    );
    expect(result.markup).toContain('href="#r"');
    expect(result.markup).not.toContain('evil.test');
    expect(result.markup).not.toContain('javascript:');
    expect(result.markup).toContain('data:image/png;base64');
    expect(result.markup).toContain('url(#g)');
  });

  it('neutralises CSS that could fetch resources but keeps ordinary styles', async () => {
    const result = await prepareSvg(
      wrap('<style>@import url(https://evil.test/x.css); .a{fill:blue; background:url(https://evil.test/p.png)}</style><rect class="a" width="3" height="3" style="fill:url(http://evil.test/q)"/>'),
    );
    expect(result.markup).not.toContain('evil.test');
    expect(result.markup).toContain('fill:blue');
  });

  it('reports a default size, flagged as unknown, for an SVG with no width, height or viewBox', async () => {
    const result = await prepareSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    expect(result.size).toEqual({ width: 300, height: 150, known: false });
  });

  it('rejects malformed XML and non-SVG roots with a plain message', async () => {
    await expect(prepareSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>')).rejects.toBeInstanceOf(SvgError);
    await expect(prepareSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>')).rejects.toMatchObject({ message: expect.stringContaining('not valid SVG') });
    await expect(prepareSvg('<div>hi</div> <svg')).rejects.toBeInstanceOf(SvgError);
    await expect(prepareSvg('')).rejects.toBeInstanceOf(SvgError);
  });
});

describe('svgAtSize', () => {
  it('sets the root size, adds a viewBox from the intrinsic size when missing, and keeps xmlns', async () => {
    const prepared = await prepareSvg('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>');
    const out = svgAtSize(prepared, 160, 80);
    const root = new DOMParser().parseFromString(out, 'image/svg+xml').documentElement;
    expect(root.getAttribute('width')).toBe('160');
    expect(root.getAttribute('height')).toBe('80');
    expect(root.getAttribute('viewBox')).toBe('0 0 40 20');
    expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
  });

  it('keeps an existing viewBox', async () => {
    const prepared = await prepareSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 30 30"><rect width="3" height="3"/></svg>');
    const root = new DOMParser().parseFromString(svgAtSize(prepared, 90, 90), 'image/svg+xml').documentElement;
    expect(root.getAttribute('viewBox')).toBe('10 10 30 30');
    expect(root.getAttribute('width')).toBe('90');
  });
});
