import type { AssetImage, GalleryImage, PublishStatus, SeoMeta, Timestamped } from './entities.interface';

// Shapes returned by portfolio-node's /api/v1/public endpoints (docs/specs/04-api.md).

// ── Public session ───────────────────────────────────────────────────────────

/** POST /public/verify-session */
export interface VerifySessionData {
  sessionToken: string;
  /** Seconds until the token expires. */
  expiresIn: number;
  /** true when the server returned the still-valid session instead of issuing a new one. */
  reused: boolean;
}

// ── Projects ─────────────────────────────────────────────────────────────────

/** List item (GET /public/projects omits the long case-study body and gallery). */
export interface ProjectCard extends Timestamped {
  slug: string;
  title: string;
  client?: string;
  summary: string;
  techStack: string[];
  featured: boolean;
  order: number;
  coverImage?: AssetImage;
  architectureDiagram?: AssetImage;
  liveUrl?: string;
  repoUrl?: string;
  status: PublishStatus;
  publishedAt?: string;
  seo: SeoMeta;
}

/** GET /public/projects/:slug */
export interface Project extends ProjectCard {
  /** Sanitized HTML. */
  content?: string;
  gallery: GalleryImage[];
}

export type ProjectSort = 'order' | '-order' | 'publishedAt' | '-publishedAt' | 'title' | '-title';

export interface ProjectListQuery {
  page?: number;
  limit?: number;
  sort?: ProjectSort;
  featured?: boolean;
  tech?: string[];
  q?: string;
}

// ── Blog ─────────────────────────────────────────────────────────────────────

export interface BlogPostCard extends Timestamped {
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: AssetImage;
  tags: string[];
  status: PublishStatus;
  publishedAt?: string;
  /** Minutes. */
  readingTime: number;
  seo: SeoMeta;
}

export interface BlogPost extends BlogPostCard {
  /** Sanitized HTML. */
  content: string;
}

export type BlogSort = 'publishedAt' | '-publishedAt' | 'title' | '-title';

export interface BlogListQuery {
  page?: number;
  limit?: number;
  sort?: BlogSort;
  tag?: string[];
  q?: string;
}

// ── Experience (timeline) ────────────────────────────────────────────────────

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | 'military';

export interface Experience extends Timestamped {
  company: string;
  role: string;
  location?: string;
  employmentType?: EmploymentType;
  startDate: string;
  endDate?: string;
  current: boolean;
  summary?: string;
  highlights: string[];
  techStack: string[];
  order: number;
}

// ── Testimonials ─────────────────────────────────────────────────────────────

export type TestimonialSource = 'fiverr' | 'upwork' | 'linkedin' | 'client' | 'other';

/** GET /public/testimonials: real client quotes entered in cusadmin (never fabricated). */
export interface Testimonial extends Timestamped {
  name: string;
  role?: string;
  company?: string;
  quote: string;
  /** 1–5, when the source has a rating. */
  rating?: number;
  source: TestimonialSource;
  /** Where the quote can be verified, e.g. the Fiverr review. */
  sourceUrl?: string;
  order: number;
}

// ── Contact ──────────────────────────────────────────────────────────────────

export type ContactSource = 'contact-form' | 'cta' | 'footer';

/** POST /public/contact. `website` is the honeypot: render it hidden and never fill it. */
export interface ContactPayload {
  email: string;
  name?: string;
  subject?: string;
  message?: string;
  source?: ContactSource;
  website?: string;
}

export interface ContactReceipt {
  received: true;
}
