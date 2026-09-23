import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { App } from './app';
import { Hero } from './sections/hero/hero';
import { ThemeToggle } from './layout/theme-toggle/theme-toggle';
import { HERO_CONTENT } from './content/hero.content';
import { SERVICES_CONTENT } from './content/services.content';
import { Services } from './sections/services/services';
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
    providers: [provideRouter([]), provideMockStore({ initialState })],
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

  it('shows the site name, "MA" mark and the resume link from settings', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.site-nav__name')?.textContent?.trim()).toBe('Muhammad Asif');
    expect(el.querySelector('.site-nav__mark')?.textContent?.trim()).toBe('MA');
    expect(el.querySelector<HTMLAnchorElement>('.site-nav__resume')?.href).toBe('https://cdn.test/resume/a.pdf');
  });

  it('lists every section link plus the Blog route', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.site-nav__link')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual(['Home', 'About', 'What I Do', 'Experience', 'Projects', 'Blog', 'Contact']);
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

  it('renders the heading and one labelled slide per service', async () => {
    const fixture = TestBed.createComponent(Services);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#services h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('My Services');
    expect(el.querySelector('[aria-roledescription="carousel"]')?.getAttribute('aria-label')).toBe('Services');
    const slides = el.querySelectorAll('[aria-roledescription="slide"]');
    expect(slides.length).toBe(SERVICES_CONTENT.items.length);
    expect(slides[0]?.getAttribute('aria-label')).toBe(`1 of ${SERVICES_CONTENT.items.length}`);
    expect(slides[0]?.querySelector('h3')?.textContent).toBe(SERVICES_CONTENT.items[0].title);
  });

  it('links each card to its home-page section', async () => {
    const fixture = TestBed.createComponent(Services);
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a.service-card__link'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(SERVICES_CONTENT.items.map((i) => `/#${i.target}`));
    expect(links.every((a) => a.getAttribute('aria-label'))).toBe(true);
  });

  it('keeps the dots hidden until the track is measured as overflowing', async () => {
    const fixture = TestBed.createComponent(Services);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dots = el.querySelector<HTMLElement>('.carousel__dots')!;
    expect(dots.hidden).toBe(true); // jsdom has no layout, so nothing overflows
    expect(el.querySelectorAll('.carousel__dot').length).toBe(SERVICES_CONTENT.items.length);
    expect(el.querySelector('.carousel__dot.is-active')?.getAttribute('aria-current')).toBe('true');
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
      highlights: ['Shipped the City of New Britain ecosystem'],
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
