import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';

import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog';

/** Thin, typed wrapper around `MatDialog.open(ConfirmDialogComponent, ...)`. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  open(
    data: ConfirmDialogData,
    config?: MatDialogConfig,
  ): MatDialogRef<ConfirmDialogComponent, boolean> {
    return this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      width: '440px',
      ...config,
      data,
    });
  }
}
