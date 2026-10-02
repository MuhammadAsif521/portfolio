import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { routes } from './app.routes';
import { LEGAL_DEFAULTS_UPDATED, LEGAL_PAGES } from './pages/legal/legal.content';
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

  it('renders the built-in privacy policy with a TOC, contact box and SEO', () => {
    const { el } = render('privacy');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Privacy Policy');

    const headings = Array.from(el.querySelectorAll('.legal-content h2'));
    expect(headings.length).toBeGreaterThan(8);
    expect(headings.every((h) => /^[a-z0-9-]+$/.test(h.id))).toBe(true);

    const tocLinks = Array.from(el.querySelectorAll<HTMLAnchorElement>('nav[aria-labelledby="legal-toc-title"] a'));
    expect(tocLinks.length).toBe(headings.length);
    expect(tocLinks[0]!.getAttribute('href')).toBe(`/privacy-policy#${headings[0]!.id}`);

    const content = el.querySelector('.legal-content')!.innerHTML;
    expect(content).toContain('https://policies.google.com/privacy');
    expect(content).toContain('https://policies.google.com/terms');
    expect(content).toContain('hello@example.com');

    // Default content: the template's own date, not Site Settings updatedAt.
    expect(el.querySelector('header time')?.getAttribute('datetime')).toBe(LEGAL_DEFAULTS_UPDATED);
    expect(el.querySelector<HTMLAnchorElement>('a[href="mailto:hello@example.com"]')).not.toBeNull();

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

  it('lists the real cookies and storage keys in the cookie policy', () => {
    const { el } = render('cookies');
    const text = el.querySelector('.legal-table')?.textContent ?? '';
    for (const name of ['public_session_token', 'public-session-expires-at', 'theme-preference', '_GRECAPTCHA']) {
      expect(text).toContain(name);
    }
    expect(el.querySelectorAll('.legal-table tbody tr').length).toBe(4);
  });

  it('uses the settings country for governing law', () => {
    const { el } = render('terms', { country: 'Norway' });
    expect(el.querySelector('.legal-content')?.textContent).toContain('governed by the laws of Norway');
  });

  it('prefers the admin HTML (sanitised) and dates it from Site Settings', () => {
    const { el } = render('cookies', {
      cookiePolicy: '<h2>Our cookies</h2><p>Custom text</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
    });
    const content = el.querySelector('.legal-content')!;
    expect(content.textContent).toContain('Custom text');
    expect(content.innerHTML).not.toContain('<script');
    expect(content.innerHTML).not.toContain('onerror');
    expect(content.querySelector('h2')?.id).toBe('our-cookies');
    expect(el.querySelector('header time')?.getAttribute('datetime')).toBe('2026-09-20');
  });

  it('falls back to the default when the admin field is empty editor markup', () => {
    const { el } = render('terms', { termsAndConditions: '<p><br></p>' });
    expect(el.querySelector('.legal-content')?.textContent).toContain('Intellectual property');
  });
});
