import { isPlatformBrowser } from '@angular/common';
import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { ApplicationRef, Injectable, PLATFORM_ID, TransferState, inject } from '@angular/core';
import { catchError, from, switchMap, tap, throwError, type Observable } from 'rxjs';
import { API_BASE_URL, SSR_API_KEY } from '@shared/config/api.tokens';
import {
  PUBLIC_SESSION_ERROR_CODES,
  PublicSessionService,
  SKIP_PUBLIC_SESSION,
} from '@shared/services/public-session.service';

/**
 * Knows which GET URLs the server-rendered page shipped in Angular's HTTP transfer cache, while that cache
 * is still answering (until the app is first stable).
 *
 * Why: functional interceptors run *before* Angular's transfer-cache interceptor. Without this, the
 * hydration requests would first establish a public session (loading reCAPTCHA, ~400 KB from Google)
 * and add an Authorization header, which also makes the transfer cache skip them, so every hydrated page
 * fetched its data twice. Passing those requests on untouched lets the cache answer them.
 */
@Injectable({ providedIn: 'root' })
export class HydrationCacheProbe {
  private readonly urls = readTransferCacheUrls(inject(TransferState));
  private active = this.urls.size > 0;

  constructor() {
    if (this.active) void inject(ApplicationRef).whenStable().then(() => (this.active = false));
  }

  /** True when a GET for `url` will (most likely) be served from the transfer cache. */
  has(url: string): boolean {
    return this.active && this.urls.has(url);
  }
}

/** Request URLs of the HTTP transfer cache entries (`u` = request URL, `b` = body) in the page's state. */
function readTransferCacheUrls(state: TransferState): Set<string> {
  const urls = new Set<string>();
  if (state.isEmpty) return urls;
  try {
    const store = JSON.parse(state.toJson()) as Record<string, { b?: unknown; u?: unknown } | null>;
    for (const entry of Object.values(store)) {
      if (entry && typeof entry === 'object' && 'b' in entry && typeof entry.u === 'string') urls.add(entry.u);
    }
  } catch {
    /* unreadable state: fall back to the normal session flow */
  }
  return urls;
}

/**
 * Authorises every request to portfolio-node's /public API (website only):
 *  - SSR: adds X-SSR-Key (server-only secret) — no session, no reCAPTCHA on the server.
 *  - Browser: adds `Authorization: Bearer <session token>`, adopts renewed tokens from
 *    X-Session-Token, and on a 401 PUBLIC_SESSION_* re-establishes the session and retries once.
 *  - Browser, during hydration: requests the server already answered (transfer cache) go through
 *    without a session, so a server-rendered first view needs no session and no reCAPTCHA at all.
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

  const retryOnSessionError = (err: unknown): Observable<HttpEvent<unknown>> => {
    const code = err instanceof HttpErrorResponse ? (err.error as { code?: string } | null)?.code : undefined;
    if (err instanceof HttpErrorResponse && err.status === 401 && code && PUBLIC_SESSION_ERROR_CODES.has(code)) {
      // Expired or rejected (e.g. the visitor's IP changed): get a fresh session, retry once.
      session.invalidate();
      return from(session.getToken()).pipe(switchMap((token) => send(req, token)));
    }
    return throwError(() => err);
  };

  // Served from the SSR transfer cache (the next interceptor): no token needed. Should the cache miss
  // after all (e.g. different query params), the API answers 401 and the normal session flow takes over.
  if (req.method === 'GET' && !session.currentToken() && inject(HydrationCacheProbe).has(req.url)) {
    return send(req, null).pipe(catchError(retryOnSessionError));
  }

  return from(session.getToken()).pipe(
    switchMap((token) => send(req, token)),
    catchError(retryOnSessionError),
  );
};
