import type { ExternalToast, Position, ToasterProps } from 'ngx-sonner';

export const TOAST_DURATION = 2500;

export const TOAST_POSITION: Position = 'bottom-right';

export const TOAST_OPTIONS: ExternalToast = {
    duration: TOAST_DURATION,
    position: TOAST_POSITION,
    closeButton: true,
};

export const TOASTER_OPTIONS = {
    duration: TOAST_DURATION,
    position: TOAST_POSITION,
    closeButton: true,
    richColors: true,
} satisfies Pick<
    ToasterProps,
    'duration' | 'position' | 'closeButton' | 'richColors'
>;