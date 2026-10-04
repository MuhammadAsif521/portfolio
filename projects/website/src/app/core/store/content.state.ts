import { isPlatformServer } from '@angular/common';
import {
  InjectionToken,
  PLATFORM_ID,
  TransferState,
  inject,
  makeEnvironmentProviders,
  makeStateKey,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { Store, provideState, type StoreConfig } from '@ngrx/store';
import { take } from 'rxjs';
import { contentEffects } from './content.effects';
import { contentFeature, initialContentState, transferableContent, type ContentState } from './content.feature';

/*
 * Hydration: the server serialises the content feature into the page (TransferState) and the browser
 * starts its store from it, so a server-rendered page makes no content requests at all after hydration
 * (the effects see fresh, loaded slots and skip). This replaces Angular's HTTP transfer cache for content
 * endpoints (app.config.ts filters them out of it), which would otherwise ship every response twice:
 *  - the cache is keyed by exact URL+params and is answered only until the app is first stable, whereas
 *    the store keeps answering for the TTL on every later navigation;
 *  - the store also carries status/404/loadedAt, so the browser knows what is fresh and what failed.
 * Site Settings still use the HTTP transfer cache (site-initializer.ts), which the public-session
 * interceptor's HydrationCacheProbe relies on.
 */
export const CONTENT_STATE_KEY = makeStateKey<ContentState>('ngrx:content');

/** Feature config whose initial state is the server's state, when the page shipped one. */
export const CONTENT_STORE_CONFIG = new InjectionToken<StoreConfig<ContentState>>('CONTENT_STORE_CONFIG', {
  providedIn: 'root',
  factory: () => {
    if (isPlatformServer(inject(PLATFORM_ID))) return { initialState: initialContentState };
    const transferred = inject(TransferState).get(CONTENT_STATE_KEY, null);
    return { initialState: transferred ?? initialContentState };
  },
});

/** Content feature + effects; on the server, also writes the final state into the page. */
export function provideContentState(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(contentFeature.name, contentFeature.reducer, CONTENT_STORE_CONFIG),
    provideEffects(contentEffects),
    provideEnvironmentInitializer(() => {
      if (!isPlatformServer(inject(PLATFORM_ID))) return;
      const store = inject(Store);
      // Called when the page is serialised, i.e. after SSR waited for every load (pendingUntilEvent).
      inject(TransferState).onSerialize(CONTENT_STATE_KEY, () => {
        let snapshot = initialContentState;
        store
          .select(contentFeature.selectContentState)
          .pipe(take(1))
          .subscribe((state) => (snapshot = transferableContent(state)));
        return snapshot;
      });
    }),
  ]);
}
