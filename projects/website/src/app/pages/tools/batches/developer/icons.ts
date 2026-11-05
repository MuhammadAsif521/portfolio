import type { IconNode } from '@shared/components/icon-component/icon-component';
// Import each icon from its own module (see src/lucide-icons.d.ts), never from 'lucide' itself.
import Bot from 'lucide/dist/esm/icons/bot.mjs';
import ChevronsDownUp from 'lucide/dist/esm/icons/chevrons-down-up.mjs';
import FileSearch from 'lucide/dist/esm/icons/file-search.mjs';
import Hash from 'lucide/dist/esm/icons/hash.mjs';
import Link from 'lucide/dist/esm/icons/link.mjs';
import Palette from 'lucide/dist/esm/icons/palette.mjs';
import QrCode from 'lucide/dist/esm/icons/qr-code.mjs';
import Tags from 'lucide/dist/esm/icons/tags.mjs';

/** Lucide icons used only by the developer tools; merged into page-icons.ts (a lazy chunk). */
export const DEVELOPER_ICONS: Readonly<Record<string, IconNode[]>> = {
  Bot,
  ChevronsDownUp,
  FileSearch,
  Hash,
  Link,
  Palette,
  QrCode,
  Tags,
};
