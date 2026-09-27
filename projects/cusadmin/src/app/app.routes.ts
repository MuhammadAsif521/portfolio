import { Routes } from '@angular/router';
import { authChildGuard, guestGuard } from '@cusadmin/core/guards/auth.guard';
import { FullLayoutComponent } from '@cusadmin/layouts/full-layout/full-layout';
import { AdminLoginPage } from '@cusadmin/pages/auth/login/login';
import { DashboardPage } from '@cusadmin/pages/dashboard/dashboard';

/**
 * Same layout as conb-sites-admin: auth pages outside the shell, everything else inside FullLayout behind
 * authChildGuard. Route `data.title` drives the topbar heading and the document title.
 */
export const routes: Routes = [
  { path: 'login', component: AdminLoginPage, canActivate: [guestGuard], title: 'Login | Portfolio Admin' },
  {
    path: '',
    component: FullLayoutComponent,
    canActivateChild: [authChildGuard],
    children: [
      { path: '', component: DashboardPage, data: { title: 'Dashboard' } },
      { path: '**', redirectTo: '' },
    ],
  },
];
