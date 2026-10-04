/** Blog section, /blog and /blog/:slug (brief, Parts 4/6). Posts themselves come from cusadmin. */
export const BLOG_CONTENT = {
  home: {
    title: 'From my blog post',
    seeAll: 'See All',
    limit: 3,
    /**
     * Shown only while no post is published, clearly marked as upcoming (brief: "Placeholder until
     * Asif drafts real posts"). Never rendered as links or as real posts.
     */
    upcoming: [
      'Building a Multi-Tenant Backend with One Express API',
      'Angular SSR + NgRx: Lessons from Production',
      'Gating Third-Party Scripts Behind Real Cookie Consent',
    ],
    upcomingLabel: 'Coming soon',
  },
  list: {
    title: 'Blog',
    /** <title> of /blog (page 1, no tag filter); the site name is appended. */
    pageTitle: 'Angular & Node.js Blog',
    intro: 'Notes from building production Angular and Node systems: architecture, SSR, performance and the details that ship.',
    pageSize: 9,
    allTags: 'All',
    empty: 'No posts published yet. Check back soon.',
    emptyTag: 'No posts with this tag yet.',
    emptyPage: 'There are no posts on this page.',
    firstPage: 'Back to the first page',
    previous: 'Previous',
    next: 'Next',
    errorTitle: 'Could not load the blog',
  },
  post: {
    backLabel: 'All posts',
    minutes: 'min read',
    notFoundTitle: 'Post not found',
    notFoundText: 'This post may have moved or is not published yet.',
    errorTitle: 'Could not load this post',
    ctaTitle: 'Want this kind of work on your project?',
    ctaText: 'I build production Angular and Node systems. Tell me what you need.',
    ctaLabel: "Let's discuss",
  },
} as const;
