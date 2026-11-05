import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeHtml } from './doc-sanitize';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('sanitizeHtml', () => {
  it('removes scripts, event handlers, styles and javascript: links', async () => {
    const { html } = await sanitizeHtml(
      '<p onclick="x()" style="color:red">Hi <a href="javascript:alert(1)">bad</a><script>alert(1)</script><iframe src="https://e.x"></iframe></p><svg onload="x()"></svg><style>p{}</style>',
    );
    expect(html).toBe('<p>Hi bad</p>');
  });

  it('only keeps embedded images and replaces remote ones with their alt text', async () => {
    const result = await sanitizeHtml(`<img src="${PIXEL}" alt="ok"><img src="https://tracker.example/p.gif" alt="logo"><img src="//x.y/z.png">`);
    expect(result.html).toContain(`src="${PIXEL}"`);
    expect(result.html).toContain('[image: logo]');
    expect(result.html).not.toContain('tracker.example');
    expect(result.html).not.toContain('x.y/z.png');
    expect(result.removedImages).toBe(2);
  });

  it('rejects svg data images', async () => {
    const result = await sanitizeHtml('<img src="data:image/svg+xml;base64,PHN2Zy8+" alt="s">');
    expect(result.html).not.toContain('svg+xml');
    expect(result.removedImages).toBe(1);
  });

  it('keeps http(s) and mailto links, opening them safely, and unwraps the rest', async () => {
    const result = await sanitizeHtml('<a href="https://a.example">a</a> <a href="mailto:x@y.z">m</a> <a href="#note">n</a> <a href="data:text/html,x">d</a>');
    expect(result.html).toContain('<a href="https://a.example" target="_blank" rel="noopener noreferrer nofollow">a</a>');
    expect(result.html).toContain('href="mailto:x@y.z"');
    expect(result.html).not.toContain('#note');
    expect(result.html).not.toContain('data:text');
    expect(result.removedLinks).toBe(2);
  });

  it('limits class names to code languages and turns task checkboxes into glyphs', async () => {
    const { html } = await sanitizeHtml(
      '<pre class="evil"><code class="language-ts other">x</code></pre><ul><li><input type="checkbox" checked disabled> done</li><li><input type="checkbox"> todo</li><li><input type="text" value="x"></li></ul>',
    );
    expect(html).toContain('<code class="language-ts">x</code>');
    expect(html).not.toContain('evil');
    expect(html).toContain('☑ done');
    expect(html).toContain('☐ todo');
    expect(html).not.toContain('<input');
  });

  it('handles empty input', async () => {
    expect((await sanitizeHtml('')).html).toBe('');
  });
});

describe('htmlToText', () => {
  it('puts blocks on lines, bullets list items and tabs table cells', () => {
    const text = htmlToText('<h1>Title</h1><p>One<br>two</p><ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><table><tr><td>x</td><td>y</td></tr></table>');
    expect(text).toBe('Title\n\nOne\ntwo\n\n- a\n- b\n  - c\n\nx\ty');
  });
});
