import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConsentService } from '@shared/services/consent.service';

/**
 * Cookie banner for optional analytics cookies: "Accept analytics" / "Reject", equally easy, plus a link
 * to the Cookie Policy. Non-modal (it never traps focus or blocks the page) and fixed to the bottom, so
 * it causes no layout shift. Mount it client-only, e.g. inside `@defer (on idle)`: on the server
 * ConsentService.bannerVisible() is always false anyway.
 *
 * When reopened from "Cookie settings", focus moves to the banner and returns to the opener afterwards;
 * Escape then closes it without changing the choice.
 */
@Component({
  selector: 'app-cookie-consent',
  imports: [RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrl: './cookie-consent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class CookieConsentComponent {
  readonly policyPath = input('/cookie-policy');

  protected readonly consent = inject(ConsentService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.consent.reopened()) return;
      const active = this.document.activeElement;
      this.opener = active instanceof HTMLElement && active !== this.document.body ? active : null;
      afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  protected accept(): void {
    this.consent.acceptAnalytics();
    this.restoreFocus();
  }

  protected reject(): void {
    this.consent.reject();
    this.restoreFocus();
  }

  protected onEscape(): void {
    if (!this.consent.reopened()) return;
    this.consent.dismiss();
    this.restoreFocus();
  }

  private restoreFocus(): void {
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) afterNextRender(() => opener.focus(), { injector: this.injector });
  }
}
