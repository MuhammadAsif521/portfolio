import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Admin requests authenticate with the httpOnly pf_session cookie (ApiService sends
    // withCredentials by default); no public-session interceptor here.
    provideHttpClient(withFetch()),
  ],
};
