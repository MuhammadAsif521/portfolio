import { describe, expect, it } from 'vitest';
import {
  EMPTY_META_FORM,
  SAMPLE_META_FORM,
  breadcrumbUrl,
  buildMetaTags,
  descriptionMeter,
  escapeAttr,
  estimateWidth,
  hostOf,
  isAbsoluteHttpUrl,
  normalizeHandle,
  robotsContent,
  titleMeter,
  truncateToWidth,
  validateMeta,
  type MetaForm,
} from './meta-logic';

const form = (over: Partial<MetaForm> = {}): MetaForm => ({ ...EMPTY_META_FORM, ...over });

describe('buildMetaTags', () => {
  it('writes charset, viewport, title, description and canonical', () => {
    const html = buildMetaTags(form({ title: 'Hello', description: 'A page.', canonical: 'https://example.com/a', ogEnabled: false, twitterCard: '' }));
    expect(html).toBe(
      [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Hello</title>',
        '<meta name="description" content="A page.">',
        '<link rel="canonical" href="https://example.com/a">',
      ].join('\n'),
    );
  });

  it('escapes quotes, ampersands and angle brackets', () => {
    const html = buildMetaTags(form({ title: 'Tom & "Jerry" <b>', description: 'He said "hi" & left', ogEnabled: false, twitterCard: '' }));
    expect(html).toContain('<title>Tom &amp; "Jerry" &lt;b&gt;</title>');
    expect(html).toContain('content="He said &quot;hi&quot; &amp; left"');
    expect(escapeAttr('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });

  it('adds Open Graph from the page fields and lets overrides win', () => {
    const html = buildMetaTags(form({ title: 'T', description: 'D', canonical: 'https://x.com/', ogSiteName: 'X', ogImage: 'https://x.com/i.png', ogImageAlt: 'An image', ogTitle: 'Social title' }));
    expect(html).toContain('<meta property="og:title" content="Social title">');
    expect(html).toContain('<meta property="og:description" content="D">');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:url" content="https://x.com/">');
    expect(html).toContain('<meta property="og:site_name" content="X">');
    expect(html).toContain('<meta property="og:image" content="https://x.com/i.png">');
    expect(html).toContain('<meta property="og:image:alt" content="An image">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('writes twitter title/description/image itself when Open Graph is off', () => {
    const html = buildMetaTags(form({ title: 'T', description: 'D', ogEnabled: false, ogImage: 'https://x.com/i.png', twitterSite: 'handle' }));
    expect(html).not.toContain('og:');
    expect(html).toContain('<meta name="twitter:site" content="@handle">');
    expect(html).toContain('<meta name="twitter:title" content="T">');
    expect(html).toContain('<meta name="twitter:image" content="https://x.com/i.png">');
  });

  it('writes robots only when it differs from the default', () => {
    expect(buildMetaTags(form({ title: 'T' }))).not.toContain('name="robots"');
    expect(buildMetaTags(form({ title: 'T', index: false, follow: false }))).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(robotsContent({ index: true, follow: true, maxSnippet: '-1', maxImagePreview: 'large' })).toBe('max-snippet:-1, max-image-preview:large');
    expect(robotsContent({ index: true, follow: true, maxSnippet: 'abc', maxImagePreview: '' })).toBe('');
  });

  it('supports light and dark theme colours and icon links', () => {
    const html = buildMetaTags(form({ themeColor: '#fff', themeColorDark: '#000', faviconIco: '/favicon.ico', faviconSvg: '/f.svg', appleTouchIcon: '/a.png', manifest: '/site.webmanifest' }));
    expect(html).toContain('<meta name="theme-color" content="#fff" media="(prefers-color-scheme: light)">');
    expect(html).toContain('<meta name="theme-color" content="#000" media="(prefers-color-scheme: dark)">');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32">');
    expect(html).toContain('<link rel="icon" href="/f.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/a.png">');
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest">');
    expect(buildMetaTags(form({ themeColor: '#123456' }))).toContain('<meta name="theme-color" content="#123456">');
  });

  it('produces a complete sample and an empty form still gives the two basics', () => {
    expect(buildMetaTags(SAMPLE_META_FORM)).toContain('<title>Handmade Ceramic Mugs | Clay &amp; Co.</title>');
    expect(buildMetaTags(form({ ogEnabled: false, twitterCard: '' }))).toBe('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">');
  });

  it('normalises handles', () => {
    expect(normalizeHandle('me')).toBe('@me');
    expect(normalizeHandle(' @me ')).toBe('@me');
    expect(normalizeHandle('')).toBe('');
  });
});

describe('validateMeta', () => {
  const messages = (f: MetaForm) => validateMeta(f).map((i) => i.message).join('\n');

  it('requires a title and flags bad URLs', () => {
    expect(validateMeta(form()).find((i) => i.level === 'error')?.message).toMatch(/title/);
    expect(messages(form({ title: 'T', canonical: '/relative' }))).toMatch(/canonical URL must be absolute/);
    expect(messages(form({ title: 'T', ogImage: 'img.png' }))).toMatch(/social image must be an absolute URL/);
    expect(messages(form({ title: 'T', ogImage: 'https://x.com/i.png' }))).toMatch(/alt text/);
  });

  it('warns about noindex and a bad max-snippet', () => {
    expect(messages(form({ title: 'T', index: false }))).toMatch(/noindex/);
    expect(validateMeta(form({ title: 'T', maxSnippet: 'x' })).some((i) => i.level === 'error')).toBe(true);
  });

  it('is quiet for a complete sample', () => {
    expect(validateMeta(SAMPLE_META_FORM).filter((i) => i.level !== 'info')).toEqual([]);
  });

  it('checks absolute URLs', () => {
    expect(isAbsoluteHttpUrl('https://a.com')).toBe(true);
    expect(isAbsoluteHttpUrl('ftp://a.com')).toBe(false);
    expect(isAbsoluteHttpUrl('a.com')).toBe(false);
  });
});

describe('length estimates', () => {
  it('estimates Arial widths (20 px)', () => {
    // Arial advance widths: "Hello" = 722+556+222+222+556 = 2278 units -> 45.6 px at 20 px.
    expect(estimateWidth('Hello', 20)).toBe(46);
    expect(estimateWidth('', 20)).toBe(0);
    expect(estimateWidth('iiii', 20)).toBeLessThan(estimateWidth('mmmm', 20));
    expect(estimateWidth('日本', 20)).toBe(40);
  });

  it('truncates by estimated width with an ellipsis', () => {
    const long = 'The quick brown fox jumps over the lazy dog and keeps running through the field';
    const cut = truncateToWidth(long, 300, 20);
    expect(cut.truncated).toBe(true);
    expect(cut.text.endsWith('…')).toBe(true);
    expect(estimateWidth(cut.text, 20)).toBeLessThanOrEqual(300);
    expect(truncateToWidth('Short', 300, 20)).toEqual({ text: 'Short', truncated: false });
  });

  it('title meter', () => {
    expect(titleMeter('').state).toBe('empty');
    expect(titleMeter('Hi').state).toBe('short');
    expect(titleMeter('Handmade Ceramic Mugs | Clay & Co.').state).toBe('good');
    const t = titleMeter('A very long page title that goes on and on and on, far beyond what a search result can show');
    expect(t.state).toBe('long');
    expect(t.chars).toBeGreaterThan(60);
    expect(t.pixels).toBeGreaterThan(600);
  });

  it('description meter', () => {
    expect(descriptionMeter('').state).toBe('empty');
    expect(descriptionMeter('Too short.').state).toBe('short');
    expect(descriptionMeter('x'.repeat(120)).state).toBe('good');
    expect(descriptionMeter('x'.repeat(200)).state).toBe('long');
    expect(descriptionMeter('😀'.repeat(100)).chars).toBe(100);
  });

  it('formats the result URL and host', () => {
    expect(breadcrumbUrl('https://example.com/blog/my%20post/')).toBe('example.com › blog › my post');
    expect(breadcrumbUrl('')).toBe('example.com');
    expect(hostOf('https://shop.example.com/x')).toBe('shop.example.com');
    expect(hostOf('nope')).toBe('');
  });
});
