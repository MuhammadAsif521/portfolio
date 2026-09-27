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
        return 'bg-success/15 text-success';

      case 'info':
        return 'bg-info/15 text-info';

      case 'warning':
      default:
        return 'bg-warning/15 text-warning';
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
