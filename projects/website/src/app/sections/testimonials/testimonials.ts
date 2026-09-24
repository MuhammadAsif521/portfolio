import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { Testimonial, TestimonialSource } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { catchError, of } from 'rxjs';
import { TESTIMONIALS_CONTENT } from '../../content/testimonials.content';
import { DEMO_CONTENT, DEMO_TESTIMONIALS, orDemo } from '../../core/demo-content';
import { disposeWith, revealOnScroll } from '../../core/motion';
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

  /** [] on failure too: a missing band is better than an error in the middle of the page. */
  protected readonly items = toSignal(
    inject(PublicApiService)
      .getTestimonials()
      .pipe(
        catchError(() => of([] as Testimonial[])),
        orDemo<Testimonial>(DEMO_TESTIMONIALS, inject(DEMO_CONTENT)),
      ),
    { initialValue: [] as Testimonial[] },
  );

  protected sourceLabel(source: TestimonialSource): string {
    return TESTIMONIALS_CONTENT.sourceLabels[source] ?? TESTIMONIALS_CONTENT.sourceLabels.other;
  }

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
