import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { environment } from '@shared/environment/environment';

const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=';
const RECAPTCHA_TIMEOUT_MS = 8_000;

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
 * reCAPTCHA v3 for the website (public session) and cusadmin (login). Google's script is loaded lazily,
 * the first time a token is actually needed. Resolves null on the server, on timeout or on failure, so
 * callers decide what a missing token means (portfolio-node skips the check when RECAPTCHA_ENABLED=false).
 */
@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private loader: Promise<Grecaptcha | null> | null = null;

  async execute(action: string): Promise<string | null> {
    if (!this.isBrowser) return null;
    const grecaptcha = await this.load();
    if (!grecaptcha) return null;
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), RECAPTCHA_TIMEOUT_MS);
      grecaptcha.ready(() => {
        // grecaptcha returns a Closure "thenable", not a real Promise (no .catch/.finally), so wrap it.
        Promise.resolve(grecaptcha.execute(environment.SITE_KEY, { action }))
          .then((token) => resolve(token))
          .catch((err: unknown) => {
            console.error('[RecaptchaService] execute failed (is the site key registered for this domain?)', err);
            resolve(null);
          })
          .finally(() => clearTimeout(timer));
      });
    });
  }

  private load(): Promise<Grecaptcha | null> {
    const view = this.document.defaultView;
    if (view?.grecaptcha) return Promise.resolve(view.grecaptcha);
    this.loader ??= new Promise<Grecaptcha | null>((resolve) => {
      const script = this.document.createElement('script');
      script.src = RECAPTCHA_SRC + encodeURIComponent(environment.SITE_KEY);
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(view?.grecaptcha ?? null);
      script.onerror = () => {
        console.error('[RecaptchaService] script failed to load (network, ad-blocker or CSP?)');
        this.loader = null; // allow a later retry
        resolve(null);
      };
      this.document.head.appendChild(script);
    });
    return this.loader;
  }
}
