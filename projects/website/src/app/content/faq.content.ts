import type { BioPart } from './about.content';

export interface FaqItem {
  question: string;
  /** Answer-first, self-contained text; parts with `link` render as internal links. */
  answer: readonly BioPart[];
}

/**
 * FAQ shown on the home page and on /faq (FAQPage JSON-LD). The questions are phrased the way people
 * search ("Do you build MEAN stack apps with Angular SSR?", "Can you build an admin dashboard?") and were
 * picked from the Google Keyword Planner research; each answer states the answer first in 40 to 90 words
 * and links to the service, case study or tool page that goes deeper. Rendered on the server as plain
 * headings and paragraphs, so search engines and AI answer engines can quote each answer on its own.
 *
 * Every statement must stay true and checkable against the projects, experience and contact copy; never
 * quote prices. Keep the city client's name out of this copy (the owner removed it on purpose). Review before editing.
 */
export const FAQ_CONTENT = {
  eyebrow: 'Frequently asked',
  title: 'Questions',
  /** How many questions the home page shows; /faq shows (and marks up) all of them. */
  homeCount: 5,
  allLabel: 'View all questions',
  items: [
    {
      question: 'What development services do you offer?',
      answer: [
        {
          text: 'I build full-stack web applications on the MEAN stack: Angular front ends with server-side rendering, Node.js and Express REST APIs, MongoDB databases, Stripe e-commerce, admin dashboards, real-time apps over WebSockets, Ionic mobile apps, and Docker and nginx deployment. ',
        },
        { text: 'See all services', link: '/services' },
        { text: '.' },
      ],
    },
    {
      question: 'Do you build MEAN stack apps with Angular SSR?',
      answer: [
        {
          text: 'Yes. MEAN stack development is my core work: MongoDB, Express, Angular and Node.js, built end to end. I render Angular on the server so every page ships complete HTML, its own metadata and real status codes, which helps search engines and link previews. Wavy Cables and AA Bridal Studio run on Angular 21 with SSR. Read more about ',
        },
        { text: 'MEAN stack development', link: '/services/mean-stack-development' },
        { text: ' and ' },
        { text: 'Angular SSR development', link: '/services/angular-ssr-development' },
        { text: '.' },
      ],
    },
    {
      question: 'Are you available to hire as a freelance full stack developer?',
      answer: [
        {
          text: 'Yes. I take freelance and contract work, from new builds to features for existing Angular or Node.js apps. I work on Pakistan Standard Time (UTC+5), already work with clients abroad, and communicate in English by email and chat. Send a short brief through the ',
        },
        { text: 'contact form', link: '/', fragment: 'contact' },
        { text: '. I usually reply within a day, and we agree on the scope before any work starts.' },
      ],
    },
    {
      question: 'How much does it cost to hire a Node.js or full stack developer?',
      answer: [
        {
          text: 'I do not publish a price list, because the cost depends on the scope. A well-defined project gets a fixed price, and open-ended work is billed hourly. Describe what you need, any deadline and your budget through the ',
        },
        { text: 'contact form', link: '/', fragment: 'contact' },
        { text: ' and I will reply with an estimate, usually within a day.' },
      ],
    },
    {
      question: 'Can you build a Node.js and Express REST API with MongoDB?',
      answer: [
        {
          text: 'Yes. I build REST APIs in TypeScript on Node.js and Express with MongoDB and Mongoose, including Zod validation, JWT authentication, role-based permissions, rate limiting and WebSockets for live features. I can also add endpoints to an existing API. Details are on the ',
        },
        { text: 'Node.js and Express API development', link: '/services/node-express-api-development' },
        { text: ' page.' },
      ],
    },
    {
      question: 'Can you build an online store with Stripe checkout in Node.js?',
      answer: [
        {
          text: 'Yes. I build custom e-commerce on Angular and Node.js with payments through Stripe, created on the server so the storefront never handles card details. Both ',
        },
        { text: 'Wavy Cables', link: '/projects/wavy-cables' },
        { text: ' and ' },
        { text: 'Khan Meat Pointe', link: '/projects/khan-meat-pointe' },
        { text: ' take payment through Stripe. See ' },
        { text: 'e-commerce development with Stripe', link: '/services/ecommerce-development-stripe' },
        { text: '.' },
      ],
    },
    {
      question: 'Can you build an admin dashboard for my business?',
      answer: [
        {
          text: 'Yes. I build role-based admin panels and dashboards in Angular on a Node.js and MongoDB API: data tables, order or booking workflows, calendars, reports, activity logs and permissions per role. Examples are the Khan Meat Pointe back office and the Wavy Cables admin app. See ',
        },
        { text: 'admin panel and dashboard development', link: '/services/admin-dashboard-development' },
        { text: '.' },
      ],
    },
    {
      question: 'Can you turn my web app into an Android and iOS app with Ionic?',
      answer: [
        {
          text: 'Often, yes. If your web app is built with Angular, Ionic and Capacitor can produce Android and iOS apps from one TypeScript codebase that reuses your API, with native features such as the camera and push notifications. I worked for a year and a half as an Ionic Angular developer. Read about ',
        },
        { text: 'Ionic Angular mobile apps', link: '/services/ionic-angular-mobile-apps' },
        { text: '.' },
      ],
    },
    {
      question: 'Do you build real-time features with WebSockets in Node.js?',
      answer: [
        {
          text: 'Yes. I build chat, presence, typing indicators and live notifications over WebSockets, with automatic reconnection, duplicate-safe message handling and paged history for long conversations. ',
        },
        { text: 'ChatMessenger', link: '/projects/chatmessenger' },
        { text: ' is a multi-tenant team chat on native WebSockets, and ' },
        { text: 'MyCityHelp', link: '/projects/mycityhelp' },
        { text: ' sends real-time ticket alerts. See ' },
        { text: 'real-time WebSocket apps', link: '/services/real-time-websocket-apps' },
        { text: '.' },
      ],
    },
    {
      question: 'Can you deploy my Node.js or Angular app with Docker and nginx?',
      answer: [
        {
          text: 'Yes. I package Node.js APIs, MongoDB and Angular SSR servers as Docker containers with Docker Compose, and put nginx in front for caching and reverse proxying. I also add health checks and backup and restore scripts for the database. See ',
        },
        { text: 'Docker and nginx deployment', link: '/services/docker-nginx-deployment' },
        { text: '.' },
      ],
    },
    {
      question: 'Which tech stack do you work with?',
      answer: [
        {
          text: 'Mainly the MEAN stack in TypeScript: Angular (SSR, NgRx for state management, RxJS, Angular Material, PrimeNG, Tailwind CSS), Node.js with Express and Zod, and MongoDB with Mongoose. For mobile apps I use Ionic and Capacitor, for payments Stripe, and for maps Google Maps. I also publish ',
        },
        { text: 'free developer tools', link: '/tools' },
        { text: '.' },
      ],
    },
    {
      question: 'Can you take over or modernise an existing project?',
      answer: [
        { text: 'Yes. Several of my projects were rebuilds: ' },
        { text: 'Wavy Cables', link: '/projects/wavy-cables' },
        { text: ' was a near-total rewrite of a 2024 build on Angular 21 with SSR, and ' },
        { text: 'AA Bridal Studio', link: '/projects/aa-bridal-studio' },
        { text: ' was redesigned from a 2024 build onto Angular 21. I start with a short code review so we know what to keep.' },
      ],
    },
  ] satisfies FaqItem[],
} as const;
