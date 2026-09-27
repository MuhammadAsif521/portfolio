import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { environment } from '@shared/environment/environment';
import { LayoutMode } from '@shared/services/layout.service';
import { ThemeService } from '@shared/services/theme.service';
import { getUserFullName, getUserInitials } from '@shared/utils/user.util';
import { NavItem } from '@cusadmin/core/interfaces/nav-item.interface';
import { AuthService } from '@cusadmin/services/auth.service';
import { selectProfileUser } from '@cusadmin/store/profile/profile.feature';

/**
 * Topbar + sidebar (conb-sites-admin layout): collapsible grouped nav, profile menu, theme toggle,
 * mobile drawer below 992px. Collapsed state persists in localStorage.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, MatTooltipModule, MatDialogModule, MatMenuModule, IconComponent, LoadingButtonComponent],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  readonly themeSer = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly store = inject(Store);
  private readonly destroy$ = new Subject<void>();

  @Input() navItems: NavItem[] = [];
  @Input() pageTitle = '';
  @Input() showBackButton = false;
  @Input() layoutMode: LayoutMode = 'default';
  @Output() onBackClick = new EventEmitter<void>();
  @Output() sidebarCollapsed = new EventEmitter<boolean>();

  readonly brandMark = 'AP';
  readonly brandName = 'Asif Portfolio';
  readonly siteUrl = environment.siteUrl;
  readonly userData = toSignal(this.store.select(selectProfileUser), { initialValue: null });

  isSidebarCollapsed = false;
  mobileOpen = false;
  isLargeScreen = false;
  currentRoute = '/';
  private readonly storageKey = 'portfolio_admin_sidebar_collapsed';

  expandedGroups = new Set<string>();

  get filteredNavItems(): NavItem[] {
    const visible = this.navItems.filter((item) => item.navCap || (!item.hidden && item.route));
    // Drop captions whose group ended up empty.
    return visible.filter((item, i) => {
      if (!item.navCap) return true;
      const next = visible[i + 1];
      return !!next && !next.navCap;
    });
  }

  get navGroups(): { cap: string; items: NavItem[] }[] {
    const groups: { cap: string; items: NavItem[] }[] = [];
    let current: { cap: string; items: NavItem[] } | null = null;
    for (const item of this.filteredNavItems) {
      if (item.navCap) {
        current = { cap: item.navCap, items: [] };
        groups.push(current);
      } else if (current) {
        current.items.push(item);
      }
    }
    return groups;
  }

  ngOnInit(): void {
    this.restoreState();
    this.checkScreenSize();
    this.currentRoute = this.router.url;
    // All groups start expanded; the admin can fold the ones they don't use.
    for (const group of this.navGroups) this.expandedGroups.add(group.cap);

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.urlAfterRedirects;
        this.mobileOpen = false;
        this.expandActiveGroup();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleGroup(cap: string): void {
    if (this.isSidebarCollapsed && this.isLargeScreen) return;
    if (this.expandedGroups.has(cap)) this.expandedGroups.delete(cap);
    else this.expandedGroups.add(cap);
  }

  isGroupExpanded(cap: string): boolean {
    if (this.isSidebarCollapsed && this.isLargeScreen) return true;
    return this.expandedGroups.has(cap);
  }

  private expandActiveGroup(): void {
    const active = this.navGroups.find((group) => group.items.some((item) => this.isActive(item.route)));
    if (active) this.expandedGroups.add(active.cap);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  checkScreenSize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLargeScreen = window.innerWidth >= 992;
    if (this.isLargeScreen) this.mobileOpen = false;
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.storageKey, String(this.isSidebarCollapsed));
      } catch {
        /* storage unavailable */
      }
    }
    this.sidebarCollapsed.emit(this.isSidebarCollapsed);
  }

  toggleMobileSidebar(): void {
    this.mobileOpen = !this.mobileOpen;
  }

  onMenuItemClick(): void {
    if (!this.isLargeScreen) this.mobileOpen = false;
  }

  private restoreState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(this.storageKey);
    } catch {
      /* storage unavailable */
    }
    if (saved !== null) {
      this.isSidebarCollapsed = saved === 'true';
      this.sidebarCollapsed.emit(this.isSidebarCollapsed);
    }
  }

  isActive(route?: string): boolean {
    if (!route) return false;
    const current = this.normalize(this.currentRoute);
    const target = this.normalize(route);
    return target === '/' ? current === '/' : current === target || current.startsWith(`${target}/`);
  }

  private normalize(route: string): string {
    const clean = route.split('?')[0]!.split('#')[0]!;
    if (clean === '/') return '/';
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  getUserInitials(user: Parameters<typeof getUserInitials>[0]): string {
    return getUserInitials(user);
  }

  getFullName(user: Parameters<typeof getUserFullName>[0]): string {
    return getUserFullName(user);
  }

  getRoleName(): string {
    return this.userData()?.role === 'admin' ? 'Administrator' : '';
  }

  openLogoutDialog(): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Logout',
        message: 'You will be signed out of the portfolio admin panel.',
        confirmText: 'Logout',
        tone: 'warning',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.auth.logout().subscribe({
              next: () => {
                void this.router.navigate(['/login']);
                resolve(true);
              },
              error: () => resolve(false),
            });
          }),
      },
    });
  }
}
