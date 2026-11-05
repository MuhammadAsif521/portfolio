import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
<<<<<<< HEAD
=======
import { RouterLink } from '@angular/router';
>>>>>>> 34a523c (Save local portfolio work)
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { SERVICES_CONTENT } from '../../content/services.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { Carousel } from '../../ui/carousel/carousel';

/**
 * "What I Do" (brief, Part 6/8): dark band, swipeable service cards with synced dots. The cards are
 * informational only: no link, no click handler and nothing focusable, so nothing suggests a destination.
 */
@Component({
  selector: 'app-services',
<<<<<<< HEAD
  imports: [IconComponent, ScrollSpyDirective, Carousel],
=======
  imports: [IconComponent, ScrollSpyDirective, Carousel, RouterLink],
>>>>>>> 34a523c (Save local portfolio work)
  templateUrl: './services.html',
  styleUrl: './services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Services {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = SERVICES_CONTENT;
<<<<<<< HEAD
=======
  /** Cards that have their own /services/<slug> page. */
  protected readonly linkedServices = SERVICES_CONTENT.items.filter((item) => 'page' in item && !!item.page);
>>>>>>> 34a523c (Save local portfolio work)

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
