import { inject, Injectable } from '@angular/core';  
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
private _snackBar = inject (MatSnackBar);

  showSuccess(message: string) {
    this._snackBar.open(message, '', {
      horizontalPosition: 'end',
      verticalPosition: 'top',
      duration: 2000,
      panelClass: ['success-snackbar'],
    });
  }
  showError(message: string) {
    this._snackBar.open(message, '', {
      horizontalPosition: 'end',
      verticalPosition: 'top',
      duration: 2000,
      panelClass: ['error-snackbar'],
    });
  }

  success(message: string) { this.showSuccess(message); }
  error(message: string) { this.showError(message); }
}
