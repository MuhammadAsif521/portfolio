import { createActionGroup, createFeature, createReducer, createSelector, emptyProps, on, props } from '@ngrx/store';
import { environment } from '@shared/environment/environment';
import type { SiteSettings } from '@shared/interfaces/auth.interface';

export const SiteActions = createActionGroup({
  source: 'Site',
  events: {
    'Load Settings': emptyProps(),
    'Load Settings Success': props<{ settings: SiteSettings }>(),
    'Load Settings Failure': props<{ error: string }>(),
  },
});

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface SiteState {
  settings: SiteSettings | null;
  status: LoadStatus;
  error: string | null;
}

const initialState: SiteState = { settings: null, status: 'idle', error: null };

/** Site Settings (name, logo, contact, resume, active theme), loaded once at bootstrap. */
export const siteFeature = createFeature({
  name: 'site',
  reducer: createReducer(
    initialState,
    on(SiteActions.loadSettings, (state): SiteState => ({ ...state, status: 'loading', error: null })),
    on(SiteActions.loadSettingsSuccess, (state, { settings }): SiteState => ({ ...state, settings, status: 'loaded' })),
    on(SiteActions.loadSettingsFailure, (state, { error }): SiteState => ({ ...state, status: 'error', error })),
  ),
  extraSelectors: ({ selectSettings }) => ({
    selectSiteName: createSelector(selectSettings, (settings) => settings?.siteName ?? environment.siteName.trim()),
    selectLogo: createSelector(selectSettings, (settings) => settings?.siteLogo ?? null),
    selectResumeUrl: createSelector(selectSettings, (settings) => settings?.resume?.url ?? null),
    selectDescription: createSelector(selectSettings, (settings) => settings?.description ?? null),
    selectContactEmail: createSelector(selectSettings, (settings) => settings?.contactEmail ?? null),
  }),
});
