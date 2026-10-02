import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideStore } from '@ngrx/store';
import { RecaptchaService } from '@shared/services/recaptcha.service';
import { ProfileActions } from '@cusadmin/store/profile/profile.actions';
import { profileFeature, selectProfileUser } from '@cusadmin/store/profile/profile.feature';
import { ProfilePage } from './profile.page';

const API = 'http://localhost:3000/api/v1';
const user = {
  _id: 'u1',
  email: 'asif@example.com',
  name: 'Muhammad Asif',
  role: 'admin' as const,
  isActive: true,
  mfaEnabled: false,
};
const tick = () => new Promise((r) => setTimeout(r));

async function render(initial = user) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideStore({ [profileFeature.name]: profileFeature.reducer }),
      { provide: RecaptchaService, useValue: { execute: () => Promise.resolve(null) } },
    ],
  });
  const store = TestBed.inject(Store);
  store.dispatch(ProfileActions.loadSuccess({ user: initial }));
  const fixture = TestBed.createComponent(ProfilePage);
  await fixture.whenStable();
  return { fixture, page: fixture.componentInstance, http: TestBed.inject(HttpTestingController), store };
}

describe('ProfilePage', () => {
  it('renders the three cards with the current details', async () => {
    const { fixture } = await render();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim())).toEqual([
      'Account details',
      'Change password',
      'Two-factor authentication',
    ]);
    expect(el.textContent).toContain('Off');
  });

  it('only sends the current password when the email changes', async () => {
    const { page, http, store } = await render();
    page.accountForm.patchValue({ name: 'Asif' });
    page.saveAccount();
    const nameOnly = http.expectOne(`${API}/auth/profile`);
    expect(nameOnly.request.body).toEqual({ name: 'Asif' });
    nameOnly.flush({ status: true, data: { user: { ...user, name: 'Asif' } } });
    expect(store.selectSignal(selectProfileUser)()?.name).toBe('Asif');

    page.accountForm.patchValue({ email: 'new@example.com' });
    expect(page.emailChanged()).toBe(true);
    page.saveAccount();
    http.expectNone(`${API}/auth/profile`); // current password missing

    page.accountForm.patchValue({ currentPassword: 'secret-password' });
    page.saveAccount();
    expect(http.expectOne(`${API}/auth/profile`).request.body).toEqual({
      email: 'new@example.com',
      currentPassword: 'secret-password',
    });
  });

  it('sets up, enables and shows the recovery codes once', async () => {
    const { page, http, fixture, store } = await render();
    page.startSetup();
    http.expectOne(`${API}/auth/mfa/setup`).flush({
      status: true,
      data: { otpauthUrl: 'otpauth://totp/x', qrDataUrl: 'data:image/png;base64,AAAA', secret: 'JBSWY3DPEHPK3PXP' },
    });
    fixture.detectChanges();
    expect(page.mfaView()).toBe('setup');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toContain('data:image/png');

    page.enableCode.setValue('123456');
    page.enable();
    const codes = Array.from({ length: 10 }, (_, i) => `abcd-${String(1000 + i)}`);
    const req = http.expectOne(`${API}/auth/mfa/enable`);
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ status: true, data: { user: { ...user, mfaEnabled: true }, recoveryCodes: codes } });
    await tick();
    fixture.detectChanges();

    expect(page.mfaView()).toBe('codes');
    expect(page.setup()).toBeNull();
    expect(store.selectSignal(selectProfileUser)()?.mfaEnabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[aria-label="Recovery codes"] li').length).toBe(10);

    page.confirmCodesSaved(); // not confirmed yet → stays
    expect(page.mfaView()).toBe('codes');
    page.savedConfirmed.setValue(true);
    page.confirmCodesSaved();
    expect(page.mfaView()).toBe('idle');
    expect(page.recoveryCodes()).toEqual([]);
  });

  it('disables with the password and a code', async () => {
    const { page, http, store } = await render({ ...user, mfaEnabled: true });
    page.showDisable.set(true);
    page.disableForm.setValue({ password: 'secret-password', code: 'abcd-2345' });
    page.disable();
    const req = http.expectOne(`${API}/auth/mfa/disable`);
    expect(req.request.body).toEqual({ password: 'secret-password', code: 'abcd-2345' });
    req.flush({ status: true, data: { user } });
    expect(store.selectSignal(selectProfileUser)()?.mfaEnabled).toBe(false);
  });
});
