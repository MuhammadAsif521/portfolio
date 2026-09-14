import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type LayoutMode = 'default' | 'float' | 'top-nav';

export interface LayoutConfig {
  mode: LayoutMode;
  label: string;
  icon: string;
  description: string;
}

export const LAYOUT_CONFIGS: LayoutConfig[] = [
  {
    mode: 'default',
    label: 'Classic Sidebar',
    icon: 'pi pi-table',
    description: 'Collapsible sidebar + stacked top header',
  },
  {
    mode: 'float',
    label: 'Floating',
    icon: 'pi pi-clone',
    description: 'Floating sidebar + floating topbar',
  },
];

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly storageKey = 'app_layout_mode';

  readonly layoutMode = signal<LayoutMode>(this.loadSavedLayout());

  readonly currentConfig = computed(() =>
    LAYOUT_CONFIGS.find((config) => config.mode === this.layoutMode()) ?? LAYOUT_CONFIGS[0]
  );

  setLayout(mode: LayoutMode): void {
    this.layoutMode.set(mode);
    if (this.isBrowser) localStorage.setItem(this.storageKey, mode);
  }

  private loadSavedLayout(): LayoutMode {
    if (!this.isBrowser) return 'default';
    const saved = localStorage.getItem(this.storageKey) as LayoutMode | null;
    const valid: LayoutMode[] = ['default', 'float'];
    return saved && valid.includes(saved) ? saved : 'default';
  }
}
