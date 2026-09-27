import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { Store, provideStore } from '@ngrx/store';
import { RecaptchaService } from '@shared/services/recaptcha.service';
import { firstValueFrom } from 'rxjs';
import { authChildGuard, guestGuard } from './core/guards/auth.guard';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AdminLoginPage } from './pages/auth/login/login';
import { ProfileActions } from './store/profile/profile.actions';
import { profileEffects } from './store/profile/profile.effects';
import { profileFeature, selectProfileUser } from './store/profile/profile.feature';
import { HttpClient } from '@angular/common/http';
import { FullLayoutComponent } from './layouts/full-layout/full-layout';

@Component({ template: '<p>page</p>' })
class Blank {}

const tick = () => new Promise((r) => setTimeout(r));
const API = 'http://localhost:3000/api/v1';
const user = { _id: 'u1', email: 'asif@example.com', name: 'Muhammad Asif', role: 'admin' as const, isActive: true };

function setup() {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'login', component: AdminLoginPage, canActivate: [guestGuard] },
        { path: '', canActivateChild: [authChildGuard], children: [{ path: '', component: Blank }, { path: 'projects', component: Blank }] },
      ]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideStore({ [profileFeature.name]: profileFeature.reducer }),
      provideEffects(profileEffects),
      // No Google script in tests; portfolio-node skips the check when reCAPTCHA is disabled.
      { provide: RecaptchaService, useValue: { execute: () => Promise.resolve(null) } },
    ],
  });
  return { http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router), store: TestBed.inject(Store) };
}

describe('auth guard', () => {
  it('sends signed-out visitors to /login with the page as returnUrl', async () => {
    const { http, router } = setup();
    const nav = router.navigateByUrl('/projects');
    await tick();
    http.expectOne(`${API}/auth/me`).flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });
    await nav;
    expect(router.url).toBe('/login?returnUrl=%2Fprojects');
  });

  it('lets a signed-in admin through and keeps them away from /login', async () => {
    const { http, router } = setup();
    const nav = router.navigateByUrl('/projects');
    await tick();
    http.expectOne(`${API}/auth/me`).flush({ status: true, data: { user } });
    await nav;
    expect(router.url).toBe('/projects');
    await router.navigateByUrl('/login');
    expect(router.url).toBe('/');
  });
});

describe('auth interceptor', () => {
  it('sends the session cookie and returns to /login when the session has ended', async () => {
    const { http, router, store } = setup();
    store.dispatch(ProfileActions.loadSuccess({ user }));
    await router.navigateByUrl('/projects');

    const request = firstValueFrom(TestBed.inject(HttpClient).get(`${API}/admin/projects`)).catch((e: unknown) => e);
    const req = http.expectOne(`${API}/admin/projects`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ status: false, code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    expect(await request).toBeInstanceOf(HttpErrorResponse);
    await TestBed.inject(Router).navigated;
    await tick();
    expect(store.selectSignal(selectProfileUser)()).toBeNull();
    expect(router.url).toBe('/login?returnUrl=%2Fprojects');
  });

  it('leaves other errors (e.g. 422) to the page', async () => {
    const { http, router, store } = setup();
    store.dispatch(ProfileActions.loadSuccess({ user }));
    await router.navigateByUrl('/projects');
    const request = firstValueFrom(TestBed.inject(HttpClient).post(`${API}/admin/projects`, {})).catch((e: unknown) => e);
    http.expectOne(`${API}/admin/projects`).flush({ code: 'VALIDATION_ERROR' }, { status: 422, statusText: 'Unprocessable' });
    await request;
    expect(store.selectSignal(selectProfileUser)()).toEqual(user);
    expect(router.url).toBe('/projects');
  });
});

describe('login page', () => {
  async function renderLogin(returnUrl?: string) {
    const ctx = setup();
    const nav = ctx.router.navigateByUrl(returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login');
    await tick();
    ctx.http.expectOne(`${API}/auth/me`).flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });
    await nav;
    const fixture = TestBed.createComponent(AdminLoginPage);
    await fixture.whenStable();
    return { ...ctx, fixture, page: fixture.componentInstance };
  }

  it('does not call the API while the form is invalid', async () => {
    const { http, page } = await renderLogin();
    page.submit();
    http.expectNone(`${API}/auth/login`);
    expect(page.form.touched).toBe(true);
  });

  it('logs in, stores the user and follows a same-app returnUrl', async () => {
    const { http, page, router, store } = await renderLogin('/projects');
    page.form.setValue({ email: 'asif@example.com', password: 'correct horse battery' });
    page.submit();
    await tick();
    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.body).toEqual({ email: 'asif@example.com', password: 'correct horse battery' });
    req.flush({ status: true, message: 'Signed in', data: { user, expiresIn: 43200 } });
    await tick();
    expect(store.selectSignal(selectProfileUser)()).toEqual(user);
    expect(router.url).toBe('/projects');
  });

  it('ignores an off-site returnUrl (no open redirect)', async () => {
    const { http, page, router } = await renderLogin('//evil.example');
    page.form.setValue({ email: 'asif@example.com', password: 'correct horse battery' });
    page.submit();
    await tick();
    http.expectOne(`${API}/auth/login`).flush({ status: true, data: { user, expiresIn: 1 } });
    await tick();
    expect(router.url).toBe('/');
  });
});

describe('shell', () => {
  it('renders the grouped sidebar with the AP mark and the signed-in admin', async () => {
    const { store } = setup();
    store.dispatch(ProfileActions.loadSuccess({ user }));
    const fixture = TestBed.createComponent(FullLayoutComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-mark')?.textContent?.trim()).toBe('AP');
    expect(Array.from(el.querySelectorAll('.nav-caption')).map((n) => n.textContent?.trim())).toEqual([
      'Overview',
      'Content',
      'Inbox',
      'Administration',
    ]);
    expect(el.querySelectorAll('a.nav-link').length).toBe(9);
    expect(el.querySelector('.user-card strong')?.textContent?.trim()).toBe('Muhammad Asif');
  });
});
