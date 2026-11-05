import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTestStore } from './testing/store.testing';
import { App } from './app';
import { Hero } from './sections/hero/hero';
import { ThemeToggle } from './layout/theme-toggle/theme-toggle';
import { HERO_CONTENT } from './content/hero.content';
import { SERVICES_CONTENT } from './content/services.content';
import { Services } from './sections/services/services';
import { About } from './sections/about/about';
import { ABOUT_CONTENT } from './content/about.content';
import { Experience, monthYear } from './sections/experience/experience';
import { EXPERIENCE_CONTENT } from './content/experience.content';
import { PublicApiService } from '@shared/services/public-api.service';
import { of, throwError } from 'rxjs';

const settings = {
  _id: 's1',
  siteName: 'Muhammad Asif',
  siteSlogan: 'MEAN Stack Developer',
  description: 'Builds production Angular & Node systems.',
  socialLinks: [],
  siteMode: 'system',
  activeThemeId: 't1',
  activeTheme: null,
  resume: { key: 'resume/a.pdf', url: 'https://cdn.test/resume/a.pdf', generatedAt: '2026-09-23T00:00:00Z' },
};

const initialState = {
  site: { settings, status: 'loaded', error: null },
  ui: { activeSection: 'home', menuOpen: false },
};

function setup() {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestStore(initialState),
      // The footer's email box injects it; sections that fetch data override it per test.
      { provide: PublicApiService, useValue: {} },
    ],
  });
}

describe('App shell', () => {
  beforeEach(setup);

  it('renders the skip link, header and main landmark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main');
    expect(el.querySelector('nav[aria-label="Main"]')).toBeTruthy();
    expect(el.querySelector('main#main')).toBeTruthy();
  });

  it('shows the "A" mark and the hover credit (resume lives in the hero); the brand link name starts with the visible mark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.site-nav__mark')?.textContent?.trim()).toBe('A');
    const brand = el.querySelector('.site-nav__brand')!;
    // Label-in-name (WCAG 2.5.3): no aria-label overriding the visible "A"; the name starts with it.
    expect(brand.hasAttribute('aria-label')).toBe(false);
    const name = [brand.querySelector('.site-nav__mark'), brand.querySelector('.sr-only')].map((n) => n?.textContent).join('');
    expect(name).toBe('A, Muhammad Asif, home');
    expect(brand.querySelector('.site-nav__made')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.site-nav__made')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Made by Asif');
    expect(el.querySelector('.site-nav__resume')).toBeNull(); // the hero's Resume button replaces it
  });

  it('lists every section link plus the Services, Blog and Tools routes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.site-nav__link')).map((a) =>
      a.textContent?.trim(),
    ); 
    expect(labels).toEqual(['Home', 'Services', 'Experience', 'About', 'Projects', 'Blog', 'Tools', 'Contact']); 
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    setup();
  });

  it('cycles Light → Dark → System and describes the next step', async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-label')).toMatch(/^Theme: System .*Switch to Light\.$/);

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('Theme: Light. Switch to Dark.');

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('Theme: Dark. Switch to System.');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('Hero', () => {
  beforeEach(setup);

  it('renders the headline, first role (for screen readers) and the settings tagline', async () => {
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain(`I'm ${HERO_CONTENT.firstName},`);
    expect(el.querySelector('h1 .sr-only')?.textContent).toBe(HERO_CONTENT.roles[0]);
    expect(el.querySelector('.hero__quote p')?.textContent).toBe('Builds production Angular & Node systems.');
    expect(el.querySelector('#home')).toBeTruthy();
  });

  it('shows the stat and a star rating with an accessible label', async () => {
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.hero__stat-value')?.textContent).toBe(HERO_CONTENT.stat.value);
    expect(el.querySelector('.hero__stars')?.getAttribute('aria-label')).toBe('5 out of 5 stars');
  });

  it('hides the portrait (keeping the arc) if the image is missing', async () => {
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('img.hero__image')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.querySelector('img.hero__image')).toBeNull();
    expect(el.querySelector('.hero__arc')).toBeTruthy();
  });
});

describe('Services', () => {
  beforeEach(setup);

  const featured = () => SERVICES_CONTENT.featured.map((page) => SERVICES_CONTENT.items.find((item) => item.page === page)!);

  it('renders the heading and a few featured cards in the original carousel design', async () => {
    const fixture = TestBed.createComponent(Services);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#services h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('My Services');
    expect(el.querySelector('[role="region"][aria-roledescription="carousel"]')).toBeTruthy();
    const cards = Array.from(el.querySelectorAll('article.service-card'));
    expect(cards.length).toBe(SERVICES_CONTENT.featured.length);
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.length).toBeLessThanOrEqual(4);
    expect(cards.map((c) => c.querySelector('h3')?.textContent?.trim())).toEqual(featured().map((s) => s.title));
    // Original card parts: glass title, stacked layers, content panel with chips, notch badge.
    for (const card of cards) {
      expect(card.querySelectorAll('.service-card__layer').length).toBe(2);
      expect(card.querySelector('.service-card__screen .service-card__ui')).toBeTruthy();
      expect(card.querySelector('.service-card__badge')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('makes each whole card a link to its service page through the title anchor, with its summary and points', async () => {
    const fixture = TestBed.createComponent(Services);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const cards = Array.from(el.querySelectorAll('article.service-card'));
    for (const [i, card] of cards.entries()) {
      const item = featured()[i];
      const links = card.querySelectorAll('a, button, [tabindex]');
      expect(links.length).toBe(1);
      expect(links[0].classList.contains('service-card__link')).toBe(true);
      expect(links[0].getAttribute('href')).toBe('/services/' + item.page);
      expect(links[0].closest('h3')).toBeTruthy();
      expect(card.querySelector('.service-card__summary')?.textContent?.trim()).toBe(item.summary);
      expect(Array.from(card.querySelectorAll('.service-card__chip')).map((c) => c.textContent?.trim())).toEqual(item.points);
    }
  });

  it('links to the full /services list', async () => {
    const fixture = TestBed.createComponent(Services);
    await fixture.whenStable();
    const all = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('p > a[href="/services"]');
    expect(all?.textContent?.trim()).toBe(SERVICES_CONTENT.allLabel);
  });
});

describe('Experience', () => {
  const live = [
    {
      _id: 'e1',
      company: 'ICTGE',
      location: 'Lahore',
      role: 'Angular Developer',
      startDate: '2025-10-01T00:00:00.000Z',
      current: true,
      highlights: ['Shipped the multi-tenant platform'],
      techStack: ['Angular', 'NgRx'],
      order: 0,
    },
    {
      _id: 'e2',
      company: 'Learn2Earn Tech',
      role: 'MEAN Stack Developer',
      startDate: '2024-03-01T00:00:00.000Z',
      endDate: '2025-09-30T00:00:00.000Z',
      current: false,
      highlights: [],
      techStack: [],
      order: 1,
    },
  ];

  function render(getExperience: () => unknown) {
    setup();
    TestBed.overrideProvider(PublicApiService, { useValue: { getExperience } });
    const fixture = TestBed.createComponent(Experience);
    return fixture.whenStable().then(() => fixture.nativeElement as HTMLElement);
  }

  it('formats month ranges in UTC and rejects bad dates', () => {
    expect(monthYear('2025-10-01T00:00:00.000Z')).toEqual({ label: 'Oct 2025', iso: '2025-10' });
    expect(monthYear('2020-06-01')).toEqual({ label: 'Jun 2020', iso: '2020-06' });
    expect(monthYear(undefined)).toBeNull();
    expect(monthYear('not a date')).toBeNull();
  });

  it('renders the live timeline newest first with dates, highlights and tech chips', async () => {
    const el = await render(() => of(live));
    const items = el.querySelectorAll('.timeline__item');
    expect(items.length).toBe(2);
    expect(items[0]?.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('ICTGE, Lahore');
    expect(items[0]?.querySelector('.timeline__dates')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Oct 2025 – Present',
    );
    expect(items[0]?.querySelector('time')?.getAttribute('datetime')).toBe('2025-10');
    expect(items[0]?.classList).toContain('timeline__item--current');
    expect(items[0]?.querySelectorAll('.timeline__chip').length).toBe(2);
    expect(items[1]?.querySelector('.timeline__dates')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Mar 2024 – Sep 2025',
    );
  });

  it('falls back to the built-in entries when the API is empty or fails', async () => {
    for (const source of [() => of([]), () => throwError(() => new Error('down'))]) {
      TestBed.resetTestingModule();
      const el = await render(source);
      const roles = Array.from(el.querySelectorAll('.timeline__role')).map((node) => node.textContent);
      expect(roles).toEqual(EXPERIENCE_CONTENT.fallback.map((entry) => entry.role));
      expect(el.querySelector('#experience h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('My Work Experience');
    }
  });
});

describe('About (Why Hire Me)', () => {
  beforeEach(setup);

  it('is the #about anchor with heading, bio and labelled stats', async () => {
    const fixture = TestBed.createComponent(About);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('section#about h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Why Hire me?');
    expect(el.querySelectorAll('.about__bio').length).toBe(ABOUT_CONTENT.bio.length);
    const stats = Array.from(el.querySelectorAll('.about__stat')).map((stat) => [
      stat.querySelector('dt')?.textContent,
      stat.querySelector('dd')?.textContent,
    ]);
    expect(stats).toEqual([
      ['Production applications delivered', '7+'],
      ['Public sites on one multi-tenant backend', '4'],
    ]);
  });

  it('links Hire me to #contact (the resume download lives in the hero)', async () => {
    const fixture = TestBed.createComponent(About);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.about__cta--outline')?.getAttribute('href')).toBe('/#contact');
    expect(el.querySelector('.about__cta--link')).toBeNull();
  });

  it('keeps the orange block when the portrait is missing', async () => {
    const fixture = TestBed.createComponent(About);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('img.about__image')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.querySelector('img.about__image')).toBeNull();
    expect(el.querySelector('.about__backdrop')).toBeTruthy();
  });
});
