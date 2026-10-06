import type { BioPart } from './about.content';

export interface FaqItem {
  question: string;
  /** Answer-first, self-contained text; parts with `link` render as internal links. */
  answer: readonly BioPart[];
}

/**
 * Home-page FAQ: the questions clients actually ask before hiring (services, stack, availability, time
 * zone, existing projects, how to start). Rendered on the server as plain headings and paragraphs, so
 * search engines and AI answer engines can quote each answer on its own. Every statement must stay true
 * and checkable against the projects, experience and contact copy; review before editing.
 */
export const FAQ_CONTENT = {
  eyebrow: 'Frequently asked',
  title: 'Questions',
  items: [
    {
      question: 'What services do you offer?',
      answer: [
        {
          text: 'I build full-stack MEAN applications: server-rendered Angular front ends, Node.js and Express REST APIs, MongoDB data models, e-commerce platforms with Stripe checkout, real-time features over WebSockets, Ionic hybrid mobile apps, and the Docker and nginx setup to deploy them. ',
        },
        { text: 'See all services', link: '/', fragment: 'services' },
        { text: '.' },
      ],
    },
    {
      question: 'Which tech stack do you work with?',
      answer: [
        {
          text: 'Mainly the MEAN stack in TypeScript: Angular (SSR, NgRx, RxJS, Angular Material, PrimeNG, Tailwind CSS), Node.js with Express and Zod, and MongoDB with Mongoose. For mobile apps I use Ionic and Capacitor; for payments and maps, Stripe and Google Maps.',
        },
      ],
    },
    {
      question: 'Are you available for freelance projects?',
      answer: [
        {
          text: 'Yes. I take on freelance and contract work, from new builds to features for existing Angular or Node.js apps. Send a short brief through the ',
        },
        { text: 'contact form', link: '/', fragment: 'contact' },
        { text: ' and I usually reply within a day.' },
      ],
    },
    {
      question: 'What time zone do you work in?',
      answer: [
        {
          text: 'I am based in Pakistan and work on Pakistan Standard Time (PKT, UTC+5). I already work with clients abroad: the ',
        },
        // { text: 'City of New Britain ecosystem', link: '/projects/city-of-new-britain-digital-ecosystem' },
        { text: ' serves a city in Connecticut, USA. I communicate in English by email and chat.' },
      ],
    },
    {
      question: 'Can you take over or modernise an existing project?',
      answer: [
        { text: 'Yes. Several of my projects were rebuilds: ' },
        { text: 'Wavy Cables', link: '/projects/wavy-cables' },
        { text: ' was a near-total rewrite of a 2024 build on Angular 21 with SSR, and ' },
        { text: 'AA Bridal Studio', link: '/projects/aa-bridal-studio' },
        { text: ' was redesigned from a 2024 build onto Angular 21.' },
      ],
    },
    {
      question: 'How do we get started?',
      answer: [
        {
          text: 'Send a short description of what you need, where the project stands today and any deadline, through the ',
        },
        { text: 'contact form', link: '/', fragment: 'contact' },
        {
          text: ' or by email. I usually reply within a day, and we agree on the scope before any work starts.',
        },
      ],
    },
  ] satisfies FaqItem[],
} as const;
