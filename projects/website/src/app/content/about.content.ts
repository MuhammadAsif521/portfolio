import { HERO_CONTENT } from './hero.content';

/**
 * "Why Hire Me" (brief, Part 6). Figures must stay real and defensible (brief, Part 10: confirm before
 * launch). The portrait is the hero cut-out, reused.
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
  portrait: { ...HERO_CONTENT.portrait, alt: 'Portrait of Muhammad Asif' },
} as const;
