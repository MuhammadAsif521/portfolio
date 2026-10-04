import { Component, DestroyRef, Injector, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { CookieConsentComponent } from '@shared/components/cookie-consent/cookie-consent';
import { TOASTER_OPTIONS } from '@shared/constants/const';
import { NgxSonnerToaster } from 'ngx-sonner';
import { siteFeature } from './core/store/site.feature';
import { SiteFooter } from './layout/site-footer/site-footer';
import { SiteHeader } from './layout/site-header/site-header';

@Component({
  // NgxSonnerToaster and the cookie banner are only used inside @defer, so they stay out of the initial bundle.
  imports: [RouterOutlet, NgxSonnerToaster, CookieConsentComponent, SiteHeader, SiteFooter],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly toaster = TOASTER_OPTIONS;

  constructor() {
    const settings = inject(Store).selectSignal(siteFeature.selectSettings);
    const injector = inject(Injector);
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => (destroyed = true));
    // Browser only, after hydration: GTM (or gtag.js) with Consent Mode v2, ids from Site Settings. The
    // service is a lazy chunk (not in the initial bundle); the Google script itself loads on idle after
    // the window `load` event (see AnalyticsService).
    afterNextRender(async () => {
      const current = settings();
      if (!current?.googleTagManagerId && !current?.googleAnalyticsId) return;
      const { AnalyticsService } = await import('@shared/services/analytics.service');
      if (destroyed) return;
      injector.get(AnalyticsService).start(
        { googleAnalyticsId: current.googleAnalyticsId, googleTagManagerId: current.googleTagManagerId },
        { exclude: (path) => path.startsWith('/cusadmin') },
      );
    });
  }
}
