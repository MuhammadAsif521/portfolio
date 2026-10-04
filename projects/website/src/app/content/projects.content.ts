/** "Projects" (brief, Part 6) and the case-study page. Project data itself comes from cusadmin. */
export const PROJECTS_CONTENT = {
  title: "Let's have a look at my",
  accent: 'Portfolio',
  /** Tech chips shown under the carousel for the active project. */
  maxChips: 6,
  readCase: 'Read the case study',
  /** How many projects the home page asks for (featured first, then the admin's order). */
  homeLimit: 12,
  empty: {
    title: 'Case studies are on their way',
    text: 'Detailed write-ups are being prepared. In the meantime, get in touch and I can walk you through recent work.',
  },
  detail: {
    backLabel: 'All projects',
    updatedLabel: 'Last updated',
    architectureTitle: 'Architecture',
    galleryTitle: 'Gallery',
    liveLabel: 'Visit live site',
    repoLabel: 'View source',
    ctaTitle: 'Have a project like this in mind?',
    ctaText: 'Tell me about it. I usually reply within a day.',
    ctaLabel: "Let's discuss",
    notFoundTitle: 'Project not found',
    notFoundText: 'This case study may have moved or is not published yet.',
    errorTitle: 'Could not load this project',
  },
} as const;
