import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { SeoService } from '@shared/services/seo.service';
import { SiteHeader } from './layout/site-header/site-header';

const FAVICON = 'https://cdn.test/settings/2026/10/cd1cc0b7-534e-4201-af26-050692fef1ea.webp';

function addStaticIcons(doc: Document): void {
  for (const [rel, href] of [
    ['icon', 'favicon.ico'],
    ['icon', 'assets/favicon/favicon.svg'],
    ['apple-touch-icon', 'assets/favicon/apple-touch-icon.png'],
  ]) {
    const link = doc.createElement('link');
    link.rel = rel;
    link.href = href;
    link.setAttribute('data-test-static', '');
    doc.head.appendChild(link);
  }
}

const iconLinks = (doc: Document) =>
  Array.from(doc.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]'));

describe('SeoService brand defaults', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
    iconLinks(doc).forEach((link) => link.remove());
    addStaticIcons(doc);
  });

  afterEach(() => iconLinks(doc).forEach((link) => link.remove()));

  it('keeps the static icons when Site Settings has no favicon', () => {
    seo.applySiteSettings({ siteName: 'Muhammad Asif' });
    expect(iconLinks(doc)).toHaveLength(3);
    expect(doc.head.querySelector('[data-site-icon]')).toBeNull();
  });

  it('swaps the static icons for the Site Settings favicon (idempotent)', () => {
    seo.applySiteSettings({ siteName: 'Muhammad Asif', favicon: FAVICON });
    seo.applySiteSettings({ siteName: 'Muhammad Asif', favicon: FAVICON });

    const links = iconLinks(doc);
    expect(links.map((l) => l.getAttribute('rel'))).toEqual(['icon', 'apple-touch-icon']);
    expect(links.every((l) => l.getAttribute('href') === FAVICON)).toBe(true);
    expect(links[0].getAttribute('type')).toBe('image/webp');
    expect(doc.head.querySelector('[data-test-static]')).toBeNull();
  });

  it('uses the committed share image until Site Settings provides one', () => {
    seo.updateFromRouteData({ title: 'Home' }, '/');
    const ogImage = () => doc.head.querySelector('meta[property="og:image"]')?.getAttribute('content');
    const twitterImage = () => doc.head.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    expect(ogImage()).toMatch(/\/assets\/images\/og-default\.jpg$/);
    expect(twitterImage()).toBe(ogImage());

    seo.applySiteSettings({ siteName: 'Muhammad Asif', ogImage: 'https://cdn.test/settings/og.webp' });
    seo.updateFromRouteData({ title: 'Home' }, '/');
    expect(ogImage()).toBe('https://cdn.test/settings/og.webp');
    expect(twitterImage()).toBe('https://cdn.test/settings/og.webp');
  });
});

describe('SiteHeader logo', () => {
  it('renders a wide Site Settings logo at its own aspect ratio', async () => {
    window.matchMedia ??= ((query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            site: {
              settings: {
                _id: 's1',
                siteName: 'Muhammad Asif',
                socialLinks: [],
                siteMode: 'system',
                activeThemeId: 't1',
                activeTheme: null,
                siteLogo: { key: 'k', url: 'https://cdn.test/logo.webp', alt: '', width: 636, height: 256 },
              },
              status: 'loaded',
              error: null,
            },
            ui: { activeSection: 'home', menuOpen: false },
          },
        }),
      ],
    });
    const fixture = TestBed.createComponent(SiteHeader);
    await fixture.whenStable();
    const img = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.site-nav__logo-img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.test/logo.webp');
    expect(img.getAttribute('width')).toBe('636');
    expect(img.getAttribute('height')).toBe('256');
  });
});
