import { Routes } from '@angular/router';
import { provideContentState } from './core/store/content.state';

/**
 * The routes that read projects, posts, testimonials or experience from the content store. The store
 * feature, its effects (and @ngrx/entity, demo content) are registered here, once, on this lazy parent
 * route instead of in app.config.ts, so none of it is in the initial bundle. See app.routes.ts.
 */
export const CONTENT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideContentState()],
    children: [
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
    ],
  },
];
