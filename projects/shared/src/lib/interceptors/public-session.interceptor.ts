import { isPlatformBrowser } from '@angular/common';
import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { catchError, from, switchMap, tap, throwError, type Observable } from 'rxjs';
import { API_BASE_URL, SSR_API_KEY } from '@shared/config/api.tokens';
import {
  PUBLIC_SESSION_ERROR_CODES,
  PublicSessionService,
  SKIP_PUBLIC_SESSION,
} from '@shared/services/public-session.service';

/**
 * Authorises every request to portfolio-node's /public API (website only):
 *  - SSR: adds X-SSR-Key (server-only secret) — no session, no reCAPTCHA on the server.
 *  - Browser: adds `Authorization: Bearer <session token>`, adopts renewed tokens from
 *    X-Session-Token, and on a 401 PUBLIC_SESSION_* re-establishes the session and retries once.
 * verify-session itself is excluded via the SKIP_PUBLIC_SESSION context flag.
 */
export const publicSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const publicPrefix = `${inject(API_BASE_URL)}/public/`;
  if (!req.url.startsWith(publicPrefix) || req.context.get(SKIP_PUBLIC_SESSION)) return next(req);

  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    const ssrKey = inject(SSR_API_KEY);
    return next(ssrKey ? req.clone({ setHeaders: { 'X-SSR-Key': ssrKey } }) : req);
  }

  const session = inject(PublicSessionService);

  const send = (request: HttpRequest<unknown>, token: string | null): Observable<HttpEvent<unknown>> =>
    next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request).pipe(
      tap((event) => {
        if (!(event instanceof HttpResponse)) return;
        const renewed = event.headers.get('X-Session-Token');
        if (renewed) session.accept(renewed, Number(event.headers.get('X-Session-Expires-In')));
      }),
    );

  return from(session.getToken()).pipe(
    switchMap((token) => send(req, token)),
    catchError((err: unknown) => {
      const code = err instanceof HttpErrorResponse ? (err.error as { code?: string } | null)?.code : undefined;
      if (err instanceof HttpErrorResponse && err.status === 401 && code && PUBLIC_SESSION_ERROR_CODES.has(code)) {
        // Expired or rejected (e.g. the visitor's IP changed): get a fresh session, retry once.
        session.invalidate();
        return from(session.getToken()).pipe(switchMap((token) => send(req, token)));
      }
      return throwError(() => err);
    }),
  );
};
