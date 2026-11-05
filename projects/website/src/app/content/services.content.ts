/**
 * "My Services" (home section and /services hub). One card per service page in services.data.ts: `page`
 * is that page's slug, and the whole card links to /services/<slug>. Edit card copy here.
 */
export interface ServiceItem {
  /** Slug of the /services/<slug> page (shared services.data.ts). */
  page: string;
  title: string;
  summary: string;
  /** Short capability tags shown as chips. */
  points: string[];
  /** Lucide icon name: the card's notch badge and its content panel. */
  icon: string;
}

export const SERVICES_CONTENT = {
  eyebrow: 'My',
  title: 'Services',
  intro:
    'Production systems end to end, from server-rendered Angular front ends to the Node and MongoDB APIs and admin tools behind them.',
  /** Every service, in /services order. */
  items: [
    {
      page: 'mean-stack-development',
      title: 'Full-Stack MEAN Web Apps',
      summary: 'Complete web applications on MongoDB, Express, Angular and Node, from first sketch to production.',
      points: ['MongoDB', 'Express', 'Angular', 'Node.js'],
      icon: 'layers',
    },
    {
      page: 'angular-ssr-development',
      title: 'Angular Front-End & SSR',
      summary: 'Fast, SEO-friendly Angular apps with server-side rendering, hydration and clean state management.',
      points: ['Angular SSR', 'NgRx', 'Tailwind', 'Core Web Vitals'],
      icon: 'monitor-smartphone',
    },
    {
      page: 'node-express-api-development',
      title: 'REST APIs & Backend',
      summary: 'Secure, validated Node.js/Express APIs with authentication, roles and rate limiting built in.',
      points: ['Node.js / Express', 'Zod validation', 'JWT & RBAC'],
      icon: 'server',
    },
    {
      page: 'ecommerce-development-stripe',
      title: 'E-Commerce Platforms',
      summary: 'Storefronts that sell: checkout, catalogue and order flows, plus the admin back office to run them.',
      points: ['Stripe checkout', 'Orders & inventory', 'Admin back office'],
      icon: 'shopping-bag',
    },
    {
      page: 'admin-dashboard-development',
      title: 'Admin Panels & Dashboards',
      summary: 'Role-based admin panels and dashboards on Angular, Node.js and MongoDB for your own team.',
      points: ['Role-based access', 'Data tables', 'Reports & activity log'],
      icon: 'layout-dashboard',
    },
    {
      page: 'real-time-websocket-apps',
      title: 'Real-Time Applications',
      summary: 'Chat, presence and live notifications over WebSockets that update the screen instantly.',
      points: ['WebSockets', 'Chat & presence', 'Live notifications'],
      icon: 'radio-tower',
    },
    {
      page: 'ionic-angular-mobile-apps',
      title: 'Hybrid Mobile Apps',
      summary: 'Ionic and Angular apps for Android and iOS from one codebase, sharing your web app’s APIs.',
      points: ['Ionic', 'Capacitor', 'Push notifications'],
      icon: 'smartphone',
    },
    {
      page: 'docker-nginx-deployment',
      title: 'Docker & nginx Deployment',
      summary: 'Docker Compose and nginx setups that make releases repeatable, with health checks and backups.',
      points: ['Docker Compose', 'nginx', 'Backups & runbook'],
      icon: 'container',
    },
  ] satisfies ServiceItem[],
  /** The strongest services shown on the home page (slugs of `items`); the rest live on /services. */
  featured: [
    'mean-stack-development',
    'angular-ssr-development',
    'node-express-api-development',
    'ecommerce-development-stripe',
  ],
  allLabel: 'View all services',
} as const;
