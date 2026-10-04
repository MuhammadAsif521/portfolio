import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, SSR_API_KEY } from '@shared/config/api.tokens';
import { HttpErrorResponse } from '@angular/common/http';
import { PUBLIC_SESSION_UNAVAILABLE, PublicSessionService } from '@shared/services/public-session.service';
import { publicSessionInterceptor } from './public-session.interceptor';

const API = 'https://api.test/api/v1';

function setup(platform: 'browser' | 'server', extra: object[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([publicSessionInterceptor])),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: API },
      { provide: PLATFORM_ID, useValue: platform },
      ...extra,
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
    session: TestBed.inject(PublicSessionService),
  };
}

/** Lets pending microtasks (the async getToken) run before inspecting the backend. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('publicSessionInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('leaves non-public requests untouched', async () => {
    const { http, backend } = setup('browser');
    const done = firstValueFrom(http.get(`${API}/admin/projects`));
    const req = backend.expectOne(`${API}/admin/projects`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: true });
    await done;
  });

  it('SSR: sends X-SSR-Key and never creates a session', async () => {
    const { http, backend } = setup('server', [{ provide: SSR_API_KEY, useValue: 'ssr-secret' }]);
    const done = firstValueFrom(http.get(`${API}/public/settings`));
    const req = backend.expectOne(`${API}/public/settings`);
    expect(req.request.headers.get('X-SSR-Key')).toBe('ssr-secret');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: true, data: {} });
    await done;
    backend.expectNone(`${API}/public/verify-session`);
  });

  it('browser: attaches the session token as a Bearer header', async () => {
    const { http, backend, session } = setup('browser');
    session.accept('token-1', 1200);
    const done = firstValueFrom(http.get(`${API}/public/projects`));
    await flushMicrotasks();
    const req = backend.expectOne(`${API}/public/projects`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
    req.flush({ status: true, data: [] });
    await done;
  });

  it('adopts a renewed token from X-Session-Token', async () => {
    const { http, backend, session } = setup('browser');
    session.accept('old-token', 1200);
    const done = firstValueFrom(http.get(`${API}/public/blog`));
    await flushMicrotasks();
    backend
      .expectOne(`${API}/public/blog`)
      .flush({ status: true, data: [] }, { headers: { 'X-Session-Token': 'renewed-token', 'X-Session-Expires-In': '1200' } });
    await done;
    expect(await session.getToken()).toBe('renewed-token');
  });

  it('reuses the cookie session without reCAPTCHA when the expiry hint is still valid', async () => {
    localStorage.setItem('public-session-expires-at', String(Date.now() + 10 * 60_000));
    const { http, backend } = setup('browser');
    const done = firstValueFrom(http.get(`${API}/public/settings`));
    await flushMicrotasks();

    const verify = backend.expectOne(`${API}/public/verify-session`);
    expect(verify.request.headers.has('x-recaptcha-token')).toBe(false); // no Google round-trip
    verify.flush({ status: true, data: { sessionToken: 'cookie-session', expiresIn: 600, reused: true } });
    await flushMicrotasks();

    const req = backend.expectOne(`${API}/public/settings`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer cookie-session');
    req.flush({ status: true, data: {} });
    await done;
    expect(document.querySelector('script[src*="recaptcha"]')).toBeNull();
  });

  it('on 401 PUBLIC_SESSION_EXPIRED re-establishes the session and retries once', async () => {
    const { http, backend, session } = setup('browser');
    session.accept('stale-token', 1200);
    const done = firstValueFrom(http.get(`${API}/public/experience`));
    await flushMicrotasks();

    // The retry runs synchronously inside the 401 handling, so stub the fresh session first
    // (the real path would run verify-session + reCAPTCHA).
    const invalidate = vi.spyOn(session, 'invalidate');
    vi.spyOn(session, 'getToken').mockResolvedValueOnce('fresh-token');
    backend
      .expectOne(`${API}/public/experience`)
      .flush({ status: false, code: 'PUBLIC_SESSION_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    expect(invalidate).toHaveBeenCalledTimes(1);
    await flushMicrotasks();
    const retry = backend.expectOne(`${API}/public/experience`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retry.flush({ status: true, data: [] });
    await done;
  });

  it('hydration: a GET the server shipped in the transfer cache needs no session (no reCAPTCHA)', async () => {
    const { http, backend } = setup('browser');
    // What the SSR transfer cache stores: { b: body, u: request URL, ... } under a hashed key.
    TestBed.inject(TransferState).set(makeStateKey<object>('cached-settings'), { b: { status: true }, u: `${API}/public/settings` });
    const done = firstValueFrom(http.get(`${API}/public/settings`));
    await flushMicrotasks();

    backend.expectNone(`${API}/public/verify-session`);
    const req = backend.expectOne(`${API}/public/settings`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: true, data: {} });
    await done;
    expect(document.querySelector('script[src*="recaptcha"]')).toBeNull();
  });

  it('hydration: a cache miss still falls back to the session flow on 401', async () => {
    const { http, backend, session } = setup('browser');
    TestBed.inject(TransferState).set(makeStateKey<object>('cached-blog'), { b: { status: true }, u: `${API}/public/blog` });
    vi.spyOn(session, 'getToken').mockResolvedValueOnce('fresh-token');
    const done = firstValueFrom(http.get(`${API}/public/blog`, { params: { limit: 3 } }));
    await flushMicrotasks();

    backend
      .expectOne((r) => r.url === `${API}/public/blog`)
      .flush({ status: false, code: 'PUBLIC_SESSION_REQUIRED' }, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    const retry = backend.expectOne((r) => r.url === `${API}/public/blog`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retry.flush({ status: true, data: [] });
    await done;
  });

  it('passes other errors through unchanged', async () => {
    const { http, backend, session } = setup('browser');
    session.accept('token', 1200);
    const done = firstValueFrom(http.get(`${API}/public/projects/missing`)).catch((err: { status: number }) => err.status);
    await flushMicrotasks();
    backend.expectOne(`${API}/public/projects/missing`).flush({ status: false, code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    expect(await done).toBe(404);
  });

  it('fails clearly, without sending the request, when no session can be established', async () => {
    const { http, backend, session } = setup('browser');
    vi.spyOn(session, 'getToken').mockResolvedValue(null);
    vi.spyOn(session, 'failure').mockReturnValue('recaptcha');
    const done = firstValueFrom(http.get(`${API}/public/projects/x`)).catch((err: unknown) => err);
    await flushMicrotasks();

    backend.expectNone(`${API}/public/projects/x`); // no request that could only answer 401
    const err = (await done) as HttpErrorResponse;
    expect(err).toBeInstanceOf(HttpErrorResponse);
    expect(err.status).toBe(0);
    expect(err.error.code).toBe(PUBLIC_SESSION_UNAVAILABLE);
    expect(err.error.message).toMatch(/reCAPTCHA/);
  });

  it('concurrent requests share one session establishment', async () => {
    localStorage.setItem('public-session-expires-at', String(Date.now() + 10 * 60_000));
    const { http, backend } = setup('browser');
    const a = firstValueFrom(http.get(`${API}/public/projects`));
    const b = firstValueFrom(http.get(`${API}/public/blog`));
    const c = firstValueFrom(http.get(`${API}/public/testimonials`));
    await flushMicrotasks();

    backend
      .expectOne(`${API}/public/verify-session`) // exactly one
      .flush({ status: true, data: { sessionToken: 'shared', expiresIn: 600, reused: true } });
    await flushMicrotasks();
    for (const path of ['projects', 'blog', 'testimonials']) {
      const req = backend.expectOne(`${API}/public/${path}`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer shared');
      req.flush({ status: true, data: [] });
    }
    await Promise.all([a, b, c]);
  });

  it('a late 401 for an already replaced token keeps the fresh session (no second establishment)', async () => {
    const { session } = setup('browser');
    session.accept('fresh', 1200);
    session.invalidate('stale');
    expect(session.currentToken()).toBe('fresh');
    session.invalidate('fresh');
    expect(session.currentToken()).toBeNull();
  });

  it('retries only once, and reports the session problem when re-establishing fails', async () => {
    const { http, backend, session } = setup('browser');
    session.accept('stale-token', 1200);
    const done = firstValueFrom(http.get(`${API}/public/blog`)).catch((err: unknown) => err);
    await flushMicrotasks();

    vi.spyOn(session, 'getToken').mockResolvedValueOnce(null);
    vi.spyOn(session, 'failure').mockReturnValue('network');
    backend
      .expectOne(`${API}/public/blog`)
      .flush({ status: false, code: 'PUBLIC_SESSION_INVALID' }, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();

    backend.expectNone(`${API}/public/blog`);
    const err = (await done) as HttpErrorResponse;
    expect(err.error.code).toBe(PUBLIC_SESSION_UNAVAILABLE);
    expect(err.error.message).toMatch(/connection/);
  });

  it('a second PUBLIC_SESSION_* 401 after the retry is passed through (single retry)', async () => {
    const { http, backend, session } = setup('browser');
    session.accept('stale-token', 1200);
    const done = firstValueFrom(http.get(`${API}/public/blog`)).catch((err: { status: number }) => err.status);
    await flushMicrotasks();

    vi.spyOn(session, 'getToken').mockResolvedValue('fresh-token');
    backend.expectOne(`${API}/public/blog`).flush({ status: false, code: 'PUBLIC_SESSION_INVALID' }, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    backend.expectOne(`${API}/public/blog`).flush({ status: false, code: 'PUBLIC_SESSION_INVALID' }, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    backend.expectNone(`${API}/public/blog`);
    expect(await done).toBe(401);
  });
});
