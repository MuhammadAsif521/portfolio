import { Injectable } from '@angular/core';
import { toast, type ExternalToast } from 'ngx-sonner';
import { TOAST_OPTIONS } from '@shared/constants/const';
import { getError } from '@shared/utils/get-error.util';

type ToastId = string | number;

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  success(message: string, options?: ExternalToast): ToastId {
    return toast.success(message, {
      ...TOAST_OPTIONS,
      ...options,
    });
  }

  error(message: string, options?: ExternalToast): ToastId {
    return toast.error(getError(message), {
      ...TOAST_OPTIONS,
      ...options,
    });
  }

  info(message: string, options?: ExternalToast): ToastId {
    return toast.info(message, {
      ...TOAST_OPTIONS,
      ...options,
    });
  }

  warning(message: string, options?: ExternalToast): ToastId {
    return toast.warning(message, {
      ...TOAST_OPTIONS,
      ...options,
    });
  }

  default(message: string, options?: ExternalToast): ToastId {
    return toast(message, {
      ...TOAST_OPTIONS,
      ...options,
    });
  }

  loading(message: string, options?: ExternalToast): ToastId {
    return toast.loading(message, {
      ...TOAST_OPTIONS,
      duration: Number.POSITIVE_INFINITY,
      ...options,
    });
  }

  dismiss(id?: ToastId): void {
    toast.dismiss(id);
  }

  dismissAll(): void {
    toast.dismiss();
  }
}
 