import { inject, signal } from '@angular/core';
import type { ContactPayload } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { getError } from '@shared/utils/get-error.util';

export type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Submission state shared by the CTA box, the full form and the footer box. Create it in a field
 * initializer (it injects PublicApiService). The session interceptor supplies the public session,
 * so no reCAPTCHA call happens per message.
 */
export class ContactSender {
  private readonly api = inject(PublicApiService);

  readonly status = signal<SendStatus>('idle');
  /** Server message for the last failure (422 field messages, 429 rate limit, network). */
  readonly error = signal<string | null>(null);

  send(payload: ContactPayload, onSent?: () => void): void {
    if (this.status() === 'sending') return;
    this.status.set('sending');
    this.error.set(null);
    this.api.submitContact(payload).subscribe({
      next: () => {
        this.status.set('sent');
        onSent?.();
      },
      error: (err: unknown) => {
        this.status.set('error');
        this.error.set(getError(err, 'Could not send right now. Please try again, or email me directly.'));
      },
    });
  }

  reset(): void {
    this.status.set('idle');
    this.error.set(null);
  }
}
