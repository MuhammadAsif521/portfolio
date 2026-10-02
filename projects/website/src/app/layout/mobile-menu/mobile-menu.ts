import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { BRAND_CONTENT } from '../../content/brand.content';
import { siteFeature } from '../../core/store/site.feature';
import { NAV_ALL, navKey, type NavLink } from '../site-header/nav-links';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen mobile navigation (below lg), opened by the header's menu button. The host element is the
 * modal dialog: focus moves to its close button on open and Tab is trapped inside. The header owns the
 * open state (UI store), Escape, close-on-navigation and the body scroll lock.
 */
@Component({
  selector: 'app-mobile-menu',
  imports: [RouterLink, NgTemplateOutlet, IconComponent, ThemeToggle],
  templateUrl: './mobile-menu.html',
  styleUrl: './mobile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    id: 'mobile-menu',
    class: 'mobile-menu',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Site menu',
    '[class.mobile-menu--open]': 'open()',
    '[attr.inert]': "open() ? null : ''",
    '[attr.aria-hidden]': "open() ? null : 'true'",
    '(keydown)': 'onKeydown($event)',
  },
})
export class MobileMenu {
  private readonly store = inject(Store);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = input(false);
  /** Same key the desktop nav uses for its active pill (see navKey). */
  readonly activeKey = input('');
  /** Close button, route link or Resume pressed. */
  readonly closeRequest = output<void>();
  /** A home-page section link was pressed; the header scrolls to it (or lets the router navigate). */
  readonly sectionClick = output<{ event: MouseEvent; link: NavLink }>();

  protected readonly links = NAV_ALL;
  /** Target of the "Hire me" CTA (same as the hero's). */
  protected readonly contactLink = NAV_ALL.find((link) => link.section === 'contact') ?? NAV_ALL[NAV_ALL.length - 1];
  protected readonly brand = BRAND_CONTENT;
  protected readonly siteName = this.store.selectSignal(siteFeature.selectSiteName);
  protected readonly logo = this.store.selectSignal(siteFeature.selectLogo);
  protected readonly resumeUrl = this.store.selectSignal(siteFeature.selectResumeUrl);

  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  constructor() {
    // Move focus into the dialog once it has rendered open (browser only: afterRenderEffect never runs on the server).
    afterRenderEffect(() => {
      if (this.open()) this.closeButton()?.nativeElement.focus({ preventScroll: true });
    });
  }

  protected isActive(link: NavLink): boolean {
    return navKey(link) === this.activeKey();
  }

  /** "01", "02"… */
  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  /** Keeps Tab / Shift+Tab inside the open dialog. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.open()) return;
    const panel = this.host.nativeElement;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
}
