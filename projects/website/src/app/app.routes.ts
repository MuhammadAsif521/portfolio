import { Routes } from '@angular/router';

// Brief, Part 4: "/" is the single scrollable page; /projects/:slug and /blog routes are added with
// their sections (build steps 9 and 12).
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
