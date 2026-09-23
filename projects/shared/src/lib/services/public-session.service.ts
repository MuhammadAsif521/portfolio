import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@shared/config/api.tokens';
import { environment } from '@shared/environment/environment';
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

const RECAPTCHA_ACTION = 'public_session';
const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=';
const RECAPTCHA_TIMEOUT_MS = 8_000;
/** Refresh a little before expiry so an in-flight request never carries a dead token. */
const EXPIRY_MARGIN_MS = 30_000;
/**
 * Non-secret hint (an expiry timestamp) telling us whether the httpOnly session cookie is probably still
 * valid, so a returning visitor re-uses it without running reCAPTCHA. The token itself stays in memory.
 */
const EXPIRY_HINT_KEY = 'public-session-expires-at';

interface Grecaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

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
  private recaptchaLoader: Promise<Grecaptcha | null> | null = null;

  /** A usable session token, establishing one if needed. Always null during SSR. */
  getToken(): Promise<string | null> {
    if (!this.isBrowser) return Promise.resolve(null);
    if (this.token && this.expiresAt - Date.now() > EXPIRY_MARGIN_MS) return Promise.resolve(this.token);
    this.pending ??= this.establish().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /** Adopts a token the server sent back (verify-session body or X-Session-Token renewal). */
  accept(token: string, expiresInSeconds: number): void {
    if (!token || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return;
    this.token = token;
    this.expiresAt = Date.now() + expiresInSeconds * 1000;
    this.writeHint(this.expiresAt);
  }

  /** Drops the current token (after a 401 PUBLIC_SESSION_*), so the next getToken() re-establishes. */
  invalidate(): void {
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
    for (let attempt = 1; attempt <= 2; attempt++) {
      const recaptchaToken = await this.executeRecaptcha();
      if (!recaptchaToken) continue;
      const token = await this.verify(recaptchaToken).catch((err: unknown) => {
        console.error('[PublicSessionService] verify-session failed', err);
        return null;
      });
      if (token) return token;
    }
    return null;
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

  private async executeRecaptcha(): Promise<string | null> {
    const grecaptcha = await this.loadRecaptcha();
    if (!grecaptcha) return null;
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), RECAPTCHA_TIMEOUT_MS);
      grecaptcha.ready(() => {
        grecaptcha
          .execute(environment.SITE_KEY, { action: RECAPTCHA_ACTION })
          .then((token) => resolve(token))
          .catch((err: unknown) => {
            console.error('[PublicSessionService] grecaptcha.execute failed (is the site key registered for this domain?)', err);
            resolve(null);
          })
          .finally(() => clearTimeout(timer));
      });
    });
  }

  /** Loads Google's script only when a reCAPTCHA check is actually needed (not on every page view). */
  private loadRecaptcha(): Promise<Grecaptcha | null> {
    const view = this.document.defaultView;
    if (view?.grecaptcha) return Promise.resolve(view.grecaptcha);
    this.recaptchaLoader ??= new Promise<Grecaptcha | null>((resolve) => {
      const script = this.document.createElement('script');
      script.src = RECAPTCHA_SRC + encodeURIComponent(environment.SITE_KEY);
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(view?.grecaptcha ?? null);
      script.onerror = () => {
        console.error('[PublicSessionService] reCAPTCHA script failed to load (network, ad-blocker or CSP?)');
        this.recaptchaLoader = null; // allow a later retry
        resolve(null);
      };
      this.document.head.appendChild(script);
    });
    return this.recaptchaLoader;
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
