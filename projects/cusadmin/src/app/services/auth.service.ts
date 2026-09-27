import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, from, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '@shared/services/api.service';
import { RecaptchaService } from '@shared/services/recaptcha.service';
import { AdminUser } from '@cusadmin/core/models/admin.model';
import { ProfileActions } from '@cusadmin/store/profile/profile.actions';

/** Must match the action portfolio-node expects for the login check. */
export const LOGIN_RECAPTCHA_ACTION = 'admin_login';

/**
 * Admin session against portfolio-node (/api/v1/auth). The JWT lives in the httpOnly pf_session cookie
 * (sent via withCredentials by the auth interceptor); nothing is stored in JS.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly base = '/auth';

  /** reCAPTCHA v3, then POST /auth/login. On success the profile store holds the user. */
  login(payload: { email: string; password: string }) {
    return from(this.recaptcha.execute(LOGIN_RECAPTCHA_ACTION)).pipe(
      switchMap((token) =>
        this.api.post<{ user: AdminUser; expiresIn: number }>(`${this.base}/login`, payload, {
          recaptchaToken: token,
          recaptchaAction: token ? LOGIN_RECAPTCHA_ACTION : null,
        }),
      ),
      tap((res) => {
        if (res.data?.user) this.store.dispatch(ProfileActions.loadSuccess({ user: res.data.user }));
      }),
    );
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
}
