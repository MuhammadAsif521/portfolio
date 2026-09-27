import { Component, HostListener, OnDestroy, OnInit, Signal, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { NavTab } from '@shared/interfaces/tabs.interface';
import { LayoutMode, LayoutService } from '@shared/services/layout.service';
import { TabService } from '@shared/services/tab.service';
import { NavItem } from '@cusadmin/core/interfaces/nav-item.interface';
import { LayoutSwitcherComponent } from '@cusadmin/layouts/layout-switcher/layout-switcher';
import { navItems } from '@cusadmin/layouts/sidebar-data';
import { SidebarComponent } from '@cusadmin/layouts/sidebar/sidebar';

const APP_NAME = 'Portfolio Admin';

/**
 * Dashboard shell (conb-sites-admin layout): sidebar + topbar, routed content, optional route tabs
 * (route data `tabs` / `activeTab`), Classic/Floating layout switcher. Page title from route data `title`.
 */
@Component({
  selector: 'app-full-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, LayoutSwitcherComponent, TabsComponent],
  templateUrl: './full-layout.html',
  styleUrls: ['./full-layout.scss'],
})
export class FullLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly tabService = inject(TabService);
  private readonly titleService = inject(Title);
  private readonly location = inject(Location);
  private readonly layoutService = inject(LayoutService);
  private readonly destroy$ = new Subject<void>();

  private readonly routeTitle = signal('');
  get pageTitle(): string {
    return this.routeTitle();
  }

  private readonly titleEffect = effect(() => {
    const title = this.routeTitle();
    this.titleService.setTitle(title ? `${title} | ${APP_NAME}` : APP_NAME);
  });

  Items: NavItem[] = navItems;
  showBackButton = false;
  currentTabs: NavTab[] = [];
  activeTab = '';
  isLargeScreen = false;
  isSidebarCollapsed = false;
  isDashboard = false;
  layoutMode: Signal<LayoutMode> = this.layoutService.layoutMode;

  ngOnInit(): void {
    this.checkScreenSize();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.syncFromRoute());
    this.syncFromRoute();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  checkScreenSize(): void {
    this.isLargeScreen = window.innerWidth >= 992;
  }

  onSidebarCollapsed(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  onActiveTabChange(tabValue: string): void {
    this.tabService.activeTab.set(tabValue);
  }

  goBack(): void {
    this.location.back();
  }

  private syncFromRoute(): void {
    let route = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;
    const data = route.snapshot.data;

    this.routeTitle.set(data['title'] || '');
    this.isDashboard = this.router.url === '/';
    this.showBackButton = !this.isDashboard;

    this.currentTabs = (data['tabs'] as NavTab[] | undefined) ?? [];
    const activeTab = data['activeTab'] as string | undefined;
    this.activeTab = this.currentTabs.length
      ? activeTab && this.currentTabs.some((t) => t.value === activeTab)
        ? activeTab
        : this.currentTabs[0]!.value
      : '';
    this.tabService.activeTab.set(this.activeTab);
  }
}
