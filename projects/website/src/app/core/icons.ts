import type { Provider } from '@angular/core';
import { LUCIDE_ICONS, type IconNode } from '@shared/components/icon-component/icon-component';
import { CORE_ICONS } from './core-icons';
import { PAGE_ICONS } from './page-icons';

/**
 * Every Lucide icon the website renders: core-icons.ts (initial bundle) plus page-icons.ts (lazy). The app
 * itself provides only the core set and registers the rest with its lazy routes (provideCoreIcons /
 * withPageIcons), so this module must not be imported by app code; it exists for tests and checks that
 * need the complete set.
 */
export const WEBSITE_ICONS: Readonly<Record<string, IconNode[]>> = { ...CORE_ICONS, ...PAGE_ICONS };

export function provideWebsiteIcons(): Provider {
  return { provide: LUCIDE_ICONS, useValue: WEBSITE_ICONS };
}
