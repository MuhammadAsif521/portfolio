/** Every document from portfolio-node carries Mongo's _id and timestamps (ISO strings). */
export interface Timestamped {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * An uploaded image. The API stores the R2 key and always adds an absolute CDN `url`, so templates can
 * bind `url` directly (asset-url.pipe passes absolute URLs through unchanged).
 *
 * Images uploaded (or backfilled) since responsive variants exist also carry `variants` (widths of the
 * `-w480.webp` / `-w960.webp` copies) and a ready-made `srcset` ("…-w480.webp 480w, …, <url> 1600w").
 * Older data has neither: bind `[attr.srcset]="image.srcset ?? null"` so `src` alone is used then.
 * Both are server-owned — never send them back (portfolio-node's imageInput rejects them).
 */
export interface AssetImage {
  key: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  variants?: number[];
  srcset?: string;
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
