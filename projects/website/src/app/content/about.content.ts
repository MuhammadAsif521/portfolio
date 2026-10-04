
/**
 * "Why Hire Me" (brief, Part 6). Figures must stay real and defensible (brief, Part 10: confirm before
 * launch).
 */
export const ABOUT_CONTENT = {
  title: 'Why',
  accent: 'Hire me',
  bio: [
    'I build production systems end to end: server-rendered Angular front ends, Node/Express and MongoDB APIs, and the admin tools that keep them running.',
    'At ICTGE I delivered the City of New Britain digital ecosystem, where one multi-tenant backend serves four public sites, alongside e-commerce redesigns and internal platforms. Before software I was an aviation technician in the Pakistan Air Force, where precision and checklists were not optional. I bring the same discipline to code.',
  ],
  stats: [
    { value: '7', suffix: '+', label: 'Production applications delivered' },
    { value: '4', suffix: '', label: 'Public sites on one multi-tenant backend' },
  ],
  /** Its own waist-up image (the hero uses the full-length cut-out). Replace the file to use another photo. */
  portrait: {
    src: '/assets/images/about-portrait.webp',
    /** Rendered at most 408 CSS px wide (.about__portrait), so 1x screens get the 320px file. */
    srcset: '/assets/images/about-portrait-sm.webp 320w, /assets/images/about-portrait.webp 493w',
    sizes: '(min-width: 440px) 408px, calc(100vw - 2rem)',
    alt: 'Portrait of Muhammad Asif',
    width: 493,
    height: 640,
  },
} as const;
