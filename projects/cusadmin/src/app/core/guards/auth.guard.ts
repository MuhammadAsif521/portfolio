import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, type RouterStateSnapshot } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';
import { ProfileActions } from '@cusadmin/store/profile/profile.actions';
import { selectProfileLoaded, selectProfileUser } from '@cusadmin/store/profile/profile.feature';

function ensureProfileLoaded(store: Store) {
  if (!store.selectSignal(selectProfileLoaded)()) store.dispatch(ProfileActions.load());
  return store.select(selectProfileLoaded).pipe(filter(Boolean), take(1));
}

function canAccessAdmin(state: RouterStateSnapshot) {
  const router = inject(Router);
  const store = inject(Store);
  return ensureProfileLoaded(store).pipe(
    map(() =>
      store.selectSignal(selectProfileUser)()
        ? true
        : router.createUrlTree(['/login'], { queryParams: state.url !== '/' ? { returnUrl: state.url } : {} }),
    ),
  );
}

/** Dashboard shell: signed-in admins only. */
export const authGuard: CanActivateFn = (_route, state) => canAccessAdmin(state);
export const authChildGuard: CanActivateChildFn = (_route, state) => canAccessAdmin(state);

/** Login page: already signed in, so go to the dashboard. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const store = inject(Store);
  return ensureProfileLoaded(store).pipe(
    map(() => (store.selectSignal(selectProfileUser)() ? router.createUrlTree(['/']) : true)),
  );
};
