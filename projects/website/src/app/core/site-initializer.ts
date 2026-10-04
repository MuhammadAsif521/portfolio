import { RESPONSE_INIT, inject, provideAppInitializer } from '@angular/core';
import { Store } from '@ngrx/store';
import { filter, firstValueFrom, of, timeout } from 'rxjs';
import { SiteActions, siteFeature } from './store/site.feature';

/** Upper bound on how long rendering waits for the API; after that the page renders with defaults. */
const SETTINGS_TIMEOUT_MS = 4_000;

/**
 * Loads Site Settings before the first render — on the server, so the HTML ships with the admin's theme,
 * name and SEO (no flash), and in the browser, where the response comes from the hydration transfer
 * cache. An unreachable API never blocks the page: it renders with the design defaults instead.
 */
export function provideSiteInitializer() {
  return provideAppInitializer(() => {
    const store = inject(Store);
    const responseInit = inject(RESPONSE_INIT, { optional: true }); // server only
    store.dispatch(SiteActions.loadSettings());
    return firstValueFrom(
      store.select(siteFeature.selectStatus).pipe(
        filter((status) => status === 'loaded' || status === 'error'),
        timeout({ first: SETTINGS_TIMEOUT_MS, with: () => of('error' as const) }),
      ),
    ).then((status) => {
      // A page rendered with fallback defaults (API down or cold-starting) must not be kept by the CDN
      // (see server.ts): the next request should try the API again.
      if (status !== 'loaded' && responseInit) {
        const headers = new Headers(responseInit.headers);
        headers.set('Cache-Control', 'no-store');
        responseInit.headers = headers;
      }
    });
  });
}
