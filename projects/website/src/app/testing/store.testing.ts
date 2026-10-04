import type { EnvironmentProviders } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideContentState } from '../core/store/content.state';
import { siteFeature } from '../core/store/site.feature';
import { uiFeature } from '../core/store/ui.feature';

/**
 * Specs only: a real store (site + ui reducers with the given state) plus the real content feature and
 * effects, so components are tested against the actual load-if-needed flow. Mock PublicApiService to
 * control what the effects receive.
 */
export function provideTestStore(initialState: { site?: unknown; ui?: unknown } = {}): EnvironmentProviders[] {
  return [
    provideStore(
      { site: siteFeature.reducer, ui: uiFeature.reducer },
      {
        initialState: {
          site: { settings: null, status: 'loaded', error: null },
          ui: { activeSection: 'home', menuOpen: false },
          ...initialState,
        } as never,
      },
    ),
    provideContentState(),
  ];
}
