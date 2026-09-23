import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { CONTACT_CONTENT } from '../../content/contact.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { ContactForm } from '../../ui/contact-form/contact-form';
import { QuickContact } from '../../ui/quick-contact/quick-contact';

/**
 * CTA (brief, Part 6) and the #contact anchor: "Have a project idea? Let's discuss" with the email
 * box and trust badges, plus the full contact form behind a disclosure button.
 */
@Component({
  selector: 'app-contact',
  imports: [IconComponent, ScrollSpyDirective, ContactForm, QuickContact],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contact {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly content = CONTACT_CONTENT.cta;
  protected readonly formOpen = signal(false);

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }

  protected toggleForm(): void {
    this.formOpen.update((open) => !open);
    if (this.formOpen()) {
      // Put keyboard users straight into the form they asked for.
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#contact-name')?.focus(), {
        injector: this.injector,
      });
    }
  }
}
