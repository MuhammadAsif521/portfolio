import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SERVICE_PAGES } from '@shared/services-pages/services.data';
import { provideTestStore } from '../../testing/store.testing';
import { FAQ_CONTENT } from '../../content/faq.content';
import { FaqPage } from '../faq/faq-page';
import { ServicePageComponent } from './service-page';
import { ServicesHubPage } from './services-hub';

const initialState = {
  site: { settings: { _id: 's1', siteName: 'Muhammad Asif', socialLinks: [] }, status: 'loaded', error: null },
  ui: { activeSection: 'home', menuOpen: false },
};

function setup() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideTestStore(initialState)] });
}

describe('/services hub', () => {
  beforeEach(setup);

  it('lists every service as the home page card, each linking to its page, under one h1', async () => {
    const fixture = TestBed.createComponent(ServicesHubPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    const cards = Array.from(el.querySelectorAll('article.service-card'));
    expect(cards.length).toBe(SERVICE_PAGES.length);
    for (const [i, card] of cards.entries()) {
      const link = card.querySelector<HTMLAnchorElement>('h2 > a.service-card__link');
      expect(link?.getAttribute('href'), SERVICE_PAGES[i].slug).toBe('/services/' + SERVICE_PAGES[i].slug);
      expect(card.querySelectorAll('a, button, [tabindex]').length).toBe(1);
      expect(card.querySelector('.service-card__screen .service-card__chip')).toBeTruthy();
    }
  });
});

describe('/services/:slug', () => {
  beforeEach(setup);

  it('renders the hero, included list, numbered steps, case studies and every FAQ answer', async () => {
    const s = SERVICE_PAGES[0];
    const fixture = TestBed.createComponent(ServicePageComponent);
    fixture.componentRef.setInput('slug', s.slug);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(s.h1);
    expect(el.querySelectorAll('.sp__included li').length).toBe(s.included.length);
    expect(el.querySelectorAll('.sp__step').length).toBe(s.process.length);
    expect(el.querySelectorAll('.sp__case').length).toBe(s.caseStudies.length);
    expect(el.querySelectorAll('.sp__faq details p').length).toBe(s.faq.length);
    expect(el.querySelector('a[href="/#contact"]')).toBeTruthy();
    // Decorative images are hidden from assistive tech.
    for (const img of Array.from(el.querySelectorAll('img'))) expect(img.getAttribute('alt')).toBe('');
  });

  it('shows a not-found message for an unknown slug', async () => {
    const fixture = TestBed.createComponent(ServicePageComponent);
    fixture.componentRef.setInput('slug', 'nope');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Service not found');
    expect(el.querySelector('a[href="/services"]')).toBeTruthy();
  });
});

describe('/faq', () => {
  beforeEach(setup);

  it('answers the general questions and points each service question at its page', async () => {
    const fixture = TestBed.createComponent(FaqPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    const questions = Array.from(el.querySelectorAll('.faqp__q')).map((h) => h.textContent?.trim());
    expect(questions.length).toBeGreaterThanOrEqual(10);
    // /faq keeps every question (the home page only shows the first five).
    expect(questions.slice(0, FAQ_CONTENT.items.length)).toEqual(FAQ_CONTENT.items.map((i) => i.question));
    expect(questions.every((q) => q?.endsWith('?'))).toBe(true);
    for (const s of SERVICE_PAGES) expect(el.querySelector(`a[href="/services/${s.slug}"]`), s.slug).toBeTruthy();
  });

  it('marks up every general question as a complete FAQPage', async () => {
    const fixture = TestBed.createComponent(FaqPage);
    await fixture.whenStable();
    const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((n) => {
      const parsed = JSON.parse(n.textContent ?? '[]');
      return parsed['@graph'] ?? (Array.isArray(parsed) ? parsed : [parsed]);
    });
    const page = nodes.find((n) => [n['@type']].flat().includes('FAQPage'));
    expect(page).toBeTruthy();
    const entities = page.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities.length).toBe(FAQ_CONTENT.items.length);
    expect(entities.map((e) => e.name)).toEqual(FAQ_CONTENT.items.map((i) => i.question));
    for (const e of entities) expect(e.acceptedAnswer.text.length).toBeGreaterThan(40);
  });
});
