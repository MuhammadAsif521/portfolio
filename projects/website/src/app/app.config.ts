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
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    
    provideHttpClient(withFetch(), withInterceptors([publicSessionInterceptor])),
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeRequestsWithCredentials: true,
        filter: (req) => !isContentRequest(req.url),
      }),
      withIncrementalHydration(),
    ),
    provideStore(),
    provideState(siteFeature),
    provideState(uiFeature),
    provideEffects(siteEffects),
    provideContentState(),
    ...(typeof ngDevMode === 'undefined' || ngDevMode ? [provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })] : []),
    provideWebsiteIcons(),
    provideSiteInitializer(),
  ],
};
