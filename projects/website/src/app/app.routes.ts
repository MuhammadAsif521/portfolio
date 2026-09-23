import { Routes } from '@angular/router';

// Brief, Part 4: "/" is the single scrollable page, /projects/:slug is a case study; the /blog routes
// are added with their section (build step 12).
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
  { path: '**', redirectTo: '' },
];
