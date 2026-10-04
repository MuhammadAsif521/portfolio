import { DOCUMENT } from '@angular/common';
import { Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '@shared/environment/environment';
import type { PublicProfile } from '@shared/interfaces/auth.interface';

/** One schema.org node of the page's JSON-LD @graph (no @context: the graph carries it). */
export type JsonLdNode = Record<string, any>;

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

  /**
   * The page's own schema.org nodes. They are written into the page's single JSON-LD @graph after the
   * site-wide WebSite and Person nodes, so they can reference those by @id.
   */
  jsonLd?: JsonLdNode | JsonLdNode[];
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

/** Real Site Settings data for the site-wide tags and the WebSite + Person nodes. Every field is
 *  optional; empty fields are omitted from the schema, never fabricated. */
export interface SiteSettingsSeoInput {
  siteName?: string;
  /** Headline shown as the Person's jobTitle, e.g. "MEAN Stack Developer". */
  jobTitle?: string;
  description?: string;
  /** Canonical origin from Site Settings ("https://www.example.com"); replaces environment.siteUrl. */
  domain?: string;
  /** Default share image (absolute URL), used when a page has no ogImage of its own. */
  ogImage?: string;
  logo?: string;
  /** A photo of the site owner (absolute, or a site path) for Person.image. Falls back to the logo. */
  photo?: string;
  /** Browser-tab / home-screen icon (absolute URL). Replaces the static icons shipped in index.html. */
  favicon?: string;
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  socialLinks?: { label: string; value: string }[];
  /** Resume profile slice from GET /public/settings: links, skills, education, current job. */
  profile?: PublicProfile;
  googleSiteVerification?: string;
}

export interface WebPageNodeInput {
  /** WebPage or a subtype: ProfilePage, CollectionPage, AboutPage, ContactPage… */
  type?: string;
  /** Site path ("/blog") or absolute URL. */
  path: string;
  name: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  /** Adds a BreadcrumbList node for this page and links it. */
  breadcrumb?: BreadcrumbItem[];
  /** Extra properties (mainEntity, about…). */
  extra?: JsonLdNode;
}

/** A portfolio case study: CreativeWork, or SoftwareSourceCode when the code is public. */
export interface CreativeWorkJsonLdInput {
  name: string;
  description?: string;
  /** Absolute URL of the case-study page. */
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  keywords?: string[];
  /** Public repository: the node becomes SoftwareSourceCode with codeRepository. */
  repoUrl?: string;
}

/** A blog post (brief: "BlogPosting schema on each /blog/:slug"). */
export interface BlogPostingJsonLdInput {
  headline: string;
  description?: string;
  /** Absolute URL of the post. */
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  keywords?: string[];
  /** Minutes, rendered as an ISO 8601 duration (timeRequired). */
  readingTime?: number;
  wordCount?: number;
}

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

/** A post or project in a list (ItemList). */
export interface ListItemInput {
  name: string;
  url: string;
}

/** Visible words in an HTML string (for BlogPosting.wordCount). */
export function countWords(html: string | undefined | null): number {
  if (!html) return 0;
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
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
  private siteUrl = SeoService.origin(environment.siteUrl) ?? environment.siteUrl.replace(/\/+$/, '');
  private defaultDescription =
    'Building scalable, production Angular & Node systems — from multi-tenant platforms to e-commerce and real-time apps.';
  /** Committed brand share image (projects/shared/src/lib/assets/images); Site Settings' ogImage replaces it. */
  static readonly STATIC_OG_IMAGE = '/assets/images/og-default.jpg';
  private defaultImage = SeoService.STATIC_OG_IMAGE;

  private renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  /** Site-wide Person node (from Site Settings), present in every page's graph. */
  private personNode: JsonLdNode | null = null;
  private websiteDescription: string | undefined;
  /** The current page's own nodes, kept so a later settings change can re-render the graph. */
  private pageNodes: JsonLdNode[] = [];

  private static readonly GRAPH_SCRIPT_ID = 'seo-json-ld';
  private static readonly SITE_VERIFICATION_NAME = 'google-site-verification';

  /** Stable id of the site owner's Person node; WebSite, ProfilePage and BlogPosting reference it. */
  get personId(): string {
    return `${this.siteUrl}/#person`;
  }

  get websiteId(): string {
    return `${this.siteUrl}/#website`;
  }

  /** "https://www.example.com/x" → "https://www.example.com"; null for anything that isn't http(s). */
  private static origin(value: string | undefined): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.origin : null;
    } catch {
      return null;
    }
  }

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

      // Site-wide nodes only; the page adds its own with a second updateSeo({ jsonLd }).
      jsonLd: [],
    });
  }

  /**
   * Applies site-wide (not per-route) SEO: the canonical origin, the google-site-verification meta tag
   * and the WebSite + Person nodes, built from real Site Settings data. Also makes the settings' name,
   * description and share image the fallbacks for every page. Call whenever site-settings loads — safe to
   * call repeatedly.
   */
  applySiteSettings(input: SiteSettingsSeoInput): void {
    if (input.siteName?.trim()) this.siteName = input.siteName.trim();
    if (input.description?.trim()) this.defaultDescription = input.description.trim();
    if (input.ogImage) this.defaultImage = input.ogImage;
    const domain = SeoService.origin(input.domain);
    if (domain) this.siteUrl = domain;
    this.websiteDescription = input.description?.trim() || undefined;
    this.applySiteIcons(input.favicon);
    this.applySiteVerification(input.googleSiteVerification);
    this.personNode = this.buildPersonNode(input);
    this.renderGraph();
  }

  /**
   * Points the tab icon and the apple-touch-icon at the Site Settings favicon. Without one, the static
   * set in index.html (favicon.ico, assets/favicon/*) stays as is. The static icon links are removed when
   * a favicon is set: browsers choose among all rel="icon" links by size and type, not by order, so
   * leaving them would let the bundled icon win over the admin's.
   */
  applySiteIcons(favicon?: string): void {
    if (!favicon) return;
    const href = this.absoluteUrl(favicon);
    const type = /\.webp(\?|$)/i.test(href) ? 'image/webp' : /\.png(\?|$)/i.test(href) ? 'image/png' : undefined;
    const head = this.document.head;
    head
      .querySelectorAll('link[rel="icon"]:not([data-site-icon]), link[rel="apple-touch-icon"]:not([data-site-icon])')
      .forEach((link) => link.remove());

    for (const rel of ['icon', 'apple-touch-icon']) {
      let link = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-site-icon]`);
      if (!link) {
        link = this.renderer.createElement('link') as HTMLLinkElement;
        this.renderer.setAttribute(link, 'rel', rel);
        this.renderer.setAttribute(link, 'data-site-icon', '');
        this.renderer.appendChild(head, link);
      }
      this.renderer.setAttribute(link, 'href', href);
      if (rel === 'icon' && type) this.renderer.setAttribute(link, 'type', type);
    }
  }

  private applySiteVerification(id?: string): void {
    const name = SeoService.SITE_VERIFICATION_NAME;
    if (id) {
      this.updateTag('name', name, id);
    } else {
      this.removeTag('name', name);
    }
  }

  /** The site owner as a schema.org Person, from Site Settings and the public resume profile. */
  private buildPersonNode(input: SiteSettingsSeoInput): JsonLdNode | null {
    const profile = input.profile;
    const name = profile?.fullName || input.siteName || this.siteName;
    if (!name) return null; // never fabricate a placeholder name

    const node: JsonLdNode = {
      '@type': 'Person',
      '@id': this.personId,
      name,
      url: this.buildUrl('/'),
    };

    const jobTitle = input.jobTitle || profile?.headline;
    if (jobTitle) node['jobTitle'] = jobTitle;
    if (input.description) node['description'] = input.description;
    const image = input.photo || input.logo;
    if (image) node['image'] = this.absoluteUrl(image);
    if (input.contactEmail) node['email'] = input.contactEmail;
    if (input.phoneNumber) node['telephone'] = input.phoneNumber;
    const address = this.postalAddress(input);
    if (address) node['address'] = address;

    const sameAs = [
      ...new Set(
        [profile?.linkedin, profile?.github, ...(input.socialLinks ?? []).map((link) => link.value)].filter(
          (url): url is string => !!url && /^https?:\/\//i.test(url),
        ),
      ),
    ];
    if (sameAs.length) node['sameAs'] = sameAs;

    if (profile?.skills.length) node['knowsAbout'] = profile.skills.slice(0, 40);
    if (profile?.languages.length) node['knowsLanguage'] = profile.languages;

    const job = profile?.currentPosition;
    if (job) {
      node['worksFor'] = {
        '@type': 'Organization',
        name: job.company,
        ...(job.location ? { location: job.location } : {}),
      };
      if (!node['jobTitle']) node['jobTitle'] = job.role;
    }

    const school = profile?.education[0];
    if (school) node['alumniOf'] = { '@type': 'EducationalOrganization', name: school.institution };

    return node;
  }

  private websiteNode(): JsonLdNode {
    return {
      '@type': 'WebSite',
      '@id': this.websiteId,
      url: this.buildUrl('/'),
      name: this.siteName,
      ...(this.websiteDescription ? { description: this.websiteDescription } : {}),
      inLanguage: 'en',
      ...(this.personNode ? { publisher: { '@id': this.personId }, author: { '@id': this.personId } } : {}),
    };
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
    } else if (data.title) {
      // A full page update without keywords clears the previous page's.
      this.removeTag('name', 'keywords');
    }

    if (data.robots) {
      this.updateTag('name', 'robots', data.robots);
    }

    if (data.image) {
      this.updateTag('property', 'og:image', data.ogImage || data.image);
      this.updateTag('name', 'twitter:image', data.twitterImage || data.image);
    }

    if (data.ogType || data.title) this.updateTag('property', 'og:type', data.ogType || 'website');
    if (data.twitterCard || data.title) {
      this.updateTag('name', 'twitter:card', data.twitterCard || 'summary_large_image');
    }

    if (data.ogUrl) {
      this.updateTag('property', 'og:url', data.ogUrl);
    }

    if (data.canonical) {
      this.setCanonicalUrl(data.canonical);
    }

    if (data.jsonLd) {
      const nodes = Array.isArray(data.jsonLd) ? data.jsonLd : [data.jsonLd];
      this.pageNodes = nodes.map(({ '@context': _context, ...node }) => node);
      this.renderGraph();
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

  /** Writes the page's one JSON-LD script: WebSite, Person and the page's own nodes in a single @graph. */
  private renderGraph(): void {
    const graph = [this.websiteNode(), ...(this.personNode ? [this.personNode] : []), ...this.pageNodes];
    let script = this.document.querySelector<HTMLScriptElement>(`script#${SeoService.GRAPH_SCRIPT_ID}`);
    if (!script) {
      script = this.renderer.createElement('script') as HTMLScriptElement;
      script.type = 'application/ld+json';
      script.id = SeoService.GRAPH_SCRIPT_ID;
      this.renderer.appendChild(this.document.head, script);
    }
    // "</" can't end the script element early; JSON.parse reads "<\/" back as "</".
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
      /<\//g,
      '<\\/',
    );
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
    if (!url) return this.absoluteUrl(this.defaultImage);

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    return `${this.siteUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private postalAddress(input: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }): JsonLdNode | undefined {
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

  // ── Page nodes ─────────────────────────────────────────────────────────────

  /** A WebPage (or subtype) node for the current page, plus its BreadcrumbList when given. */
  webPageNodes(input: WebPageNodeInput): JsonLdNode[] {
    const url = this.buildUrl(input.path);
    const crumbs = input.breadcrumb?.length ? this.breadcrumbNode(url, input.breadcrumb) : null;
    const page: JsonLdNode = {
      '@type': input.type ?? 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      isPartOf: { '@id': this.websiteId },
      inLanguage: 'en',
      ...(input.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: this.absoluteUrl(input.image) } } : {}),
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
      ...(crumbs ? { breadcrumb: { '@id': crumbs['@id'] } } : {}),
      ...input.extra,
    };
    return crumbs ? [page, crumbs] : [page];
  }

  /** ProfilePage for the home page: the page is about, and mainly shows, the site owner. */
  profilePageNodes(input: { name: string; description?: string; dateModified?: string }): JsonLdNode[] {
    return this.webPageNodes({
      type: 'ProfilePage',
      path: '/',
      name: input.name,
      description: input.description,
      dateModified: input.dateModified,
      extra: this.personNode ? { mainEntity: { '@id': this.personId }, about: { '@id': this.personId } } : {},
    });
  }

  /** /blog: a CollectionPage whose main entity is the list of posts, plus the Blog itself. */
  blogListNodes(input: { name: string; description?: string; posts: ListItemInput[]; path?: string }): JsonLdNode[] {
    const blogUrl = this.buildUrl('/blog');
    const pageUrl = this.buildUrl(input.path ?? '/blog');
    const listId = `${pageUrl}#itemlist`;
    const blog: JsonLdNode = {
      '@type': 'Blog',
      '@id': `${blogUrl}#blog`,
      url: blogUrl,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      inLanguage: 'en',
      isPartOf: { '@id': this.websiteId },
      ...(this.personNode ? { author: { '@id': this.personId }, publisher: { '@id': this.personId } } : {}),
    };
    const list: JsonLdNode = {
      '@type': 'ItemList',
      '@id': listId,
      numberOfItems: input.posts.length,
      itemListElement: input.posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: post.url,
        name: post.name,
      })),
    };
    return [
      ...this.webPageNodes({
        type: 'CollectionPage',
        path: input.path ?? '/blog',
        name: input.name,
        description: input.description,
        breadcrumb: [
          { name: 'Home', url: this.buildUrl('/') },
          { name: input.name, url: blogUrl },
        ],
        extra: { mainEntity: { '@id': listId }, about: { '@id': blog['@id'] } },
      }),
      blog,
      list,
    ];
  }

  /** CreativeWork (or SoftwareSourceCode) for a case study, created by the site-wide Person node. */
  buildCreativeWorkJsonLd(input: CreativeWorkJsonLdInput): JsonLdNode {
    return {
      '@type': input.repoUrl ? 'SoftwareSourceCode' : 'CreativeWork',
      '@id': `${input.url}#work`,
      name: input.name,
      headline: input.name,
      ...(input.description ? { description: input.description } : {}),
      url: input.url,
      mainEntityOfPage: { '@id': `${input.url}#webpage` },
      ...(input.image ? { image: [this.absoluteUrl(input.image)] } : {}),
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
      ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
      ...(input.repoUrl ? { codeRepository: input.repoUrl } : {}),
      inLanguage: 'en',
      author: { '@id': this.personId },
      creator: { '@id': this.personId },
    };
  }

  /** BlogPosting authored and published by the site-wide Person node. */
  buildBlogPostingJsonLd(input: BlogPostingJsonLdInput): JsonLdNode {
    return {
      '@type': 'BlogPosting',
      '@id': `${input.url}#article`,
      // Google truncates headlines over 110 characters.
      headline: input.headline.length > 110 ? `${input.headline.slice(0, 109).trimEnd()}…` : input.headline,
      ...(input.description ? { description: input.description } : {}),
      url: input.url,
      mainEntityOfPage: { '@id': `${input.url}#webpage` },
      isPartOf: { '@id': `${this.buildUrl('/blog')}#blog` },
      ...(input.image ? { image: [this.absoluteUrl(input.image)] } : {}),
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      ...(input.dateModified || input.datePublished
        ? { dateModified: input.dateModified || input.datePublished }
        : {}),
      ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
      ...(input.wordCount ? { wordCount: input.wordCount } : {}),
      ...(input.readingTime ? { timeRequired: `PT${Math.max(1, Math.round(input.readingTime))}M` } : {}),
      inLanguage: 'en',
      author: { '@id': this.personId },
      publisher: { '@id': this.personId },
    };
  }

  /** BreadcrumbList for the page at `pageUrl` (absolute). */
  breadcrumbNode(pageUrl: string, items: BreadcrumbItem[]): JsonLdNode {
    return {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        ...(item.url ? { item: item.url } : {}),
      })),
    };
  }
}
