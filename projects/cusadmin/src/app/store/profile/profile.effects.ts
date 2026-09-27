import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { getError } from '@shared/utils/get-error.util';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '@cusadmin/services/auth.service';
import { ProfileActions } from './profile.actions';

/** GET /auth/me. A 401 simply means "not signed in" (loaded, user null). */
export const loadProfile$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService)) =>
    actions$.pipe(
      ofType(ProfileActions.load),
      switchMap(() =>
        auth.me().pipe(
          map((user) => ProfileActions.loadSuccess({ user })),
          catchError((e: unknown) => of(ProfileActions.loadFailure({ error: getError(e, 'Not signed in') }))),
        ),
      ),
    ),
  { functional: true },
);

export const profileEffects = { loadProfile$ };
