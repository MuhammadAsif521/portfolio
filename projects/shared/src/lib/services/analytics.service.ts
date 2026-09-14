import { DOCUMENT } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConsentService } from '@shared/services/consent.service';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export interface AnalyticsConfig {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
}

/**
 * Loads Google Tag Manager / gtag.js — but only when ALL of these hold:
 *  1. running in the browser (never during SSR),
 *  2. the visitor has actively granted analytics cookie consent
 *     (ConsentService.analyticsGranted()),
 *  3. `configure()` has been called with a non-empty googleTagManagerId or
 *     googleAnalyticsId (from site-settings) — no fake/placeholder ID is
 *     ever substituted.
 *
 * Call `configure()` once site-settings has loaded (see full.ts) — safe to
 * call repeatedly/with the same values. The container script is appended
 * dynamically at runtime (never a static <script> in index.html), so it can
 * never load before consent and never competes with the initial render for
 * bandwidth/parse time.
 *
 * If a GTM container id is configured it takes priority (it can also fire
 * GA4 tags itself); gtag.js is only loaded directly when there's a GA4 id
 * but no GTM container configured.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private consent = inject(ConsentService);

  private readonly config = signal<AnalyticsConfig>({});
  private injected = false;

  constructor() {
    if (!this.isBrowser) return;
    effect(() => {
      const granted = this.consent.analyticsGranted();
      const { googleAnalyticsId, googleTagManagerId } = this.config();
      if (!granted || this.injected) return;

      if (googleTagManagerId) {
        this.injectGtm(googleTagManagerId);
        this.injected = true;
      } else if (googleAnalyticsId) {
        this.injectGtag(googleAnalyticsId);
        this.injected = true;
      }
    });
  }

  /** Feed real site-settings values in. Safe to call on every settings change. */
  configure(config: AnalyticsConfig): void {
    this.config.set({
      googleAnalyticsId: config.googleAnalyticsId || '',
      googleTagManagerId: config.googleTagManagerId || '',
    });
  }

  private injectGtm(containerId: string): void {
    const win = window as Window;
    win.dataLayer = win.dataLayer || [];
    win.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
    this.document.head.appendChild(script);
    // No <noscript> iframe fallback by design — that variant is meant to run
    // with no JS at all, which would bypass the consent gate above entirely.
  }

  private injectGtag(measurementId: string): void {
    const win = window as Window;
    win.dataLayer = win.dataLayer || [];
    win.gtag = win.gtag || function gtag(...args: unknown[]) { win.dataLayer!.push(args); };
    win.gtag('js', new Date());
    win.gtag('config', measurementId);

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    this.document.head.appendChild(script);
  }
}
