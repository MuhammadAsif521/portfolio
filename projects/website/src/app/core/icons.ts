import type { Provider } from '@angular/core';
import { LUCIDE_ICONS, type IconNode } from '@shared/components/icon-component/icon-component';
// One module per icon (see src/lucide-icons.d.ts): importing from 'lucide' itself would bundle all ~1,700.
import ArrowLeft from 'lucide/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide/dist/esm/icons/arrow-right.mjs';
import ArrowUpRight from 'lucide/dist/esm/icons/arrow-up-right.mjs';
import Award from 'lucide/dist/esm/icons/award.mjs';
import CalendarClock from 'lucide/dist/esm/icons/calendar-clock.mjs';
import Check from 'lucide/dist/esm/icons/check.mjs';
import ChevronDown from 'lucide/dist/esm/icons/chevron-down.mjs';
import ChevronLeft from 'lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import ChevronUp from 'lucide/dist/esm/icons/chevron-up.mjs';
import CircleCheck from 'lucide/dist/esm/icons/circle-check.mjs';
import Code from 'lucide/dist/esm/icons/code.mjs';
import Container from 'lucide/dist/esm/icons/container.mjs';
import Cookie from 'lucide/dist/esm/icons/cookie.mjs';
import Database from 'lucide/dist/esm/icons/database.mjs';
import Download from 'lucide/dist/esm/icons/download.mjs';
import FileClock from 'lucide/dist/esm/icons/file-clock.mjs';
import Globe from 'lucide/dist/esm/icons/globe.mjs';
import Layers from 'lucide/dist/esm/icons/layers.mjs';
import Mail from 'lucide/dist/esm/icons/mail.mjs';
import MapPin from 'lucide/dist/esm/icons/map-pin.mjs';
import Menu from 'lucide/dist/esm/icons/menu.mjs';
import Monitor from 'lucide/dist/esm/icons/monitor.mjs';
import MonitorSmartphone from 'lucide/dist/esm/icons/monitor-smartphone.mjs';
import Moon from 'lucide/dist/esm/icons/moon.mjs';
import PenLine from 'lucide/dist/esm/icons/pen-line.mjs';
import Phone from 'lucide/dist/esm/icons/phone.mjs';
import RadioTower from 'lucide/dist/esm/icons/radio-tower.mjs';
import ScrollText from 'lucide/dist/esm/icons/scroll-text.mjs';
import SendHorizontal from 'lucide/dist/esm/icons/send-horizontal.mjs';
import Server from 'lucide/dist/esm/icons/server.mjs';
import ShieldCheck from 'lucide/dist/esm/icons/shield-check.mjs';
import ShoppingBag from 'lucide/dist/esm/icons/shopping-bag.mjs';
import Smartphone from 'lucide/dist/esm/icons/smartphone.mjs';
import Star from 'lucide/dist/esm/icons/star.mjs';
import Sun from 'lucide/dist/esm/icons/sun.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';

/**
 * Every Lucide icon the website renders (`<i-lucide name="…">`, including names from content files and
 * conditional bindings), keyed like Lucide's exports (PascalCase). Only these ship (a few kB) instead of the
 * full ~440 kB Lucide chunk, and they render synchronously, so server HTML and hydration show the same SVG.
 *
 * Adding an icon: import its file here and list it below. A missing name still works (the full set is
 * lazy-loaded) but logs a warning in development builds.
 */
const WEBSITE_ICONS: Readonly<Record<string, IconNode[]>> = {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Code,
  Container,
  Cookie,
  Database,
  Download,
  FileClock,
  Globe,
  Layers,
  Mail,
  MapPin,
  Menu,
  Monitor,
  MonitorSmartphone,
  Moon,
  PenLine,
  Phone,
  RadioTower,
  ScrollText,
  SendHorizontal,
  Server,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Star,
  Sun,
  X,
};

export function provideWebsiteIcons(): Provider {
  return { provide: LUCIDE_ICONS, useValue: WEBSITE_ICONS };
}
