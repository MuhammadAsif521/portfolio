import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { publicSessionInterceptor } from '@shared/interceptors/public-session.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Public API calls carry the visitor's session token (browser) or X-SSR-Key (server).
    provideHttpClient(withFetch(), withInterceptors([publicSessionInterceptor])),
    // GET responses fetched during SSR are reused on hydration, so the first page view makes no
    // browser API calls at all (and needs no public session or reCAPTCHA).
    provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: false })),
  ],
};
