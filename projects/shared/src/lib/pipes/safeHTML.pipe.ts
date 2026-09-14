import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {

  // Angular's SafeValue.toString() guard text has occasionally been pasted
  // into rich-text content instead of the HTML it was meant to wrap. Strip it
  // defensively at render time so already-saved content still displays clean.
  private readonly ANGULAR_SAFE_VALUE_ARTIFACT_RE =
    /SafeValue must use \[property\]=binding:[\s\S]*?\(see https?:\/\/\S+?\)\s*/gi;

  private readonly ALLOWED_TAGS = [
    'b', 'i', 'u', 'em', 'strong', 'br',
    'p', 'div', 'span',
    'ul', 'ol', 'li',
    'a', 'code', 'pre', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'mark', 'small', 'sub', 'sup',
    'hr', 'cite', 'q', 's', 'del', 'ins',
    'img'
  ];

  private readonly ALLOWED_ATTRIBUTES = [
    'href',
    'target',
    'rel',
    'class',
    'style',
    'title',
    'id',
    'name',
    'alt',
    'src',
    'width',
    'height',
    'dir',
    'aria-level',
    'role'
  ];

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    try {
      const withoutArtifacts = value.replace(this.ANGULAR_SAFE_VALUE_ARTIFACT_RE, '');
      return this.sanitizeHtmlString(withoutArtifacts);
    } catch (error) {
      console.error('HTML sanitization failed:', error);
      return this.escapeHtml(value);
    }
  }

  private sanitizeHtmlString(html: string): string {
    const parser = new DOMParser();

    const doc = parser.parseFromString(
      `<div>${html}</div>`,
      'text/html'
    );

    const container = doc.body.firstElementChild as HTMLElement;

    if (!container) {
      return '';
    }

    this.sanitizeChildren(container);

    return container.innerHTML;
  }

  private sanitizeChildren(element: HTMLElement): void {
    const children = Array.from(element.children);

    for (const child of children) {
      this.sanitizeElement(child as HTMLElement);
    }
  }

  private sanitizeElement(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();

    /*
     * Completely remove dangerous elements.
     */
    if (
      tagName === 'script' ||
      tagName === 'iframe' ||
      tagName === 'object' ||
      tagName === 'embed' ||
      tagName === 'form' ||
      tagName === 'style' ||
      tagName === 'link' ||
      tagName === 'meta'
    ) {
      element.remove();
      return;
    }

    /*
     * Remove unsupported elements but preserve their text/content.
     */
    if (!this.ALLOWED_TAGS.includes(tagName)) {
      const parent = element.parentNode;

      if (parent) {
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }

        parent.removeChild(element);
      }

      return;
    }

    this.sanitizeAttributes(element);

    /*
     * Sanitize children recursively.
     */
    const children = Array.from(element.children);

    for (const child of children) {
      this.sanitizeElement(child as HTMLElement);
    }
  }

  private sanitizeAttributes(element: HTMLElement): void {
    const attributes = Array.from(element.attributes);

    for (const attribute of attributes) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      /*
       * Remove event handlers:
       *
       * onclick
       * onload
       * onerror
       * onmouseover
       * etc.
       */
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      /*
       * Remove attributes that aren't explicitly allowed.
       */
      if (!this.ALLOWED_ATTRIBUTES.includes(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      /*
       * Validate URLs.
       */
      if (name === 'href' || name === 'src') {
        if (!this.isSafeUrl(value)) {
          element.removeAttribute(attribute.name);
        }
      }
    }

    /*
     * Force safe behavior for links.
     */
    if (element.tagName.toLowerCase() === 'a') {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }

  private isSafeUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    const normalized = url.trim().toLowerCase();

    /*
     * Explicitly reject javascript/data except images.
     */
    if (normalized.startsWith('javascript:')) {
      return false;
    }

    if (normalized.startsWith('vbscript:')) {
      return false;
    }

    if (normalized.startsWith('data:')) {
      return normalized.startsWith('data:image/');
    }

    /*
     * Relative URLs.
     */
    if (
      url.startsWith('/') ||
      url.startsWith('./') ||
      url.startsWith('../') ||
      url.startsWith('?') ||
      url.startsWith('#')
    ) {
      return true;
    }

    try {
      const parsed = new URL(url, window.location.origin);

      return [
        'http:',
        'https:',
        'mailto:',
        'tel:'
      ].includes(parsed.protocol.toLowerCase());
    } catch {
      return false;
    }
  }

  private escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
}