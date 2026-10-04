import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CONSENT_COOKIE, ConsentService } from '../../services/consent.service';
import { CookieConsentComponent } from './cookie-consent';

function clearCookie() {
  document.cookie = `${CONSENT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(CookieConsentComponent);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, consent: TestBed.inject(ConsentService) };
}

const button = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

describe('CookieConsentComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    clearCookie();
  });
  afterEach(() => clearCookie());

  it('shows for a first visit with equal Accept / Reject choices and a cookie policy link', async () => {
    const { el } = await render();
    const region = el.querySelector('section[role="region"]');
    expect(region?.getAttribute('aria-labelledby')).toBe('consent-title');
    expect(button(el, 'Accept analytics')).toBeTruthy();
    expect(button(el, 'Reject')).toBeTruthy();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/cookie-policy');
  });

  it('Accept stores the choice and hides the banner', async () => {
    const { fixture, el, consent } = await render();
    button(el, 'Accept analytics').click();
    await fixture.whenStable();
    expect(consent.analyticsGranted()).toBe(true);
    expect(el.querySelector('section')).toBeNull();
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":true');
  });

  it('Reject stores a denied choice', async () => {
    const { fixture, el, consent } = await render();
    button(el, 'Reject').click();
    await fixture.whenStable();
    expect(consent.analyticsGranted()).toBe(false);
    expect(consent.answered()).toBe(true);
    expect(el.querySelector('section')).toBeNull();
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":false');
  });

  it('stays hidden for a returning visitor and reopens from "Cookie settings" with focus; Escape closes it', async () => {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent('{"analytics":false}')}; path=/`;
    const { fixture, el, consent } = await render();
    expect(el.querySelector('section')).toBeNull();

    consent.reopen();
    await fixture.whenStable();
    const region = el.querySelector<HTMLElement>('section');
    expect(region).toBeTruthy();
    expect(document.activeElement).toBe(region);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('section')).toBeNull();
    expect(consent.analyticsGranted()).toBe(false);
  });
});
