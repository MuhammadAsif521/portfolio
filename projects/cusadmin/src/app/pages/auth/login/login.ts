import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayoutComponent } from '@shared/components/authlayout/auth-layout';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { AuthService, MfaFactor } from '@cusadmin/services/auth.service';

/** Only same-app paths are accepted as ?returnUrl= (no open redirect to other sites). */
function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** The mfaToken is no longer usable: start again from the password step. */
const STEP_ENDED = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID']);

const TOTP_PATTERN = /^\d{6}$/;
const RECOVERY_PATTERN = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, AuthLayoutComponent, DynamicReactiveFormComponent, LoadingButtonComponent],
  templateUrl: './login.html',
  styles: `
    .mfa-input {
      background: var(--form-control-bg);
      border-color: var(--form-control-border);
      color: var(--form-control-text);
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }
    .mfa-input:focus {
      background: var(--form-control-bg-active);
      border-color: var(--form-control-border-active);
      box-shadow: var(--form-focus-shadow);
    }
  `,
})
export class AdminLoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isSubmitting = signal(false);
  /** 'password' → email + password; 'mfa' → authenticator / recovery code. */
  readonly step = signal<'password' | 'mfa'>('password');
  readonly useRecoveryCode = signal(false);

  /** Second-step ticket from POST /auth/login. Component memory only — never stored. */
  private mfaToken: string | null = null;

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  readonly fields: FormFieldConfig[] = [
    { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true, colClass: 'col-span-12' },
    { name: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password', required: true, colClass: 'col-span-12' },
  ];

  readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(TOTP_PATTERN)],
  });
  readonly recoveryCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(RECOVERY_PATTERN)],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth
      .login({ email: email.trim(), password })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (result) => {
          if (result.mfaRequired) {
            this.startMfaStep(result.mfaToken);
            return;
          }
          this.finish(result.message);
        },
        error: (err: unknown) => this.toast.error(getError(err, 'Invalid email or password.')),
      });
  }

  /** Keeps digits only and submits as soon as six are entered (typed, pasted or autofilled). */
  onCodeInput(): void {
    const digits = this.code.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== this.code.value) this.code.setValue(digits);
    if (TOTP_PATTERN.test(digits) && !this.isSubmitting()) this.verify();
  }

  verify(): void {
    if (!this.mfaToken || this.isSubmitting()) return;
    const recovery = this.useRecoveryCode();
    const control = recovery ? this.recoveryCode : this.code;
    if (control.invalid) {
      control.markAsTouched();
      return;
    }

    const factor: MfaFactor = recovery ? { recoveryCode: control.value.trim() } : { code: control.value };
    this.isSubmitting.set(true);
    this.auth
      .verifyMfa(this.mfaToken, factor)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (res) => {
          this.mfaToken = null;
          this.finish(res.message);
        },
        error: (err: unknown) => {
          const code = err instanceof HttpErrorResponse ? (err.error?.code as string | undefined) : undefined;
          if (code && STEP_ENDED.has(code)) {
            this.toast.error('Your sign-in step expired. Please sign in again.');
            this.backToSignIn();
            return;
          }
          this.toast.error(getError(err, 'Invalid verification code.'));
          control.setValue('');
          this.focusCode();
        },
      });
  }

  toggleRecoveryCode(): void {
    this.useRecoveryCode.update((value) => !value);
    this.code.reset('');
    this.recoveryCode.reset('');
    this.focusCode();
  }

  backToSignIn(): void {
    this.mfaToken = null;
    this.code.reset('');
    this.recoveryCode.reset('');
    this.useRecoveryCode.set(false);
    this.form.controls.password.reset('');
    this.step.set('password');
  }

  private startMfaStep(mfaToken: string): void {
    this.mfaToken = mfaToken;
    this.useRecoveryCode.set(false);
    this.code.reset('');
    this.recoveryCode.reset('');
    this.step.set('mfa');
    this.focusCode();
  }

  private finish(message: string | undefined): void {
    this.toast.success(message || 'Welcome back');
    void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
  }

  private focusCode(): void {
    setTimeout(() => this.codeInput()?.nativeElement.focus());
  }
}
