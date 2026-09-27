export type ContactMessageSource = 'contact-form' | 'cta' | 'footer';
export type ContactMessageStatus = 'new' | 'read' | 'archived';

/** GET /api/v1/admin/contact(/:id) (portfolio-node ContactMessage). 'cta' / 'footer' entries may carry only an email. */
export interface ContactMessage {
  _id: string;
  name?: string;
  email: string;
  subject?: string;
  message?: string;
  source: ContactMessageSource;
  userAgent?: string;
  recaptchaScore?: number;
  status: ContactMessageStatus;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const CONTACT_SOURCE_LABELS: Record<ContactMessageSource, string> = {
  'contact-form': 'Contact form',
  cta: 'CTA',
  footer: 'Footer',
};
