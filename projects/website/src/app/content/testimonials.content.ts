import type { TestimonialSource } from '@shared/interfaces/public-api.interface';

/**
 * "Testimonials" (brief, Part 6). Quotes come only from cusadmin (brief: never fabricated); with none
 * published the section is not rendered at all, and nothing links to it.
 */
export const TESTIMONIALS_CONTENT = {
  title: 'Testimonials That',
  lead: 'Speak to',
  accent: 'My Results',
  intro: 'What clients said after we shipped together.',
  sourceLabels: {
    fiverr: 'Fiverr',
    upwork: 'Upwork',
    linkedin: 'LinkedIn',
    client: 'Client',
    other: 'Review',
  } satisfies Record<TestimonialSource, string>,
} as const;

/** "Angular SSR ✦ NgRx ✦ …" strip (brief, Part 6). */
export const MARQUEE_CONTENT = {
  label: 'Skills and availability',
  items: [
    'Angular SSR',
    'NgRx',
    'Node.js',
    'MongoDB',
    'Multi-Tenant Architecture',
    'Stripe',
    'WebSockets',
    'Freelance Available',
  ],
  /** Scroll speed in pixels per second (recording: roughly 250–330px/s at 1440). */
  speed: 240,
} as const;
