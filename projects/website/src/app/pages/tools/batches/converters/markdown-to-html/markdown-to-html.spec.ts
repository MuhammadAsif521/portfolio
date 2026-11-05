import { describe, expect, it } from 'vitest';
import { activeContentIn, convertMarkdown, DEFAULT_MARKDOWN, escapeHtml, slugify, type MarkdownOptions } from './markdown-to-html.logic';
import { sanitizePreview } from './markdown-preview';

const run = (md: string, over: Partial<MarkdownOptions> = {}) => convertMarkdown(md, { ...DEFAULT_MARKDOWN, ...over });

async function html(md: string, over: Partial<MarkdownOptions> = {}): Promise<string> {
  const r = await run(md, over);
  if (!r.ok) throw new Error(r.error.message);
  return r.output;
}

describe('markdown to html', () => {
  it('renders headings, emphasis, lists, links and code', async () => {
    const out = await html('# Title\n\nSome *emphasis*, **bold** and `code`.\n\n- one\n- two\n\n1. a\n2. b\n\n[link](https://example.com "T")\n\n```js\nconst a = 1;\n```\n');
    expect(out).toContain('<h1 id="title">Title</h1>');
    expect(out).toContain('<em>emphasis</em>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<code>code</code>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<ol>');
    expect(out).toContain('<a href="https://example.com" title="T">link</a>');
    expect(out).toContain('<pre><code class="language-js">');
  });

  it('supports GFM tables, task lists, strikethrough and autolinks, and can turn GFM off', async () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n~~gone~~ https://example.com\n';
    const gfm = await html(md);
    expect(gfm).toContain('<table>');
    expect(gfm).toContain('type="checkbox"');
    expect(gfm).toContain('<del>gone</del>');
    expect(gfm).toContain('<a href="https://example.com">');
    const plain = await html(md, { gfm: false });
    expect(plain).not.toContain('<table>');
    expect(plain).not.toContain('<del>');
  });

  it('turns single line breaks into <br> only when asked', async () => {
    expect(await html('a\nb')).not.toContain('<br');
    expect(await html('a\nb', { breaks: true })).toContain('<br>');
  });

  it('adds unique heading ids, or none', async () => {
    const out = await html('# Hello, World!\n\n## Same\n\n## Same\n\n## Über café 日本\n');
    expect(out).toContain('id="hello-world"');
    expect(out).toContain('<h2 id="same">');
    expect(out).toContain('<h2 id="same-1">');
    expect(out).toContain('id="über-café-日本"');
    expect(await html('# Title', { headingIds: false })).toContain('<h1>Title</h1>');
    expect(slugify('A <b>B</b> &amp; C')).toBe('a-b-c');
  });

  it('wraps the HTML in a full document with a title from the first H1', async () => {
    const out = await html('# My "Doc" & Co\n\nText', { fullDocument: true });
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('<title>My &quot;Doc&quot; &amp; Co</title>');
    expect(out).toContain('<style>');
    expect(out).toContain('<article>');
    expect(out).toContain('</html>');
    expect(await html('plain', { fullDocument: true })).toContain('<title>Document</title>');
  });

  it('returns raw HTML exactly as marked produced it, and warns when it is active', async () => {
    const md = 'Hi\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[x](javascript:alert(3))\n';
    const r = await run(md);
    expect(r.ok && r.output).toContain('<script>alert(1)</script>');
    expect(r.ok && r.output).toContain('onerror="alert(2)"');
    expect(r.ok && r.warnings.join(' ')).toContain('Sanitise untrusted Markdown');
    expect(activeContentIn('<p>safe</p>')).toEqual([]);
    expect(activeContentIn('<a href="javascript:x">')).toHaveLength(1);
    const clean = await run('# fine\n\n[ok](https://example.com)');
    expect(clean.ok && clean.warnings).toEqual([]);
  });

  it('keeps unicode, emoji, CRLF and a BOM', async () => {
    const out = await html('﻿# José 😀\r\n\r\nline one\r\nline two\r\n', { breaks: true });
    expect(out).toContain('José 😀');
    expect(out).toContain('<br>');
  });

  it('rejects empty input and survives very deep nesting without throwing', async () => {
    expect((await run('  \n ')).ok).toBe(false);
    const deep = await run('> '.repeat(2000) + 'x');
    expect(typeof deep.ok).toBe('boolean');
    const huge = await run('word '.repeat(200_000));
    expect(huge.ok).toBe(true);
  });

  it('escapes HTML helper input', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

describe('markdown preview sanitiser (DOMPurify)', () => {
  const clean = async (dirty: string) => (await sanitizePreview(dirty)).html;

  it('keeps ordinary formatting', async () => {
    const out = await clean('<h1 id="a">T</h1><p><strong>b</strong> <a href="https://example.com">l</a></p><table><tbody><tr><td>1</td></tr></tbody></table>');
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('id="md-preview-a"');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('<table>');
  });

  it('removes scripts, event handlers, javascript: URLs and other active content', async () => {
    const hostile = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '<a href="  JaVaScRiPt:alert(1)">x</a>',
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      '<svg onload=alert(1)><circle/></svg>',
      '<math><mtext><table><mglyph><style><img src onerror=alert(1)>',
      '<iframe src="https://evil.example"></iframe>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      '<object data="x"></object><embed src="x">',
      '<form action="https://evil.example"><input name="a"><button>go</button></form>',
      '<meta http-equiv="refresh" content="0;url=https://evil.example">',
      '<link rel="stylesheet" href="https://evil.example/x.css">',
      '<style>@import url(https://evil.example/x.css); body{background:url(https://evil.example/p.png)}</style>',
      '<div style="background:url(https://evil.example/p.png)">x</div>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<details open ontoggle=alert(1)>x</details>',
      '<p onclick="alert(1)" data-x="1">x</p>',
      '<base href="https://evil.example/">',
      '<a href="vbscript:alert(1)">x</a>',
    ].join('\n');
    const out = (await clean(hostile)).toLowerCase();
    for (const bad of ['<script', 'onerror', 'onload', 'ontoggle', 'onclick', 'javascript:', 'vbscript:', '<iframe', '<object', '<embed', '<form', '<meta', '<link', '<style', 'style=', '<base', '<svg', '<math', 'data-x', 'data:text/html', 'evil.example']) {
      expect(out, bad).not.toContain(bad);
    }
  });

  it('never keeps a remote image: it becomes its alt text', async () => {
    const r = await sanitizePreview('<p><img src="https://tracker.example/p.gif" alt="logo"> <img src="//t.example/a.png" alt=""></p>');
    expect(r.html).not.toContain('<img');
    expect(r.html).not.toContain('tracker.example');
    expect(r.html).toContain('[image: logo]');
    expect(r.blockedImages).toBe(2);
  });

  it('keeps small embedded data images but not SVG data images', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect((await clean(`<img src="${png}" alt="x">`))).toContain(png);
    const svg = await sanitizePreview('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="s">');
    expect(svg.html).not.toContain('<img');
  });

  it('keeps table alignment and column spans', async () => {
    const out = await clean('<table><tbody><tr><td align="right" colspan="2">x</td></tr></tbody></table><ol start="3"><li>a</li></ol>');
    expect(out).toContain('align="right"');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('start="3"');
  });

  it('turns task list checkboxes into text and drops other inputs', async () => {
    const out = await clean('<ul><li><input checked="" disabled="" type="checkbox"> done</li><li><input type="text" value="x"> t</li></ul>');
    expect(out).not.toContain('<input');
    expect(out).toContain('☑');
  });

  it('prefixes ids and repoints #links; drops links to missing anchors', async () => {
    const out = await clean('<h2 id="intro">Intro</h2><a href="#intro">go</a><a href="#missing">no</a>');
    expect(out).toContain('id="md-preview-intro"');
    expect(out).toContain('href="#md-preview-intro"');
    expect(out).not.toContain('#missing');
  });

  it('defuses DOM clobbering ids', async () => {
    const out = await clean('<img id="cookie" src="data:image/png;base64,iVBORw0KGgo="><a id="body" href="#x">x</a>');
    expect(out).not.toMatch(/id="(?:md-preview-)?(?:cookie|body)"[^>]*>/);
  });

  it('makes the whole pipeline safe: hostile Markdown in, clean preview out', async () => {
    const r = await run('# Hi\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n<script>alert(2)</script>\n');
    if (!r.ok) throw new Error('conversion failed');
    const out = (await clean(r.output)).toLowerCase();
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('<script');
    expect(out).toContain('<h1');
  });
});
