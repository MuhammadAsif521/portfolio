import { Routes } from '@angular/router';
import { authChildGuard, guestGuard } from '@cusadmin/core/guards/auth.guard';
import { FullLayoutComponent } from '@cusadmin/layouts/full-layout/full-layout';
import { AdminLoginPage } from '@cusadmin/pages/auth/login/login';
import { DashboardPage } from '@cusadmin/pages/dashboard/dashboard';

/**
 * Same layout as conb-sites-admin: auth pages outside the shell, everything else inside FullLayout behind
 * authChildGuard. Route `data.title` drives the topbar heading and the document title. Resource pages are
 * lazy-loaded so the first load stays small.
 */
export const routes: Routes = [
  { path: 'login', component: AdminLoginPage, canActivate: [guestGuard], title: 'Login | Portfolio Admin' },
  {
    path: '',
    component: FullLayoutComponent,
    canActivateChild: [authChildGuard],
    children: [
      { path: '', component: DashboardPage, data: { title: 'Dashboard' } },
      {
        path: 'projects',
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/resources/projects/projects-list.page').then((m) => m.ProjectsListPage),
            data: { title: 'Projects' },
          },
          {
            path: 'new',
            loadComponent: () => import('./pages/resources/projects/projects-form.page').then((m) => m.ProjectsFormPage),
            data: { title: 'Add Project' },
          },
          {
            path: ':id/edit',
            loadComponent: () => import('./pages/resources/projects/projects-form.page').then((m) => m.ProjectsFormPage),
            data: { title: 'Edit Project' },
          },
        ],
      },
      {
        path: 'blog',
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/resources/blog/blog-list.page').then((m) => m.BlogListPage),
            data: { title: 'Blog Posts' },
          },
          {
            path: 'new',
            loadComponent: () => import('./pages/resources/blog/blog-form.page').then((m) => m.BlogFormPage),
            data: { title: 'Add Post' },
          },
          {
            path: ':id/edit',
            loadComponent: () => import('./pages/resources/blog/blog-form.page').then((m) => m.BlogFormPage),
            data: { title: 'Edit Post' },
          },
        ],
      },
      {
        path: 'experience',
        loadComponent: () =>
          import('./pages/resources/experience/experience-list.page').then((m) => m.ExperienceListPage),
        data: { title: 'Experience' },
      },
      {
        path: 'testimonials',
        loadComponent: () =>
          import('./pages/resources/testimonials/testimonials-list.page').then((m) => m.TestimonialsListPage),
        data: { title: 'Testimonials' },
      },
      {
        path: 'messages',
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/resources/messages/messages-list.page').then((m) => m.MessagesListPage),
            data: { title: 'Messages' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./pages/resources/messages/message-detail.page').then((m) => m.MessageDetailPage),
            data: { title: 'Message' },
          },
        ],
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
