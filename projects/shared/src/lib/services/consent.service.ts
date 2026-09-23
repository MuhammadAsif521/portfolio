import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CookieService } from 'ngx-cookie-service';

const CONSENT_KEY = 'bo_cookie_consent';

export interface ConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly cookieService = inject(CookieService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _preferences = signal<ConsentPreferences>(DEFAULT_PREFERENCES);
  private readonly _answered = signal(false);

  readonly preferences = this._preferences.asReadonly();
  readonly answered = this._answered.asReadonly();

  readonly bannerVisible = signal(false);
  readonly modalOpen = signal(false);

  readonly analyticsGranted = computed(() => this._preferences().analytics);
  readonly marketingGranted = computed(() => this._preferences().marketing);

  constructor() {
    if (!this.isBrowser) return;

    const stored = this.readStoredPreferences();
    if (stored) {
      this._preferences.set(stored);
      this._answered.set(true); 
      this.pushConsentUpdate(stored);
    } else {
       setTimeout(() => {
        if (!this._answered()) this.bannerVisible.set(true);
      }, 800);
    }
  }

  acceptAll(): void {
    this.applyAndPersist({ necessary: true, analytics: true, marketing: true });
  }

  rejectNonEssential(): void {
    this.applyAndPersist({ necessary: true, analytics: false, marketing: false });
  }

  savePreferences(prefs: { analytics: boolean; marketing: boolean }): void {
    this.applyAndPersist({ necessary: true, analytics: prefs.analytics, marketing: prefs.marketing });
  }

  openPreferences(): void {
    this.modalOpen.set(true);
  }

  closePreferences(): void {
    this.modalOpen.set(false);
  }

  private applyAndPersist(prefs: ConsentPreferences): void {
    this._preferences.set(prefs);
    this._answered.set(true);
    this.bannerVisible.set(false);
    this.modalOpen.set(false);

    if (!this.isBrowser) return;

    this.persistCookie(prefs);
    this.pushConsentUpdate(prefs);
  }

  private persistCookie(prefs: ConsentPreferences): void {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    this.cookieService.set(CONSENT_KEY, JSON.stringify(prefs), {
      expires,
      path: '/',
      sameSite: 'Lax',
      secure: location.protocol === 'https:',
    });
  }

  private pushConsentUpdate(prefs: ConsentPreferences): void {
    if (typeof window.gtag !== 'function') return;

    window.gtag('consent', 'update', {
      ad_storage: prefs.marketing ? 'granted' : 'denied',
      ad_user_data: prefs.marketing ? 'granted' : 'denied',
      ad_personalization: prefs.marketing ? 'granted' : 'denied',
      analytics_storage: prefs.analytics ? 'granted' : 'denied',
    });
  }

  private readStoredPreferences(): ConsentPreferences | null {
    const raw = this.cookieService.get(CONSENT_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
      return {
        necessary: true,
        analytics: parsed.analytics === true,
        marketing: parsed.marketing === true,
      };
    } catch {
      return null;
    }
  }
}
