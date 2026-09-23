/** Every document from portfolio-node carries Mongo's _id and timestamps (ISO strings). */
export interface Timestamped {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * An uploaded image. The API stores the R2 key and always adds an absolute CDN `url`, so templates can
 * bind `url` directly (asset-url.pipe passes absolute URLs through unchanged).
 */
export interface AssetImage {
  key: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface GalleryImage extends AssetImage {
  caption?: string;
}

export type RobotsDirective = 'index, follow' | 'noindex, follow' | 'index, nofollow' | 'noindex, nofollow';

/** Per-page SEO overrides; field names match seo.service's RouteSeoData. */
export interface SeoMeta {
  title?: string;
  heroDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: AssetImage;
  ogUrl?: string;
  robots?: RobotsDirective;
}

export type PublishStatus = 'draft' | 'published';
