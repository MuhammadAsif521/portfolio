import { Routes } from '@angular/router';

// Brief, Part 4: "/" is the single scrollable page; /projects/:slug, /blog and /blog/:slug are the
// only other routes.
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
  { path: '**', redirectTo: '' },
];
