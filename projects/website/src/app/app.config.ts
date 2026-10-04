import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { publicSessionInterceptor } from '@shared/interceptors/public-session.interceptor';
import { routes } from './app.routes';
import { provideWebsiteIcons } from './core/icons';
import { provideSiteInitializer } from './core/site-initializer';
import { isContentRequest } from './core/store/content-endpoints';
import { provideContentState } from './core/store/content.state';
import { siteEffects } from './core/store/site.effects';
import { siteFeature } from './core/store/site.feature';
import { uiFeature } from './core/store/ui.feature';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // /#projects etc. land on their section; back/forward restores the scroll position.
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    // Public API calls carry the visitor's session token (browser) or X-SSR-Key (server).
    provideHttpClient(withFetch(), withInterceptors([publicSessionInterceptor])),
    // GET responses fetched during SSR are reused on hydration, so the first page view makes no
    // browser API calls at all (and needs no public session or reCAPTCHA).
    // ApiService sends withCredentials, which Angular excludes by default. Including it is safe here:
    // SSR requests carry only X-SSR-Key (no visitor cookies), so every cached response is public data.
    // Content endpoints are left out: their data reaches the browser as NgRx state instead
    // (core/store/content.state.ts), so shipping the responses as well would double the page size.
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeRequestsWithCredentials: true,
        filter: (req) => !isContentRequest(req.url),
      }),
      // @defer (hydrate on …) blocks are server-rendered but load their code only when needed (footer).
      withIncrementalHydration(),
    ),

    // NgRx (brief): site settings, UI state (scroll-spy section, mobile menu) and the content cache
    // (projects, posts, testimonials, experience: loaded once, reused for CONTENT_TTL_MS).
    provideStore(),
    provideState(siteFeature),
    provideState(uiFeature),
    provideEffects(siteEffects),
    provideContentState(),
    // Development builds only: `ngDevMode` is false in production builds, so the devtools code is dropped.
    ...(typeof ngDevMode === 'undefined' || ngDevMode ? [provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })] : []),

    // The Lucide icons the site uses (instead of lazy-loading the whole set on every page).
    provideWebsiteIcons(),

    // Settings (theme, name, SEO) are loaded before the first render.
    provideSiteInitializer(),
  ],
};
