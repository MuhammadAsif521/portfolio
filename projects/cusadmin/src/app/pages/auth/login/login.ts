import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { AuthService } from '@cusadmin/services/auth.service';

/** Only same-app paths are accepted as ?returnUrl= (no open redirect to other sites). */
function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, AuthLayoutComponent, DynamicReactiveFormComponent, LoadingButtonComponent],
  templateUrl: './login.html',
})
export class AdminLoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isSubmitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  readonly fields: FormFieldConfig[] = [
    { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true, colClass: 'col-span-12' },
    { name: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password', required: true, colClass: 'col-span-12' },
  ];

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
        next: (res) => {
          this.toast.success(res.message || 'Welcome back');
          void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
        },
        error: (err: unknown) => this.toast.error(getError(err, 'Invalid email or password.')),
      });
  }
}
