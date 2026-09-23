import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { ABOUT_CONTENT } from '../../content/about.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { siteFeature } from '../../core/store/site.feature';

/** "Why Hire Me" (brief, Part 6): light-gray band, portrait on an orange block, bio and two stats. */
@Component({
  selector: 'app-about',
  imports: [RouterLink, IconComponent, ScrollSpyDirective],
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = ABOUT_CONTENT;
  protected readonly resumeUrl = inject(Store).selectSignal(siteFeature.selectResumeUrl);
  protected readonly portraitVisible = signal(true);

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }

  protected onPortraitError(): void {
    this.portraitVisible.set(false);
  }
}
