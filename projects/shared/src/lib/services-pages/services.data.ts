/*
 * Service pages (/services/<slug>), Phase 3.4 of PORTFOLIO_TRAFFIC_PLAN.md. Each targets one commercial
 * search from the Keyword Planner export (portfolio/stats). Copy must stay unique per page and every claim
 * must be backed by a real case study. The backend keeps a verbatim copy at
 * portfolio-node/src/data/services.data.ts for sitemap.xml and llms.txt (run `npm run sync:tools`).
 * Keep it import-free.
 */

export interface ServicePage {
  slug: string;
  name: string;
  h1: string;
  /** <= 60 characters. */
  title: string;
  /** <= 155 characters. */
  description: string;
  keyword: string;
  intro: string[];
  included: string[];
  process: { step: string; detail: string }[];
  tech: string[];
  /** Case studies that prove the service: slug, title and why it is relevant. */
  caseStudies: { slug: string; title: string; why: string }[];
  /** Tool slugs to link (internal links). */
  tools: string[];
  faq: { q: string; a: string }[];
  updatedAt: string;
}

export const SERVICES_PATH = '/services';

export const SERVICES_HUB = {
  title: 'MEAN Stack Development Services | Asif Dev',
  description:
    'Hire a freelance MEAN stack developer: Angular SSR, Node.js and Express APIs, Stripe e-commerce and Ionic mobile apps, built for production.',
  h1: 'Development services',
  intro:
    'I build production web applications end to end on MongoDB, Express, Angular and Node.js. Pick the service closest to your project; every page links to the case studies behind it.',
  updatedAt: '2026-11-05',
} as const;

const D = '2026-11-05';

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: 'angular-ssr-development',
    name: 'Angular SSR Development',
    h1: 'Angular SSR Development for Fast, Indexable Sites',
    title: 'Angular SSR Developer for Hire | Asif Dev',
    description:
      'Hire an Angular SSR developer: server-side rendering, hydration, real status codes and Core Web Vitals work so your Angular app ranks and loads fast.',
    keyword: 'angular ssr developer',
    intro: [
      'A client-rendered Angular app sends search engines and social previews an almost empty HTML shell. Server-side rendering fixes that: every route arrives as complete HTML with its own title, description, canonical and structured data, and Angular hydrates it in the browser without re-rendering.',
      'I build new Angular apps with SSR from the first commit and move existing ones over. The work goes beyond switching SSR on: browser-only code has to be isolated, error pages must return real 404 and 503 status codes, API data has to be fetched once on the server and reused on hydration, and third-party scripts must stay off the critical path so Core Web Vitals hold up.',
    ],
    included: [
      'Angular SSR setup or migration (standalone components, signals, incremental hydration)',
      'Per-route SEO: title, meta description, canonical, Open Graph and JSON-LD',
      'Real HTTP status codes from SSR (404, 503) and noindex on error pages',
      'HTTP transfer cache so API calls are not repeated after hydration',
      'Fixes for SSR-only errors such as "window is not defined"',
      'Sitemap, robots.txt and edge caching for rendered pages',
    ],
    process: [
      { step: 'Audit', detail: 'I crawl the current app as Googlebot sees it and list what is missing from the raw HTML, which routes return the wrong status, and what slows the first render.' },
      { step: 'Render on the server', detail: 'Enable SSR, guard browser-only APIs, and make every page set its own SEO and status code from real data.' },
      { step: 'Make it fast', detail: 'Transfer cache, lazy routes, deferred third-party scripts and image sizing, then measure on mobile Lighthouse.' },
      { step: 'Verify and hand over', detail: 'Check the rendered HTML with curl, validate structured data, submit the sitemap and document the deployment.' },
    ],
    tech: ['Angular 20/21', 'Angular SSR', 'Signals', 'NgRx', 'Express', 'Tailwind CSS', 'Docker', 'nginx'],
    caseStudies: [
      { slug: 'city-of-new-britain-digital-ecosystem', title: 'City of New Britain Digital Ecosystem', why: 'Four independent Angular SSR sites on one backend, with a full performance, SEO and compliance overhaul.' },
      { slug: 'wavy-cables', title: 'Wavy Cables', why: 'A near-total rewrite of an e-commerce site on Angular 21 with SSR.' },
    ],
    tools: ['http-status-codes', 'json-to-typescript'],
    faq: [
      { q: 'Does Angular SSR help SEO?', a: 'Yes. Crawlers and link previews get complete HTML with per-page metadata instead of an empty shell, and pages can return real status codes. Rankings still depend on content and links.' },
      { q: 'Can you add SSR to my existing Angular app?', a: 'Usually yes. The main work is isolating code that touches window, document or localStorage, and making data loading work on the server.' },
      { q: 'Where can an Angular SSR app be hosted?', a: 'Anywhere that runs Node.js: a VPS with Docker and nginx, Vercel, Render or a cloud container service. I set up whichever fits your budget.' },
      { q: 'Will SSR slow my server down?', a: 'Rendering costs some CPU per request, so I add edge caching for public pages and keep rendering fast by avoiding repeated API calls.' },
    ],
    updatedAt: D,
  },
  {
    slug: 'mean-stack-development',
    name: 'MEAN Stack Development',
    h1: 'Freelance MEAN Stack Developer for Full Web Apps',
    title: 'Hire a Freelance MEAN Stack Developer | Asif Dev',
    description:
      'Hire a freelance MEAN stack developer to build your web app end to end: MongoDB, Express, Angular and Node.js, plus the admin panel and deployment.',
    keyword: 'mean stack developer',
    intro: [
      'MEAN means one language from the database to the browser: MongoDB stores JSON-like documents, Express and Node.js serve the API, and Angular renders the interface. With one developer owning the whole stack, the data model, API contract and screens are designed together, so there is no hand-off where details get lost.',
      'I take projects from the first sketch to production: data model, API, public front end, the admin panel your team will use every day, and the deployment. I have shipped this stack for a city government, e-commerce brands and SaaS products, and I keep the code typed and validated end to end so it stays maintainable after I hand it over.',
    ],
    included: [
      'MongoDB data modelling with indexes designed around your queries',
      'Node.js and Express API with Zod validation, authentication and roles',
      'Angular front end with SSR where search traffic matters',
      'Admin panel for content, users, orders or tickets',
      'File uploads, email, payments and third-party integrations',
      'Docker-based deployment, CI and documentation',
    ],
    process: [
      { step: 'Scope', detail: 'We agree on the users, the core flows and what version one must do, and I turn that into a data model and an API outline.' },
      { step: 'Build in slices', detail: 'Each feature ships through the whole stack (schema, endpoint, screen) so you can try it early on a staging URL.' },
      { step: 'Harden', detail: 'Validation, rate limiting, error handling, logging and tests on the parts that would hurt most if they broke.' },
      { step: 'Launch and support', detail: 'Deploy, monitor the first weeks, and hand over with documentation, or keep going on a monthly basis.' },
    ],
    tech: ['MongoDB', 'Mongoose', 'Express 5', 'Node.js', 'Angular', 'TypeScript', 'Zod', 'Docker'],
    caseStudies: [
      { slug: 'city-of-new-britain-digital-ecosystem', title: 'City of New Britain Digital Ecosystem', why: 'One multi-tenant Node.js and MongoDB backend and one Angular admin panel powering four public sites.' },
      { slug: 'mycityhelp', title: 'MyCityHelp', why: 'A helpdesk SaaS with role-gated access and real-time ticket notifications.' },
    ],
    tools: ['json-to-mongoose-schema', 'objectid-to-date', 'json-to-typescript'],
    faq: [
      { q: 'What is a MEAN stack developer?', a: 'A developer who builds the whole application on MongoDB, Express, Angular and Node.js: database, API and front end.' },
      { q: 'Do you work with existing codebases?', a: 'Yes. Several of my projects were rebuilds or extensions of existing apps. I start with a short code review so we know what to keep.' },
      { q: 'How do you price a project?', a: 'Fixed price for a well-defined scope, or hourly for open-ended work. Send a short brief through the contact form for an estimate.' },
      { q: 'Which time zone do you work in?', a: 'Pakistan Standard Time (UTC+5). I already work with clients abroad, including a city in Connecticut, USA, and communicate in English by email and chat.' },
      { q: 'Will I own the code?', a: 'Yes. The code lives in your repository and is yours, with documentation for running and deploying it.' },
    ],
    updatedAt: D,
  },
  {
    slug: 'ecommerce-development-stripe',
    name: 'E-commerce Development with Stripe',
    h1: 'Custom E-commerce Development with Stripe Checkout',
    title: 'Custom E-commerce with Stripe and Angular | Asif Dev',
    description:
      'Custom e-commerce on Angular and Node.js with Stripe checkout: product configurators, order flows and the admin back office to run your store.',
    keyword: 'stripe node js developer',
    intro: [
      'Off-the-shelf store builders are fine until your product does not fit their model: a configurator with dozens of options, a seasonal pre-order module, delivery slots or prices that depend on choices. A custom store on Angular and Node.js handles those rules exactly, and Stripe handles the payments securely so card data never touches your server.',
      'I build the storefront, the checkout and the back office together. Stripe Checkout or Payment Element on the front, webhooks on the server so an order is only marked paid when Stripe confirms it, and an admin panel for orders, delivery, products and marketing. Pages are server-rendered so product and category pages can rank.',
    ],
    included: [
      'Server-rendered Angular storefront with product, category and cart pages',
      'Stripe Checkout or Payment Element, with webhook-confirmed orders',
      'Product configurators and custom pricing rules',
      'Admin back office for orders, delivery, inventory and promotions',
      'Order and receipt emails, reCAPTCHA and rate limiting on forms',
      'Product structured data and sitemap for search',
    ],
    process: [
      { step: 'Model the catalogue', detail: 'Products, options, prices and stock rules first, because checkout and admin depend on them.' },
      { step: 'Checkout and webhooks', detail: 'Stripe integration with idempotent webhook handling, so retries never create duplicate orders.' },
      { step: 'Back office', detail: 'The screens your team uses daily: order status, delivery, refunds and reports.' },
      { step: 'Launch', detail: 'Test mode end to end, then live keys, monitoring of failed payments and a short training session.' },
    ],
    tech: ['Angular 21', 'Angular SSR', 'NgRx', 'Node.js', 'Express', 'MongoDB', 'Stripe', 'Tailwind CSS'],
    caseStudies: [
      { slug: 'wavy-cables', title: 'Wavy Cables', why: 'E-commerce for a custom audio-cable maker, with a build-your-own-cable configurator (840 combinations).' },
      { slug: 'khan-meat-pointe', title: 'Khan Meat Pointe', why: 'Halal meat delivery store with delivery slots, proof of delivery, a seasonal Qurbani module and a full admin back office.' },
    ],
    tools: ['http-status-codes', 'json-to-mongoose-schema'],
    faq: [
      { q: 'Stripe Checkout or a custom payment form?', a: 'Stripe Checkout is fastest and handles compliance for you. Payment Element keeps the customer on your page. I recommend based on your design and countries.' },
      { q: 'How do you prevent duplicate or unpaid orders?', a: 'Orders are confirmed by Stripe webhooks, verified by signature and processed idempotently, never by the browser redirect alone.' },
      { q: 'Can you migrate my existing store?', a: 'Yes. Wavy Cables was rebuilt from an older Angular build. Products, customers and URLs can be migrated, with redirects for changed URLs.' },
      { q: 'Is Stripe available in my country?', a: 'Stripe supports many countries, but not all. If it is not available for your business, we can use another provider with the same webhook approach.' },
    ],
    updatedAt: D,
  },
  {
    slug: 'node-express-api-development',
    name: 'Node.js and Express API Development',
    h1: 'Node.js and Express API Development',
    title: 'Node.js Express API Developer for Hire | Asif Dev',
    description:
      'Hire a Node.js developer for secure Express REST APIs: Zod validation, JWT and role-based access, rate limiting, MongoDB and real-time WebSockets.',
    keyword: 'node js developer',
    intro: [
      'An API is a contract that your web app, mobile app and partners all depend on. I build Express APIs in TypeScript where every input is validated at the edge, every error maps to the right HTTP status code, and every public route is rate limited, so the API behaves predictably under real traffic and real attackers.',
      'Typical work includes authentication with short-lived JWTs and refresh tokens, two-factor login for admin users, role-based permissions checked on the server, multi-tenant data isolation, file uploads to object storage, and WebSocket channels for live features such as chat, presence and notifications.',
      'I also take over existing Node.js APIs that have grown hard to change: adding validation and tests around the risky parts first, then fixing slow queries with the right MongoDB indexes, and replacing ad-hoc error handling with one consistent format your front end can rely on.',
    ],
    included: [
      'REST API design and documentation',
      'Zod validation and consistent error responses',
      'Authentication: JWT, refresh tokens, TOTP two-factor and RBAC',
      'Multi-tenant data isolation on MongoDB',
      'Real-time features over WebSockets',
      'Rate limiting, logging, health checks and Docker deployment',
    ],
    process: [
      { step: 'Contract first', detail: 'Resources, endpoints, payloads and error codes agreed before code, so front-end work can start in parallel.' },
      { step: 'Secure by default', detail: 'Validation, auth, authorisation and rate limits are part of every endpoint, not a later phase.' },
      { step: 'Test what matters', detail: 'Integration tests against a real database for auth, permissions and money flows.' },
      { step: 'Operate', detail: 'Structured logs, health checks and graceful shutdown so the API can be deployed and debugged calmly.' },
    ],
    tech: ['Node.js', 'Express 5', 'TypeScript', 'Zod', 'MongoDB', 'Mongoose', 'WebSockets', 'Docker'],
    caseStudies: [
      { slug: 'city-of-new-britain-digital-ecosystem', title: 'City of New Britain Digital Ecosystem', why: 'One multi-tenant Node.js and MongoDB API serving four public sites and a shared admin panel.' },
      { slug: 'chatmessenger', title: 'ChatMessenger', why: 'Multi-tenant, Slack-style chat with presence, typing indicators and read receipts over WebSockets.' },
    ],
    tools: ['jwt-decoder', 'http-status-codes', 'cron-expression-explainer'],
    faq: [
      { q: 'REST or GraphQL?', a: 'REST suits most business apps and caches well. I use GraphQL only when many clients need very different shapes of the same data.' },
      { q: 'How do you secure an Express API?', a: 'Validate every input, authenticate with short-lived tokens, check permissions on every request, rate-limit public routes and never leak internal errors.' },
      { q: 'Can you add features to my existing Node.js API?', a: 'Yes. I start by reading the code and adding tests around the area I will change.' },
      { q: 'Do you build real-time features?', a: 'Yes: chat, presence, live dashboards and notifications over WebSockets, as in ChatMessenger and MyCityHelp.' },
    ],
    updatedAt: D,
  },
  {
    slug: 'ionic-angular-mobile-apps',
    name: 'Ionic Angular Mobile Apps',
    h1: 'Ionic and Angular Mobile App Development',
    title: 'Ionic Angular App Developer for Hire | Asif Dev',
    description:
      'Hybrid mobile apps with Ionic, Angular and Capacitor: one codebase for Android, iOS and web, sharing your existing API and design system.',
    keyword: 'ionic angular developer',
    intro: [
      'If you already have an Angular web app or a team that knows Angular, Ionic with Capacitor is the shortest path to Android and iOS apps. One TypeScript codebase produces the web app and both native apps, uses the same API, and reaches native features such as the camera, push notifications and file storage through Capacitor plugins.',
      'I spent a year and a half as an Ionic Angular developer before moving to full-stack work, and I still use Capacitor where a project needs a mobile client. I focus on what makes hybrid apps feel native: fast startup, offline-tolerant screens, correct safe areas and gestures, and builds that pass store review.',
    ],
    included: [
      'Ionic Angular app for Android, iOS and web from one codebase',
      'Capacitor plugins: camera, push notifications, storage, geolocation',
      'Shared API client and models with your web app',
      'Offline-tolerant screens and background sync where needed',
      'App store builds, signing and release guidance',
      'Updates to existing Ionic and Cordova apps',
    ],
    process: [
      { step: 'Reuse first', detail: 'Identify which web screens, services and models can be shared, so the mobile app costs less.' },
      { step: 'Native where it counts', detail: 'Pick Capacitor plugins for device features and design screens for touch and small viewports.' },
      { step: 'Test on devices', detail: 'Real Android and iOS devices, not only emulators, including slow networks.' },
      { step: 'Release', detail: 'Store listings, signing, staged rollout and crash reporting.' },
    ],
    tech: ['Ionic', 'Angular', 'Capacitor', 'TypeScript', 'Node.js API', 'Push notifications'],
    caseStudies: [
      { slug: 'student-management-system', title: 'Student Management System', why: 'Admin, teacher and student portals with Capacitor and real-time facial-recognition attendance.' },
      { slug: 'aa-bridal-studio', title: 'AA Bridal Studio', why: 'Booking platform with appointment requests, owner and artist roles and live notifications over WebSockets.' },
    ],
    tools: ['json-to-typescript', 'jwt-decoder'],
    faq: [
      { q: 'Ionic or React Native or Flutter?', a: 'If your team and web app are Angular, Ionic reuses the most. For graphics-heavy apps a fully native toolkit can be better; I will tell you honestly.' },
      { q: 'Do Ionic apps feel native?', a: 'For business apps, yes, when built carefully: native navigation patterns, fast startup and Capacitor plugins for device features.' },
      { q: 'Can you publish to the App Store and Google Play?', a: 'Yes. I prepare signed builds and guide you through store listings under your own developer accounts.' },
      { q: 'Can my existing web app become a mobile app?', a: 'Often a large part of it can. We review which screens need a mobile-specific design.' },
    ],
    updatedAt: D,
  },
];

export const serviceBySlug = (slug: string): ServicePage | undefined => SERVICE_PAGES.find((s) => s.slug === slug);
