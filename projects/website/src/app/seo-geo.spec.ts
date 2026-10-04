import { DOCUMENT } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { SeoService, countWords } from '@shared/services/seo.service';
import { routes } from './app.routes';
import { ABOUT_CONTENT } from './content/about.content';
import { FAQ_CONTENT } from './content/faq.content';
import { NOT_FOUND_CONTENT } from './content/not-found.content';
import { NotFoundPage } from './pages/not-found/not-found';
import { About } from './sections/about/about';
import { Faq } from './sections/faq/faq';

const profile = {
  fullName: 'Muhammad Asif',
  headline: 'MEAN Stack Developer — Angular & Node.js',
  location: 'Lahore, Pakistan',
  linkedin: 'https://www.linkedin.com/in/muhammad-asif-94ab47350',
  github: 'https://github.com/MuhammadAsif521',
  skills: ['Angular', 'NgRx', 'Node.js'],
  skillGroups: [],
  education: [{ institution: 'Virtual University of Pakistan', degree: 'BS', inProgress: true }],
  languages: ['English', 'Urdu'],
  currentPosition: { company: 'ICTGE', role: 'MEAN Stack Developer', location: 'Lahore, Pakistan', since: '2025-10-01T00:00:00.000Z' },
};

function graphScripts(doc: Document) {
  return Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
}

function graph(doc: Document): Record<string, any>[] {
  const scripts = graphScripts(doc);
  expect(scripts).toHaveLength(1);
  const parsed = JSON.parse(scripts[0].textContent ?? '{}');
  expect(parsed['@context']).toBe('https://schema.org');
  return parsed['@graph'];
}

describe('SeoService JSON-LD graph', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
    graphScripts(doc).forEach((script) => script.remove());
    seo.applySiteSettings({
      siteName: 'Muhammad Asif',
      jobTitle: 'MEAN Stack Developer',
      description: 'Building production Angular & Node systems.',
      domain: 'https://www.asifdev.test',
      photo: '/assets/images/about-portrait.webp',
      contactEmail: 'hello@example.com',
      city: 'Lahore',
      country: 'Pakistan',
      socialLinks: [{ label: 'GitHub', value: 'https://github.com/MuhammadAsif521' }],
      profile,
    });
  });

  it('uses the Site Settings domain for canonical URLs and @ids', () => {
    seo.updateFromRouteData({ title: 'Blog' }, '/blog');
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.asifdev.test/blog');
    expect(seo.personId).toBe('https://www.asifdev.test/#person');
  });

  it('writes one @graph with WebSite and a complete Person', () => {
    seo.updateSeo({ jsonLd: seo.profilePageNodes({ name: 'Muhammad Asif — MEAN Stack Developer' }) });
    const nodes = graph(doc);
    const website = nodes.find((node) => node['@type'] === 'WebSite');
    const person = nodes.find((node) => node['@type'] === 'Person');
    const page = nodes.find((node) => node['@type'] === 'ProfilePage');

    expect(website).toMatchObject({
      '@id': 'https://www.asifdev.test/#website',
      url: 'https://www.asifdev.test/',
      publisher: { '@id': 'https://www.asifdev.test/#person' },
    });
    expect(person).toMatchObject({
      '@id': 'https://www.asifdev.test/#person',
      name: 'Muhammad Asif',
      jobTitle: 'MEAN Stack Developer',
      image: 'https://www.asifdev.test/assets/images/about-portrait.webp',
      email: 'hello@example.com',
      address: { '@type': 'PostalAddress', addressLocality: 'Lahore', addressCountry: 'Pakistan' },
      knowsAbout: ['Angular', 'NgRx', 'Node.js'],
      knowsLanguage: ['English', 'Urdu'],
      worksFor: { '@type': 'Organization', name: 'ICTGE', location: 'Lahore, Pakistan' },
      alumniOf: { '@type': 'EducationalOrganization', name: 'Virtual University of Pakistan' },
    });
    // LinkedIn + GitHub from the resume profile, de-duplicated against the social links.
    expect(person?.['sameAs']).toEqual([profile.linkedin, profile.github]);
    expect(page).toMatchObject({
      '@id': 'https://www.asifdev.test/#webpage',
      isPartOf: { '@id': 'https://www.asifdev.test/#website' },
      mainEntity: { '@id': 'https://www.asifdev.test/#person' },
    });
    // Every node is a plain node (the graph carries the only @context) and every @id is unique.
    expect(nodes.every((node) => !('@context' in node))).toBe(true);
    const ids = nodes.map((node) => node['@id']).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds Blog, CollectionPage and ItemList for /blog', () => {
    seo.updateSeo({
      jsonLd: seo.blogListNodes({
        name: 'Blog',
        description: 'Notes',
        posts: [
          { name: 'A', url: 'https://www.asifdev.test/blog/a' },
          { name: 'B', url: 'https://www.asifdev.test/blog/b' },
        ],
      }),
    });
    const nodes = graph(doc);
    expect(nodes.find((node) => node['@type'] === 'CollectionPage')).toMatchObject({
      mainEntity: { '@id': 'https://www.asifdev.test/blog#itemlist' },
      breadcrumb: { '@id': 'https://www.asifdev.test/blog#breadcrumb' },
    });
    expect(nodes.find((node) => node['@type'] === 'Blog')?.['publisher']).toEqual({
      '@id': 'https://www.asifdev.test/#person',
    });
    const list = nodes.find((node) => node['@type'] === 'ItemList');
    expect(list?.['numberOfItems']).toBe(2);
    expect(list?.['itemListElement'][1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      url: 'https://www.asifdev.test/blog/b',
      name: 'B',
    });
    expect(nodes.find((node) => node['@type'] === 'BreadcrumbList')).toBeTruthy();
  });

  it('marks a project with public code as SoftwareSourceCode', () => {
    const work = seo.buildCreativeWorkJsonLd({
      name: 'X',
      url: 'https://www.asifdev.test/projects/x',
      repoUrl: 'https://github.com/MuhammadAsif521/x',
    });
    expect(work).toMatchObject({ '@type': 'SoftwareSourceCode', codeRepository: 'https://github.com/MuhammadAsif521/x' });
    expect(seo.buildCreativeWorkJsonLd({ name: 'Y', url: 'https://www.asifdev.test/projects/y' })['@type']).toBe(
      'CreativeWork',
    );
  });

  it('escapes "</" so a value can never close the script element', () => {
    seo.updateSeo({ jsonLd: { '@type': 'Thing', name: '</script><script>alert(1)</script>' } });
    const text = graphScripts(doc)[0].textContent ?? '';
    expect(text).not.toContain('</script>');
    expect(graph(doc).find((node) => node['@type'] === 'Thing')?.['name']).toBe('</script><script>alert(1)</script>');
  });

  it('counts visible words in HTML', () => {
    expect(countWords('<p>Hello <strong>big</strong> world</p><pre><code>const x = 1;</code></pre>')).toBe(6);
    expect(countWords('')).toBe(0);
  });
});

function setupStore() {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideMockStore({
        initialState: {
          site: { settings: null, status: 'loaded', error: null },
          ui: { activeSection: 'home', menuOpen: false },
        },
      }),
    ],
  });
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

describe('home GEO content', () => {
  it('has an answer-first About passage of 134-167 words that names the role and location', async () => {
    setupStore();
    const fixture = TestBed.createComponent(About);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const text = Array.from(el.querySelectorAll('.about__bio'))
      .map((p) => p.textContent ?? '')
      .join(' ');
    expect(words(text)).toBeGreaterThanOrEqual(134);
    expect(words(text)).toBeLessThanOrEqual(167);
    expect(text.slice(0, 120)).toContain('MEAN stack developer in Lahore, Pakistan');
    // Runs join without stray spaces before punctuation.
    expect(text).not.toMatch(/\s[.,:]/);
    // Internal links to the case studies it mentions.
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.about__bio a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/projects/city-of-new-britain-digital-ecosystem');
    expect(links.length).toBe(ABOUT_CONTENT.bio.flat().filter((part) => 'link' in part).length);
  });

  it('renders every FAQ answer in the HTML under a question heading', async () => {
    setupStore();
    const fixture = TestBed.createComponent(Faq);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Questions');
    const questions = Array.from(el.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(questions).toEqual(FAQ_CONTENT.items.map((item) => item.question));
    expect(questions.every((q) => q?.endsWith('?'))).toBe(true);
    const answers = Array.from(el.querySelectorAll('.faq__answer'));
    expect(answers.every((p) => words(p.textContent ?? '') >= 20)).toBe(true);
    expect(el.querySelector('a[href="/#contact"]')).toBeTruthy();
  });
});

describe('unknown URLs', () => {
  it('render a 404 page with noindex instead of redirecting home', async () => {
    window.matchMedia ??= ((query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    const responseInit: { status?: number } = {};
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: RESPONSE_INIT, useValue: responseInit }],
    });
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBeUndefined();
    const fixture = TestBed.createComponent(NotFoundPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(responseInit.status).toBe(404);
    expect(el.querySelector('h1')?.textContent).toBe(NOT_FOUND_CONTENT.title);
    expect(el.querySelector('a[href="/blog"]')).toBeTruthy();
    expect(TestBed.inject(Title).getTitle()).toContain(NOT_FOUND_CONTENT.title);
    expect(TestBed.inject(DOCUMENT).querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  });
});
