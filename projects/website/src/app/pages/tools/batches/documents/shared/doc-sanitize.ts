/**
 * One strict HTML sanitiser for everything the documents tools render from user content (Word, Markdown).
 * DOMPurify with a small allow-list, then a second pass that enforces what DOMPurify cannot express:
 * images may only be embedded data: images (never a remote URL, which would be a request and a tracker),
 * links may only be http(s)/mailto and always open in a new tab, class names are limited to code languages,
 * and task-list checkboxes become plain glyphs. Browser/jsdom only: call it from a handler, never at import.
 */

const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol',
  'p', 'pre', 's', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'align', 'start', 'class', 'type', 'checked'];

const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i;
const SAFE_LINK = /^(?:https?:|mailto:)/i;
const CODE_CLASS = /^language-[\w+#.-]{1,30}$/;

export interface SanitizeResult {
  html: string;
  /** Images dropped because they were not embedded data: images (e.g. https:// pictures in Markdown). */
  removedImages: number;
  /** Links dropped because their address was not http(s) or mailto. */
  removedLinks: number;
}

export async function sanitizeHtml(dirty: string): Promise<SanitizeResult> {
  const purify = (await import('dompurify')).default;
  const fragment = purify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ['style', 'script', 'form', 'iframe', 'object', 'embed', 'svg', 'math', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'srcset', 'ping', 'formaction'],
    RETURN_DOM_FRAGMENT: true,
  }) as unknown as DocumentFragment;
  return finish(fragment);
}

function finish(fragment: DocumentFragment): SanitizeResult {
  let removedImages = 0;
  let removedLinks = 0;

  for (const img of Array.from(fragment.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (DATA_IMAGE.test(src)) {
      img.setAttribute('alt', img.getAttribute('alt') ?? '');
      continue;
    }
    removedImages++;
    const alt = (img.getAttribute('alt') ?? '').trim();
    img.replaceWith(document.createTextNode(alt ? `[image: ${alt}]` : '[image]'));
  }

  for (const a of Array.from(fragment.querySelectorAll('a'))) {
    const href = (a.getAttribute('href') ?? '').trim();
    if (SAFE_LINK.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer nofollow');
    } else {
      removedLinks++;
      a.replaceWith(...Array.from(a.childNodes));
    }
  }

  for (const input of Array.from(fragment.querySelectorAll('input'))) {
    const isBox = (input.getAttribute('type') ?? '').toLowerCase() === 'checkbox';
    input.replaceWith(document.createTextNode(isBox ? (input.hasAttribute('checked') ? '☑' : '☐') : ''));
  }

  for (const el of Array.from(fragment.querySelectorAll('[class]'))) {
    const keep = el.tagName === 'CODE' || el.tagName === 'PRE' ? Array.from(el.classList).filter((c) => CODE_CLASS.test(c)) : [];
    if (keep.length) el.setAttribute('class', keep.join(' '));
    else el.removeAttribute('class');
  }
  for (const el of Array.from(fragment.querySelectorAll('[type], [checked]'))) {
    if (el.tagName !== 'OL') el.removeAttribute('type');
    el.removeAttribute('checked');
  }

  const holder = document.createElement('div');
  holder.append(fragment);
  return { html: holder.innerHTML, removedImages, removedLinks };
}

/** Plain text of sanitised HTML: blocks on their own lines, table cells tab-separated, list items bulleted. */
export function htmlToText(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  const out: string[] = [];
  const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE', 'FIGURE', 'HR']);

  const walk = (node: Node, listDepth: number): void => {
    if (node.nodeType === 3) {
      out.push(node.textContent ?? '');
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') {
      out.push('\n');
      return;
    }
    if (tag === 'IMG') {
      const alt = el.getAttribute('alt');
      if (alt) out.push(`[image: ${alt}]`);
      return;
    }
    if (tag === 'TR') {
      const cells = Array.from(el.children).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim());
      out.push(cells.join('\t'), '\n');
      return;
    }
    if (tag === 'LI') {
      out.push('\n', '  '.repeat(Math.max(0, listDepth - 1)), '- ');
    } else if (BLOCK.has(tag) && !((tag === 'UL' || tag === 'OL') && listDepth > 0)) {
      out.push('\n');
    }
    const nested = tag === 'UL' || tag === 'OL' ? listDepth + 1 : listDepth;
    for (const child of Array.from(el.childNodes)) walk(child, nested);
    if (BLOCK.has(tag) && tag !== 'TABLE' && !((tag === 'UL' || tag === 'OL') && listDepth > 0)) out.push('\n');
  };
  walk(root, 0);
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
