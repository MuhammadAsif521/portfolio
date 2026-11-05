import { describe, expect, it } from 'vitest';
import { extractToc, headingIds, relatedTools, shareLinks, slugify } from './post-extras';

describe('post extras', () => {
  it('builds a table of contents from h2 headings with unique ids', () => {
    const toc = extractToc('<p>x</p><h2>Why SSR?</h2><h3>skip</h3><h2 class="a">Set <code>up</code> &amp; run</h2><h2>Why SSR?</h2>');
    expect(toc).toEqual([
      { id: 'why-ssr', text: 'Why SSR?' },
      { id: 'set-up-run', text: 'Set up & run' },
      { id: 'why-ssr-2', text: 'Why SSR?' },
    ]);
    expect(extractToc(undefined)).toEqual([]);
  });

  it('names DOM headings exactly like the TOC', () => {
    expect(headingIds(['A b', 'A b', 'Ç d'])).toEqual(['a-b', 'a-b-2', 'c-d']);
    expect(slugify('!!!')).toBe('section');
  });

  it('suggests tools from tags and title', () => {
    expect(relatedTools(['Node.js', 'TOTP'], 'Two-factor auth').map((t) => t.slug)).toEqual(['jwt-decoder', 'http-status-codes']);
    expect(relatedTools(['MongoDB'], 'Aggregation').map((t) => t.slug)).toContain('json-to-mongoose-schema');
    expect(relatedTools(['css'], 'Theming')).toEqual([]);
  });

  it('encodes share URLs', () => {
    expect(shareLinks('https://asifdev.com/blog/a', 'A & B').x).toBe(
      'https://x.com/intent/post?url=https%3A%2F%2Fasifdev.com%2Fblog%2Fa&text=A%20%26%20B',
    );
  });
});
