import { TestBed } from '@angular/core/testing';
import { PublicApiService } from '@shared/services/public-api.service';
import { DEMO_CONTENT } from './core/demo-content';
import { of, throwError } from 'rxjs';
import { MARQUEE_CONTENT } from './content/testimonials.content';
import { Marquee } from './sections/marquee/marquee';
import { Testimonials, initials } from './sections/testimonials/testimonials';

function setup(api: Partial<PublicApiService> = {}, demo = false) {
  // Reduced motion: keeps GSAP from lazy-loading while the test environment tears down.
  window.matchMedia = ((query: string) =>
    ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      { provide: PublicApiService, useValue: api },
      // Demo content is dev-only UI review data; these tests cover real API behaviour.
      { provide: DEMO_CONTENT, useValue: demo },
    ],
  });
}

const quote = (name: string, overrides: Record<string, unknown> = {}) => ({
  _id: name,
  name,
  quote: `A genuine quote from ${name}.`,
  source: 'client',
  order: 0,
  ...overrides,
});

describe('Testimonials', () => {
  async function render(getTestimonials: () => unknown) {
    setup({ getTestimonials } as unknown as Partial<PublicApiService>);
    const fixture = TestBed.createComponent(Testimonials);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('builds initials from the first and last name', () => {
    expect(initials('Ada Lovelace Byron')).toBe('AB');
    expect(initials('  cher ')).toBe('C');
  });

  it('renders each quote with person, rating and a verifiable source link', async () => {
    const el = await render(() =>
      of([
        quote('Jane Smith', {
          role: 'Founder',
          company: 'Acme',
          rating: 4,
          source: 'fiverr',
          sourceUrl: 'https://www.fiverr.com/reviews/1',
        }),
        quote('Sam'),
      ]),
    );
    expect(el.querySelector('#testimonials h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Testimonials That Speak to My Results',
    );
    const cards = el.querySelectorAll('.quote-card');
    expect(cards.length).toBe(2);
    expect(cards[0]?.querySelector('.quote-card__avatar')?.textContent).toBe('JS');
    expect(cards[0]?.querySelector('.quote-card__role')?.textContent).toBe('Founder, Acme');
    expect(cards[0]?.querySelector('.quote-card__rating')?.getAttribute('aria-label')).toBe('4 out of 5 stars');
    expect(cards[0]?.querySelectorAll('.quote-card__rating .is-off').length).toBe(1);
    expect(cards[0]?.querySelector('blockquote')?.textContent?.trim()).toBe('A genuine quote from Jane Smith.');
    const source = cards[0]?.querySelector('.quote-card__source');
    expect(source?.getAttribute('href')).toBe('https://www.fiverr.com/reviews/1');
    expect(source?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(source?.textContent).toContain('View on Fiverr');
    // No rating, role or link when the admin didn't enter them.
    expect(cards[1]?.querySelector('.quote-card__rating, .quote-card__role, .quote-card__source')).toBeNull();
  });

  it('shows clearly labelled demo cards in development when none are published', async () => {
    setup({ getTestimonials: () => of([]) } as unknown as Partial<PublicApiService>, true);
    const fixture = TestBed.createComponent(Testimonials);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const roles = Array.from(el.querySelectorAll('.quote-card__role')).map((node) => node.textContent);
    expect(roles.length).toBe(3);
    expect(roles.every((role) => role?.includes('Demo data'))).toBe(true);
  });

  it('renders nothing when no testimonials are published or the API fails', async () => {
    for (const source of [() => of([]), () => throwError(() => new Error('down'))]) {
      TestBed.resetTestingModule();
      const el = await render(source);
      expect(el.querySelector('section')).toBeNull();
    }
  });
});

describe('Marquee', () => {
  it('exposes the skills once to screen readers and hides the loop copy', async () => {
    setup();
    const fixture = TestBed.createComponent(Marquee);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const lists = el.querySelectorAll('ul');
    expect(lists.length).toBe(2);
    expect(lists[0]?.getAttribute('aria-label')).toBe(MARQUEE_CONTENT.label);
    expect(Array.from(lists[0]!.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      ...MARQUEE_CONTENT.items,
    ]);
    expect(lists[1]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is a CSS-driven loop with no pause button (JS only tunes the speed)', async () => {
    setup();
    const fixture = TestBed.createComponent(Marquee);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.marquee__track')).toBeTruthy();
    expect(el.querySelector('button')).toBeNull();
  });
});
