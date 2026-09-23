import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Directive, ElementRef, PLATFORM_ID, afterNextRender, inject, input } from '@angular/core';
import { Store } from '@ngrx/store';
import { UiActions } from './store/ui.feature';

/**
 * Marks a page section for the nav's scroll-spy: when the section crosses the middle of the viewport
 * it becomes the active nav item. Browser only (no IntersectionObserver during SSR).
 *
 *   <section id="about" appSpySection>…</section>
 */
@Directive({ selector: '[appSpySection]' })
export class ScrollSpyDirective {
  /** Section id reported to the store; defaults to the element's id. */
  readonly appSpySection = input<string>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const id = this.appSpySection() || this.host.nativeElement.id;
      if (!id) return;
      // A thin band across the middle of the viewport: exactly one section "owns" it at a time.
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.store.dispatch(UiActions.sectionEntered({ id }));
        },
        { rootMargin: '-45% 0px -54% 0px' },
      );
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
