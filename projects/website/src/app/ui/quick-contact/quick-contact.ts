import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { ContactSource } from '@shared/interfaces/public-api.interface';
import { ContactSender } from '../../core/contact-sender';

let nextId = 0;

/**
 * Email-only pill (Figma: envelope icon, input, orange "Send"). Used by the CTA band (`cta`) and the
 * footer (`footer`); both are accepted by POST /public/contact without a name or message.
 */
@Component({
  selector: 'app-quick-contact',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './quick-contact.html',
  styleUrl: './quick-contact.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-dark]': "tone() === 'dark'", '[class.is-field]': "variant() === 'field'" },
})
export class QuickContact {
  readonly source = input.required<Extract<ContactSource, 'cta' | 'footer'>>();
  /** Accessible name of the email field (there is no visible label). */
  readonly label = input.required<string>();
  readonly placeholder = input('Enter email address');
  readonly buttonText = input('Send');
  readonly sentText = input("Thanks! I'll be in touch.");
  readonly tone = input<'light' | 'dark'>('light');
  /** Figma: rounded pill with icon (CTA), or a flat field with a square send button (footer). */
  readonly variant = input<'pill' | 'field'>('pill');

  protected readonly id = `quick-contact-${nextId++}`;
  protected readonly sender = new ContactSender();
  protected readonly sending = computed(() => this.sender.status() === 'sending');

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    /** Honeypot: hidden from people, so only bots fill it. */
    website: [''],
  });

  protected get emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, website } = this.form.getRawValue();
    this.sender.send({ email, source: this.source(), ...(website ? { website } : {}) }, () => this.form.reset());
  }
}
