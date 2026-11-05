import { Location, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';

/** The URL shown in the address bar while a "not found" page is displayed. */
export const NOT_FOUND_PATH = '/404';

/**
 * Returns a function that shows /404 in the address bar (call it in an injection context).
 *
 * Why not a redirect: the server must answer the requested URL itself with status 404 + noindex (that is
 * what Google reads; redirecting /typo to /404 would turn every typo into a redirect). After the page has
 * rendered in the browser, the visible URL is replaced with /404 using history.replaceState, so there is
 * no navigation, no extra request, and the Back button still works. The requested path is returned so the
 * page can show it.
 */
export function injectNotFoundUrl(): () => string {
  const location = inject(Location);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  return () => {
    const requested = location.path() || '/';
    if (isBrowser && requested !== NOT_FOUND_PATH) {
      // After the current render/hydration pass, so nothing reads the URL mid-update.
      setTimeout(() => {
        if (location.path() === requested) location.replaceState(NOT_FOUND_PATH);
      });
    }
    return requested;
  };
}
