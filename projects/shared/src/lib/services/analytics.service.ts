import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ConsentService } from '@shared/services/consent.service';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export interface AnalyticsConfig {
  googleAnalyticsId?: string | null;
  googleTagManagerId?: string | null;
}

/** What gets loaded: GTM (GA4 is configured inside the container), gtag.js directly, or nothing. */
export type AnalyticsSetup = { mode: 'gtm'; id: string } | { mode: 'gtag'; id: string } | { mode: 'off' };

export interface AnalyticsStartOptions {
  /** URLs (router paths) that never get a page view. */
  exclude?: (path: string) => boolean;
}

/** dataLayer event pushed on every page view in GTM mode (GTM: Custom Event trigger with this name). */
export const VIRTUAL_PAGE_VIEW_EVENT = 'virtual_page_view';
/** dataLayer event pushed whenever the visitor changes their analytics choice (handy for GTM triggers). */
export const CONSENT_UPDATE_EVENT = 'cookie_consent_update';

const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;
const GA_ID = /^G-[A-Z0-9]{4,16}$/;
/**
 * Upper bound on waiting for a new page's <title> before its page view is sent anyway. Pages such as the
 * blog list set their title only once their API data arrived (which can include reCAPTCHA and a cold
 * API), hence generous; a view still pending when the tab is hidden or closed is sent at once.
 */
export const PAGE_SETTLE_MS = 8_000;
/** requestIdleCallback timeout: the tag loads by then even on a page that never goes idle. */
const IDLE_TIMEOUT_MS = 3_000;

/**
 * Consent Mode v2 defaults: everything optional is denied until the visitor accepts (everywhere, not
 * only in the EEA — the HTML is cached at the edge, so there is no per-region server decision to make).
 */
/**
 * Consent Mode v2 defaults by region (Google resolves the visitor's region in the browser, so this works
 * with edge-cached HTML). Ads are denied everywhere (the site has none). Analytics: granted by default with
 * opt-out (Reject / Cookie settings), except in the EEA, UK and Switzerland where it waits for Accept (GDPR).
 * The region-specific default takes precedence over the global one.
 */
export const CONSENT_DEFAULTS = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
  functionality_storage: 'granted',
  security_storage: 'granted',
} as const;

/** EEA + UK + Switzerland (ISO 3166-1 alpha-2). */
export const CONSENT_REQUIRED_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
] as const;

export const CONSENT_DEFAULTS_REGIONAL = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  region: [...CONSENT_REQUIRED_REGIONS],
  wait_for_update: 500,
} as const;

/** Picks GTM over gtag.js (never both: that would count every page view twice). */
export function resolveAnalyticsSetup(config: AnalyticsConfig | null | undefined): AnalyticsSetup {
  const gtm = config?.googleTagManagerId?.trim().toUpperCase() ?? '';
  const ga = config?.googleAnalyticsId?.trim().toUpperCase() ?? '';
  if (GTM_ID.test(gtm)) return { mode: 'gtm', id: gtm };
  if (GA_ID.test(ga)) return { mode: 'gtag', id: ga };
  return { mode: 'off' };
}

/**
 * Google Tag Manager / Google Analytics 4 with Google Consent Mode v2 ("advanced" mode).
 *
 * `start()` (browser only, once, after hydration):
 *  1. creates `dataLayer` + the `gtag()` stub and pushes the regional `consent default`s (see CONSENT_DEFAULTS) — always the very
 *     first command, before any Google script exists;
 *  2. if the visitor accepted on an earlier visit, pushes `consent update` (analytics granted) right away,
 *     so the first hit of the visit is already a full one;
 *  3. queues the container start (`gtm.js` event) or gtag `js`/`config` (send_page_view: false);
 *  4. sends a page view for the current page and one per router navigation (NavigationEnd), once the
 *     new page set its title (so `page_title` is right), in navigation order;
 *  5. loads gtm.js or gtag/js on idle after the window `load` event, so it never competes with LCP/TBT.
 * The tag loads even while consent is denied: Google then only receives cookieless pings (no `_ga`
 * cookies), which is what Consent Mode is for and what GA4's "data collection active" check needs.
 * Accept/Reject later turns into `consent update` + a `cookie_consent_update` dataLayer event.
 *
 * Page views: gtag mode sends `gtag('event', 'page_view', …)`; GTM mode pushes
 * `{ event: 'virtual_page_view', page_location, page_path, page_title, page_referrer }` for a GA4 event
 * tag in the container. In GA4, turn off Enhanced measurement → "Page changes based on browser history
 * events", or SPA navigations are counted twice.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly consent = inject(ConsentService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly active = signal<AnalyticsSetup>({ mode: 'off' });
  private started = false;
  private lastConsent: boolean | null = null;
  /** The visitor's explicit choice (true = Accept, false = Reject), or null while they haven't chosen. */
  private readonly choice = computed<boolean | null>(() =>
    this.consent.answered() ? this.consent.analyticsGranted() : null,
  );
  private lastPage: string | null = null;
  private lastLocation: string | null = null;
  private lastTitle: string | null = null;
  private navigations = 0;
  private queue: Promise<void> = Promise.resolve();

  /** The setup in use after `start()` ('off' on the server, without ids, or before start). */
  readonly setup = this.active.asReadonly();

  constructor() {
    if (!this.isBrowser) return;
    // Consent changes after start → Consent Mode update (the initial state is pushed by start()).
    effect(() => {
      const choice = this.choice();
      if (this.active().mode === 'off' || choice === null || choice === this.lastConsent) return;
      this.lastConsent = choice;
      this.pushConsentUpdate(choice);
      this.dataLayer().push({ event: CONSENT_UPDATE_EVENT, analytics_storage: choice ? 'granted' : 'denied' });
    });
  }

  start(config: AnalyticsConfig | null | undefined, options: AnalyticsStartOptions = {}): AnalyticsSetup {
    if (!this.isBrowser || this.started) return this.active();
    const setup = resolveAnalyticsSetup(config);
    if (setup.mode === 'off') return setup;
    this.started = true;

    const gtag = this.gtag();
    gtag('consent', 'default', { ...CONSENT_DEFAULTS });
    gtag('consent', 'default', { ...CONSENT_DEFAULTS_REGIONAL, region: [...CONSENT_REQUIRED_REGIONS] });
    gtag('set', 'ads_data_redaction', true);
    // A returning visitor's earlier choice (Accept or Reject) overrides the regional default right away.
    this.lastConsent = this.choice();
    if (this.lastConsent !== null) this.pushConsentUpdate(this.lastConsent);

    let src: string;
    if (setup.mode === 'gtm') {
      this.dataLayer().push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(setup.id)}`;
    } else {
      gtag('js', new Date());
      gtag('config', setup.id, { send_page_view: false });
      src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(setup.id)}`;
    }
    this.active.set(setup);

    const exclude = options.exclude ?? (() => false);
    let first = true; // the landing page already has its final title (server-rendered)
    const track = (url: string) => {
      if (!exclude(url)) this.trackPage(url, first);
      first = false;
    };
    track(this.router.url);
    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) track(event.urlAfterRedirects);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    this.whenIdle(() => this.loadScript(src));
    return setup;
  }

  /**
   * Queues a page view for `url` (path + query; fragment-only changes are ignored). Views are sent in
   * navigation order. After a navigation the view waits until the new page has set its own <title> (it
   * often does so only once its data arrived), at most PAGE_SETTLE_MS.
   */
  private trackPage(url: string, first: boolean): void {
    const page = url.split('#')[0] || '/';
    if (page === this.lastPage) return;
    this.lastPage = page;
    const seq = ++this.navigations;
    const location = (this.document.defaultView?.location.origin ?? '') + page;
    const referrer = this.lastLocation ?? this.document.referrer;
    this.lastLocation = location;

    this.queue = this.queue.then(async () => {
      if (!first) await this.titleSettled(seq);
      const title = this.document.title;
      this.lastTitle = title;
      const params = { page_location: location, page_path: page, page_title: title, page_referrer: referrer };
      const setup = this.active();
      if (setup.mode === 'gtm') this.dataLayer().push({ event: VIRTUAL_PAGE_VIEW_EVENT, ...params });
      else if (setup.mode === 'gtag') this.gtag()('event', 'page_view', { ...params, send_to: setup.id });
    });
  }

  /**
   * Resolves once the title differs from the last page's, another navigation started, the page is being
   * hidden or closed, or on timeout.
   */
  private titleSettled(seq: number): Promise<void> {
    const startedAt = Date.now();
    const view = this.document.defaultView as Window;
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        clearTimeout(timer);
        this.document.removeEventListener('visibilitychange', check);
        view.removeEventListener('pagehide', done);
        resolve();
      };
      const settled = () =>
        this.document.title !== this.lastTitle ||
        seq !== this.navigations ||
        this.document.visibilityState === 'hidden' ||
        Date.now() - startedAt >= PAGE_SETTLE_MS;
      const check = () => {
        clearTimeout(timer);
        if (settled()) done();
        else timer = setTimeout(check, 100);
      };
      this.document.addEventListener('visibilitychange', check);
      view.addEventListener('pagehide', done);
      check();
    });
  }

  private pushConsentUpdate(granted: boolean): void {
    this.gtag()('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
  }

  private dataLayer(): unknown[] {
    const view = this.document.defaultView as Window;
    return (view.dataLayer ??= []);
  }

  /** The standard gtag stub. It must push the `arguments` object: gtag.js/GTM ignore plain arrays. */
  private gtag(): (...args: unknown[]) => void {
    const view = this.document.defaultView as Window;
    const dataLayer = this.dataLayer();
    view.gtag ??= function gtag() {
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    };
    return view.gtag;
  }

  private loadScript(src: string): void {
    if (this.document.querySelector(`script[src="${src}"]`)) return;
    const script = this.document.createElement('script');
    script.async = true;
    script.src = src;
    this.document.head.appendChild(script);
  }

  /** After the window `load` event, then on idle (with a timeout) — off the critical rendering path. */
  private whenIdle(task: () => void): void {
    const view = this.document.defaultView as Window;
    const schedule = () => {
      if (typeof view.requestIdleCallback === 'function') view.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
      else view.setTimeout(task, 1);
    };
    if (this.document.readyState === 'complete') schedule();
    else view.addEventListener('load', schedule, { once: true });
  }
}
