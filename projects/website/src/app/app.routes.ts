import { Routes } from '@angular/router';

// Brief, Part 4: "/" is the single scrollable page; /projects/:slug, /blog and /blog/:slug are the
// only other content routes, plus the three legal pages.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  {
    path: 'projects/:slug',
    loadComponent: () => import('./pages/project-detail/project-detail').then((m) => m.ProjectDetailPage),
  },
  {
    path: 'blog',
    loadComponent: () => import('./pages/blog-list/blog-list').then((m) => m.BlogListPage),
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./pages/blog-post/blog-post').then((m) => m.BlogPostPage),
  },
<<<<<<< HEAD
=======
  // Free developer tools (hub + one page per tool), see pages/tools/tools.routes.ts.
  {
    path: 'tools',
    loadChildren: () => import('./pages/tools/tools.routes').then((m) => m.TOOLS_ROUTES),
  },
  {
    path: 'faq',
    loadComponent: () => import('./pages/faq/faq-page').then((m) => m.FaqPage),
  },
  // Service landing pages (copy in shared services.data.ts).
  {
    path: 'services',
    pathMatch: 'full',
    loadComponent: () => import('./pages/services/services-hub').then((m) => m.ServicesHubPage),
  },
  {
    path: 'services/:slug',
    loadComponent: () => import('./pages/services/service-page').then((m) => m.ServicePageComponent),
  },
>>>>>>> 34a523c (Save local portfolio work)
  // Legal pages: one lazy component, admin HTML from Site Settings or a built-in default. Server-rendered
  // like everything else (see app.routes.server.ts), so admin edits show without a redeploy.
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
    data: { kind: 'privacy' },
  },
  {
    path: 'terms-and-conditions',
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
    data: { kind: 'terms' },
  },
  {
    path: 'cookie-policy',
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
    data: { kind: 'cookies' },
  },
<<<<<<< HEAD
=======
  // /404 is what the address bar shows on every not-found page (core/not-found-url.ts); same page, same 404 status.
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
>>>>>>> 34a523c (Save local portfolio work)
  // Everything else: a real 404 page (status 404, noindex), not a redirect to the home page.
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
];
