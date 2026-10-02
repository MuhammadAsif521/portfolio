import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';
import { ProfileActions } from '@cusadmin/store/profile/profile.actions';

/** Session codes after which the cookie is gone (portfolio-node clears it): sign in again. */
const SESSION_ENDED = new Set(['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'TOKEN_INVALID']);
// /auth/mfa/verify runs before there is a session: its TOKEN_* errors mean the sign-in step expired.
const AUTH_PATHS = ['/auth/login', '/auth/mfa/verify', '/auth/me', '/auth/logout'];

/**
 * Sends the httpOnly session cookie on every call. portfolio-node has no refresh token, so when an admin
 * request answers 401 with a session code the profile is cleared and the app returns to /login, keeping
 * the page as ?returnUrl=. Other errors (422, 409, 5xx…) pass through to the page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const store = inject(Store);
  const isAuthCall = AUTH_PATHS.some((path) => req.url.includes(path));

  return next(req.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      if (
        !isAuthCall &&
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        SESSION_ENDED.has(error.error?.code)
      ) {
        store.dispatch(ProfileActions.clear());
        const returnUrl = router.url.startsWith('/login') || router.url === '/' ? null : router.url;
        void router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
      }
      return throwError(() => error);
    }),
  );
};
