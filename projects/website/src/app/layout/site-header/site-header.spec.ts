import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { UiActions } from '../../core/store/ui.feature';
import { SiteHeader } from './site-header';

const settings = {
  _id: 's1',
  siteName: 'Muhammad Asif',
  socialLinks: [],
  siteMode: 'system',
  activeThemeId: 't1',
  activeTheme: null,
  resume: { key: 'resume/a.pdf', url: 'https://cdn.test/resume/a.pdf', generatedAt: '2026-09-23T00:00:00Z' },
};

const state = (menuOpen: boolean) => ({
  site: { settings, status: 'loaded', error: null },
  ui: { activeSection: 'home', menuOpen },
});

async function setup() {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'blog', children: [] }]), provideMockStore({ initialState: state(false) })],
  });
  const fixture = TestBed.createComponent(SiteHeader);
  document.body.appendChild(fixture.nativeElement);
  const store = TestBed.inject(MockStore);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const toggle = el.querySelector<HTMLButtonElement>('button[aria-controls="mobile-menu"]')!;
  const panel = el.querySelector<HTMLElement>('#mobile-menu')!;
  const open = async () => {
    store.setState(state(true));
    await fixture.whenStable();
  };
  return { fixture, store, el, toggle, panel, open };
}

describe('SiteHeader mobile menu', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('starts closed: labelled toggle, inert dialog', async () => {
    const { toggle, panel } = await setup();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Open menu');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('');
  });

  it('dispatches a toggle when the menu button is pressed', async () => {
    const { store, toggle } = await setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    toggle.click();
    expect(dispatch).toHaveBeenCalledWith(UiActions.menuToggled());
  });

  it('when open: numbered links from the shared nav data, CTA, focus moved in, scroll locked', async () => {
    const { el, toggle, panel, open } = await setup();
    await open();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Close menu');
    expect(panel.hasAttribute('inert')).toBe(false);
    const rows = Array.from(panel.querySelectorAll('.mobile-menu__link')).map((a) =>
      a.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toEqual(['01Home', '02What I Do', '03Experience', '04About', '05Projects', '06Blog', '07Contact']);
    expect(panel.querySelector('.mobile-menu__link.is-active')?.getAttribute('aria-current')).toBe('location');
    expect(panel.querySelector<HTMLAnchorElement>('.mobile-menu__cta')?.getAttribute('href')).toBe('/#contact');
    expect(panel.querySelector<HTMLAnchorElement>('.mobile-menu__cta--ghost')?.href).toBe('https://cdn.test/resume/a.pdf');
    expect(panel.querySelector('app-theme-toggle')).toBeTruthy();
    expect(document.activeElement).toBe(el.querySelector('.mobile-menu__close'));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('traps Tab inside the open menu', async () => {
    const { panel, open } = await setup();
    await open();
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('Escape closes it, returns focus to the menu button and releases the scroll lock', async () => {
    const { store, toggle, open, fixture } = await setup();
    await open();
    const dispatch = vi.spyOn(store, 'dispatch');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dispatch).toHaveBeenCalledWith(UiActions.menuClosed());
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(toggle);
    store.setState(state(false));
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('a route link closes the menu', async () => {
    const { store, panel, open } = await setup();
    await open();
    const dispatch = vi.spyOn(store, 'dispatch');
    const blog = Array.from(panel.querySelectorAll<HTMLAnchorElement>('.mobile-menu__link')).find((a) =>
      a.textContent?.includes('Blog'),
    )!;
    blog.click();
    expect(dispatch).toHaveBeenCalledWith(UiActions.menuClosed());
  });
});
