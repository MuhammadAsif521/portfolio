import { sanitizeHtml, type SanitizeResult } from '../shared/doc-sanitize';
import { countWords } from '../shared/doc-utils';

export const MD_MAX_MB = 5;
export const WORDS_PER_MINUTE = 200;

/** Renders Markdown (GitHub-flavoured) to HTML with marked, then sanitises it strictly. Browser/jsdom only. */
export async function renderMarkdown(source: string): Promise<SanitizeResult> {
  if (!source.trim()) return { html: '', removedImages: 0, removedLinks: 0 };
  const { marked } = await import('marked');
  const dirty = marked.parse(source, { gfm: true, breaks: false, async: false });
  return sanitizeHtml(dirty);
}

/** Typing pause before the preview is rebuilt: short for normal notes, longer as the document grows. */
export const renderDelay = (chars: number): number => Math.min(1500, 200 + Math.floor(chars / 400));

export interface MarkdownStats {
  words: number;
  characters: number;
  lines: number;
  /** Whole minutes, at least 1 when there is any text. */
  readingMinutes: number;
}

/** Words of the readable text: code fences, link targets, HTML tags and Markdown punctuation do not count. */
export function readableText(markdown: string): string {
  return markdown
    .replace(/^\s*(```|~~~).*$/gm, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^\s*>+\s?/gm, ' ')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/[|`*_~]/g, ' ');
}

export function markdownStats(markdown: string): MarkdownStats {
  const words = countWords(readableText(markdown));
  return {
    words,
    characters: markdown.length,
    lines: markdown === '' ? 0 : markdown.split(/\r\n|\r|\n/).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}

export const MARKDOWN_SAMPLE = `# Release notes

A short **sample** to show what the preview supports: *emphasis*, ~~strikethrough~~, \`inline code\`, [links](https://example.com) and autolinks like https://example.org.

## Checklist

- [x] Write the draft
- [x] Review the tables
- [ ] Publish

## A table

| Tool | Runs in | Uploads |
| ---- | :-----: | ------: |
| Markdown viewer | browser | none |
| CSV viewer | browser | none |

## Code

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> Raw HTML is cleaned and remote images are not loaded: <script>alert(1)</script> is dropped.

1. First
2. Second
   - nested item
`;
