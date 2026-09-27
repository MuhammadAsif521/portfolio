import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';

export interface ResourceFormDialogData {
  title: string;
  submitLabel?: string;
  fields: FormFieldConfig[];
  value?: Record<string, unknown>;
  /**
   * Performs the create/update call. The dialog stays open (submit button loading) until this
   * resolves, and closes only on success, so a failed save (e.g. a 422) never loses the input.
   */
  onSubmit: (value: Record<string, unknown>) => Observable<unknown>;
}

/** Create/edit dialog for simple resources (conb-sites-admin ResourceFormDialogComponent). */
@Component({
  selector: 'app-resource-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, DynamicReactiveFormComponent, LoadingButtonComponent, IconComponent],
  templateUrl: './resource-form-dialog.html',
})
export class ResourceFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ResourceFormDialogComponent>);
  private readonly toast = inject(ToastService);
  readonly data = inject<ResourceFormDialogData>(MAT_DIALOG_DATA);

  readonly fields = this.data.fields;
  readonly form = buildFormGroup(this.data.fields, this.data.value ?? {});
  readonly saving = signal(false);

  close(): void {
    if (this.saving()) return;
    this.dialogRef.close(null);
  }

  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.dialogRef.disableClose = true;
    this.data.onSubmit(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        this.toast.error(getError(e, 'Save failed'));
      },
    });
  }
}
