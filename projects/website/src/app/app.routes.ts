import { Routes } from '@angular/router';
import { withPageIcons } from './core/core-icons';

// Brief, Part 4: "/" is the single scrollable page; /projects/:slug, /blog and /blog/:slug are the
// only other content routes, plus the three legal pages.
export const routes: Routes = [
  // Free developer tools (hub + one page per tool), see pages/tools/tools.routes.ts.
  {
    path: 'tools',
    loadChildren: withPageIcons(() => import('./pages/tools/tools.routes').then((m) => m.TOOLS_ROUTES)),
  },
  {
    path: 'faq',
    loadComponent: withPageIcons(() => import('./pages/faq/faq-page').then((m) => m.FaqPage)),
  },
  // Service landing pages (copy in shared services.data.ts).
  {
    path: 'services',
    pathMatch: 'full',
    loadComponent: withPageIcons(() => import('./pages/services/services-hub').then((m) => m.ServicesHubPage)),
  },
  {
    path: 'services/:slug',
    loadComponent: withPageIcons(() => import('./pages/services/service-page').then((m) => m.ServicePageComponent)),
  }, 
  // Legal pages: one lazy component, admin HTML from Site Settings or a built-in default. Server-rendered
  // like everything else (see app.routes.server.ts), so admin edits show without a redeploy.
  {
    path: 'privacy-policy',
    loadComponent: withPageIcons(() => import('./pages/legal/legal-page').then((m) => m.LegalPage)),
    data: { kind: 'privacy' },
  },
  {
    path: 'terms-and-conditions',
    loadComponent: withPageIcons(() => import('./pages/legal/legal-page').then((m) => m.LegalPage)),
    data: { kind: 'terms' },
  },
  {
    path: 'cookie-policy',
    loadComponent: withPageIcons(() => import('./pages/legal/legal-page').then((m) => m.LegalPage)),
    data: { kind: 'cookies' },
  }, 
  // /404 is what the address bar shows on every not-found page (core/not-found-url.ts); same page, same 404 status.
  {
    path: '404',
    loadComponent: withPageIcons(() => import('./pages/not-found/not-found').then((m) => m.NotFoundPage)),
  }, 
  // Home, project pages and the blog: the only routes that read the content store, whose state and effects
  // are registered by this lazy parent route (content.routes.ts) instead of at startup. Kept after the
  // other routes so unrelated URLs never load it.
  {
    path: '',
    loadChildren: withPageIcons(() => import('./content.routes').then((m) => m.CONTENT_ROUTES)),
  },
  // Everything else: a real 404 page (status 404, noindex), not a redirect to the home page.
  {
    path: '**',
    loadComponent: withPageIcons(() => import('./pages/not-found/not-found').then((m) => m.NotFoundPage)),
  },
];
