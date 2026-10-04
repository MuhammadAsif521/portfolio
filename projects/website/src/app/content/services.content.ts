/** "What I Do" (brief, Part 6). Edit copy here; the section renders whatever is listed. */
export interface ServiceItem {
  title: string;
  summary: string;
  /** Short capability tags shown as chips. */
  points: string[];
  /** Lucide icon name: the card's notch badge, and its screen until card artwork exists. */
  icon: string;
  /** Optional artwork (e.g. a WebP from the CDN); the icon panel is used when absent. */
  image?: { src: string; alt: string; width: number; height: number };
}

/** What a MEAN-stack developer delivers, front to back. Shown in the swipeable carousel. */
export const SERVICES_CONTENT = {
  eyebrow: 'My',
  title: 'Services',
  intro:
    'Production systems end to end — from server-rendered Angular front ends to the Node and MongoDB APIs and admin tools behind them.',
  items: [
    {
      title: 'Full-Stack MEAN Web Apps',
      summary: 'Complete web applications on MongoDB, Express, Angular and Node, from first sketch to production.',
      points: ['MongoDB', 'Express', 'Angular', 'Node.js'],
      icon: 'layers',
    },
    {
      title: 'Angular Front-End & SSR',
      summary: 'Fast, SEO-friendly Angular apps with server-side rendering, hydration and clean state management.',
      points: ['Angular SSR', 'NgRx', 'Tailwind', 'Core Web Vitals'],
      icon: 'monitor-smartphone',
    },
    {
      title: 'REST APIs & Backend',
      summary: 'Secure, validated Node.js/Express APIs with authentication, roles and rate limiting built in.',
      points: ['Node.js / Express', 'Zod validation', 'JWT & RBAC'],
      icon: 'server',
    },
    {
      title: 'MongoDB Database Design',
      summary: 'Schemas, indexes and aggregation pipelines designed for your queries, not the other way round.',
      points: ['Data modelling', 'Indexes', 'Aggregation'],
      icon: 'database',
    },
    {
      title: 'E-Commerce Platforms',
      summary: 'Storefronts that sell: checkout, catalogue and order flows, plus the admin back office to run them.',
      points: ['Stripe checkout', 'Orders & inventory', 'Admin back office'],
      icon: 'shopping-bag',
    },
    {
      title: 'Real-Time Applications',
      summary: 'Live features over WebSockets: chat, presence, live dashboards and instant notifications.',
      points: ['WebSockets', 'Chat & presence', 'Live updates'],
      icon: 'radio-tower',
    },
    {
      title: 'Hybrid Mobile Apps',
      summary: 'Ionic and Angular apps for Android and iOS from one codebase, sharing your web app’s APIs.',
      points: ['Ionic', 'Capacitor', 'Push notifications'],
      icon: 'smartphone',
    },
    {
      title: 'Deployment & DevOps',
      summary: 'Dockerised builds, nginx and CI pipelines so releases are repeatable and boring.',
      points: ['Docker', 'nginx', 'CI/CD'],
      icon: 'container',
    },
  ] satisfies ServiceItem[],
} as const;
