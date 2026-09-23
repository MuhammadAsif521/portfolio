import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { CustomReactiveTextareaComponent } from '@shared/components/reactive-form-components/custom-reactive-textarea/custom-textarea.component';
import { CustomReactiveTextfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-textfield/custom-textfield.component';
import { of } from 'rxjs';
import { CONTACT_CONTENT } from '../../content/contact.content';
import { ContactSender } from '../../core/contact-sender';

const F = CONTACT_CONTENT.form;

/**
 * Full contact form (brief, Part 9 step 11: built from shared's reactive-form-components), posting to
 * POST /public/contact with source "contact-form". Limits mirror the backend's Zod schema.
 */
@Component({
  selector: 'app-contact-form',
  imports: [
    ReactiveFormsModule,
    IconComponent,
    LoadingButtonComponent,
    CustomReactiveTextfieldComponent,
    CustomReactiveTextareaComponent,
  ],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactForm {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly content = F;
  protected readonly sender = new ContactSender();
  protected readonly sending = computed(() => this.sender.status() === 'sending');
  protected readonly labels = {
    name: of(F.name),
    email: of(F.email),
    subject: of(F.subject),
    message: of(F.message),
  };

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    subject: ['', [Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.minLength(F.messageMin), Validators.maxLength(F.messageMax)]],
    /** Honeypot: hidden from people, so only bots fill it. */
    website: [''],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Move focus to the first problem so keyboard and screen-reader users land on it.
      afterNextRender(
        () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    const { name, email, subject, message, website } = this.form.getRawValue();
    this.sender.send(
      {
        name: name.trim(),
        email,
        message: message.trim(),
        source: 'contact-form',
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(website ? { website } : {}),
      },
      () => this.form.reset(),
    );
  }

  protected again(): void {
    this.sender.reset();
  }
}
