/*
 * Sanitiser for the on-page Markdown preview. Everything goes through DOMPurify with a strict allow-list:
 * no scripts, styles, forms, event handlers, iframes or data-* attributes, only http(s)/mailto/tel/# links, and
 * no remote resources (a remote image is replaced by its alt text so the preview never makes a request).
 * Runs on the page only (it needs a DOM); the HTML output of the tool is NOT passed through this.
 */

const ALLOWED_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre',
  'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
];
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'id', 'class', 'colspan', 'rowspan', 'align', 'start', 'type', 'checked', 'disabled', 'open', 'lang', 'dir'];
const SAFE_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const PREFIX = 'md-preview-';

export interface PreviewResult {
  html: string;
  /** Remote images that were replaced by their alt text. */
  blockedImages: number;
}

export async function sanitizePreview(html: string): Promise<PreviewResult> {
  const mod = await import('dompurify');
  const purify = (mod as unknown as { default: typeof import('dompurify').default }).default ?? (mod as unknown as typeof import('dompurify').default);
  const fragment = purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
    // Plain-value attributes are exempt from the URL check (which would otherwise strip them); href and src are not.
    ADD_URI_SAFE_ATTR: ['type', 'align', 'colspan', 'rowspan', 'start', 'lang', 'dir', 'open', 'checked', 'disabled'],
    RETURN_DOM_FRAGMENT: true,
  }) as DocumentFragment;

  const doc = fragment.ownerDocument;
  let blockedImages = 0;

  for (const img of Array.from(fragment.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (SAFE_IMAGE.test(src)) {
      img.setAttribute('loading', 'lazy');
      continue;
    }
    blockedImages++;
    const note = doc.createElement('span');
    note.className = 'md-image-blocked';
    note.textContent = `[image: ${img.getAttribute('alt') || 'no description'}]`;
    img.replaceWith(note);
  }

  // Task lists: show the state as text instead of a form control.
  for (const input of Array.from(fragment.querySelectorAll('input'))) {
    if (input.getAttribute('type') === 'checkbox') {
      const mark = doc.createElement('span');
      mark.className = 'md-checkbox';
      mark.setAttribute('role', 'img');
      mark.setAttribute('aria-label', input.hasAttribute('checked') ? 'done' : 'not done');
      mark.textContent = input.hasAttribute('checked') ? '☑' : '☐';
      input.replaceWith(mark);
    } else {
      input.remove();
    }
  }

  // ids are prefixed so they cannot collide with, or clobber, anything on the page; #links follow.
  const ids = new Set<string>();
  for (const el of Array.from(fragment.querySelectorAll('[id]'))) {
    const id = el.getAttribute('id') ?? '';
    ids.add(id);
    el.setAttribute('id', PREFIX + id);
  }
  for (const a of Array.from(fragment.querySelectorAll('a'))) {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      const target = href.slice(1);
      if (ids.has(target)) a.setAttribute('href', `#${PREFIX}${target}`);
      else a.removeAttribute('href');
    } else if (/^https?:/i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  }

  const holder = doc.createElement('div');
  holder.appendChild(fragment);
  return { html: holder.innerHTML, blockedImages };
}
