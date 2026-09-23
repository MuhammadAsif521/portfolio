import { DOCUMENT } from '@angular/common';
import { Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser'; 
import { environment } from '@shared/environment/environment';

export interface SeoPayload {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  image?: string;
  robots?: string;

  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;

  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterCard?: string;

  jsonLd?: Record<string, any> | Record<string, any>[];
}

export interface RouteSeoData {
  title?: string;
  heroDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  robots?: string;
}

/** Site-settings-derived fallback used by updateFromRouteData when a route
 *  supplies no metaTitle/metaDescription/metaKeywords/ogImage of its own —
 *  the second link in the fallback chain (page value -> site-settings ->
 *  siteName/default). Left undefined/empty fields are simply skipped, never
 *  fabricated. */
export interface SiteSeoFallback {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
}

/** Real, per-tenant data used to build the site-wide google-site-verification
 *  meta tag and GovernmentOrganization JSON-LD — kept separate from
 *  per-page SEO (RouteSeoData/SeoPayload) since it's applied once whenever
 *  site-settings loads/changes, not per navigation. Every field is optional;
 *  fields left empty are simply omitted from the schema, never fabricated. */
export interface SiteSettingsSeoInput {
  siteName?: string;
  logo?: string;
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  socialLinks?: { label: string; value: string }[];
  googleSiteVerification?: string;
}

export interface EventJsonLdInput {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  image?: string;
  url: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface LocalBusinessJsonLdInput {
  name: string;
  description?: string;
  image?: string;
  url: string;
  phone?: string;
  websiteUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private rendererFactory = inject(RendererFactory2);
  private document = inject(DOCUMENT);

  // Trimmed defensively: environment.siteName carries a trailing space
  // ('NB Youth Prevention ') used verbatim elsewhere (e.g. the apple-mobile-
  // web-app-title meta), which would otherwise make withSiteName()'s
  // "already contains the site name" check fail for any route title that
  // ends exactly at "NB Youth Prevention" with no trailing space, producing
  // a duplicated "| NB Youth Prevention | NB Youth Prevention" suffix.
  private readonly siteName = environment.siteName.trim();
  private readonly siteUrl = environment.siteUrl;
  private readonly defaultDescription =
    "NB Youth Prevention is New Britain, CT's youth substance-use and mental-health prevention coalition — Parent Cafés, Bee Positive, Bee Responsible, Peer to Peer, and Local & Youth Leadership Councils working to keep New Britain's youth healthy, informed, and supported.";
  private readonly defaultImage = `${this.siteUrl}/assets/logo/nv-logo.svg`;

  private renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  private static readonly ORG_SCHEMA_ID = 'site-org-json-ld';
  private static readonly SITE_VERIFICATION_NAME = 'google-site-verification';

  updateFromRouteData(data: RouteSeoData, currentUrl: string, siteFallback?: SiteSeoFallback): void {
    const title =
      data.metaTitle ||
      (siteFallback?.metaTitle ? this.withSiteName(siteFallback.metaTitle) : undefined) ||
      this.withSiteName(data.title || this.siteName);

    const description =
      data.metaDescription || data.heroDescription || siteFallback?.metaDescription || this.defaultDescription;

    const canonical = this.buildUrl(currentUrl);
    const image = this.absoluteUrl(data.ogImage || siteFallback?.ogImage || this.defaultImage);

    this.updateSeo({
      title,
      description,
      keywords: data.metaKeywords || siteFallback?.metaKeywords,
      canonical,
      image,
      robots: data.robots || 'index, follow',

      ogTitle: data.ogTitle || title,
      ogDescription: data.ogDescription || description,
      ogImage: image,
      ogUrl: data.ogUrl || canonical,
      ogType: 'website',

      twitterTitle: data.ogTitle || title,
      twitterDescription: data.ogDescription || description,
      twitterImage: image,
      twitterCard: 'summary_large_image',

      jsonLd: this.siteJsonLd(),
    });
  }

  /**
   * Applies site-wide (not per-route) SEO: the google-site-verification
   * meta tag and a GovernmentOrganization JSON-LD block built from real
   * contact/branding data. Call whenever site-settings changes (e.g. from an
   * effect watching the site-settings store slice) — safe to call repeatedly.
   *
   * Uses its own script id (distinct from the per-page `data-seo-json-ld`
   * scripts written by updateSeo()) so this never gets clobbered by, or
   * clobbers, a route component's own JSON-LD.
   */
  applySiteSettings(input: SiteSettingsSeoInput): void {
    this.applySiteVerification(input.googleSiteVerification);
    this.applyOrganizationSchema(input);
  }

  private applySiteVerification(id?: string): void {
    const name = SeoService.SITE_VERIFICATION_NAME;
    if (id) {
      this.updateTag('name', name, id);
    } else {
      this.removeTag('name', name);
    }
  }

  private applyOrganizationSchema(input: SiteSettingsSeoInput): void {
    const name = input.siteName || this.siteName;
    if (!name) return; // never fabricate a placeholder org name

    const address = this.postalAddress(input);
    const schema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'GovernmentOrganization',
      name,
      url: this.siteUrl,
    };

    if (input.logo) schema['logo'] = this.absoluteUrl(input.logo);
    if (input.phoneNumber) schema['telephone'] = input.phoneNumber;
    if (input.contactEmail) schema['email'] = input.contactEmail;
    if (address) schema['address'] = address;

    const sameAs = (input.socialLinks || []).map((s) => s.value).filter(Boolean);
    if (sameAs.length) schema['sameAs'] = sameAs;

    let script = this.document.querySelector<HTMLScriptElement>(`script#${SeoService.ORG_SCHEMA_ID}`);
    if (!script) {
      const created = this.renderer.createElement('script') as HTMLScriptElement;
      created.type = 'application/ld+json';
      created.id = SeoService.ORG_SCHEMA_ID;
      this.renderer.appendChild(this.document.head, created);
      script = created;
    }
    script.textContent = JSON.stringify(schema);
  }

  updateSeo(data: SeoPayload): void {
    if (data.title) {
      this.title.setTitle(data.title);
      this.updateTag('property', 'og:title', data.ogTitle || data.title);
      this.updateTag('name', 'twitter:title', data.twitterTitle || data.title);
    }

    if (data.description) {
      this.updateTag('name', 'description', data.description);
      this.updateTag('property', 'og:description', data.ogDescription || data.description);
      this.updateTag('name', 'twitter:description', data.twitterDescription || data.description);
    }

    if (data.keywords) {
      this.updateTag('name', 'keywords', data.keywords);
    } else {
      this.removeTag('name', 'keywords');
    }

    if (data.robots) {
      this.updateTag('name', 'robots', data.robots);
    }

    if (data.image) {
      this.updateTag('property', 'og:image', data.ogImage || data.image);
      this.updateTag('name', 'twitter:image', data.twitterImage || data.image);
    }

    this.updateTag('property', 'og:type', data.ogType || 'website');
    this.updateTag('name', 'twitter:card', data.twitterCard || 'summary_large_image');

    if (data.ogUrl) {
      this.updateTag('property', 'og:url', data.ogUrl);
    }

    if (data.canonical) {
      this.setCanonicalUrl(data.canonical);
    }

    if (data.jsonLd) {
      this.setJsonLd(data.jsonLd);
    }
  }

  private updateTag(attr: 'name' | 'property', attrValue: string, content: string): void {
    this.meta.updateTag({
      [attr]: attrValue,
      content,
    });
  }

  private removeTag(attr: 'name' | 'property', attrValue: string): void {
    this.meta.removeTag(`${attr}="${attrValue}"`);
  }

  private setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');

    if (!link) {
      link = this.renderer.createElement('link');
      this.renderer.setAttribute(link, 'rel', 'canonical');
      this.renderer.appendChild(this.document.head, link);
    }

    this.renderer.setAttribute(link, 'href', url);
  }

  private setJsonLd(schema: Record<string, any> | Record<string, any>[]): void {
    const oldScripts = this.document.querySelectorAll('script[data-seo-json-ld="true"]');
    oldScripts.forEach((script) => script.remove());

    const schemas = Array.isArray(schema) ? schema : [schema];

    schemas.forEach((item) => {
      const script = this.renderer.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(item);
      this.renderer.setAttribute(script, 'data-seo-json-ld', 'true');
      this.renderer.appendChild(this.document.head, script);
    });
  }

  withSiteName(title: string): string {
    return title.includes(this.siteName) ? title : `${title} | ${this.siteName}`;
  }

  buildUrl(pathOrUrl: string): string {
    if (!pathOrUrl) return this.siteUrl;

    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    const cleanPath = pathOrUrl.split('#')[0].split('?')[0];

    return `${this.siteUrl}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
  }

  private absoluteUrl(url: string): string {
    if (!url) return this.defaultImage;

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    return `${this.siteUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private websiteJsonLd(): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.siteName,
      url: this.siteUrl,
    };
  }

  private organizationJsonLd(): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.siteName,
      url: this.siteUrl,
      logo: this.defaultImage,
      sameAs: [],
    };
  }

  /** The site's own identity schema — include alongside page-specific JSON-LD so it's
   * present even when a detail page is the visitor's actual entry point. */
  siteJsonLd(): Record<string, any>[] {
    return [this.websiteJsonLd(), this.organizationJsonLd()];
  }

  private postalAddress(input: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }): Record<string, any> | undefined {
    if (!input.address && !input.city) return undefined;

    return {
      '@type': 'PostalAddress',
      ...(input.address ? { streetAddress: input.address } : {}),
      ...(input.city ? { addressLocality: input.city } : {}),
      ...(input.state ? { addressRegion: input.state } : {}),
      ...(input.zipCode ? { postalCode: input.zipCode } : {}),
      addressCountry: input.country || 'US',
    };
  }

  buildEventJsonLd(input: EventJsonLdInput): Record<string, any> {
    const address = this.postalAddress(input);

    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      startDate: input.startDate,
      ...(input.endDate ? { endDate: input.endDate } : {}),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: input.name,
        ...(address ? { address } : {}),
      },
      ...(input.image ? { image: [input.image] } : {}),
      url: input.url,
    };
  }

  buildLocalBusinessJsonLd(input: LocalBusinessJsonLdInput): Record<string, any> {
    const address = this.postalAddress(input);

    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(address ? { address } : {}),
      ...(input.phone ? { telephone: input.phone } : {}),
      ...(input.websiteUrl ? { url: input.websiteUrl } : {}),
      ...(input.image ? { image: [input.image] } : {}),
      ...(input.lat != null && input.lng != null
        ? { geo: { '@type': 'GeoCoordinates', latitude: input.lat, longitude: input.lng } }
        : {}),
    };
  }

  buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        ...(item.url ? { item: item.url } : {}),
      })),
    };
  }
}