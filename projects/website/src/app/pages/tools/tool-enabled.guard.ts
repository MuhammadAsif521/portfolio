import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { siteFeature } from '../../core/store/site.feature';

/**
 * Matches only while the tool is switched on in cusadmin (Site Settings disabledTools). When it does not
 * match, the router falls through to the app's ** route: a real 404 with noindex. Site Settings are loaded
 * by the app initializer before the first navigation, on the server and in the browser.
 */
export function toolEnabled(slug: string): CanMatchFn {
  return () => !inject(Store).selectSignal(siteFeature.selectDisabledTools)().includes(slug);
}
