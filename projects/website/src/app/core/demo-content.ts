import { InjectionToken } from '@angular/core';
import { environment } from '@shared/environment/environment';
import type { BlogPost, Project, Testimonial } from '@shared/interfaces/public-api.interface';
import { map, type OperatorFunction } from 'rxjs';

/*
 * Demo content for UI review in development (environment.demoContent — false in production, so none of
 * this is ever shown on the live site). Used only when the API returns nothing. Projects are the
 * brief's real projects (Part 5); testimonials are clearly labelled placeholders, never presented as
 * real quotes; posts are the brief's planned topics.
 */

const img = (name: string, alt: string, width: number, height: number) => ({
  key: `demo/${name}`,
  url: `/assets/images/demo/${name}`,
  alt,
  width,
  height,
});

const project = (
  n: number,
  slug: string,
  title: string,
  client: string,
  summary: string,
  techStack: string[],
): Project => ({
  _id: `demo-project-${n}`,
  slug,
  title,
  client,
  summary,
  techStack,
  featured: n === 1,
  order: n,
  status: 'published',
  seo: { robots: 'noindex, follow' },
  coverImage: img(`project-${((n - 1) % 4) + 1}.webp`, `${title} (demo cover)`, 1266, 742),
  gallery: [],
  content: `<p><strong>Demo content for UI review.</strong> ${summary}</p>`,
  publishedAt: '2026-09-01T00:00:00.000Z',
});

export const DEMO_PROJECTS: readonly Project[] = [
  project(1, 'city-of-new-britain', 'City of New Britain Digital Ecosystem', 'City of New Britain, CT',
    'One shared multi-tenant Node.js/MongoDB backend and one Angular + NgRx admin panel powering four independent public city websites.',
    ['Angular SSR', 'NgRx', 'Node.js', 'MongoDB', 'Docker', 'nginx']),
  project(2, 'aa-bridal-studio', 'AA Bridal Studio', 'AA Bridal Studio',
    'Booking and CRM platform for a bridal & beauty salon: public booking site plus an admin dashboard for artists, customers and scheduling.',
    ['Angular 21', 'SSR', 'NgRx', 'Stripe', 'GSAP']),
  project(3, 'wavy-cables', 'Wavy Cables', 'Wavy Cables',
    'E-commerce platform for a custom audio-cable manufacturer, including a build-your-own-cable configurator.',
    ['Angular 21', 'SSR', 'NgRx', 'Stripe', 'Tailwind']),
  project(4, 'khan-meat-pointe', 'Khan Meat Pointe', 'Khan Meat Pointe',
    'Halal meat delivery storefront with a seasonal Qurbani ordering module and a full admin back office.',
    ['Angular 21', 'SSR', 'Stripe', 'Leaflet']),
  project(5, 'chat-messenger', 'ChatMessenger', 'Internal product',
    'Multi-tenant, Slack-style real-time chat with presence, typing indicators, read receipts and attachments.',
    ['Angular', 'PrimeNG', 'WebSockets']),
  project(6, 'student-management-system', 'Student Management System', 'Internal product',
    'Institute platform with admin, teacher and student portals and live facial-recognition attendance over WebSockets.',
    ['Angular 21', 'NgRx', 'PrimeNG', 'Capacitor']),
  project(7, 'mycityhelp', 'MyCityHelp', 'Internal product',
    'Support-ticket SaaS: marketing landing page plus a role-gated helpdesk with real-time ticket notifications.',
    ['Angular 20', 'SSR', 'PrimeNG', 'Tailwind 4']),
];

export const DEMO_TESTIMONIALS: readonly Testimonial[] = [1, 2, 3].map((n) => ({
  _id: `demo-testimonial-${n}`,
  name: ['Demo Client', 'Demo Founder', 'Demo Manager'][n - 1] ?? 'Demo Client',
  role: 'Sample testimonial',
  company: 'Demo data',
  quote:
    'This is placeholder text shown only in development to preview the testimonial card. Real client quotes are added in cusadmin and replace it automatically.',
  rating: 5,
  source: 'client' as const,
  order: n,
}));

export const DEMO_POSTS: readonly BlogPost[] = [
  ['building-a-multi-tenant-backend', 'Building a Multi-Tenant Backend with One Express API', 'architecture', '2026-09-10'],
  ['angular-ssr-ngrx-lessons', 'Angular SSR + NgRx: Lessons from Production', 'angular', '2026-08-09'],
  ['gating-third-party-scripts', 'Gating Third-Party Scripts Behind Real Cookie Consent', 'privacy', '2026-07-13'],
].map(([slug, title, tag, date], i) => ({
  _id: `demo-post-${i + 1}`,
  slug: slug!,
  title: title!,
  excerpt: 'Demo post for UI review; the real write-up is coming soon.',
  tags: [tag!],
  status: 'published' as const,
  publishedAt: `${date}T00:00:00.000Z`,
  readingTime: 6,
  seo: { robots: 'noindex, follow' as const },
  coverImage: img(`blog-${i + 1}.webp`, `${title} (demo cover)`, 832, 862),
  content: '<p><strong>Demo content for UI review.</strong> The real post is being written.</p>',
}));

/** Whether demo content may be shown: environment.demoContent (dev only). Tests override it. */
export const DEMO_CONTENT = new InjectionToken<boolean>('DEMO_CONTENT', {
  providedIn: 'root',
  factory: () => environment.demoContent,
});

/** Replaces an empty API result with demo items when demo content is enabled. */
export function orDemo<T>(demo: readonly T[], enabled: boolean): OperatorFunction<T[], T[]> {
  return map((items) => (items.length || !enabled ? items : [...demo]));
}
