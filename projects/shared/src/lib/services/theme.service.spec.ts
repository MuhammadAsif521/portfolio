import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

/** Controllable prefers-color-scheme for jsdom (which has no matchMedia). */
function mockSystemDark(initial: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: initial,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };
  window.matchMedia = ((q: string) =>
    q.includes('prefers-color-scheme') ? query : { matches: true, addEventListener() {}, removeEventListener() {} }) as never;
  return {
    change(dark: boolean) {
      query.matches = dark;
      listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent));
    },
  };
}

const html = () => document.documentElement;

function createService() {
  const service = TestBed.inject(ThemeService);
  TestBed.tick(); // flush the effect that writes data-theme
  return service;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    html().removeAttribute('data-theme');
    html().removeAttribute('data-theme-preference');
    html().removeAttribute('data-site-mode');
    html().removeAttribute('style');
    TestBed.resetTestingModule();
  });

  describe('modes', () => {
    it('defaults to system and follows the OS setting live', () => {
      const os = mockSystemDark(true);
      const service = createService();
      expect(service.preference()).toBe('system');
      expect(service.theme()).toBe('dark');
      expect(html().getAttribute('data-theme')).toBe('dark');
      expect(html().getAttribute('data-theme-preference')).toBe('system');

      os.change(false);
      TestBed.tick();
      expect(html().getAttribute('data-theme')).toBe('light');
    });

    it('an explicit choice wins over the OS and is persisted', () => {
      mockSystemDark(true);
      const service = createService();
      service.setPreference('light');
      TestBed.tick();
      expect(service.theme()).toBe('light');
      expect(html().getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('theme-preference')).toBe('light');
    });

    it('cycles light → dark → system', () => {
      mockSystemDark(false);
      const service = createService();
      service.setPreference('light');
      service.cycle();
      expect(service.preference()).toBe('dark');
      service.cycle();
      expect(service.preference()).toBe('system');
      service.cycle();
      expect(service.preference()).toBe('light');
    });

    it('the site default applies only until the visitor chooses', () => {
      mockSystemDark(false);
      const service = createService();
      service.initFromSiteSettings('dark');
      TestBed.tick();
      expect(service.theme()).toBe('dark');
      expect(html().getAttribute('data-site-mode')).toBe('dark');

      service.setPreference('light');
      service.initFromSiteSettings('dark'); // settings reload must not override the visitor
      expect(service.theme()).toBe('light');

      service.clearPreference();
      expect(service.theme()).toBe('dark');
      expect(localStorage.getItem('theme-preference')).toBeNull();
    });

    it('reads the SSR-rendered site default from <html data-site-mode>', () => {
      mockSystemDark(false);
      html().setAttribute('data-site-mode', 'dark');
      expect(createService().theme()).toBe('dark');
    });

    it('migrates the old two-mode keys', () => {
      mockSystemDark(false);
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('theme-explicit', 'true');
      const service = createService();
      expect(service.preference()).toBe('dark');
      expect(localStorage.getItem('theme-preference')).toBe('dark');
      expect(localStorage.getItem('theme')).toBeNull();
    });

    it('ignores a non-explicit legacy value', () => {
      mockSystemDark(false);
      localStorage.setItem('theme', 'dark'); // written by the old service without an explicit choice
      expect(createService().preference()).toBe('system');
    });
  });

  describe('brand palette', () => {
    it('writes the palette and readable on-colours as CSS variables', () => {
      mockSystemDark(false);
      const service = createService();
      service.applyBrand({ primary: '#1d4ed8', secondary: '#f8fafc', accent: '#38bdf8' });

      const style = html().style;
      expect(style.getPropertyValue('--primary')).toBe('#1D4ED8');
      expect(style.getPropertyValue('--on-primary')).toBe('#FFFFFF');
      expect(style.getPropertyValue('--on-secondary')).toBe('#141414');
      expect(service.brand()).toEqual({ primary: '#1D4ED8', secondary: '#F8FAFC', accent: '#38BDF8' });
    });

    it('gives the default orange near-black text (WCAG AA)', () => {
      mockSystemDark(false);
      createService().applyBrand({ primary: '#FF7A3D', secondary: '#141414', accent: '#FF9A5C' });
      expect(html().style.getPropertyValue('--on-primary')).toBe('#141414');
    });

    it('writes AA-shaded primary text colours for light and dark surfaces', () => {
      mockSystemDark(false);
      createService().applyBrand({ primary: '#D97706', secondary: '#141414', accent: '#FF9A5C' });
      const style = html().style;
      expect(style.getPropertyValue('--primary-ink-light')).toBe('#A75C05'); // 3.2:1 → 4.56:1 on #F2F4F7
      expect(style.getPropertyValue('--primary-ink-dark')).toBe('#D97706'); // already passes on #1F1F1F
    });

    it('ignores invalid colours (keeps the CSS defaults)', () => {
      mockSystemDark(false);
      createService().applyBrand({ primary: 'red; background: url(x)', secondary: '#141414', accent: '#FF9A5C' });
      expect(html().style.getPropertyValue('--primary')).toBe('');
      expect(html().style.getPropertyValue('--secondary')).toBe('#141414');
    });

    it('applySiteSettings sets both layers', () => {
      mockSystemDark(false);
      const service = createService();
      service.applySiteSettings({ siteMode: 'dark', activeTheme: { primary: '#FF7A3D', secondary: '#141414', accent: '#FF9A5C' } });
      TestBed.tick();
      expect(html().getAttribute('data-theme')).toBe('dark');
      expect(html().style.getPropertyValue('--primary')).toBe('#FF7A3D');
    });
  });
});
