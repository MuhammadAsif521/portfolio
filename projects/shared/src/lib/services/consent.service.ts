import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/** First-party cookie that stores the visitor's analytics choice (listed in the Cookie Policy). */
export const CONSENT_COOKIE = 'bo_cookie_consent';
/** How long a choice is remembered before the banner asks again (6 months, as CNIL recommends). */
export const CONSENT_MAX_AGE_DAYS = 180;

/** What is stored in the cookie. `marketing` is always false: the site has no advertising. */
export interface ConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: false;
}

/**
 * The visitor's cookie choice for optional (analytics) cookies. Browser only: on the server nothing is
 * read or written, so the SSR HTML is the same for everyone and safe to cache at the edge.
 *
 *  - No stored choice  → analytics denied, banner should be shown.
 *  - Stored choice     → applied at once, banner hidden (returning visitors are not asked again).
 *  - `reopen()`        → the footer's "Cookie settings" shows the banner again to change the choice.
 *
 * AnalyticsService turns `analyticsGranted()` into Google Consent Mode updates; this service knows
 * nothing about Google.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _analytics = signal(false);
  private readonly _answered = signal(false);
  private readonly _reopened = signal(false);

  /** True once the visitor accepted analytics (now or on an earlier visit). */
  readonly analyticsGranted = this._analytics.asReadonly();
  /** True once the visitor made a choice (accept or reject). */
  readonly answered = this._answered.asReadonly();
  /** True while the banner was opened again from "Cookie settings" (focus moves into it). */
  readonly reopened = this._reopened.asReadonly();
  /** Whether the banner should be on screen. Always false on the server. */
  readonly bannerVisible = computed(() => this.isBrowser && (!this._answered() || this._reopened()));

  constructor() {
    if (!this.isBrowser) return;
    const stored = this.read();
    if (stored) {
      this._analytics.set(stored.analytics);
      this._answered.set(true);
    }
  }

  acceptAnalytics(): void {
    this.choose(true);
  }

  reject(): void {
    this.choose(false);
  }

  /** Shows the banner again (footer "Cookie settings"). */
  reopen(): void {
    if (this.isBrowser) this._reopened.set(true);
  }

  /** Hides a reopened banner without changing the stored choice. No-op before the first choice. */
  dismiss(): void {
    this._reopened.set(false);
  }

  private choose(analytics: boolean): void {
    this._analytics.set(analytics);
    this._answered.set(true);
    this._reopened.set(false);
    if (!this.isBrowser) return;
    const prefs: ConsentPreferences = { necessary: true, analytics, marketing: false };
    const secure = this.document.location?.protocol === 'https:' ? '; Secure' : '';
    this.document.cookie =
      `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}` +
      `; Path=/; SameSite=Lax${secure}`;
  }

  private read(): ConsentPreferences | null {
    const raw = this.document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentPreferences> | null;
      if (!parsed || typeof parsed !== 'object') return null;
      return { necessary: true, analytics: parsed.analytics === true, marketing: false };
    } catch {
      return null;
    }
  }
}
