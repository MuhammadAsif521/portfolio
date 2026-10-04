import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { DARK_SURFACE, LIGHT_SURFACE, isHexColor, readableShade, readableTextOn } from '../utils/color.util';

/** The mode actually rendered. */
export type ThemeMode = 'light' | 'dark';
/** What the visitor (or the site default) asked for; 'system' follows the OS setting. */
export type ThemePreference = ThemeMode | 'system';
/** @deprecated Use ThemeMode. Kept for existing imports. */
export type Theme = ThemeMode;

/** Admin-managed brand palette (the active Theme from GET /api/v1/public/settings). */
export interface BrandPalette {
  primary: string;
  secondary: string;
  accent: string;
}

// localStorage keys. `theme-preference` is written only when the visitor explicitly picks a mode.
const PREFERENCE_KEY = 'theme-preference';
// Keys used before three-mode support; read once for migration.
const LEGACY_THEME_KEY = 'theme';
const LEGACY_EXPLICIT_KEY = 'theme-explicit';

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const isPreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TRANSITION_CLASS = 'theme-transition';
const TRANSITION_MS = 350;

/**
 * Two independent theming layers (brief, Part 7):
 *
 * 1. Mode — light / dark / system. `<html data-theme>` always holds the resolved mode, so the CSS
 *    tokens and Tailwind's `dark:` variant work unchanged. The inline script in index.html resolves it
 *    before first paint (no flash); this service keeps it in sync afterwards, including live OS changes.
 *    Precedence: the visitor's explicit choice → the admin's site default → 'system'.
 *
 * 2. Brand — the admin-selected palette, written as --primary/--secondary/--accent (plus readable
 *    --on-* text colours) on <html>. Works during SSR, so the first HTML already has the right colours.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly root = this.document.documentElement;

  /** The visitor's explicit choice, or null if they never picked one. */
  private readonly explicitPreference = signal<ThemePreference | null>(null);
  /** The admin's default from Site Settings (siteMode). */
  private readonly siteDefault = signal<ThemePreference>('system');
  /** The OS setting, tracked live in the browser. */
  private readonly systemMode = signal<ThemeMode>('light');

  /** Effective preference: explicit choice → site default → system. */
  readonly preference = computed<ThemePreference>(() => this.explicitPreference() ?? this.siteDefault());
  /** The mode being rendered (what `data-theme` holds). */
  readonly theme = computed<ThemeMode>(() => {
    const preference = this.preference();
    return preference === 'system' ? this.systemMode() : preference;
  });
  readonly isDark = computed(() => this.theme() === 'dark');
  /** True when the visitor has made an explicit choice (vs. following the site default). */
  readonly hasExplicitPreference = computed(() => this.explicitPreference() !== null);

  readonly brand = signal<BrandPalette | null>(null);

  constructor() {
    if (!this.isBrowser) return; // SSR: the inline script resolves the mode in the visitor's browser

    this.explicitPreference.set(this.readStoredPreference());
    const siteAttr = this.root.getAttribute('data-site-mode');
    if (isPreference(siteAttr)) this.siteDefault.set(siteAttr);

    const media = this.media(DARK_QUERY);
    if (media) {
      this.systemMode.set(media.matches ? 'dark' : 'light');
      const onChange = (event: MediaQueryListEvent) => this.systemMode.set(event.matches ? 'dark' : 'light');
      media.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
    }

    effect(() => {
      this.root.setAttribute('data-theme', this.theme());
      this.root.setAttribute('data-theme-preference', this.preference());
    });
  }

  // ── Mode ─────────────────────────────────────────────────────────────────

  /** Explicit visitor choice from the theme menu/toggle; persisted in localStorage. */
  setPreference(preference: ThemePreference): void {
    this.withTransition(() => this.explicitPreference.set(preference));
    this.store(PREFERENCE_KEY, preference);
  }

  /** Cycles light → dark → system (for a single icon button). */
  cycle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    this.setPreference(order[(order.indexOf(this.preference()) + 1) % order.length]!);
  }

  /** Flips between light and dark explicitly (leaves system mode). */
  toggle(): void {
    this.setPreference(this.theme() === 'dark' ? 'light' : 'dark');
  }

  /** Forgets the visitor's choice and follows the site default again. */
  clearPreference(): void {
    this.withTransition(() => this.explicitPreference.set(null));
    this.remove(PREFERENCE_KEY);
  }

  /**
   * Applies the admin's default mode from Site Settings. Only affects visitors who haven't chosen
   * themselves. Safe to call on every settings load; also runs during SSR, where it records the
   * default on <html data-site-mode> so the inline script can use it before first paint.
   */
  initFromSiteSettings(mode: ThemePreference | null | undefined): void {
    const next = isPreference(mode) ? mode : 'system';
    this.siteDefault.set(next);
    this.root.setAttribute('data-site-mode', next);
  }

  // ── Brand palette ────────────────────────────────────────────────────────

  /**
   * Writes the active Theme's colours as CSS custom properties on <html> (SSR and browser), with
   * --on-* text colours chosen for contrast. Invalid colours are ignored, so the CSS defaults stay.
   */
  applyBrand(palette: Partial<BrandPalette> | null | undefined): void {
    if (!palette) return;
    const valid: Partial<BrandPalette> = {};
    for (const key of ['primary', 'secondary', 'accent'] as const) {
      const value = palette[key];
      if (isHexColor(value)) {
        valid[key] = value.toUpperCase();
        this.root.style.setProperty(`--${key}`, valid[key]);
        this.root.style.setProperty(`--on-${key}`, readableTextOn(valid[key]));
      }
    }
    // Brand-coloured text on page surfaces (links, accents): the primary, shaded only as far as AA needs.
    if (valid.primary) {
      this.root.style.setProperty('--primary-ink-light', readableShade(valid.primary, LIGHT_SURFACE));
      this.root.style.setProperty('--primary-ink-dark', readableShade(valid.primary, DARK_SURFACE));
    }
    if (valid.primary && valid.secondary && valid.accent) this.brand.set(valid as BrandPalette);
  }

  /** Convenience for the settings response: `{ siteMode, activeTheme }`. */
  applySiteSettings(settings: { siteMode?: ThemePreference; activeTheme?: Partial<BrandPalette> | null }): void {
    this.initFromSiteSettings(settings.siteMode);
    this.applyBrand(settings.activeTheme);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private readStoredPreference(): ThemePreference | null {
    const stored = this.read(PREFERENCE_KEY);
    if (isPreference(stored)) return stored;

    // Migrate the two-mode keys: only an explicit legacy choice counts as a preference.
    const legacy = this.read(LEGACY_THEME_KEY);
    const wasExplicit = this.read(LEGACY_EXPLICIT_KEY) === 'true';
    this.remove(LEGACY_THEME_KEY);
    this.remove(LEGACY_EXPLICIT_KEY);
    if (wasExplicit && (legacy === 'light' || legacy === 'dark')) {
      this.store(PREFERENCE_KEY, legacy);
      return legacy;
    }
    return null;
  }

  /** Briefly enables colour transitions so an explicit switch fades instead of snapping. */
  private withTransition(change: () => void): void {
    const view = this.document.defaultView;
    const reduced = this.media(REDUCED_MOTION_QUERY)?.matches ?? true;
    if (!this.isBrowser || reduced) {
      change();
      return;
    }
    this.root.classList.add(TRANSITION_CLASS);
    change();
    view?.setTimeout(() => this.root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
  }

  /** matchMedia is missing in some environments (jsdom, old embedded browsers). */
  private media(query: string): MediaQueryList | null {
    const view = this.document.defaultView;
    return view && typeof view.matchMedia === 'function' ? view.matchMedia(query) : null;
  }

  // localStorage can throw (private mode, blocked storage); theming must never break the page.
  private read(key: string): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private store(key: string, value: string): void {
    try {
      this.document.defaultView?.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the choice lasts for this page view only */
    }
  }

  private remove(key: string): void {
    try {
      this.document.defaultView?.localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}
