import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { routes } from './app.routes';
import { LEGAL_PAGES, LEGAL_UI } from './pages/legal/legal.content';
import { headingText, slugify, withHeadingIds } from './pages/legal/legal-html';
import { hasText, LegalPage } from './pages/legal/legal-page';
import type { LegalKind } from './pages/legal/legal-links';

const baseSettings = {
  _id: 's1',
  siteName: 'Muhammad Asif',
  contactEmail: 'hello@example.com',
  country: 'Pakistan',
  socialLinks: [],
  siteMode: 'system',
  activeThemeId: 't1',
  activeTheme: null,
  updatedAt: '2026-09-20T08:00:00.000Z',
};

function render(kind: LegalKind, settings: Record<string, unknown> = {}) {
  window.matchMedia = ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          site: { settings: { ...baseSettings, ...settings }, status: 'loaded', error: null },
          ui: { activeSection: 'home', menuOpen: false },
        },
      }),
    ],
  });
  const fixture = TestBed.createComponent(LegalPage);
  fixture.componentRef.setInput('kind', kind);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('legal HTML helpers', () => {
  it('adds unique slug ids to h2s and builds the TOC', () => {
    const { html, toc } = withHeadingIds(
      '<h2 id="evil" class="x">1. Your rights &amp; choices</h2><p>a</p><h2>Contact</h2><h2>Contact</h2><h2> </h2>',
    );
    expect(toc).toEqual([
      { id: 'your-rights-choices', label: '1. Your rights & choices' },
      { id: 'contact', label: 'Contact' },
      { id: 'contact-2', label: 'Contact' },
    ]);
    expect(html).toContain('<h2 id="your-rights-choices" class="x">');
    expect(html).not.toContain('evil');
  });

  it('reads heading text and slugs safely', () => {
    expect(headingText('<strong>Cookies</strong> &#38; storage')).toBe('Cookies & storage');
    expect(slugify('Café "policy" <b>')).toBe('cafe-policy-b');
  });

  it('ignores empty editor HTML', () => {
    expect(hasText('<p><br></p>')).toBe(false);
    expect(hasText('<p>&nbsp;</p>')).toBe(false);
    expect(hasText('<p>Hi</p>')).toBe(true);
  });
});

describe('LegalPage', () => {
  it('registers the three lazy routes', () => {
    const legal = routes.filter((route) => route.data?.['kind']);
    expect(legal.map((route) => [route.path, route.data?.['kind']])).toEqual([
      ['privacy-policy', 'privacy'],
      ['terms-and-conditions', 'terms'],
      ['cookie-policy', 'cookies'],
    ]);
  });

  const PRIVACY =
    '<p>Intro with <a href="/cookie-policy">cookies</a>.</p>' +
    '<h2>Who I am</h2><p>Contact <a href="mailto:hello@example.com">hello@example.com</a>.</p>' +
    '<h2>What data I collect</h2><h3>Contact form</h3><ul><li><strong>Name</strong></li></ul>' +
    '<h2>Your rights</h2><p>See <a href="https://policies.google.com/privacy">Google</a>.</p>';

  it('renders the Site Settings policy with a TOC, settings date, contact box, cross-links and SEO', () => {
    const { el } = render('privacy', { privacyPolicy: PRIVACY });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Privacy Policy');

    const headings = Array.from(el.querySelectorAll('.legal-content h2'));
    expect(headings.map((h) => h.id)).toEqual(['who-i-am', 'what-data-i-collect', 'your-rights']);

    const tocLinks = Array.from(el.querySelectorAll<HTMLAnchorElement>('nav[aria-labelledby="legal-toc-title"] a'));
    expect(tocLinks.map((a) => a.getAttribute('href'))).toEqual([
      '/privacy-policy#who-i-am',
      '/privacy-policy#what-data-i-collect',
      '/privacy-policy#your-rights',
    ]);

    const content = el.querySelector('.legal-content')!;
    expect(content.querySelector('h3')?.textContent).toBe('Contact form');
    expect(content.innerHTML).toContain('https://policies.google.com/privacy');
    expect(el.querySelector('[data-testid="legal-empty"]')).toBeNull();

    expect(el.querySelector('header time')?.getAttribute('datetime')).toBe('2026-09-20');
    expect(el.querySelector<HTMLAnchorElement>('aside a[href="mailto:hello@example.com"]')).not.toBeNull();

    const related = Array.from(el.querySelectorAll('nav[aria-labelledby="legal-related-title"] a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(related).toEqual(['/terms-and-conditions', '/cookie-policy']);

    // "<title> | <siteName>"; the name comes from the settings effect, which the mock store doesn't run.
    expect(TestBed.inject(Title).getTitle()).toMatch(/^Privacy Policy \| \S/);
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="description"')?.content).toBe(LEGAL_PAGES.privacy.metaDescription);
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/privacy-policy$/);
  });

  it('keeps tables from the admin HTML', () => {
    const { el } = render('cookies', {
      cookiePolicy:
        '<h2>Cookies</h2><table><thead><tr><th scope="col">Name</th></tr></thead>' +
        '<tbody><tr><td>theme-preference</td></tr></tbody></table>',
    });
    expect(el.querySelector('.legal-content table th')?.getAttribute('scope')).toBe('col');
    expect(el.querySelector('.legal-content table td')?.textContent).toBe('theme-preference');
  });

  it('sanitises the admin HTML', () => {
    const { el } = render('cookies', {
      cookiePolicy: '<h2>Our cookies</h2><p>Custom text</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
    });
    const content = el.querySelector('.legal-content')!;
    expect(content.textContent).toContain('Custom text');
    expect(content.innerHTML).not.toContain('<script');
    expect(content.innerHTML).not.toContain('onerror');
    expect(content.querySelector('h2')?.id).toBe('our-cookies');
  });

  for (const [kind, settings] of [
    ['terms', {}],
    ['terms', { termsAndConditions: '<p><br></p>' }],
    ['cookies', { cookiePolicy: '' }],
  ] as const) {
    it(`shows a neutral empty state and noindex when ${kind} is ${JSON.stringify(settings)}`, () => {
      const { el } = render(kind, settings);
      expect(el.querySelector('.legal-content')).toBeNull();
      const empty = el.querySelector('[data-testid="legal-empty"]');
      expect(empty?.textContent).toContain(LEGAL_UI.emptyText);
      expect(el.querySelector('nav[aria-labelledby="legal-toc-title"]')).toBeNull();
      expect(el.querySelector('header time')).toBeNull();
      expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
      // No built-in policy text sneaks back in.
      expect(el.textContent).not.toContain('Intellectual property');
      expect(el.querySelectorAll('nav[aria-labelledby="legal-related-title"] a').length).toBe(2);
    });
  }

  it('hides the contact box when Site Settings has no email', () => {
    const { el } = render('privacy', { privacyPolicy: PRIVACY, contactEmail: undefined });
    expect(el.querySelector('aside[aria-labelledby="legal-contact-title"]')).toBeNull();
  });
});
