import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, Injector, PLATFORM_ID, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@shared/config/api.tokens';
import type { ApiResponse } from '@shared/interfaces/auth.interface';
import type { VerifySessionData } from '@shared/interfaces/public-api.interface';

/** Marks the session service's own requests so the interceptor doesn't try to authorise them. */
export const SKIP_PUBLIC_SESSION = new HttpContextToken<boolean>(() => false);

/** 401 codes that mean "get a new public session and retry" (portfolio-node, 03-errors.md). */
export const PUBLIC_SESSION_ERROR_CODES = new Set([
  'PUBLIC_SESSION_REQUIRED',
  'PUBLIC_SESSION_EXPIRED',
  'PUBLIC_SESSION_INVALID',
]);

/** Why the last attempt to establish a session failed (see PublicSessionService.failure()). */
export type PublicSessionFailure = 'recaptcha' | 'network' | 'rejected';

/** Error code the interceptor reports when no session could be established (never sent by the API). */
export const PUBLIC_SESSION_UNAVAILABLE = 'PUBLIC_SESSION_UNAVAILABLE';

const RECAPTCHA_ACTION = 'public_session';
/** Refresh a little before expiry so an in-flight request never carries a dead token. */
const EXPIRY_MARGIN_MS = 30_000;
/**
 * Non-secret hint (an expiry timestamp) telling us whether the httpOnly session cookie is probably still
 * valid, so a returning visitor re-uses it without running reCAPTCHA. The token itself stays in memory.
 */
const EXPIRY_HINT_KEY = 'public-session-expires-at';

/**
 * Public API session for the website (same flow as nb-recovers, adapted to portfolio-node):
 *
 * - One token per browser visit, sent on every /public request by publicSessionInterceptor.
 * - reCAPTCHA quota is spent only when there is no valid session:
 *     1. a valid token in memory is used as-is;
 *     2. if the cookie is probably still valid, verify-session is called *without* a reCAPTCHA token and
 *        the server returns the existing session (Google is never called);
 *     3. only otherwise is reCAPTCHA loaded (lazily) and executed.
 * - Renewed tokens from the X-Session-Token response header are adopted automatically.
 * - Concurrent callers share one establishment (one verify-session / reCAPTCHA run), and a 401 for a
 *   token that has already been replaced does not throw the new one away (see invalidate()).
 * - When no session can be established, getToken() resolves null and failure() says why; the
 *   interceptor then fails the request with a clear PUBLIC_SESSION_UNAVAILABLE error instead of sending
 *   it without a token (which could only answer 401).
 * - On the server (SSR) this service is inert: the interceptor sends X-SSR-Key instead.
 */
@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private token: string | null = null;
  private expiresAt = 0;
  private pending: Promise<string | null> | null = null;
  private lastFailure: PublicSessionFailure | null = null;
  private readonly injector = inject(Injector);

  /** A usable session token, establishing one if needed. Always null during SSR. */
  getToken(): Promise<string | null> {
    if (!this.isBrowser) return Promise.resolve(null);
    if (this.token && this.expiresAt - Date.now() > EXPIRY_MARGIN_MS) return Promise.resolve(this.token);
    this.pending ??= this.establish()
      .catch((err: unknown) => {
        // e.g. the reCAPTCHA chunk failed to load (offline): report it like any other failure.
        console.error('[PublicSessionService] could not establish a session', err);
        this.lastFailure = 'network';
        return null;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  /** Why the last establishment failed; null after a success. */
  failure(): PublicSessionFailure | null {
    return this.lastFailure;
  }

  /** The in-memory token if it is still usable, without establishing one (never runs reCAPTCHA). */
  currentToken(): string | null {
    return this.token && this.expiresAt - Date.now() > EXPIRY_MARGIN_MS ? this.token : null;
  }

  /** Adopts a token the server sent back (verify-session body or X-Session-Token renewal). */
  accept(token: string, expiresInSeconds: number): void {
    if (!token || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return;
    this.token = token;
    this.expiresAt = Date.now() + expiresInSeconds * 1000;
    this.lastFailure = null;
    this.writeHint(this.expiresAt);
  }

  /**
   * Drops the current token after a 401 PUBLIC_SESSION_*, so the next getToken() re-establishes.
   * Pass the token the failed request carried: if another request has already replaced it (concurrent
   * 401s), the fresh token is kept and no second reCAPTCHA runs. Without an argument it always clears.
   */
  invalidate(failedToken?: string | null): void {
    if (failedToken !== undefined && failedToken !== this.token) return;
    this.token = null;
    this.expiresAt = 0;
    this.writeHint(null);
  }

  private async establish(): Promise<string | null> {
    // 2. The cookie is probably still valid: ask the server to hand it back, no reCAPTCHA needed.
    if (this.readHint() > Date.now() + EXPIRY_MARGIN_MS) {
      const reused = await this.verify(null).catch(() => null);
      if (reused) return reused;
    }

    // 3. No usable session: run reCAPTCHA (retry once — the first call can race a cold script load).
    let failure: PublicSessionFailure = 'recaptcha';
    for (let attempt = 1; attempt <= 2; attempt++) {
      const recaptchaToken = await this.runRecaptcha();
      if (!recaptchaToken) {
        failure = 'recaptcha';
        continue;
      }
      const token = await this.verify(recaptchaToken).catch((err: unknown) => {
        console.error('[PublicSessionService] verify-session failed', err);
        failure = err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500 ? 'rejected' : 'network';
        return null;
      });
      if (token) return token;
    }
    this.lastFailure = failure;
    return null;
  }

  /** reCAPTCHA's code (and Google's script) loads only here, when a visitor first needs a new session. */
  private async runRecaptcha(): Promise<string | null> {
    const { RecaptchaService } = await import('./recaptcha.service');
    return this.injector.get(RecaptchaService).execute(RECAPTCHA_ACTION);
  }

  private async verify(recaptchaToken: string | null): Promise<string | null> {
    let headers = new HttpHeaders();
    if (recaptchaToken) {
      headers = headers.set('x-recaptcha-token', recaptchaToken).set('x-recaptcha-action', RECAPTCHA_ACTION);
    }
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<VerifySessionData>>(
          `${this.baseUrl}/public/verify-session`,
          {},
          { headers, withCredentials: true, context: new HttpContext().set(SKIP_PUBLIC_SESSION, true) },
        ),
      );
      const data = response.data;
      if (!response.status || !data?.sessionToken) return null;
      this.accept(data.sessionToken, data.expiresIn);
      return data.sessionToken;
    } catch (err) {
      // A tokenless attempt is expected to fail with RECAPTCHA_MISSING when the cookie has gone.
      if (!recaptchaToken && err instanceof HttpErrorResponse && err.status < 500) return null;
      throw err;
    }
  }

  private readHint(): number {
    try {
      return Number(this.document.defaultView?.localStorage.getItem(EXPIRY_HINT_KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  private writeHint(expiresAt: number | null): void {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (expiresAt) storage?.setItem(EXPIRY_HINT_KEY, String(expiresAt));
      else storage?.removeItem(EXPIRY_HINT_KEY);
    } catch {
      /* storage unavailable: we'll just run reCAPTCHA when needed */
    }
  }
}
