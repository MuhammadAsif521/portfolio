import type { Provider } from '@angular/core';
import { LUCIDE_ICONS, type IconNode } from '@shared/components/icon-component/icon-component';
// One module per icon (see src/lucide-icons.d.ts): importing from 'lucide' itself would bundle all ~1,700.
import ArrowRight from 'lucide/dist/esm/icons/arrow-right.mjs';
import ArrowUpRight from 'lucide/dist/esm/icons/arrow-up-right.mjs';
import CircleCheck from 'lucide/dist/esm/icons/circle-check.mjs';
import Mail from 'lucide/dist/esm/icons/mail.mjs';
import MapPin from 'lucide/dist/esm/icons/map-pin.mjs';
import Menu from 'lucide/dist/esm/icons/menu.mjs';
import Monitor from 'lucide/dist/esm/icons/monitor.mjs';
import Moon from 'lucide/dist/esm/icons/moon.mjs';
import Phone from 'lucide/dist/esm/icons/phone.mjs';
import SendHorizontal from 'lucide/dist/esm/icons/send-horizontal.mjs';
import Sun from 'lucide/dist/esm/icons/sun.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';

/**
 * The Lucide icons rendered by what ships in the initial bundle: the header, the mobile menu, the theme
 * toggle and the footer (with its quick-contact form). Keyed like Lucide's exports (PascalCase).
 *
 * Every other icon the website uses lives in page-icons.ts, which is a lazy chunk registered by the
 * lazy routes (see withPageIcons below and app.routes.ts), so it stays out of the initial bundle.
 * Adding an icon: a header / menu / footer icon goes here; anything used on a page goes in page-icons.ts.
 */
export const CORE_ICONS: Readonly<Record<string, IconNode[]>> = {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  Mail,
  MapPin,
  Menu,
  Monitor,
  Moon,
  Phone,
  SendHorizontal,
  Sun,
  X,
};

/** What IconComponent reads (LUCIDE_ICONS): the core icons, plus the page icons once a page has loaded. */
const ACTIVE_ICONS: Record<string, IconNode[]> = { ...CORE_ICONS };

/** Adds icons to the set IconComponent renders synchronously (server and browser alike). */
export function registerIcons(icons: Readonly<Record<string, IconNode[]>>): void {
  Object.assign(ACTIVE_ICONS, icons);
}

export function provideCoreIcons(): Provider {
  return { provide: LUCIDE_ICONS, useValue: ACTIVE_ICONS };
}

/**
 * Wraps a lazy route loader (loadComponent / loadChildren) so the page icons are loaded and registered
 * together with the page, before it renders: server HTML and hydration still show the same inline SVG.
 */
export function withPageIcons<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    Promise.all([import('./page-icons'), load()]).then(([icons, loaded]) => {
      icons.registerPageIcons();
      return loaded;
    });
}
