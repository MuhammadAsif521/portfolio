import { createFeature, createReducer, on } from '@ngrx/store';
import { AdminUser } from '@cusadmin/core/models/admin.model';
import { ProfileActions } from './profile.actions';

export interface ProfileState {
  user: AdminUser | null;
  loading: boolean;
  /** true once /auth/me has answered (either way), so guards can decide. */
  loaded: boolean;
}

const initialState: ProfileState = { user: null, loading: false, loaded: false };

export const profileFeature = createFeature({
  name: 'profile',
  reducer: createReducer(
    initialState,
    on(ProfileActions.load, (s): ProfileState => ({ ...s, loading: true })),
    on(ProfileActions.loadSuccess, (s, { user }): ProfileState => ({ ...s, loading: false, loaded: true, user })),
    on(ProfileActions.loadFailure, (s): ProfileState => ({ ...s, loading: false, loaded: true, user: null })),
    // loaded stays true: after logout or an expired session the guard goes straight to /login.
    on(ProfileActions.clear, (): ProfileState => ({ ...initialState, loaded: true })),
  ),
});

export const {
  name: profileFeatureKey,
  reducer: profileReducer,
  selectUser: selectProfileUser,
  selectLoading: selectProfileLoading,
  selectLoaded: selectProfileLoaded,
} = profileFeature;
