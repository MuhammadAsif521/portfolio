import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTestStore } from './testing/store.testing';
import { PublicApiService } from '@shared/services/public-api.service';
import { DEMO_CONTENT } from './core/demo-content';
import { Store } from '@ngrx/store';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ContentActions } from './core/store/content.feature';
import { PROJECTS_CONTENT } from './content/projects.content';
import { PROJECT_COVER_SIZES } from './core/image-sizes';
import { ProjectDetailPage } from './pages/project-detail/project-detail';
import { Projects } from './sections/projects/projects';

const initialState = {
  site: { settings: null, status: 'loaded', error: null },
  ui: { activeSection: 'home', menuOpen: false },
};

function setup(api: Partial<PublicApiService>, responseInit?: ResponseInit, demo = false) {
  // Reduced motion: these tests are about content, and it keeps GSAP from lazy-loading mid-teardown.
  window.matchMedia = ((query: string) =>
    ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestStore(initialState),
      { provide: PublicApiService, useValue: api },
      // Demo content is dev-only UI review data; these tests cover real API behaviour.
      { provide: DEMO_CONTENT, useValue: demo },
      ...(responseInit ? [{ provide: RESPONSE_INIT, useValue: responseInit }] : []),
    ],
  });
}

function projectCard(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: slug,
    slug,
    title: `Project ${slug}`,
    summary: `Summary of ${slug}`,
    techStack: ['Angular', 'Node.js', 'MongoDB', 'NgRx', 'Docker', 'nginx', 'Zod'],
    featured: false,
    order: 0,
    status: 'published' as const,
    seo: {},
    ...overrides,
  };
}

const page = (data: unknown[]) => ({ data, total: data.length, limit: 12, page: 1, pages: data.length ? 1 : 0 });

describe('Projects section', () => {
  async function render(listProjects: () => unknown) {
    setup({ listProjects } as unknown as Partial<PublicApiService>);
    const fixture = TestBed.createComponent(Projects);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows every project as a linked slide, in API order (featured first from the backend)', async () => {
    const items = [projectCard('flagship', { featured: true }), projectCard('a'), projectCard('b')];
    const el = await render(() => of(page(items)));

    const slides = Array.from(el.querySelectorAll('[aria-roledescription="slide"] app-project-card'));
    expect(slides.map((card) => card.querySelector('h3')?.textContent)).toEqual([
      'Project flagship',
      'Project a',
      'Project b',
    ]);
    expect(slides[0]?.querySelector('.project-card__summary')?.textContent).toBe('Summary of flagship');
  });

  it('makes each whole card one real link to its case study, named by the project title', async () => {
    const el = await render(() => of(page([projectCard('flagship'), projectCard('a')])));
    const cards = Array.from(el.querySelectorAll('[aria-roledescription="slide"] .project-card'));
    for (const [i, slug] of ['flagship', 'a'].entries()) {
      const links = cards[i]!.querySelectorAll('a');
      expect(links.length).toBe(1); // a single tab stop per card
      const link = links[0]!;
      expect(link.getAttribute('href')).toBe(`/projects/${slug}`);
      // Accessible name (and crawlable anchor text) is just the title; the arrow ring is decorative.
      expect(link.textContent?.trim()).toBe(`Project ${slug}`);
      expect(link.querySelector('.project-card__arrow')?.getAttribute('aria-hidden')).toBe('true');
      expect(link.classList).toContain('project-card__link'); // its ::after covers the whole card
    }
  });

  it("shows the active project's tech chips (max six), title link and summary below the carousel", async () => {
    const el = await render(() => of(page([projectCard('flagship', { featured: true }), projectCard('a')])));
    const details = el.querySelector('.projects__details')!;
    expect(Array.from(details.querySelectorAll('.projects__chip')).map((chip) => chip.textContent)).toEqual([
      'Angular',
      'Node.js',
      'MongoDB',
      'NgRx',
      'Docker',
      'nginx',
    ]);
    expect(details.querySelector('.projects__name span')?.textContent).toBe('Project flagship');
    expect(details.querySelector('.projects__go')?.getAttribute('href')).toBe('/projects/flagship');
    expect(details.querySelector('.projects__summary')?.textContent).toBe('Summary of flagship');
  });

  it('falls back to the demo projects in development (and only then)', async () => {
    setup({ listProjects: () => of(page([])) } as unknown as Partial<PublicApiService>, undefined, true);
    const fixture = TestBed.createComponent(Projects);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const titles = Array.from(el.querySelectorAll('app-project-card h3')).map((node) => node.textContent);
    expect(titles[0]).toBe('City of New Britain Digital Ecosystem');
    expect(titles.length).toBe(7);
    expect(el.querySelector('.projects__empty')).toBeNull();
  });

  it('shows the empty state when nothing is published', async () => {
    const el = await render(() => of(page([])));
    expect(el.querySelector('section#projects')).toBeTruthy();
    expect(el.querySelector('.projects__empty-title')?.textContent).toBe(PROJECTS_CONTENT.empty.title);
    expect(el.querySelector('app-project-card')).toBeNull();
  });

  it('shows a friendly error with "Try again" (not the empty state) when the API fails, and retries', async () => {
    const listProjects = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValueOnce(of(page([projectCard('back')])));
    setup({ listProjects } as unknown as Partial<PublicApiService>);
    const fixture = TestBed.createComponent(Projects);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.projects__empty')).toBeNull();
    const box = el.querySelector('app-load-error [role="alert"]')!;
    expect(box.textContent).toContain('Could not load the projects');
    const retry = box.querySelector<HTMLButtonElement>('button')!;
    expect(retry.textContent?.trim()).toBe('Try again');
    expect(retry.type).toBe('button');

    retry.click();
    await fixture.whenStable();
    expect(listProjects).toHaveBeenCalledTimes(2);
    expect(el.querySelector('app-load-error')).toBeNull();
    expect(el.querySelector('app-project-card h3')?.textContent).toBe('Project back');
  });

  it('renders from the store on a revisit without asking the API again', async () => {
    const listProjects = vi.fn(() => of(page([projectCard('cached')])));
    setup({ listProjects } as unknown as Partial<PublicApiService>);
    const first = TestBed.createComponent(Projects);
    await first.whenStable();
    first.destroy();

    const again = TestBed.createComponent(Projects);
    again.detectChanges(); // first render, synchronously from the store
    expect((again.nativeElement as HTMLElement).querySelector('app-project-card h3')?.textContent).toBe('Project cached');
    expect(listProjects).toHaveBeenCalledTimes(1);
  });
});

describe('Project case study page', () => {
  const project = {
    ...projectCard('city-of-new-britain', { featured: true, client: 'City of New Britain, CT' }),
    content: '<h2>Challenge</h2><p>Four sites, one backend.</p><script>alert(1)</script>',
    liveUrl: 'https://nbrecovers.com',
    coverImage: { key: 'projects/2026/09/c.webp', url: 'https://cdn.test/c.webp', alt: 'Cover' },
    architectureDiagram: { key: 'projects/2026/09/d.webp', url: 'https://cdn.test/d.webp', alt: 'Architecture diagram' },
    gallery: [{ key: 'projects/2026/09/g.webp', url: 'https://cdn.test/g.webp', alt: 'Admin panel', caption: 'Admin' }],
    publishedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  async function render(getProject: (slug: string) => unknown) {
    const responseInit: ResponseInit = {};
    setup({ getProject } as unknown as Partial<PublicApiService>, responseInit);
    const fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.componentRef.setInput('slug', 'city-of-new-britain');
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, responseInit };
  }

  function jsonLd(): Record<string, any>[] {
    return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((node) => {
      const parsed = JSON.parse(node.textContent ?? '[]');
      return Array.isArray(parsed) ? parsed : [parsed];
    });
  }

  it('renders the case study with diagram, sanitized content, gallery and outbound links', async () => {
    const { el, responseInit } = await render(() => of(project));
    expect(el.querySelector('h1')?.textContent).toBe('Project city-of-new-britain');
    expect(el.querySelector('.case__client')?.textContent).toBe('City of New Britain, CT');
    expect(el.querySelector('[aria-current="page"]')?.textContent).toBe('Project city-of-new-britain');
    expect(el.querySelector('.case__figure img')?.getAttribute('alt')).toBe('Architecture diagram');
    expect(el.querySelector('.case__content h2')?.textContent).toBe('Challenge');
    expect(el.querySelector('.case__content script')).toBeNull();
    expect(el.querySelector('.case__shot figcaption')?.textContent).toBe('Admin');

    const live = el.querySelector('.case__actions a')!;
    expect(live.getAttribute('href')).toBe('https://nbrecovers.com');
    expect(live.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el.querySelector('.case__cta a')?.getAttribute('href')).toBe('/#contact');
    expect(responseInit.status).toBeUndefined();
  });

  it('serves the cover (the LCP image) eagerly at high priority, responsive when the API sends a srcset', async () => {
    const srcset = 'https://cdn.test/c-w480.webp 480w, https://cdn.test/c-w960.webp 960w, https://cdn.test/c.webp 1600w';
    const { el } = await render(() =>
      of({ ...project, coverImage: { ...project.coverImage, width: 1600, height: 900, variants: [480, 960], srcset } }),
    );
    const cover = el.querySelector<HTMLImageElement>('img.case__cover')!;
    expect(cover.getAttribute('srcset')).toBe(srcset);
    expect(cover.getAttribute('sizes')).toBe(PROJECT_COVER_SIZES);
    expect(cover.getAttribute('src')).toBe('https://cdn.test/c.webp');
    expect(cover.getAttribute('fetchpriority')).toBe('high');
    expect(cover.getAttribute('loading')).toBeNull();
  });

  it('falls back to the plain cover src for images stored before variants existed', async () => {
    const { el } = await render(() => of(project));
    const cover = el.querySelector<HTMLImageElement>('img.case__cover')!;
    expect(cover.getAttribute('src')).toBe('https://cdn.test/c.webp');
    expect(cover.hasAttribute('srcset')).toBe(false);
    expect(cover.hasAttribute('sizes')).toBe(false);
    expect([cover.getAttribute('width'), cover.getAttribute('height')]).toEqual(['1600', '900']);
  });

  it('sets the title and CreativeWork + BreadcrumbList JSON-LD', async () => {
    await render(() => of(project));
    expect(TestBed.inject(Title).getTitle()).toContain('Project city-of-new-britain');

    const work = jsonLd().find((schema) => schema['@type'] === 'CreativeWork');
    expect(work).toMatchObject({
      name: 'Project city-of-new-britain',
      image: ['https://cdn.test/c.webp'],
      datePublished: '2026-09-01T00:00:00.000Z',
      dateModified: '2026-09-20T00:00:00.000Z',
    });
    expect(work?.['url']).toMatch(/\/projects\/city-of-new-britain$/);
    expect(work?.['author']['@id']).toMatch(/#person$/);

    const crumbs = jsonLd().find((schema) => schema['@type'] === 'BreadcrumbList');
    expect(crumbs?.['itemListElement'].map((item: { name: string }) => item.name)).toEqual([
      'Home',
      'Project city-of-new-britain',
    ]);
  });

  it('answers unknown slugs with a 404 status, a noindex page and a way back', async () => {
    const { el, responseInit } = await render(() =>
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    );
    expect(responseInit.status).toBe(404);
    expect(el.querySelector('h1')?.textContent).toBe(PROJECTS_CONTENT.detail.notFoundTitle);
    expect(el.querySelector('.case__missing a')?.getAttribute('href')).toBe('/#projects');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  });

  it('uses 503, not 404, when the API itself is failing, with "Try again" and a way back', async () => {
    const { el, responseInit } = await render(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(responseInit.status).toBe(503);
    expect(el.querySelector('h1')?.textContent).toBe(PROJECTS_CONTENT.detail.errorTitle);
    expect(el.querySelector('app-load-error button')?.textContent?.trim()).toBe('Try again');
    expect(el.querySelector('app-load-error a')?.getAttribute('href')).toBe('/#projects');
  });

  it('"Try again" reloads a failed case study', async () => {
    const getProject = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of(project));
    setup({ getProject } as unknown as Partial<PublicApiService>);
    const fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.componentRef.setInput('slug', 'city-of-new-britain');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
    await fixture.whenStable();
    expect(getProject).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.case__content h2')?.textContent).toBe('Challenge');
  });

  it('renders the list card at once (title, summary, cover) while the full case study loads', async () => {
    const full = new Subject<typeof project>();
    setup({ getProject: () => full } as unknown as Partial<PublicApiService>);
    TestBed.inject(Store).dispatch(
      ContentActions.loadProjectListSuccess({
        key: 'limit=12',
        result: page([{ ...projectCard('city-of-new-britain'), coverImage: project.coverImage }]) as never,
        loadedAt: Date.now(),
      }),
    );
    const fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.componentRef.setInput('slug', 'city-of-new-britain');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toBe('Project city-of-new-britain');
    expect(el.querySelector('.case__lead')?.textContent).toBe('Summary of city-of-new-britain');
    expect(el.querySelector('img.case__cover')?.getAttribute('src')).toBe('https://cdn.test/c.webp');
    expect(el.querySelector('.case__content')).toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Loading');

    full.next(project);
    full.complete();
    await fixture.whenStable();
    expect(el.querySelector('.case__content h2')?.textContent).toBe('Challenge');
  });
});
