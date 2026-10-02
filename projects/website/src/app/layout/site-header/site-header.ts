import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { filter } from 'rxjs';
import { BRAND_CONTENT } from '../../content/brand.content';
import { siteFeature } from '../../core/store/site.feature';
import { UiActions, uiFeature } from '../../core/store/ui.feature';
import { MobileMenu } from '../mobile-menu/mobile-menu';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import { NAV_LEFT, NAV_RIGHT, navKey, type NavLink } from './nav-links';

/** Matches the lg breakpoint where the desktop links replace the mobile menu (styles/_mixins.scss). */
const DESKTOP_MIN_WIDTH = 1024;

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, NgTemplateOutlet, IconComponent, ThemeToggle, MobileMenu],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeMenu()',
    '(window:resize)': 'onResize($any($event.target).innerWidth)',
  },
})
export class SiteHeader {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly left = NAV_LEFT;
  protected readonly right = NAV_RIGHT;

  protected readonly siteName = this.store.selectSignal(siteFeature.selectSiteName);
  protected readonly logo = this.store.selectSignal(siteFeature.selectLogo);
  protected readonly resumeUrl = this.store.selectSignal(siteFeature.selectResumeUrl);
  protected readonly activeSection = this.store.selectSignal(uiFeature.selectActiveSection);
  protected readonly menuOpen = this.store.selectSignal(uiFeature.selectMenuOpen);

  /** "AP" mark; hover/focus reveals "Made by Asif". */
  protected readonly brand = BRAND_CONTENT;

  private readonly currentUrl = signal(this.router.url);
  private readonly onHome = computed(() => this.currentUrl().split(/[?#]/)[0] === '/');

  // Sliding active-pill indicator (desktop): positioned over the active link, animated with CSS.
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly linkEls = viewChildren<ElementRef<HTMLElement>>('navLink');
  protected readonly indicator = signal<{ x: number; width: number } | null>(null, {
    // Compared by value: this is written after every render, so a new object each time would loop.
    equal: (a, b) => a?.x === b?.x && a?.width === b?.width,
  });
  protected readonly viewportWidth = signal(0);

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  /** Inline styles the scroll lock replaced, restored on unlock (null while unlocked). */
  private scrollLock: { overflow: string; paddingRight: string } | null = null;

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.closeMenu();
    });

    // Recompute after every render that could move the active link (section change, fonts, resize…).
    afterRenderEffect(() => {
      this.viewportWidth(); // re-measure on resize
      const active = this.activeKey();
      const bar = this.bar()?.nativeElement;
      const link = this.linkEls().find((el) => el.nativeElement.dataset['key'] === active)?.nativeElement;
      if (!bar || !link) {
        this.indicator.set(null);
        return;
      }
      const barBox = bar.getBoundingClientRect();
      const box = link.getBoundingClientRect();
      this.indicator.set({ x: box.left - barBox.left, width: box.width });
    });

    // Mobile menu: lock page scroll while it's open (setScrollLock is a no-op on the server).
    effect(() => this.setScrollLock(this.menuOpen()));
    inject(DestroyRef).onDestroy(() => this.setScrollLock(false));
  }

  /** Nav item that should look active: the Blog route, or the section in view on the home page. */
  protected readonly activeKey = computed(() => {
    if (this.currentUrl().startsWith('/blog')) return 'route:/blog';
    return this.onHome() ? `section:${this.activeSection()}` : '';
  });

  protected keyOf(link: NavLink): string {
    return navKey(link);
  }

  protected isActive(link: NavLink): boolean {
    return this.keyOf(link) === this.activeKey();
  }

  protected toggleMenu(): void {
    this.store.dispatch(UiActions.menuToggled());
  }

  /** Closes the mobile menu and (by default) hands focus back to the button that opened it. */
  protected closeMenu(returnFocus = true): void {
    if (!this.menuOpen()) return;
    this.setScrollLock(false);
    this.store.dispatch(UiActions.menuClosed());
    if (returnFocus) this.menuButton()?.nativeElement.focus({ preventScroll: true });
  }

  protected onResize(width: number): void {
    this.viewportWidth.set(width);
    // Widening past lg swaps the menu for the desktop links; the menu button is hidden there.
    if (width >= DESKTOP_MIN_WIDTH) this.closeMenu(false);
  }

  /**
   * Body scroll lock for the open menu. Pads the body by the scrollbar's width so nothing shifts when
   * the scrollbar disappears (desktop browsers narrower than lg). No-op on the server.
   */
  private setScrollLock(locked: boolean): void {
    if (!this.isBrowser) return;
    const body = this.document.body;
    if (locked && !this.scrollLock) {
      const scrollbar = (this.document.defaultView?.innerWidth ?? 0) - this.document.documentElement.clientWidth;
      this.scrollLock = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
      // The fixed overlay spans the full viewport, so it pads by the same gap to keep its bar aligned.
      body.style.setProperty('--scroll-lock-gap', `${Math.max(scrollbar, 0)}px`);
    } else if (!locked && this.scrollLock) {
      body.style.overflow = this.scrollLock.overflow;
      body.style.paddingRight = this.scrollLock.paddingRight;
      body.style.removeProperty('--scroll-lock-gap');
      this.scrollLock = null;
    }
  }

  /** Clicking a section link while already on the home page: scroll smoothly instead of re-routing. */
  protected onSectionClick(event: MouseEvent, link: NavLink): void {
    if (!link.section || !this.onHome() || !this.isBrowser) return;
    const target = this.document.getElementById(link.section);
    if (!target) return;
    event.preventDefault();
    // Unlock first so the smooth scroll isn't fighting the menu's scroll lock.
    this.closeMenu();
    const reduce = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    this.document.defaultView?.history.replaceState(null, '', `#${link.section}`);
  }
}
