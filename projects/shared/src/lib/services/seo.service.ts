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
  /** Headline shown as the Person's jobTitle, e.g. "MEAN Stack Developer". */
  jobTitle?: string;
  description?: string;
  /** Default share image (absolute URL), used when a page has no ogImage of its own. */
  ogImage?: string;
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

/** A portfolio case study (brief: "CreativeWork-style schema on each /projects/:slug"). */
export interface CreativeWorkJsonLdInput {
  name: string;
  description?: string;
  /** Absolute URL of the case-study page. */
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  keywords?: string[];
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

  // Environment values are the fallback; applySiteSettings() replaces them with the admin's Site Settings.
  // Trimmed defensively so withSiteName()'s "already contains the site name" check can't miss.
  private siteName = environment.siteName.trim();
  private readonly siteUrl = environment.siteUrl.replace(/\/+$/, '');
  private defaultDescription =
    'Building scalable, production Angular & Node systems — from multi-tenant platforms to e-commerce and real-time apps.';
  // No invented fallback image: without a site or page ogImage, image tags are simply omitted.
  private defaultImage = '';

  private renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  /** Stable id of the site owner's Person node; ProfilePage/BlogPosting reference it. */
  readonly personId = `${environment.siteUrl.replace(/\/+$/, '')}/#person`;

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
   * Applies site-wide (not per-route) SEO: the google-site-verification meta tag and the site owner's
   * Person JSON-LD, built from real Site Settings data. Also makes the settings' name, description and
   * share image the fallbacks for every page. Call whenever site-settings loads — safe to call repeatedly.
   *
   * Uses its own script id (distinct from the per-page `data-seo-json-ld` scripts written by updateSeo())
   * so this never gets clobbered by, or clobbers, a route component's own JSON-LD.
   */
  applySiteSettings(input: SiteSettingsSeoInput): void {
    if (input.siteName?.trim()) this.siteName = input.siteName.trim();
    if (input.description?.trim()) this.defaultDescription = input.description.trim();
    if (input.ogImage) this.defaultImage = input.ogImage;
    this.applySiteVerification(input.googleSiteVerification);
    this.applyOrganizationSchema(input);
  }

  /** ProfilePage JSON-LD for the home page, pointing at the site-wide Person node. */
  profilePageJsonLd(url: string): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: this.buildUrl(url),
      mainEntity: { '@id': this.personId },
    };
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
    // A personal portfolio: the site owner is a Person (brief: Person/ProfilePage on "/").
    const schema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': this.personId,
      name,
      url: this.siteUrl,
    };

    if (input.jobTitle) schema['jobTitle'] = input.jobTitle;
    if (input.description) schema['description'] = input.description;
    if (input.logo) schema['image'] = this.absoluteUrl(input.logo);
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

  /** The site's own identity schema — include alongside page-specific JSON-LD so it's present even
   * when a detail page is the visitor's entry point. (The owner's Person node is written separately by
   * applySiteSettings, from real data, under its own script id.) */
  siteJsonLd(): Record<string, any>[] {
    return [this.websiteJsonLd()];
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
      ...(input.country ? { addressCountry: input.country } : {}),
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

  /** CreativeWork for a case study, authored by the site-wide Person node. */
  buildCreativeWorkJsonLd(input: CreativeWorkJsonLdInput): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: input.name,
      headline: input.name,
      ...(input.description ? { description: input.description } : {}),
      url: input.url,
      mainEntityOfPage: input.url,
      ...(input.image ? { image: [this.absoluteUrl(input.image)] } : {}),
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
      ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
      author: { '@id': this.personId },
      creator: { '@id': this.personId },
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