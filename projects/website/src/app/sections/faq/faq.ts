import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FAQ_CONTENT, type FaqItem } from '../../content/faq.content';
import { disposeWith, revealOnScroll } from '../../core/motion';

/**
 * Home-page FAQ: question headings with short, answer-first paragraphs, all in the server-rendered HTML
 * (no accordion hiding the answers), so readers, search engines and AI answer engines see them as is.
 */
@Component({
  selector: 'app-faq',
  imports: [RouterLink],
  templateUrl: './faq.html',
  styleUrl: './faq.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Faq {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = FAQ_CONTENT;
  protected readonly items: readonly FaqItem[] = FAQ_CONTENT.items;

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
