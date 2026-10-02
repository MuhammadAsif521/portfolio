import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { finalize } from 'rxjs';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { AuthService, MfaSetup } from '@cusadmin/services/auth.service';
import { selectProfileUser } from '@cusadmin/store/profile/profile.feature';

/** Authenticator code, or (where the API allows it) a recovery code like abcd-2345. */
const CODE_PATTERN = /^(\d{6}|[A-Za-z0-9]{4}-?[A-Za-z0-9]{4})$/;
const TOTP_PATTERN = /^\d{6}$/;

type MfaView = 'idle' | 'setup' | 'codes';

/** The signed-in admin's own account: details, password and two-factor authentication. */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, DynamicReactiveFormComponent, LoadingButtonComponent, IconComponent],
  templateUrl: './profile.page.html',
  styles: `
    .code-input {
      background: var(--form-control-bg);
      border-color: var(--form-control-border);
      color: var(--form-control-text);
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }
    .code-input:focus {
      background: var(--form-control-bg-active);
      border-color: var(--form-control-border-active);
      box-shadow: var(--form-focus-shadow);
      outline: none;
    }
  `,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly user = this.store.selectSignal(selectProfileUser);
  readonly mfaEnabled = computed(() => !!this.user()?.mfaEnabled);

  // ── Account details ────────────────────────────────────────────────────────

  readonly accountFields: FormFieldConfig[] = [
    { name: 'name', label: 'Name', type: 'text', maxLength: 100, placeholder: 'Your name', colClass: 'col-span-12 md:col-span-6' },
    { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 254, colClass: 'col-span-12 md:col-span-6' },
  ];
  readonly accountPasswordField: FormFieldConfig = {
    name: 'currentPassword',
    label: 'Current password (required to change your email)',
    type: 'password',
    maxLength: 128,
    colClass: 'col-span-12 md:col-span-6',
  };
  readonly accountForm: FormGroup = buildFormGroup([...this.accountFields, this.accountPasswordField], {
    name: this.user()?.name ?? '',
    email: this.user()?.email ?? '',
  });
  readonly emailChanged = signal(false);
  readonly savingAccount = signal(false);

  // ── Password ───────────────────────────────────────────────────────────────

  readonly passwordFields: FormFieldConfig[] = [
    { name: 'currentPassword', label: 'Current password', type: 'password', required: true, maxLength: 128, colClass: 'col-span-12' },
    { name: 'newPassword', label: 'New password', type: 'password', required: true, minLength: 12, maxLength: 128, placeholder: 'At least 12 characters', colClass: 'col-span-12 md:col-span-6' },
    { name: 'confirmPassword', label: 'Confirm new password', type: 'password', required: true, maxLength: 128, colClass: 'col-span-12 md:col-span-6' },
  ];
  readonly passwordForm: FormGroup = buildFormGroup(this.passwordFields);
  readonly savingPassword = signal(false);

  // ── Two-factor authentication ──────────────────────────────────────────────

  readonly mfaView = signal<MfaView>('idle');
  /** Pending setup (QR + secret). Memory only; cleared once enabled or cancelled. */
  readonly setup = signal<MfaSetup | null>(null);
  /** Plain recovery codes, shown once after enable / regenerate. */
  readonly recoveryCodes = signal<string[]>([]);
  readonly savedConfirmed = new FormControl(false, { nonNullable: true });
  readonly mfaBusy = signal<'setup' | 'enable' | 'regenerate' | 'disable' | null>(null);
  readonly showDisable = signal(false);
  readonly showRegenerate = signal(false);

  readonly enableCode = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(TOTP_PATTERN)] });
  readonly regenerateCode = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(CODE_PATTERN)] });
  readonly disableFields: FormFieldConfig[] = [
    { name: 'password', label: 'Password', type: 'password', required: true, maxLength: 128, colClass: 'col-span-12 md:col-span-6' },
    { name: 'code', label: 'Authenticator or recovery code', type: 'text', required: true, maxLength: 9, pattern: CODE_PATTERN.source, placeholder: '123456 or abcd-2345', colClass: 'col-span-12 md:col-span-6' },
  ];
  readonly disableForm: FormGroup = buildFormGroup(this.disableFields);

  constructor() {
    this.accountForm
      .get('email')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: string) => this.emailChanged.set(this.normaliseEmail(value) !== (this.user()?.email ?? '')));
  }

  // ── Account details ────────────────────────────────────────────────────────

  saveAccount(): void {
    const form = this.accountForm;
    const currentPassword = form.get('currentPassword')!;
    currentPassword.updateValueAndValidity(); // drop a "required" set by an earlier attempt
    if (this.emailChanged() && !currentPassword.value) {
      currentPassword.setErrors({ required: true });
    }
    if (form.invalid) {
      form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields');
      return;
    }

    const user = this.user();
    const name = String(form.get('name')!.value ?? '').trim();
    const email = this.normaliseEmail(form.get('email')!.value);
    const body: { name?: string | null; email?: string; currentPassword?: string } = {};
    if (name !== (user?.name ?? '')) body.name = name || null;
    if (email !== user?.email) {
      body.email = email;
      body.currentPassword = currentPassword.value;
    }
    if (!Object.keys(body).length) {
      this.toast.info('Nothing to update');
      return;
    }

    this.savingAccount.set(true);
    this.auth
      .updateProfile(body)
      .pipe(finalize(() => this.savingAccount.set(false)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Profile updated');
          form.reset({ name: res.data.user.name ?? '', email: res.data.user.email, currentPassword: '' });
          this.emailChanged.set(false);
        },
        error: (e: unknown) => this.toast.error(getError(e, 'Profile update failed')),
      });
  }

  // ── Password ───────────────────────────────────────────────────────────────

  changePassword(): void {
    const form = this.passwordForm;
    const { currentPassword, newPassword, confirmPassword } = form.getRawValue() as Record<string, string>;
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      form.get('confirmPassword')!.setErrors({ mismatch: true });
    }
    if (form.invalid) {
      form.markAllAsTouched();
      this.toast.error(
        form.get('confirmPassword')!.hasError('mismatch') ? 'Passwords do not match' : 'Please fix the highlighted fields',
      );
      return;
    }
    if (newPassword === currentPassword) {
      this.toast.error('New password must differ from the current one');
      return;
    }

    this.savingPassword.set(true);
    this.auth
      .changePassword({ currentPassword, newPassword, confirmPassword })
      .pipe(finalize(() => this.savingPassword.set(false)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Password changed');
          this.toast.info('Other devices have been signed out.');
          form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        },
        error: (e: unknown) => this.toast.error(getError(e, 'Password change failed')),
      });
  }

  // ── Two-factor authentication ──────────────────────────────────────────────

  startSetup(): void {
    this.mfaBusy.set('setup');
    this.auth
      .mfaSetup()
      .pipe(finalize(() => this.mfaBusy.set(null)))
      .subscribe({
        next: (res) => {
          this.setup.set(res.data);
          this.enableCode.reset('');
          this.mfaView.set('setup');
        },
        error: (e: unknown) => this.toast.error(getError(e, 'Could not start two-factor setup')),
      });
  }

  cancelSetup(): void {
    this.setup.set(null);
    this.enableCode.reset('');
    this.mfaView.set('idle');
  }

  /** Digits only, max 6. */
  onEnableCodeInput(): void {
    const digits = this.enableCode.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== this.enableCode.value) this.enableCode.setValue(digits);
  }

  enable(): void {
    if (this.enableCode.invalid) {
      this.enableCode.markAsTouched();
      return;
    }
    this.mfaBusy.set('enable');
    this.auth
      .mfaEnable(this.enableCode.value)
      .pipe(finalize(() => this.mfaBusy.set(null)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Two-factor authentication enabled');
          this.setup.set(null);
          this.enableCode.reset('');
          this.showRecoveryCodes(res.data.recoveryCodes);
        },
        error: (e: unknown) => {
          this.enableCode.setValue('');
          this.toast.error(getError(e, 'That code did not match. Try the current code.'));
        },
      });
  }

  regenerate(): void {
    if (this.regenerateCode.invalid) {
      this.regenerateCode.markAsTouched();
      return;
    }
    this.mfaBusy.set('regenerate');
    this.auth
      .regenerateRecoveryCodes(this.regenerateCode.value.trim())
      .pipe(finalize(() => this.mfaBusy.set(null)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'New recovery codes generated');
          this.regenerateCode.reset('');
          this.showRegenerate.set(false);
          this.showRecoveryCodes(res.data.recoveryCodes);
        },
        error: (e: unknown) => {
          this.regenerateCode.setValue('');
          this.toast.error(getError(e, 'Could not generate new recovery codes'));
        },
      });
  }

  disable(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }
    const { password, code } = this.disableForm.getRawValue() as { password: string; code: string };
    this.mfaBusy.set('disable');
    this.auth
      .mfaDisable(password, code.trim())
      .pipe(finalize(() => this.mfaBusy.set(null)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Two-factor authentication disabled');
          this.disableForm.reset({ password: '', code: '' });
          this.showDisable.set(false);
          this.recoveryCodes.set([]);
          this.mfaView.set('idle');
        },
        error: (e: unknown) => this.toast.error(getError(e, 'Could not disable two-factor authentication')),
      });
  }

  /** "I've saved these": the codes are dropped from memory and can't be shown again. */
  confirmCodesSaved(): void {
    if (!this.savedConfirmed.value) return;
    this.recoveryCodes.set([]);
    this.savedConfirmed.reset(false);
    this.mfaView.set('idle');
  }

  async copyCodes(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.recoveryCodesText());
      this.toast.success('Recovery codes copied');
    } catch {
      this.toast.error('Copy failed. Select the codes and copy them manually.');
    }
  }

  downloadCodes(): void {
    if (!this.isBrowser) return;
    const blob = new Blob([this.recoveryCodesText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'portfolio-admin-recovery-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private showRecoveryCodes(codes: string[]): void {
    this.recoveryCodes.set(codes);
    this.savedConfirmed.reset(false);
    this.mfaView.set('codes');
  }

  private recoveryCodesText(): string {
    const account = this.user()?.email ?? 'admin';
    return [
      'Asif Portfolio Admin - two-factor recovery codes',
      `Account: ${account}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'Each code can be used once to sign in without your authenticator app.',
      '',
      ...this.recoveryCodes(),
      '',
    ].join('\n');
  }

  private normaliseEmail(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
