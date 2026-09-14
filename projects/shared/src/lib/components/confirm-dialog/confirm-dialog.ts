import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import {
  LoadingButtonComponent,
  ButtonColor,
} from '@shared/components/loading-button/loading-button';

import { IconComponent } from '@shared/components/icon-component/icon-component';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'warning' | 'error' | 'success' | 'info';

  /**
   * The action to run when the user confirms.
   *
   * The calling (parent) component owns the loading flag: return a Promise
   * that resolves once your operation finishes. The dialog shows a spinner
   * and stays open for as long as that Promise is pending, and only closes
   * itself once it resolves `true` (a successful outcome). Resolve `false`
   * (or throw) to keep the dialog open so the user can retry.
   *
   * Omit `onConfirm` for a plain confirmation with no async work — the
   * dialog then closes immediately on confirm.
   */
  onConfirm?: () => void | Promise<boolean>;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    IconComponent,
    LoadingButtonComponent,
  ],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialogComponent {
  private readonly dialogRef =
    inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  /** Set while the parent-supplied `onConfirm` Promise is pending. */
  readonly loading = signal(false);

  get iconName(): string {
    switch (this.data.tone) {
      case 'error':
        return 'trash-2';

      case 'success':
        return 'check-circle-2';

      case 'info':
        return 'info';

      case 'warning':
      default:
        return 'triangle-alert';
    }
  }

  get iconClasses(): string {
    switch (this.data.tone) {
      case 'error':
        return 'bg-error/15 text-error';

      case 'success':
        return 'bg-primary/15 text-primary';

      case 'info':
        return 'bg-info/15 text-info';

      case 'warning':
      default:
        return 'bg-yellow/15 text-yellow';
    }
  }

  get confirmColor(): ButtonColor {
    switch (this.data.tone) {
      case 'error':
        return 'error';

      case 'success':
        return 'primary';

      case 'info':
        return 'secondary';

      case 'warning':
      default:
        return 'primary';
    }
  }

  close(value: boolean): void {
    if (this.loading()) return;

    this.dialogRef.close(value);
  }

  async confirm(): Promise<void> {
    if (this.loading()) return;

    if (!this.data.onConfirm) {
      this.dialogRef.close(true);
      return;
    }

    this.loading.set(true);

    try {
      const result = await this.data.onConfirm();

      if (result !== false) {
        this.dialogRef.close(true);
      } else {
        this.loading.set(false);
      }
    } catch {
      this.loading.set(false);
    }
  }
}
