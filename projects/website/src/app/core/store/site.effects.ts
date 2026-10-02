import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { PublicApiService } from '@shared/services/public-api.service';
import { SeoService } from '@shared/services/seo.service';
import { ThemeService } from '@shared/services/theme.service';
import { getError } from '@shared/utils/get-error.util';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { SiteActions } from './site.feature';

/** GET /public/settings (X-SSR-Key during SSR; served from the transfer cache on hydration). */
export const loadSettings = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService)) =>
    actions$.pipe(
      ofType(SiteActions.loadSettings),
      exhaustMap(() =>
        api.getSettings().pipe(
          map((settings) => SiteActions.loadSettingsSuccess({ settings })),
          catchError((err: unknown) => of(SiteActions.loadSettingsFailure({ error: getError(err) }))),
        ),
      ),
    ),
  { functional: true },
);

/**
 * Applies settings to both theme layers and to site-wide SEO. Runs during SSR too, so the first HTML
 * already carries the brand colours, data-site-mode and the Person JSON-LD.
 */
export const applySettings = createEffect(
  (actions$ = inject(Actions), theme = inject(ThemeService), seo = inject(SeoService)) =>
    actions$.pipe(
      ofType(SiteActions.loadSettingsSuccess),
      tap(({ settings }) => {
        theme.applySiteSettings({ siteMode: settings.siteMode, activeTheme: settings.activeTheme });
        seo.applySiteSettings({
          siteName: settings.siteName,
          jobTitle: settings.siteSlogan,
          description: settings.description,
          ogImage: settings.ogImage?.url,
          logo: settings.siteLogo?.url,
          favicon: settings.favicon?.url,
          contactEmail: settings.contactEmail,
          phoneNumber: settings.phoneNumber,
          address: settings.address,
          city: settings.city,
          state: settings.state,
          zipCode: settings.zipCode,
          country: settings.country,
          socialLinks: settings.socialLinks,
          googleSiteVerification: settings.googleSiteVerification,
        });
      }),
    ),
  { functional: true, dispatch: false },
);

export const siteEffects = { loadSettings, applySettings };
