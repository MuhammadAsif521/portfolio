import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MAT_MENU_DEFAULT_OPTIONS } from '@angular/material/menu';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { authInterceptor } from '@cusadmin/core/interceptors/auth.interceptor';
import { profileEffects } from '@cusadmin/store/profile/profile.effects';
import { profileFeature } from '@cusadmin/store/profile/profile.feature';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Admin requests authenticate with the httpOnly pf_session cookie (authInterceptor adds
    // withCredentials; a 401 session code returns to /login). No public-session interceptor here.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideStore({ [profileFeature.name]: profileFeature.reducer }),
    provideEffects(profileEffects),
    // Panel classes styled in shared styles/_material.scss (conb-sites-admin conventions).
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: { tooltipClass: 'my-global-tooltip' } },
    { provide: MAT_MENU_DEFAULT_OPTIONS, useValue: { overlayPanelClass: 'global-mat-menu' } },
    { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { panelClass: 'global-mat-dialog', hasBackdrop: true } },
  ],
};
