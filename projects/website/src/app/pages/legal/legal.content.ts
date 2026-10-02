import type { SiteSettings } from '@shared/interfaces/auth.interface';
import { LEGAL_LINKS, type LegalKind } from './legal-links';

export { LEGAL_ORDER, type LegalKind } from './legal-links';

export interface LegalPageDef {
  kind: LegalKind;
  path: string;
  title: string;
  /** Short line under the title. */
  lead: string;
  metaDescription: string;
  /**
   * Site Settings field holding the policy HTML (cusadmin → Site Settings → Legal). It is the only source
   * of the policy text: portfolio-node seeds a starter document into an empty field once, after which it
   * is entirely the admin's.
   */
  settingsKey: keyof Pick<SiteSettings, 'privacyPolicy' | 'termsAndConditions' | 'cookiePolicy'>;
}

export const LEGAL_PAGES: Record<LegalKind, LegalPageDef> = {
  privacy: {
    kind: 'privacy',
    ...LEGAL_LINKS.privacy,
    lead: 'How personal data is collected, used and protected on this site, and the choices you have.',
    metaDescription:
      'How this portfolio website collects, uses and protects personal data, and the rights you have over it.',
    settingsKey: 'privacyPolicy',
  },
  terms: {
    kind: 'terms',
    ...LEGAL_LINKS.terms,
    lead: 'The rules for using this website and its content.',
    metaDescription:
      'The terms and conditions for using this portfolio website and its content.',
    settingsKey: 'termsAndConditions',
  },
  cookies: {
    kind: 'cookies',
    ...LEGAL_LINKS.cookies,
    lead: 'The cookies and browser storage this site uses and how to control them.',
    metaDescription:
      'The cookies and browser storage this portfolio website uses, what they are for and how to manage them.',
    settingsKey: 'cookiePolicy',
  },
};

export const LEGAL_UI = {
  updatedLabel: 'Last updated',
  tocTitle: 'On this page',
  related: 'Related policies',
  contactTitle: 'Questions about this policy?',
  contactText: 'Email me and I will get back to you, usually within a few days.',
  breadcrumbHome: 'Home',
  /** Shown (with robots noindex) while the Site Settings field is empty. */
  emptyTitle: 'Not published yet',
  emptyText: "This policy hasn't been published yet.",
} as const;
