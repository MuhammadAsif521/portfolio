/** "What I Do" (brief, Part 6). Edit copy here; the section renders whatever is listed. */
export interface ServiceItem {
  title: string;
  summary: string;
  /** Short capability tags shown as chips. */
  points: string[];
  /** Lucide icon name (until card artwork exists). */
  icon: string;
  /** Home-page section the card's arrow button scrolls to. */
  target: 'projects' | 'contact';
  /** Optional artwork (e.g. a WebP from the CDN); the icon is used when absent. */
  image?: { src: string; alt: string; width: number; height: number };
}

export const SERVICES_CONTENT = {
  eyebrow: 'My',
  title: 'Services',
  intro:
    'Production systems end to end — from server-rendered Angular front ends to the Node and MongoDB APIs and admin tools behind them.',
  items: [
    {
      title: 'Full-Stack Angular & Node Development',
      summary: 'SSR Angular with NgRx on the front, Express and MongoDB APIs behind it, built for real traffic.',
      points: ['Angular SSR', 'NgRx', 'Express / MongoDB', 'Multi-tenant architecture'],
      icon: 'layers',
      target: 'projects',
    },
    {
      title: 'E-Commerce Platforms',
      summary: 'Storefronts that sell: checkout, catalogue and order flows, plus the admin back office to run them.',
      points: ['Stripe checkout', 'Product & order management', 'Custom admin back offices'],
      icon: 'shopping-bag',
      target: 'projects',
    },
    {
      title: 'Real-Time & Multi-Tenant Systems',
      summary: 'Live features over WebSockets and shared backends that serve several independent sites at once.',
      points: ['Chat & presence', 'Live attendance', 'Ticket notifications', 'Shared multi-tenant backends'],
      icon: 'radio-tower',
      target: 'contact',
    },
  ] satisfies ServiceItem[],
} as const;
