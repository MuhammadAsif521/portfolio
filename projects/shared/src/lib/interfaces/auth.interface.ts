import { HttpContextToken } from '@angular/common/http';
import type { AssetImage, Timestamped } from './entities.interface';

export const WITH_CREDENTIALS = new HttpContextToken(() => false);
export const RECAPTCHA_ACTION = new HttpContextToken<string>(() => '');

// ── Envelope (portfolio-node, docs/specs/04-api.md) ──────────────────────────

export interface ApiResponse<T> {
  status: boolean;
  statusCode: string;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  page: number;
  pages: number;
}

export interface ApiFieldErrorItem {
  field: string;
  message: string;
}

/** Body of every error response. `code` is machine-readable (see docs/specs/03-errors.md). */
export interface ApiErrorBody {
  status: false;
  statusCode: string;
  code: string;
  message: string;
  errors?: ApiFieldErrorItem[];
  requestId?: string;
}

// ── Site settings ────────────────────────────────────────────────────────────

/** Site-wide default appearance; 'system' follows the visitor's OS. */
export type SiteMode = 'light' | 'dark' | 'system';

export interface SocialLink {
  label: string;
  value: string;
}

/** The active brand palette embedded in the settings response. */
export interface ThemePalette {
  _id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface ResumeFile {
  key: string;
  url: string;
  generatedAt: string;
}

/**
 * GET /public/settings only: the public slice of the resume profile and the current job, used for the
 * Person JSON-LD (sameAs, knowsAbout, worksFor, alumniOf). Dates are ISO strings.
 */
export interface PublicProfile {
  fullName?: string;
  headline?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  skills: string[];
  skillGroups: { category: string; items: string[] }[];
  education: { institution: string; degree?: string; field?: string; inProgress: boolean }[];
  languages: string[];
  currentPosition?: { company: string; role: string; location?: string; since: string };
  careerStart?: string;
}

/** GET /public/settings (and /admin/settings): the singleton plus the active theme. */
export interface SiteSettings extends Timestamped {
  siteName: string;
  siteSlogan?: string;
  description?: string;
  siteLogo?: AssetImage;
  /** Square browser-tab icon (WebP, like every upload). */
  favicon?: AssetImage;
  ogImage?: AssetImage;
  resume?: ResumeFile;
  contactEmail?: string;
  phoneNumber?: string;
  socialLinks: SocialLink[];
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  privacyPolicy?: string;
  termsAndConditions?: string;
  cookiePolicy?: string;
  siteMode: SiteMode;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  googleSiteVerification?: string;

  domain?: string;
  activeThemeId: string;
  activeTheme: ThemePalette | null;
  /** Public endpoint only (absent on /admin/settings). */
  profile?: PublicProfile;
}

// ── Admin auth (cusadmin) ────────────────────────────────────────────────────

export type AdminRole = 'admin';

export interface AdminUser extends Timestamped {
  email: string;
  name?: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  user: AdminUser;
  /** Seconds until the httpOnly session cookie expires. */
  expiresIn: number;
}
