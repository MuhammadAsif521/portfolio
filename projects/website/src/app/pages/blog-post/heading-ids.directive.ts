import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';
import { headingIds } from './post-extras';

/**
 * Gives every <h2> of the rendered post an id matching the table of contents (Angular's sanitizer drops
 * id attributes from [innerHTML], so they are set here, in the browser, after each render). If the URL
 * already points at a heading (#section), it scrolls there once the id exists.
 */
@Directive({ selector: '[appHeadingIds]' })
export class HeadingIdsDirective {
  /** The HTML that was rendered: a change re-runs the effect. */
  readonly appHeadingIds = input<string | undefined>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private scrolled = false;

  constructor() {
    afterRenderEffect(() => {
      this.appHeadingIds();
      const headings = Array.from(this.host.nativeElement.querySelectorAll('h2'));
      const ids = headingIds(headings.map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()));
      headings.forEach((h, i) => {
        h.id = ids[i];
        h.tabIndex = -1;
      });
      const hash = decodeURIComponent(this.host.nativeElement.ownerDocument.defaultView?.location.hash.slice(1) ?? '');
      if (!this.scrolled && hash && ids.includes(hash)) {
        this.scrolled = true;
        this.host.nativeElement.ownerDocument.getElementById(hash)?.scrollIntoView();
      }
    });
  }
}
