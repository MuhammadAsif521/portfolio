import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AnalyticsService } from '@shared/services/analytics.service';
import { CONSENT_COOKIE, ConsentService } from '@shared/services/consent.service';
import { PublicApiService } from '@shared/services/public-api.service';
import { App } from './app';
import { SiteFooter } from './layout/site-footer/site-footer';
import { provideTestStore } from './testing/store.testing';

const settings = {
  _id: 's1',
  siteName: 'Muhammad Asif',
  socialLinks: [],
  siteMode: 'system',
  activeThemeId: 't1',
  activeTheme: null,
  googleAnalyticsId: 'G-QSLES6573S',
  googleTagManagerId: 'GTM-T68362R4',
};

function setup(start = vi.fn()) {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestStore({ site: { settings, status: 'loaded', error: null } }),
      { provide: PublicApiService, useValue: {} },
      { provide: AnalyticsService, useValue: { start } },
    ],
  });
  return start;
}

describe('Analytics wiring', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    document.cookie = `${CONSENT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  it('starts analytics after the first render with the Site Settings ids, excluding /cusadmin', async () => {
    const start = setup();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1), { timeout: 10_000 }); // lazy chunk
    const [config, options] = start.mock.calls[0];
    expect(config).toEqual({ googleAnalyticsId: 'G-QSLES6573S', googleTagManagerId: 'GTM-T68362R4' });
    expect(options.exclude('/cusadmin/login')).toBe(true);
    expect(options.exclude('/blog')).toBe(false);
  });

  it('the footer "Cookie settings" button reopens the banner after a choice was made', async () => {
    setup();
    const consent = TestBed.inject(ConsentService);
    consent.reject();
    expect(consent.bannerVisible()).toBe(false);

    const fixture = TestBed.createComponent(SiteFooter);
    await fixture.whenStable();
    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cookie settings',
    );
    expect(button).toBeTruthy();
    button!.click();
    expect(consent.bannerVisible()).toBe(true);
  });
});
