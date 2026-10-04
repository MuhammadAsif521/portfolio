/**
 * Finishes the Vercel output (dist/website/browser, see vercel.json) after `ng build website` and
 * `ng build cusadmin --base-href /cusadmin/`:
 *
 * 1. Copies the admin app to /cusadmin.
 * 2. Removes the client-only shell index.csr.html from the static files. Vercel serves static files
 *    before rewrites, and it answered "/" with that empty shell instead of calling the SSR function, so the
 *    home page shipped no server-rendered content (title "Website", LCP image found only after the JS ran).
 *    The SSR function never needs it: Angular embeds its own copy in dist/website/server.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';

const browser = 'dist/website/browser';

cpSync('dist/cusadmin/browser', `${browser}/cusadmin`, { recursive: true });

for (const shell of ['index.csr.html', 'index.html']) {
  if (existsSync(`${browser}/${shell}`)) {
    rmSync(`${browser}/${shell}`);
    console.log(`[vercel-output] removed ${browser}/${shell} (pages are rendered by api/render.mjs)`);
  }
}
