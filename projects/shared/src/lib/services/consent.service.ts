import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CookieService } from 'ngx-cookie-service';

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_KEY = 'vnb_cookie_consent';
const COOKIE_EXPIRY_DAYS = 365;

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

/**
 * Single source of truth for cookie consent, backed by the `vnb_cookie_consent`
 * cookie (same key/shape the cookie-consent banner has always used). Gates
 * anything that sets a non-essential cookie:
 *  - AnalyticsService (GTM/GA loading) reacts to `analyticsGranted()`.
 *  - Embedded third-party widgets (YouTube/Vimeo video players) react to
 *    `embedsGranted()` — an embedded player sets third-party cookies the same
 *    way an ad/analytics script does, unlike a plain `<a href>` link.
 *
 * `answered()` is false only until the visitor has made an explicit choice
 * (accepted or rejected) — the banner stays visible until then.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly cookieService = inject(CookieService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly answeredState = signal(this.hasStoredChoice());
  private readonly preferencesState = signal<CookiePreferences>(this.readStored());

  readonly answered = this.answeredState.asReadonly();
  readonly preferences = this.preferencesState.asReadonly();

  readonly analyticsGranted = computed(() => this.preferencesState().analytics);
  /** Third-party embeds (YouTube/Vimeo video players, and any future social
   *  embed) — treated as granted if the visitor opted into either analytics
   *  or marketing. */
  readonly embedsGranted = computed(
    () => this.preferencesState().analytics || this.preferencesState().marketing,
  );

  private hasStoredChoice(): boolean {
    if (!this.isBrowser) return false;
    return !!this.cookieService.get(COOKIE_KEY);
  }

  private readStored(): CookiePreferences {
    if (!this.isBrowser) return DEFAULT_PREFERENCES;
    try {
      const raw = this.cookieService.get(COOKIE_KEY);
      if (!raw) return DEFAULT_PREFERENCES;
      const parsed = JSON.parse(raw);
      return {
        necessary: true,
        analytics: !!parsed.analytics,
        marketing: !!parsed.marketing,
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  acceptAll(): void {
    this.save({ necessary: true, analytics: true, marketing: true });
  }

  rejectAll(): void {
    this.save({ necessary: true, analytics: false, marketing: false });
  }

  /** Grants just enough consent to load an embedded video player (marketing),
   *  without also opting the visitor into analytics — used by the "enable
   *  video" affordance shown in place of an embed before consent is given. */
  grantEmbeds(): void {
    this.save({ ...this.preferencesState(), necessary: true, marketing: true });
  }

  save(preferences: CookiePreferences): void {
    this.preferencesState.set(preferences);
    this.answeredState.set(true);
    if (!this.isBrowser) return;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + COOKIE_EXPIRY_DAYS);
    const isSecureContext = window.location.protocol === 'https:';

    try {
      this.cookieService.set(
        COOKIE_KEY,
        JSON.stringify(preferences),
        expiry,
        '/',
        undefined,
        isSecureContext,
        'Lax',
      );
    } catch {
      // Ignore — the in-memory signal still reflects the choice for this session.
    }
  }
}
