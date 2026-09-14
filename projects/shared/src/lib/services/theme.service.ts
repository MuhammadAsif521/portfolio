import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'theme';
// Set only when the visitor explicitly toggles — distinguishes "never chose,
// currently showing our hardcoded/site default" from "chose dark on purpose".
const THEME_EXPLICIT_KEY = 'theme-explicit';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  readonly theme = signal<Theme>('dark');
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    if (this.isBrowser) {
      const saved = localStorage.getItem(THEME_KEY) as Theme;
      this.applyTheme(saved || 'dark');
    }
  }

  toggle(): void {
    const next = this.theme() === 'light' ? 'dark' : 'light';
    this.applyTheme(next, true);
  }

  /** Applies the site-wide default theme from Site Settings — but only if
   * the visitor has never explicitly chosen one themselves. Safe to call
   * every time settings load; a no-op once the visitor has toggled. */
  initFromSiteSettings(theme: Theme): void {
    if (!this.isBrowser) return;
    if (localStorage.getItem(THEME_EXPLICIT_KEY) === 'true') return;
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme, explicit = false): void {
    this.theme.set(theme);
    if (this.isBrowser) {
      const html = document.documentElement;
      html.classList.toggle('dark', theme === 'dark');
      html.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      if (explicit) localStorage.setItem(THEME_EXPLICIT_KEY, 'true');
    }
  }
}