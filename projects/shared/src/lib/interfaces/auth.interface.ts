import { HttpContextToken } from "@angular/common/http";

export const WITH_CREDENTIALS = new HttpContextToken(() => false);
export const RECAPTCHA_ACTION = new HttpContextToken<string>(() => '');

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
  pages?: number;
}

export interface SocialLink {
  label: string;
  value: string;
}
export interface SiteSettings {
  siteName?: string;
  siteSlogan?: string;
  siteLogo?: string;
  contactEmail?: string;
  phoneNumber?: string; 
  socialLinks?: SocialLink[];
  privacyPolicy?: string;
  termsAndConditions?: string;
  cookiePolicy?: string;
  siteMode?: SiteMode;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  googleSiteVerification?: string;
}

export type SiteMode = 'light' | 'dark';

