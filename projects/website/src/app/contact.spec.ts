import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { PublicApiService } from '@shared/services/public-api.service';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CONTACT_CONTENT } from './content/contact.content';
import { SiteFooter } from './layout/site-footer/site-footer';
import { Contact } from './sections/contact/contact';
import { ContactForm } from './ui/contact-form/contact-form';
import { QuickContact } from './ui/quick-contact/quick-contact';
import { brandKey } from './ui/social-icon/social-icon';

function setup(submitContact: ReturnType<typeof vi.fn>, settings: Record<string, unknown> | null = null) {
  // Reduced motion: keeps GSAP from lazy-loading while the test environment tears down.
  window.matchMedia = ((query: string) =>
    ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: { site: { settings, status: 'loaded', error: null }, ui: { activeSection: 'home', menuOpen: false } },
      }),
      { provide: PublicApiService, useValue: { submitContact } },
    ],
  });
}

function type(el: HTMLElement, selector: string, value: string) {
  const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submit(el: HTMLElement) {
  el.querySelector('form')!.dispatchEvent(new Event('submit'));
}

describe('QuickContact (CTA / footer email box)', () => {
  async function render(submitContact: ReturnType<typeof vi.fn>, source: 'cta' | 'footer' = 'cta') {
    setup(submitContact);
    const fixture = TestBed.createComponent(QuickContact);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('label', 'Your email address');
    fixture.componentRef.setInput('sentText', 'Thanks!');
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('labels the field for screen readers and blocks an invalid email without calling the API', async () => {
    const api = vi.fn();
    const { fixture, el } = await render(api);
    expect(el.querySelector('label.sr-only')?.textContent).toBe('Your email address');
    expect(el.querySelector('input[type="email"]')?.getAttribute('autocomplete')).toBe('email');

    type(el, 'input[type="email"]', 'not-an-email');
    submit(el);
    await fixture.whenStable();
    expect(api).not.toHaveBeenCalled();
    const input = el.querySelector('input[type="email"]')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent?.trim()).toBe(
      'Please enter a valid email address.',
    );
  });

  it('sends email + source and then shows the confirmation', async () => {
    const api = vi.fn(() => of({ received: true }));
    const { fixture, el } = await render(api, 'footer');
    type(el, 'input[type="email"]', 'lead@example.com');
    submit(el);
    await fixture.whenStable();
    expect(api).toHaveBeenCalledWith({ email: 'lead@example.com', source: 'footer' });
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Thanks!');
    expect(el.querySelector('form')).toBeNull();
  });

  it('shows the server message (e.g. rate limit) and keeps the email for a retry', async () => {
    const api = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 429, error: { message: 'Too many messages. Try later.' } })),
    );
    const { fixture, el } = await render(api);
    type(el, 'input[type="email"]', 'lead@example.com');
    submit(el);
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Too many messages. Try later.');
    expect(el.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe('lead@example.com');
  });

  it('passes a filled honeypot through so the server can discard the bot', async () => {
    const api = vi.fn(() => of({ received: true }));
    const { fixture, el } = await render(api);
    type(el, 'input[type="email"]', 'bot@example.com');
    type(el, '.quick__hp input', 'https://spam.example');
    submit(el);
    await fixture.whenStable();
    expect(api).toHaveBeenCalledWith({ email: 'bot@example.com', source: 'cta', website: 'https://spam.example' });
  });
});

describe('ContactForm (full form)', () => {
  async function render(submitContact: ReturnType<typeof vi.fn>) {
    setup(submitContact);
    const fixture = TestBed.createComponent(ContactForm);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('marks every missing field, focuses the first, and does not send', async () => {
    const api = vi.fn();
    const { fixture, el } = await render(api);
    submit(el);
    await fixture.whenStable();
    expect(api).not.toHaveBeenCalled();
    const invalid = Array.from(el.querySelectorAll('[aria-invalid="true"]')).map((node) => node.id);
    expect(invalid).toEqual(['contact-name', 'contact-email', 'contact-message']);
    expect(document.activeElement?.id).toBe('contact-name');
    expect(el.querySelector('#contact-message-error')?.textContent?.trim()).toBe('Message is required.');
  });

  it('requires a message of at least 10 characters, like the API', async () => {
    const api = vi.fn();
    const { fixture, el } = await render(api);
    type(el, '#contact-message', 'Too short');
    submit(el);
    await fixture.whenStable();
    expect(el.querySelector('#contact-message-error')?.textContent?.trim()).toBe(
      `Please write at least ${CONTACT_CONTENT.form.messageMin} characters.`,
    );
  });

  it('sends a trimmed payload with source contact-form, omitting a blank subject', async () => {
    const api = vi.fn(() => of({ received: true }));
    const { fixture, el } = await render(api);
    type(el, '#contact-name', '  Jane  ');
    type(el, '#contact-email', 'jane@example.com');
    type(el, '#contact-message', '  I need an Angular SSR storefront.  ');
    submit(el);
    await fixture.whenStable();
    expect(api).toHaveBeenCalledWith({
      name: 'Jane',
      email: 'jane@example.com',
      message: 'I need an Angular SSR storefront.',
      source: 'contact-form',
    });
    expect(el.querySelector('[role="status"]')?.textContent).toContain(CONTACT_CONTENT.form.sent);
  });
});

describe('Contact section', () => {
  it('is the #contact anchor with badges and a disclosure for the full form', async () => {
    setup(vi.fn());
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('section#contact h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${CONTACT_CONTENT.cta.title} ${CONTACT_CONTENT.cta.accent}`,
    );
    expect(Array.from(el.querySelectorAll('.contact__badge')).map((b) => b.textContent?.trim())).toEqual(
      CONTACT_CONTENT.cta.badges.map((badge) => badge.label),
    );

    const toggle = el.querySelector<HTMLButtonElement>('.contact__toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('app-contact-form')).toBeNull();
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#contact-full-form app-contact-form')).toBeTruthy();
  });
});

describe('SiteFooter', () => {
  it('maps social labels to brand marks', () => {
    expect(brandKey('LinkedIn')).toBe('linkedin');
    expect(brandKey('GitHub')).toBe('github');
    expect(brandKey('Twitter / X')).toBe('x');
    expect(brandKey('X')).toBe('x');
    expect(brandKey('Fiverr')).toBeNull();
  });

  it('uses Site Settings, renders only safe social links, and falls back to the brief contact', async () => {
    setup(vi.fn(), {
      siteName: 'Muhammad Asif',
      description: 'MEAN stack developer.',
      socialLinks: [
        { label: 'LinkedIn', value: 'https://www.linkedin.com/in/example' },
        { label: 'Evil', value: 'javascript:alert(1)' },
      ],
    });
    const fixture = TestBed.createComponent(SiteFooter);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const socials = el.querySelectorAll('.footer__social');
    expect(socials.length).toBe(1);
    expect(socials[0]?.getAttribute('href')).toBe('https://www.linkedin.com/in/example');
    expect(socials[0]?.querySelector('svg path')).toBeTruthy();

    expect(el.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toBe(`mailto:${CONTACT_CONTENT.footer.email}`);
    expect(el.querySelector('address')?.textContent).toContain(CONTACT_CONTENT.footer.location);
    expect(el.querySelector('.footer__description')?.textContent?.trim()).toBe('MEAN stack developer.');
    expect(el.querySelector('.footer__bottom')?.textContent).toContain(`© ${new Date().getFullYear()} Muhammad Asif`);
    expect(el.querySelector('app-quick-contact')).toBeTruthy();
  });
});
