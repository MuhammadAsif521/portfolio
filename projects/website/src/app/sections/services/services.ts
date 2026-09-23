import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { SERVICES_CONTENT } from '../../content/services.content';
import { revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { Carousel } from '../../ui/carousel/carousel';

/** "What I Do" (brief, Part 6/8): dark band, swipeable service cards with synced dots. */
@Component({
  selector: 'app-services',
  imports: [RouterLink, IconComponent, ScrollSpyDirective, Carousel],
  templateUrl: './services.html',
  styleUrl: './services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Services {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = SERVICES_CONTENT;

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      void revealOnScroll(section, root.querySelectorAll('[data-reveal]')).then((cleanup) =>
        this.destroyRef.onDestroy(cleanup),
      );
    });
  }
}
