import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SERVICES_CONTENT, type ServiceItem } from '../../content/services.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { Carousel } from '../../ui/carousel/carousel';
import { ServiceCard } from '../../ui/service-card/service-card';

/**
 * "What I Do" (brief, Part 6/8): dark band with swipeable service cards and synced dots. Each card is one
 * link to its /services/<slug> page; a "View all services" link points to the hub.
 */
@Component({
  selector: 'app-services',
  imports: [ScrollSpyDirective, Carousel, ServiceCard, RouterLink],
  templateUrl: './services.html',
  styleUrl: './services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Services {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = SERVICES_CONTENT;
  /** The featured services, in the order set in services.content.ts (unknown slugs are skipped). */
  protected readonly featured: readonly ServiceItem[] = SERVICES_CONTENT.featured
    .map((page) => SERVICES_CONTENT.items.find((item) => item.page === page))
    .filter((item): item is ServiceItem => !!item);

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
