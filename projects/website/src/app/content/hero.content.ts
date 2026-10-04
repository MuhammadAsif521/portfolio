/**
 * Hero copy (brief, Part 6). Edit here; nothing else needs to change.
 * Figures must stay real and defensible (brief, Part 10: confirm before launch).
 */
export const HERO_CONTENT = {
  greeting: 'Hello!',
  /** First name shown in the brand colour: "I'm Asif," */
  firstName: 'Asif',
  /** Rotating subtitle (typewriter). The first entry is what SSR, crawlers and reduced-motion users see. */
  roles: ['MEAN Stack Developer', 'Angular Developer', 'Full-Stack Developer', 'Freelance Developer', 'Ionic Angular Developer', 'Hybrid App Developer'],
  /** Used when Site Settings has no description. */
  tagline:
    'Building scalable, production Angular & Node systems — from multi-tenant platforms to e-commerce and real-time apps.',
  stat: { value: '7+', label: 'Production Apps Shipped', rating: 5 },
  /** Transparent cut-out portrait (WebP/PNG). Leave the file out and the orange arc shows alone. */
  portrait: {
    src: '/assets/images/portrait.webp',
    /** The hero's LCP image: phones get the 320px file (the figure is ~150-250 CSS px wide below lg). */
    srcset: '/assets/images/portrait-sm.webp 320w, /assets/images/portrait.webp 433w',
    sizes: '(min-width: 1024px) 433px, calc(5rem + 20vw)',
    alt: 'Muhammad Asif',
    width: 433,
    height: 865,
  },
} as const;
