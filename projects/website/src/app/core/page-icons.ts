import type { IconNode } from '@shared/components/icon-component/icon-component';
import { CONVERTERS_ICONS } from '../pages/tools/batches/converters/icons';
import { DEVELOPER_ICONS } from '../pages/tools/batches/developer/icons';
import { DOCUMENTS_ICONS } from '../pages/tools/batches/documents/icons';
import { IMAGES_PDF_ICONS } from '../pages/tools/batches/images-pdf/icons';
import { TEXT_ICONS } from '../pages/tools/batches/text/icons';
// One module per icon (see src/lucide-icons.d.ts): importing from 'lucide' itself would bundle all ~1,700.
import ArrowLeft from 'lucide/dist/esm/icons/arrow-left.mjs';
import AudioLines from 'lucide/dist/esm/icons/audio-lines.mjs';
import Award from 'lucide/dist/esm/icons/award.mjs';
import Binary from 'lucide/dist/esm/icons/binary.mjs';
import Braces from 'lucide/dist/esm/icons/braces.mjs';
import CalendarClock from 'lucide/dist/esm/icons/calendar-clock.mjs';
import Check from 'lucide/dist/esm/icons/check.mjs';
import ChevronDown from 'lucide/dist/esm/icons/chevron-down.mjs';
import ChevronLeft from 'lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import ChevronUp from 'lucide/dist/esm/icons/chevron-up.mjs';
import CircleAlert from 'lucide/dist/esm/icons/circle-alert.mjs';
import Clock from 'lucide/dist/esm/icons/clock.mjs';
import Code from 'lucide/dist/esm/icons/code.mjs';
import Container from 'lucide/dist/esm/icons/container.mjs';
import Cookie from 'lucide/dist/esm/icons/cookie.mjs';
import Copy from 'lucide/dist/esm/icons/copy.mjs';
import Database from 'lucide/dist/esm/icons/database.mjs';
import Download from 'lucide/dist/esm/icons/download.mjs';
import Eraser from 'lucide/dist/esm/icons/eraser.mjs';
import File from 'lucide/dist/esm/icons/file.mjs';
import FileClock from 'lucide/dist/esm/icons/file-clock.mjs';
import FileCode from 'lucide/dist/esm/icons/file-code.mjs';
import FingerprintPattern from 'lucide/dist/esm/icons/fingerprint-pattern.mjs';
import Globe from 'lucide/dist/esm/icons/globe.mjs';
import Hourglass from 'lucide/dist/esm/icons/hourglass.mjs';
import Info from 'lucide/dist/esm/icons/info.mjs';
import KeyRound from 'lucide/dist/esm/icons/key-round.mjs';
import Layers from 'lucide/dist/esm/icons/layers.mjs';
import LayoutDashboard from 'lucide/dist/esm/icons/layout-dashboard.mjs';
import MonitorSmartphone from 'lucide/dist/esm/icons/monitor-smartphone.mjs';
import Pencil from 'lucide/dist/esm/icons/pencil.mjs';
import PenLine from 'lucide/dist/esm/icons/pen-line.mjs';
import Play from 'lucide/dist/esm/icons/play.mjs';
import Plus from 'lucide/dist/esm/icons/plus.mjs';
import RadioTower from 'lucide/dist/esm/icons/radio-tower.mjs';
import RefreshCw from 'lucide/dist/esm/icons/refresh-cw.mjs';
import Regex from 'lucide/dist/esm/icons/regex.mjs';
import ScrollText from 'lucide/dist/esm/icons/scroll-text.mjs';
import Search from 'lucide/dist/esm/icons/search.mjs';
import Server from 'lucide/dist/esm/icons/server.mjs';
import ShieldCheck from 'lucide/dist/esm/icons/shield-check.mjs';
import ShoppingBag from 'lucide/dist/esm/icons/shopping-bag.mjs';
import Smartphone from 'lucide/dist/esm/icons/smartphone.mjs';
import Star from 'lucide/dist/esm/icons/star.mjs';
import TriangleAlert from 'lucide/dist/esm/icons/triangle-alert.mjs';
import Upload from 'lucide/dist/esm/icons/upload.mjs';
import WandSparkles from 'lucide/dist/esm/icons/wand-sparkles.mjs';
import { registerIcons } from './core-icons';

/**
 * Lucide icons used by pages and sections (including names from content files and conditional bindings),
 * keyed like Lucide's exports (PascalCase). A lazy chunk: withPageIcons() in core-icons.ts loads and
 * registers it with every lazy route. Icons used by the header, mobile menu or footer belong in
 * core-icons.ts instead.
 *
 * Adding an icon: import its file here and list it below. A missing name still works (the full set is
 * lazy-loaded) but logs a warning in development builds.
 */
export const PAGE_ICONS: Readonly<Record<string, IconNode[]>> = {
  ArrowLeft,
  AudioLines,
  Award,
  Binary,
  Braces,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock,
  Code,
  Container,
  Cookie,
  Copy,
  Database,
  Download,
  Eraser,
  File,
  FileClock,
  FileCode,
  FingerprintPattern,
  Globe,
  Hourglass,
  Info,
  KeyRound,
  Layers,
  LayoutDashboard,
  MonitorSmartphone,
  Pencil,
  PenLine,
  Play,
  Plus,
  RadioTower,
  RefreshCw,
  Regex,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Star,
  TriangleAlert,
  Upload,
  WandSparkles,
  ...DOCUMENTS_ICONS,
  ...CONVERTERS_ICONS,
  ...IMAGES_PDF_ICONS,
  ...TEXT_ICONS,
  ...DEVELOPER_ICONS,
};

export function registerPageIcons(): void {
  registerIcons(PAGE_ICONS);
}
