import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { mergeApplicationConfig, ApplicationConfig, type Provider } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { API_BASE_URL, SSR_API_KEY } from '@shared/config/api.tokens';
import { environment } from '@shared/environment/environment';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/*
 * Server-only settings, read from the SSR container's environment (never bundled for the browser):
 *   API_INTERNAL_URL  portfolio-node on the Docker network, e.g. http://portfolio-node:3000/api/v1.
 *                     Required in production: nginx strips X-SSR-Key from public traffic.
 *   SSR_API_KEY       must equal portfolio-node's SSR_API_KEY.
 */
const publicApiUrl = environment.server.replace(/\/+$/, '');
const internalApiUrl = (process.env['API_INTERNAL_URL'] ?? publicApiUrl).replace(/\/+$/, '');
const ssrApiKey = process.env['SSR_API_KEY'] ?? null;

const providers: Provider[] = [
  { provide: API_BASE_URL, useValue: internalApiUrl },
  { provide: SSR_API_KEY, useValue: ssrApiKey },
];

// The transfer cache keys responses by URL: map the internal origin to the public one, or every page
// would fetch its data twice (once on the server, again in the browser).
const internalOrigin = new URL(internalApiUrl).origin;
const publicOrigin = new URL(publicApiUrl).origin;
if (internalOrigin !== publicOrigin) {
  providers.push({ provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP, useValue: { [internalOrigin]: publicOrigin } });
}

if (!ssrApiKey) {
  console.warn('[ssr] SSR_API_KEY is not set: server-rendered pages cannot read the public API.');
}

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes)), ...providers],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
