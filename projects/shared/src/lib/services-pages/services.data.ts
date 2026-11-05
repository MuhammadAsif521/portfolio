/*
 * Service pages (/services/<slug>). Each targets one commercial
 * search from the Google Keyword Planner research. Copy must stay unique per page and every claim
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
  /** Lucide icon name for the service card (must be listed in the website's core/icons.ts). */
  icon: string;
  /** One short line for the service card on the home page and the /services hub. */
  summary: string;
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
    'Hire a freelance MEAN stack developer: Angular SSR, Node.js APIs, Stripe e-commerce, admin dashboards, real-time apps, Ionic apps and Docker deployment.',
  h1: 'Development services',
  intro:
    'I build production web applications end to end on MongoDB, Express, Angular and Node.js. Pick the service closest to your project; each page explains what is included, how we work and the case studies behind it.',
  updatedAt: '2026-11-05',
} as const;

const D = '2026-11-05';

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: 'mean-stack-development',
    name: 'MEAN Stack Development',
    h1: 'Freelance MEAN Stack Developer for Full Web Apps',
    title: 'Hire a Freelance MEAN Stack Developer | Asif Dev',
    description:
      'Hire a freelance MEAN stack developer to build your web app end to end: MongoDB, Express, Angular and Node.js, plus the admin panel and deployment.',
    keyword: 'mean stack developer',
    icon: 'layers',
    summary: 'Full web apps on MongoDB, Express, Angular and Node.js.',
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
      { slug: 'mycityhelp', title: 'MyCityHelp', why: 'A helpdesk SaaS with role-gated access and real-time ticket notifications.' },
    ],
    tools: ['json-to-mongoose-schema', 'objectid-to-date', 'json-to-typescript'],
    faq: [
      { q: 'What is a MEAN stack developer?', a: 'A developer who builds the whole application on MongoDB, Express, Angular and Node.js: database, API and front end.' },
      { q: 'Do you work with existing codebases?', a: 'Yes. Several of my projects were rebuilds or extensions of existing apps. I start with a short code review so we know what to keep.' },
      { q: 'How do you price a project?', a: 'Fixed price for a well-defined scope, or hourly for open-ended work. Send a short brief through the contact form for an estimate.' },
      { q: 'Which time zone do you work in?', a: 'Pakistan Standard Time (UTC+5). I already work with clients abroad and communicate in English by email and chat.' },
      { q: 'Will I own the code?', a: 'Yes. The code lives in your repository and is yours, with documentation for running and deploying it.' },
    ],
    updatedAt: D,
  },
  {
    slug: 'angular-ssr-development',
    name: 'Angular SSR Development',
    h1: 'Angular SSR Development for Fast, Indexable Sites',
    title: 'Angular SSR Developer for Hire | Asif Dev',
    description:
      'Hire an Angular SSR developer: server-side rendering, hydration, real status codes and Core Web Vitals work so your Angular app ranks and loads fast.',
    keyword: 'angular ssr developer',
    icon: 'monitor-smartphone',
    summary: 'Fast, indexable Angular apps with server-side rendering.',
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
    slug: 'node-express-api-development',
    name: 'Node.js and Express API Development',
    h1: 'Node.js and Express API Development',
    title: 'Node.js Express API Developer for Hire | Asif Dev',
    description:
      'Hire a Node.js developer for secure Express REST APIs: Zod validation, JWT and role-based access, rate limiting, MongoDB and real-time WebSockets.',
    keyword: 'node js developer',
    icon: 'server',
    summary: 'Secure Express APIs with validation, JWT and roles.',
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
    slug: 'ecommerce-development-stripe',
    name: 'E-commerce Development with Stripe',
    h1: 'Custom E-commerce Development with Stripe Checkout',
    title: 'Custom E-commerce with Stripe and Angular | Asif Dev',
    description:
      'Custom e-commerce on Angular and Node.js with Stripe checkout: product configurators, order flows and the admin back office to run your store.',
    keyword: 'stripe node js developer',
    icon: 'shopping-bag',
    summary: 'Custom online stores with Stripe checkout and a back office.',
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
    slug: 'admin-dashboard-development',
    name: 'Admin Panel and Dashboard Development',
    h1: 'Admin Panel and Dashboard Development with Angular',
    title: 'Angular Admin Dashboard Developer | Asif Dev',
    description:
      'Custom admin panels and dashboards on Angular, Node.js and MongoDB: role-based access, audit logs, reports and the tools your team uses every day.',
    keyword: 'admin dashboard developer',
    icon: 'layout-dashboard',
    summary: 'Role-based admin panels and dashboards for your team.',
    intro: [
      'An admin panel is the part of your product that your own team opens every morning. It decides how fast orders ship, how quickly tickets are answered and how much a mistake costs, so it deserves the same care as the public site. I build admin panels and dashboards in Angular on top of a Node.js and MongoDB API, designed around the people who use them: an owner, a stylist, a delivery driver, a support agent.',
      'The hard part is permissions and workflow, not the tables. Each role should see only its own screens and only the actions it may take, enforced on the API and not just hidden in the interface. Orders, bookings or tickets should move through clear statuses, and every change should leave a record, so you can always answer who did what and when. I have built panels from a three-role delivery back office to a city-wide admin with 38 resource types and 142 permission keys.',
    ],
    included: [
      'Role-based access with permission keys checked on every API request, and role-guarded routes in Angular',
      'Data tables with server-side pagination, sorting, filtering and search',
      'Order, booking and ticket workflows with clear status changes and live notifications',
      'Calendar views and CSV, XLSX or PDF reports',
      'Activity log of every admin change, plus two-step sign-in for staff accounts',
      'Charts and summary cards for the numbers you check daily',
    ],
    process: [
      { step: 'Know the users', detail: 'We list who will use the panel, what each role does in a day and which actions must be restricted, before any screen is designed.' },
      { step: 'Model roles and data', detail: 'Permissions and resources are defined once on the API, so every new screen inherits validation, access checks and audit logging.' },
      { step: 'Build the daily workflows', detail: 'The screens used most, such as order handling, scheduling or ticket replies, are built first and tried by your team on a staging URL.' },
      { step: 'Report and refine', detail: 'Reports, filters and shortcuts are added from real use, then the panel is documented for new staff.' },
    ],
    tech: ['Angular', 'Angular Material', 'PrimeNG', 'NgRx', 'Chart.js', 'Node.js', 'Express', 'MongoDB', 'Tailwind CSS'],
    caseStudies: [
      { slug: 'khan-meat-pointe', title: 'Khan Meat Pointe', why: 'A back office for Admin, Delivery Partner and Butcher roles, with order batching and CSV, XLSX and PDF reports.' },
      { slug: 'wavy-cables', title: 'Wavy Cables', why: 'An admin app for products, categories, orders, custom orders, discounts and customers on role-guarded routes.' },
      { slug: 'aa-bridal-studio', title: 'AA Bridal Studio', why: 'A role-aware dashboard for the owner and the artists, with a calendar and live notifications.' },
    ],
    tools: ['jwt-decoder', 'json-to-typescript'],
    faq: [
      { q: 'What should an admin panel include?', a: 'At minimum: sign-in with roles, lists you can search and filter, forms with validation, status workflows for your core records and an activity log. Reports, calendars and charts come next, based on what your team checks daily.' },
      { q: 'Can you add an admin panel to my existing website or API?', a: 'Yes. If you already have a Node.js API I build the Angular panel against it; if you do not, I build both. A short review of the existing data and endpoints comes first.' },
      { q: 'How do you handle roles and permissions?', a: 'Permissions are checked on the server for every request, and the Angular routes mirror them so people only see screens they may use. Roles stay easy to change as your team grows.' },
      { q: 'Do you use a template or build from scratch?', a: 'I build with Angular Material or PrimeNG components and Tailwind CSS, so the panel looks consistent and stays accessible, but the screens and workflows are designed for your process rather than copied from a template.' },
    ],
    updatedAt: D,
  },
  {
    slug: 'real-time-websocket-apps',
    name: 'Real-Time Web Apps with WebSockets',
    h1: 'Real-Time Web App Development with Node.js and WebSockets',
    title: 'WebSocket Real-Time App Developer | Asif Dev',
    description:
      'Real-time chat, presence, live notifications and dashboards with Node.js and WebSockets, built into Angular apps that stay in sync without refreshing.',
    keyword: 'websockets in node js',
    icon: 'radio-tower',
    summary: 'Chat, presence and live notifications that update instantly.',
    intro: [
      'Some features cannot wait for a page refresh: a chat message, a new support ticket, an appointment request, an attendance mark. WebSockets keep one connection open between the browser and the server, so the server can push an update the moment something happens instead of the page asking again and again. Done well, the app feels instant. Done badly, it drops messages, shows duplicates and drains batteries.',
      'I build the real-time layer as a first-class part of the app. That starts with an event contract, since every message type needs a clear shape, and continues with a single socket service in Angular that reconnects after a drop, avoids duplicate messages and keeps the interface in sync using signals and RxJS. Large uploads travel over normal HTTP requests so they never block the live channel.',
    ],
    included: [
      'Chat with private and group rooms, presence, typing indicators and read receipts',
      'Live notifications that arrive as a snapshot first and then one push per event',
      'Automatic reconnection and message de-duplication',
      'Cursor-based message history so long conversations stay fast',
      'Attachments uploaded over HTTP and referenced by id over the socket',
      'Live camera streams where the app needs them',
    ],
    process: [
      { step: 'Define the events', detail: 'We list every event the app sends and receives, with its payload and who may see it, so client and server agree before coding.' },
      { step: 'Build one socket layer', detail: 'A single service owns connecting, authenticating, reconnecting and routing events, so screens only subscribe to what they need.' },
      { step: 'Handle the bad days', detail: 'Dropped connections, duplicate events, sleeping tabs and slow networks are tested on purpose instead of being found by users.' },
      { step: 'Ship and watch', detail: 'Deploy behind nginx with proxy settings that allow connection upgrades, then watch connection counts and errors in the first weeks.' },
    ],
    tech: ['WebSockets', 'Node.js', 'Express', 'Angular', 'RxJS', 'Signals', 'TypeScript', 'nginx'],
    caseStudies: [
      { slug: 'chatmessenger', title: 'ChatMessenger', why: 'Multi-tenant team chat on native WebSockets, with presence, typing indicators, read receipts and attachments.' },
      { slug: 'student-management-system', title: 'Student Management System', why: 'A teacher camera streams frames over WebSockets, and face-recognition matches appear in the lecture view live.' },
      { slug: 'mycityhelp', title: 'MyCityHelp', why: 'Real-time ticket notifications over WebSockets that reconnect on their own and are grouped per ticket.' },
      { slug: 'aa-bridal-studio', title: 'AA Bridal Studio', why: 'Live appointment notifications in the staff dashboard and the website header.' },
    ],
    tools: ['jwt-decoder', 'json-to-typescript'],
    faq: [
      { q: 'When should I use WebSockets instead of polling?', a: 'Use WebSockets when updates must appear within a second or two and arrive unpredictably, such as chat or alerts. For data that changes every few minutes, plain polling or a page refresh is simpler and cheaper.' },
      { q: 'Do I need Socket.IO or are native WebSockets enough?', a: 'Native WebSockets are enough for most business apps and keep the bundle small; I wrap them in one service with reconnection. Socket.IO helps when you need fallbacks for very restrictive networks.' },
      { q: 'Can WebSockets work with my existing Node.js API?', a: 'Yes. A WebSocket server can run beside your Express API and share its authentication, so a user token or session decides what each person may receive.' },
      { q: 'How do WebSockets behave behind nginx or a load balancer?', a: 'They need proxy settings that allow connection upgrades and long-lived connections. With more than one server instance you also need a shared message channel, so every instance can reach every user.' },
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
    icon: 'smartphone',
    summary: 'Android and iOS apps from one Ionic Angular codebase.',
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
  {
    slug: 'docker-nginx-deployment',
    name: 'Docker and nginx Deployment',
    h1: 'Docker and nginx Deployment for Node.js and Angular SSR Apps',
    title: 'Docker & nginx Deployment Developer | Asif Dev',
    description:
      'Deploy Node.js, MongoDB and Angular SSR apps with Docker Compose and nginx: lean images, asset caching, health checks, backups and repeatable releases.',
    keyword: 'node js docker container',
    icon: 'container',
    summary: 'Docker and nginx setups that make releases repeatable.',
    intro: [
      'An app that runs on one laptop is not yet a product. Docker packages the Node.js server, the Angular SSR build and the database into containers that start the same way everywhere, and nginx sits in front to serve static files quickly and pass page requests to the right container. The result is a deployment you can repeat, roll back and hand to someone else.',
      'I set this up as part of the projects I build, and I also take over deployments that only one person understands. The work covers multi-stage images that contain only production dependencies, a Compose file for the API, database and web server, nginx caching for hashed assets, health checks, and scripts that back up the database and uploaded files and restore them.',
    ],
    included: [
      'Multi-stage Dockerfiles for Node.js APIs and Angular SSR servers',
      'Docker Compose for the API, MongoDB and nginx, with health checks',
      'nginx reverse proxy with long-lived caching for hashed assets',
      'Several sites on one platform, each an SSR container plus nginx on a shared Docker network',
      'Backup and restore scripts for the database and uploads, stored in cloud storage',
      'Environment and secrets handling, with a written runbook',
    ],
    process: [
      { step: 'Read the app', detail: 'I check how the app builds and what it needs at runtime: environment variables, ports, uploads, the database and background jobs.' },
      { step: 'Containerise', detail: 'Lean multi-stage images and a Compose file, so a clean machine can start the whole stack with one command.' },
      { step: 'Put nginx in front', detail: 'Add the reverse proxy, caching rules, compression and security headers, then check what the browser actually receives.' },
      { step: 'Make it recoverable', detail: 'Add backups, a restore test and a short runbook covering updates, rollbacks and where to look when something fails.' },
    ],
    tech: ['Docker', 'Docker Compose', 'nginx', 'Node.js', 'MongoDB', 'Angular SSR', 'Google Cloud Storage'],
    caseStudies: [
      { slug: 'social-share', title: 'Social Share', why: 'A Docker Compose stack with nginx, the API, a queue worker, Redis and MongoDB, with hashed assets served with long-lived caching.' },
    ],
    tools: ['http-status-codes', 'cron-expression-explainer'],
    faq: [
      { q: 'Do I need Docker to deploy a Node.js app?', a: 'No, but it removes most works-on-my-machine problems. Docker pins the Node version and dependencies, so the app behaves the same in staging and production, and rollbacks are simple.' },
      { q: 'Why put nginx in front of a Node.js or Angular SSR server?', a: 'nginx serves static files and cached assets far more cheaply than Node does, handles compression and connection limits, and lets several apps share one server and domain.' },
      { q: 'Can you deploy my app to my existing server?', a: 'Yes. I can work on a VPS or cloud server you already pay for, given SSH access, and I write down every step so you are not locked in to me.' },
      { q: 'How do you handle database backups?', a: 'I set up scripts that dump the database and uploaded files to cloud storage, with matching restore scripts, ready to run on a schedule such as cron. Test a restore before you rely on it, because a backup you have never restored is only a hope.' },
    ],
    updatedAt: D,
  },
];

export const serviceBySlug = (slug: string): ServicePage | undefined => SERVICE_PAGES.find((s) => s.slug === slug);
