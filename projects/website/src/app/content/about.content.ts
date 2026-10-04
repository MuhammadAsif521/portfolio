/** A run of text in a bio paragraph; with `link` it renders as an internal link (router path). */
export interface BioPart {
  text: string;
  link?: string;
  /** Optional fragment for `link`, e.g. "contact" for /#contact. */
  fragment?: string;
}

/**
 * "Why Hire Me" (brief, Part 6). Figures must stay real and defensible (brief, Part 10: confirm before
 * launch).
 *
 * The bio is the site's answer-first "who is this and what does he do" passage: about 150 words (the
 * length AI answer engines quote best), self-contained, factual and taken from the experience and
 * project data, with links to the case studies it mentions. Keep it that way when editing.
 */
export const ABOUT_CONTENT = {
  title: 'Why',
  accent: 'Hire me',
  bio: [
    [
      {
        text: "I'm Muhammad Asif, a MEAN stack developer in Lahore, Pakistan. I build production web applications end to end: server-rendered Angular front ends, Node.js and Express APIs on MongoDB, and the admin panels that keep them running.",
      },
    ],
    [
      { text: 'Since October 2025 I have worked as a MEAN Stack Developer at ICTGE, where I delivered the ' },
      { text: 'City of New Britain digital ecosystem', link: '/projects/city-of-new-britain-digital-ecosystem' },
      {
        text: ': one multi-tenant Node.js backend and one Angular admin panel powering four public city websites. I have also rebuilt e-commerce platforms such as ',
      },
      { text: 'Wavy Cables', link: '/projects/wavy-cables' },
      { text: ' on Angular 21 with Stripe checkout, and shipped real-time apps over WebSockets, from a ' },
      { text: 'Slack-style chat platform', link: '/projects/chatmessenger' },
      { text: ' to a ' },
      { text: 'facial-recognition attendance system', link: '/projects/student-management-system' },
      { text: '.' },
    ],
    [
      {
        text: 'Before that I spent a year and a half as an Ionic Angular developer at Learn2Earn Tech, and two years as an aviation technician in the Pakistan Air Force, where precision and checklists were not optional. I bring the same discipline to code.',
      },
    ],
  ] satisfies BioPart[][],
  stats: [
    { value: '7', suffix: '+', label: 'Production applications delivered' },
    { value: '4', suffix: '', label: 'Public sites on one multi-tenant backend' },
  ],
  /** Its own waist-up image (the hero uses the full-length cut-out). Replace the file to use another photo. */
  portrait: {
    src: '/assets/images/about-portrait-842.webp',
    /** Rendered at most 408 CSS px wide (.about__portrait), so 1x screens get the 320px file. */
    srcset: '/assets/images/about-portrait-480.webp 480w, /assets/images/about-portrait-842.webp 842w',
    sizes: '(min-width: 440px) 408px, calc(100vw - 2rem)',
    alt: 'Portrait of Muhammad Asif',
    width: 842,
    height: 1056,
  },
} as const;
