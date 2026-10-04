import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { TestimonialSource } from '@shared/interfaces/public-api.interface';
import { TESTIMONIALS_CONTENT } from '../../content/testimonials.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ContentActions, contentFeature } from '../../core/store/content.feature';
import { Carousel } from '../../ui/carousel/carousel';

/** "AB" from "Ada Byron"; one letter for single names. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** "Testimonials" (brief, Part 6): dark band of real client quotes; absent until one is published. */
@Component({
  selector: 'app-testimonials',
  imports: [IconComponent, Carousel],
  templateUrl: './testimonials.html',
  styleUrl: './testimonials.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Testimonials {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = TESTIMONIALS_CONTENT;
  protected readonly initials = initials;
  protected readonly stars = [1, 2, 3, 4, 5];

  private readonly store = inject(Store);
  private readonly slot = this.store.selectSignal(contentFeature.selectTestimonials);

  /**
   * [] while loading and on failure: a missing band is better than an error in the middle of the page.
   * A failed load is retried the next time the home page is visited (the cache never keeps errors).
   */
  protected readonly items = computed(() => this.slot().items ?? []);

  protected sourceLabel(source: TestimonialSource): string {
    return TESTIMONIALS_CONTENT.sourceLabels[source] ?? TESTIMONIALS_CONTENT.sourceLabels.other;
  }

  constructor() {
    this.store.dispatch(ContentActions.loadTestimonials());
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
