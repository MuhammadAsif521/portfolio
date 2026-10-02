// Paths and titles only, so the footer can link the legal pages without pulling in the page component.

export type LegalKind = 'privacy' | 'terms' | 'cookies';

export const LEGAL_ORDER: readonly LegalKind[] = ['privacy', 'terms', 'cookies'];

export const LEGAL_LINKS: Record<LegalKind, { path: string; title: string }> = {
  privacy: { path: '/privacy-policy', title: 'Privacy Policy' },
  terms: { path: '/terms-and-conditions', title: 'Terms & Conditions' },
  cookies: { path: '/cookie-policy', title: 'Cookie Policy' },
};
