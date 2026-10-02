import type { SiteSettings } from '@shared/interfaces/auth.interface';
import { cookiePolicyDefault } from './defaults/cookie-policy.default';
import { privacyPolicyDefault } from './defaults/privacy-policy.default';
import { termsDefault } from './defaults/terms-and-conditions.default';
import { LEGAL_LINKS, type LegalKind } from './legal-links';

export { LEGAL_ORDER, type LegalKind } from './legal-links';

/** Values the built-in default templates fill in. Plain text: the templates escape them. */
export interface LegalContext {
  /** Site Settings name; on this personal portfolio it is the owner's name. */
  siteName: string;
  email: string;
  /** Owner's country (Site Settings), used for the governing-law clause. */
  country: string;
  /** Canonical origin, e.g. https://example.com (no trailing slash). */
  siteUrl: string;
}

export interface LegalPageDef {
  kind: LegalKind;
  path: string;
  title: string;
  /** Short line under the title. */
  lead: string;
  metaDescription: string;
  /** Site Settings field holding the admin-edited HTML (cusadmin → Site Settings → Legal). */
  settingsKey: keyof Pick<SiteSettings, 'privacyPolicy' | 'termsAndConditions' | 'cookiePolicy'>;
  /** Built-in fallback used while the admin field is empty. */
  defaultHtml: (ctx: LegalContext) => string;
}

/**
 * "Last updated" for the built-in defaults. Bump it whenever a file in ./defaults changes.
 * Admin-provided policies use Site Settings `updatedAt` instead.
 */
export const LEGAL_DEFAULTS_UPDATED = '2026-10-02';

/** Used when Site Settings has no contact email / country yet (same defaults as the footer). */
export const LEGAL_FALLBACKS = {
  email: 'm.asif340315@gmail.com',
  country: 'Pakistan',
} as const;

export const LEGAL_PAGES: Record<LegalKind, LegalPageDef> = {
  privacy: {
    kind: 'privacy',
    ...LEGAL_LINKS.privacy,
    lead: 'What personal data this site collects, why, how long it is kept and the choices you have.',
    metaDescription:
      'How this portfolio site handles personal data: the contact form, Google reCAPTCHA, retention, sharing and your privacy rights.',
    settingsKey: 'privacyPolicy',
    defaultHtml: privacyPolicyDefault,
  },
  terms: {
    kind: 'terms',
    ...LEGAL_LINKS.terms,
    lead: 'The rules for using this website and its content.',
    metaDescription:
      'Terms for using this portfolio website: permitted use, intellectual property, disclaimers, liability and governing law.',
    settingsKey: 'termsAndConditions',
    defaultHtml: termsDefault,
  },
  cookies: {
    kind: 'cookies',
    ...LEGAL_LINKS.cookies,
    lead: 'The cookies and browser storage this site uses, what each one is for and how to control them.',
    metaDescription:
      'The cookies and local storage this portfolio site uses, including Google reCAPTCHA, with their purpose, duration and how to manage them.',
    settingsKey: 'cookiePolicy',
    defaultHtml: cookiePolicyDefault,
  },
};

export const LEGAL_UI = {
  updatedLabel: 'Last updated',
  tocTitle: 'On this page',
  related: 'Related policies',
  contactTitle: 'Questions about this policy?',
  contactText: 'Email me and I will get back to you, usually within a few days.',
  breadcrumbHome: 'Home',
} as const;
