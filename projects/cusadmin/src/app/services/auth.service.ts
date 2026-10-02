import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '@shared/services/api.service';
import { RecaptchaService } from '@shared/services/recaptcha.service';
import { AdminUser } from '@cusadmin/core/models/admin.model';
import { ProfileActions } from '@cusadmin/store/profile/profile.actions';

/** Must match the action portfolio-node expects for the login check. */
export const LOGIN_RECAPTCHA_ACTION = 'admin_login';

/** POST /auth/login: either signed in (cookie set) or a second step is needed. */
export type LoginResult =
  | { mfaRequired: false; user: AdminUser; expiresIn: number; message: string }
  | { mfaRequired: true; mfaToken: string; message: string };

/** Second sign-in step: a 6-digit authenticator code or one recovery code. */
export type MfaFactor = { code: string } | { recoveryCode: string };

export interface MfaSetup {
  otpauthUrl: string;
  /** data:image/png;base64 QR code of otpauthUrl. */
  qrDataUrl: string;
  /** Base32 secret for manual entry. Shown once; never stored by the app. */
  secret: string;
}

export interface ProfileUpdate {
  name?: string | null;
  email?: string;
  currentPassword?: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

type LoginResponse = { user: AdminUser; expiresIn: number } | { mfaRequired: true; mfaToken: string };

/**
 * Admin session against portfolio-node (/api/v1/auth). The JWT lives in the httpOnly pf_session cookie
 * (sent via withCredentials by the auth interceptor); nothing is stored in JS. The short-lived mfaToken of
 * the two-step sign-in is returned to the caller, which keeps it in memory only.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly base = '/auth';

  /** reCAPTCHA v3, then POST /auth/login. When signed in, the profile store holds the user. */
  login(payload: { email: string; password: string }): Observable<LoginResult> {
    return from(this.recaptcha.execute(LOGIN_RECAPTCHA_ACTION)).pipe(
      switchMap((token) =>
        this.api.post<LoginResponse>(`${this.base}/login`, payload, {
          recaptchaToken: token,
          recaptchaAction: token ? LOGIN_RECAPTCHA_ACTION : null,
        }),
      ),
      map((res): LoginResult => {
        const data = res.data;
        if ('mfaRequired' in data && data.mfaRequired) {
          return { mfaRequired: true, mfaToken: data.mfaToken, message: res.message };
        }
        const signedIn = data as { user: AdminUser; expiresIn: number };
        return { mfaRequired: false, user: signedIn.user, expiresIn: signedIn.expiresIn, message: res.message };
      }),
      tap((result) => {
        if (!result.mfaRequired && result.user) this.setUser(result.user);
      }),
    );
  }

  /** POST /auth/mfa/verify (no reCAPTCHA: the password step already passed it). Sets the session cookie. */
  verifyMfa(mfaToken: string, factor: MfaFactor) {
    return this.api
      .post<{ user: AdminUser; expiresIn: number }>(`${this.base}/mfa/verify`, { mfaToken, ...factor })
      .pipe(tap((res) => this.setUser(res.data.user)));
  }

  me() {
    return this.api.get<{ user: AdminUser }>(`${this.base}/me`).pipe(map((res) => res.data.user));
  }

  /** Clears the cookie server-side; the local profile is cleared even if the request fails. */
  logout() {
    return this.api.post<null>(`${this.base}/logout`, {}).pipe(
      tap(() => this.store.dispatch(ProfileActions.clear())),
      catchError(() => {
        this.store.dispatch(ProfileActions.clear());
        return of(null);
      }),
    );
  }

  // ── Two-factor management ──────────────────────────────────────────────────

  mfaSetup() {
    return this.api.post<MfaSetup>(`${this.base}/mfa/setup`, {});
  }

  /** Other sessions are signed out; this one gets a fresh cookie. Recovery codes are returned once. */
  mfaEnable(code: string) {
    return this.api
      .post<{ user: AdminUser; recoveryCodes: string[] }>(`${this.base}/mfa/enable`, { code })
      .pipe(tap((res) => this.setUser(res.data.user)));
  }

  /** `code` may be an authenticator code or a recovery code. */
  mfaDisable(password: string, code: string) {
    return this.api
      .post<{ user: AdminUser }>(`${this.base}/mfa/disable`, { password, code })
      .pipe(tap((res) => this.setUser(res.data.user)));
  }

  regenerateRecoveryCodes(code: string) {
    return this.api.post<{ recoveryCodes: string[] }>(`${this.base}/mfa/recovery-codes`, { code });
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  /** `currentPassword` is required by the API only when the email changes. */
  updateProfile(body: ProfileUpdate) {
    return this.api
      .patch<{ user: AdminUser }>(`${this.base}/profile`, body)
      .pipe(tap((res) => this.setUser(res.data.user)));
  }

  /** Other sessions are signed out; this one gets a fresh cookie. */
  changePassword(body: PasswordChange) {
    return this.api
      .post<{ user: AdminUser }>(`${this.base}/password`, body)
      .pipe(tap((res) => this.setUser(res.data.user)));
  }

  private setUser(user: AdminUser | undefined) {
    if (user) this.store.dispatch(ProfileActions.loadSuccess({ user }));
  }
}
