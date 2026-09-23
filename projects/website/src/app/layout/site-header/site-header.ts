import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { filter } from 'rxjs';
import { siteFeature } from '../../core/store/site.feature';
import { UiActions, uiFeature } from '../../core/store/ui.feature';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import { NAV_ALL, NAV_LEFT, NAV_RIGHT, type NavLink } from './nav-links';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, NgTemplateOutlet, IconComponent, ThemeToggle],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeMenu()',
    '(window:resize)': 'viewportWidth.set($any($event.target).innerWidth)',
  },
})
export class SiteHeader {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly left = NAV_LEFT;
  protected readonly right = NAV_RIGHT;
  protected readonly all = NAV_ALL;

  protected readonly siteName = this.store.selectSignal(siteFeature.selectSiteName);
  protected readonly logo = this.store.selectSignal(siteFeature.selectLogo);
  protected readonly resumeUrl = this.store.selectSignal(siteFeature.selectResumeUrl);
  protected readonly activeSection = this.store.selectSignal(uiFeature.selectActiveSection);
  protected readonly menuOpen = this.store.selectSignal(uiFeature.selectMenuOpen);

  /** "MA" mark from the site name (brief: "MA" mark + "Muhammad Asif"). */
  protected readonly initials = computed(() =>
    this.siteName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join(''),
  );

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
  private readonly firstMenuLink = viewChild<ElementRef<HTMLAnchorElement>>('firstMenuLink');

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

    // Move focus into the mobile menu when it opens, and back to the button when it closes.
    afterRenderEffect(() => {
      if (!this.isBrowser) return;
      if (this.menuOpen()) this.firstMenuLink()?.nativeElement.focus();
    });
  }

  /** Nav item that should look active: the Blog route, or the section in view on the home page. */
  protected readonly activeKey = computed(() => {
    if (this.currentUrl().startsWith('/blog')) return 'route:/blog';
    return this.onHome() ? `section:${this.activeSection()}` : '';
  });

  protected keyOf(link: NavLink): string {
    return link.route ? `route:${link.route}` : `section:${link.section ?? ''}`;
  }

  protected isActive(link: NavLink): boolean {
    return this.keyOf(link) === this.activeKey();
  }

  protected toggleMenu(): void {
    this.store.dispatch(UiActions.menuToggled());
  }

  protected closeMenu(): void {
    if (!this.menuOpen()) return;
    this.store.dispatch(UiActions.menuClosed());
    this.menuButton()?.nativeElement.focus();
  }

  /** Clicking a section link while already on the home page: scroll smoothly instead of re-routing. */
  protected onSectionClick(event: MouseEvent, link: NavLink): void {
    if (!link.section || !this.onHome() || !this.isBrowser) return;
    const target = this.document.getElementById(link.section);
    if (!target) return;
    event.preventDefault();
    const reduce = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    this.document.defaultView?.history.replaceState(null, '', `#${link.section}`);
    this.store.dispatch(UiActions.menuClosed());
  }
}
