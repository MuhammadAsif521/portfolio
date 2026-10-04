import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AnalyticsService, CONSENT_DEFAULTS, resolveAnalyticsSetup, VIRTUAL_PAGE_VIEW_EVENT } from './analytics.service';
import { CONSENT_COOKIE, ConsentService } from './consent.service';

@Component({ template: '' })
class Blank {}

const GTM = 'GTM-T68362R4';
const GA = 'G-QSLES6573S';

/** dataLayer entries as plain arrays (gtag pushes `arguments` objects). */
function layer(): unknown[] {
  return (window.dataLayer ?? []).map((entry) =>
    Object.prototype.toString.call(entry) === '[object Arguments]' ? Array.from(entry as ArrayLike<unknown>) : entry,
  );
}

const googleScripts = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="googletagmanager.com"]')).map((s) => s.src);

function clearCookie() {
  document.cookie = `${CONSENT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

let idleTasks: (() => void)[] = [];

function setup(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Blank },
        { path: 'blog', component: Blank, title: 'Blog' },
        { path: 'projects/:slug', component: Blank, title: 'Project' },
        { path: 'about', component: Blank },
      ]),
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  return { analytics: TestBed.inject(AnalyticsService), consent: TestBed.inject(ConsentService) };
}

/** Waits for page views (they wait for the app to be stable first). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('resolveAnalyticsSetup', () => {
  it('prefers GTM, falls back to GA4, ignores missing or malformed ids', () => {
    expect(resolveAnalyticsSetup({ googleTagManagerId: GTM, googleAnalyticsId: GA })).toEqual({ mode: 'gtm', id: GTM });
    expect(resolveAnalyticsSetup({ googleAnalyticsId: ` ${GA.toLowerCase()} ` })).toEqual({ mode: 'gtag', id: GA });
    expect(resolveAnalyticsSetup({ googleTagManagerId: 'nope', googleAnalyticsId: '' })).toEqual({ mode: 'off' });
    expect(resolveAnalyticsSetup(null)).toEqual({ mode: 'off' });
  });
});

describe('AnalyticsService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    delete window.dataLayer;
    delete window.gtag;
    googleScripts().forEach((src) => document.querySelector(`script[src="${src}"]`)?.remove());
    clearCookie();
    document.title = '';
    idleTasks = [];
    (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = (task: () => void) => {
      idleTasks.push(task);
      return idleTasks.length;
    };
  });

  afterEach(() => clearCookie());

  it('does nothing on the server: no dataLayer, no scripts', () => {
    const { analytics } = setup('server');
    expect(analytics.start({ googleTagManagerId: GTM })).toEqual({ mode: 'off' });
    idleTasks.forEach((task) => task());
    expect(window.dataLayer).toBeUndefined();
    expect(googleScripts()).toEqual([]);
  });

  it('does nothing without a configured id', () => {
    const { analytics } = setup();
    expect(analytics.start({ googleAnalyticsId: '', googleTagManagerId: '' })).toEqual({ mode: 'off' });
    expect(window.dataLayer).toBeUndefined();
  });

  it('GTM: consent default is the first command, before gtm.js; the script loads only on idle', () => {
    const { analytics } = setup();
    analytics.start({ googleTagManagerId: GTM, googleAnalyticsId: GA });

    const entries = layer();
    expect(entries[0]).toEqual(['consent', 'default', { ...CONSENT_DEFAULTS }]);
    expect(entries.findIndex((e) => (e as { event?: string }).event === 'gtm.js')).toBeGreaterThan(0);
    // Denied unless the visitor accepted: no update yet.
    expect(entries.some((e) => Array.isArray(e) && e[1] === 'update')).toBe(false);

    expect(googleScripts()).toEqual([]);
    idleTasks.forEach((task) => task());
    expect(googleScripts()).toEqual([`https://www.googletagmanager.com/gtm.js?id=${GTM}`]);
    // Never both containers.
    expect(googleScripts().some((src) => src.includes('/gtag/js'))).toBe(false);
  });

  it('gtag mode (GA4 id only): config with send_page_view false, then gtag/js on idle', () => {
    const { analytics } = setup();
    analytics.start({ googleAnalyticsId: GA });
    const entries = layer();
    expect(entries[0]).toEqual(['consent', 'default', { ...CONSENT_DEFAULTS }]);
    expect(entries).toContainEqual(['config', GA, { send_page_view: false }]);
    idleTasks.forEach((task) => task());
    expect(googleScripts()).toEqual([`https://www.googletagmanager.com/gtag/js?id=${GA}`]);
  });

  it('Accept → consent update granted (+ dataLayer event); Reject → denied', () => {
    const { analytics, consent } = setup();
    analytics.start({ googleTagManagerId: GTM });

    consent.acceptAnalytics();
    TestBed.tick();
    expect(layer()).toContainEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(layer()).toContainEqual({ event: 'cookie_consent_update', analytics_storage: 'granted' });
    expect(document.cookie).toContain(CONSENT_COOKIE);

    consent.reject();
    TestBed.tick();
    expect(layer().at(-2)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  });

  it('defaults by region: analytics granted globally, denied in the EEA/UK/CH; ads denied everywhere', () => {
    const { analytics } = setup();
    analytics.start({ googleTagManagerId: GTM });
    const defaults = layer().filter((e) => Array.isArray(e) && e[0] === 'consent' && e[1] === 'default') as [
      string,
      string,
      Record<string, unknown>,
    ][];
    expect(defaults).toHaveLength(2);
    expect(defaults[0][2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied' });
    expect(defaults[0][2]['region']).toBeUndefined();
    expect(defaults[1][2]).toMatchObject({ analytics_storage: 'denied', ad_storage: 'denied' });
    expect(defaults[1][2]['region']).toEqual(expect.arrayContaining(['DE', 'FR', 'GB', 'CH', 'NO']));
    expect(defaults[1][2]['region']).not.toContain('PK');
  });

  it('a first Reject (no earlier choice) pushes consent update denied', () => {
    const { analytics, consent } = setup();
    analytics.start({ googleTagManagerId: GTM });
    expect(layer().some((e) => Array.isArray(e) && e[1] === 'update')).toBe(false);
    consent.reject();
    TestBed.tick();
    expect(layer()).toContainEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  });

  it('returning visitor who accepted: update granted right after the default, before the script loads', () => {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ necessary: true, analytics: true }))}; path=/`;
    const { analytics, consent } = setup();
    expect(consent.bannerVisible()).toBe(false);
    analytics.start({ googleTagManagerId: GTM });
    const entries = layer();
    expect(entries[0]).toEqual(['consent', 'default', { ...CONSENT_DEFAULTS }]);
    expect(entries.findIndex((e) => Array.isArray(e) && e[1] === 'update')).toBeLessThan(
      entries.findIndex((e) => (e as { event?: string }).event === 'gtm.js'),
    );
    expect(googleScripts()).toEqual([]);
  });

  it('sends a page view for the first page and for each navigation (not for fragment-only changes)', async () => {
    const { analytics } = setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    analytics.start({ googleTagManagerId: GTM });

    await router.navigateByUrl('/blog');
    await router.navigateByUrl('/blog#top');
    await router.navigateByUrl('/projects/demo?ref=x');

    const views = () =>
      layer().filter((e) => (e as { event?: string }).event === VIRTUAL_PAGE_VIEW_EVENT) as {
        page_path: string;
        page_title: string;
        page_location: string;
        page_referrer: string;
      }[];
    await vi.waitFor(() => expect(views().map((v) => v.page_path)).toEqual(['/', '/blog', '/projects/demo?ref=x']));
    expect(views()[2].page_title).toBe('Project');
    expect(views()[1].page_title).toBe('Blog');
    expect(views()[1].page_location).toBe(`${location.origin}/blog`);
    expect(views()[1].page_referrer).toBe(`${location.origin}/`);
  });

  it('waits for the new page to set its title (e.g. after its data loaded) before sending the view', async () => {
    const { analytics } = setup();
    const router = TestBed.inject(Router);
    document.title = 'Home';
    analytics.start({ googleTagManagerId: GTM });
    await router.navigateByUrl('/about'); // a route without its own title: the component sets it later
    await settle();
    const viewFor = () =>
      layer().find((e) => (e as { page_path?: string }).page_path === '/about') as { page_title: string } | undefined;
    expect(viewFor()).toBeUndefined();
    document.title = 'About';
    await vi.waitFor(() => expect(viewFor()?.page_title).toBe('About'));
  });

  it('sends a pending view at once when the tab is hidden (no title change needed)', async () => {
    const { analytics } = setup();
    const router = TestBed.inject(Router);
    document.title = 'Home';
    analytics.start({ googleTagManagerId: GTM });
    await router.navigateByUrl('/about');
    await settle();
    const viewFor = () => layer().find((e) => (e as { page_path?: string }).page_path === '/about');
    expect(viewFor()).toBeUndefined();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.waitFor(() => expect(viewFor()).toBeTruthy());
    } finally {
      delete (document as unknown as { visibilityState?: string }).visibilityState;
    }
  });

  it('gtag mode sends page_view events with gtag()', async () => {
    const { analytics } = setup();
    const router = TestBed.inject(Router);
    analytics.start({ googleAnalyticsId: GA });
    await router.navigateByUrl('/blog');
    const views = () => layer().filter((e) => Array.isArray(e) && e[0] === 'event' && e[1] === 'page_view') as unknown[][];
    await vi.waitFor(() => expect(views().length).toBe(2));
    expect(views()[1][2]).toEqual(expect.objectContaining({ page_path: '/blog', page_title: 'Blog', send_to: GA }));
  });

  it('skips excluded paths', async () => {
    const { analytics } = setup();
    const router = TestBed.inject(Router);
    analytics.start({ googleTagManagerId: GTM }, { exclude: (path) => path.startsWith('/blog') });
    await router.navigateByUrl('/blog');
    await new Promise((resolve) => setTimeout(resolve, 300));
    const paths = layer()
      .filter((e) => (e as { event?: string }).event === VIRTUAL_PAGE_VIEW_EVENT)
      .map((e) => (e as { page_path: string }).page_path);
    expect(paths).not.toContain('/blog');
  });

  it('starts only once', () => {
    const { analytics } = setup();
    analytics.start({ googleTagManagerId: GTM });
    const length = layer().length;
    analytics.start({ googleTagManagerId: GTM });
    expect(layer().length).toBe(length);
  });
});
