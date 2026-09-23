import { InjectionToken } from '@angular/core';
import { environment } from '@shared/environment/environment';

/**
 * Base URL of portfolio-node's /api/v1. Browser: the public URL from the environment file.
 * SSR (app.config.server.ts): the internal Docker URL, because nginx strips X-SSR-Key from public traffic.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.server.replace(/\/+$/, ''),
});

/**
 * Server-only secret the Angular SSR server sends as X-SSR-Key on /public requests (it can't run
 * reCAPTCHA). Provided only in app.config.server.ts from process.env — never in browser bundles.
 */
export const SSR_API_KEY = new InjectionToken<string | null>('SSR_API_KEY', {
  providedIn: 'root',
  factory: () => null,
});
