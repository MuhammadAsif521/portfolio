import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Rendered per request: projects, posts, settings and the theme are admin-managed and change
    // without a redeploy (prerendering at build time would freeze them and need the API during builds).
    path: '**',
    renderMode: RenderMode.Server,
  },
];
