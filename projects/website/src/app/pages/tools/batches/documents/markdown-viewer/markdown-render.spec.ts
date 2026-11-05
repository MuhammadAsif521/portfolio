import { describe, expect, it } from 'vitest';
import { MARKDOWN_SAMPLE, markdownStats, readableText, renderDelay, renderMarkdown } from './markdown-render';

describe('renderMarkdown', () => {
  it('renders headings, emphasis, tables, task lists and code with a language class', async () => {
    const { html } = await renderMarkdown(
      '# Title\n\n**bold** *it* ~~gone~~\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n```ts\nconst x = 1;\n```\n',
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<del>gone</del>');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('☑ done');
    expect(html).toContain('☐ todo');
    expect(html).toContain('<code class="language-ts">');
  });

  it('strips scripts, event handlers, javascript: links and styles from raw HTML', async () => {
    const { html, removedLinks } = await renderMarkdown(
      'Hi <script>alert(1)</script><img src=x onerror=alert(1)> <a href="javascript:alert(1)">click</a> <b style="color:red" onclick="x()">b</b> [md](javascript:alert(1))\n\n<iframe src="https://evil.example"></iframe>\n\n<svg onload=alert(1)></svg>',
    );
    expect(html).not.toMatch(/<script|onerror|onclick|onload|javascript:|<iframe|<svg|style=/i);
    expect(html).toContain('click');
    expect(removedLinks).toBeGreaterThanOrEqual(2);
  });

  it('does not load remote images: they become their alt text', async () => {
    const { html, removedImages } = await renderMarkdown('![A logo](https://tracker.example/pixel.png) and ![](http://x.y/z.gif)');
    expect(html).not.toContain('<img');
    expect(html).toContain('[image: A logo]');
    expect(removedImages).toBe(2);
  });

  it('keeps embedded data images and opens links safely', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const { html } = await renderMarkdown(`![dot](${png}) [site](https://example.com) <mailto:a@b.c>`);
    expect(html).toContain(`src="${png}"`);
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer nofollow"');
  });

  it('returns nothing for empty input and renders the bundled sample safely', async () => {
    expect((await renderMarkdown('  \n')).html).toBe('');
    const sample = await renderMarkdown(MARKDOWN_SAMPLE);
    expect(sample.html).toContain('<h2>Checklist</h2>');
    expect(sample.html).not.toContain('<script');
  });

  it('handles large input', async () => {
    const big = 'Line with **bold** text and a [link](https://example.com)\n\n'.repeat(400);
    const { html } = await renderMarkdown(big);
    expect(html.match(/<p>/g)?.length).toBe(400);
  });
});

describe('markdownStats', () => {
  it('counts readable words, not syntax or code fences', () => {
    expect(readableText('# Title\n\n- [x] one two\n\n[link text](https://example.com/long/path)\n')).not.toMatch(/https|\[|\]|#/);
    const stats = markdownStats('# Title\n\nOne two **three**.\n\n```js\n```\n');
    expect(stats.words).toBe(4);
    expect(stats.lines).toBe(7);
  });

  it('estimates reading time at about 200 words per minute', () => {
    expect(markdownStats('').readingMinutes).toBe(0);
    expect(markdownStats('word').readingMinutes).toBe(1);
    expect(markdownStats('word '.repeat(450)).readingMinutes).toBe(2);
    expect(markdownStats('word '.repeat(1000)).readingMinutes).toBe(5);
  });
});

describe('renderDelay', () => {
  it('waits 200 ms for short notes and at most 1.5 s for huge ones', () => {
    expect(renderDelay(0)).toBe(200);
    expect(renderDelay(4000)).toBe(210);
    expect(renderDelay(534_000)).toBe(1500);
    expect(renderDelay(50_000_000)).toBe(1500);
  });
});
