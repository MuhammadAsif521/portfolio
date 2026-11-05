import type { IconNode } from '@shared/components/icon-component/icon-component';
// Import each icon from its own module (see src/lucide-icons.d.ts), never from 'lucide' itself.
import ArrowDown from 'lucide/dist/esm/icons/arrow-down.mjs';
import ArrowUp from 'lucide/dist/esm/icons/arrow-up.mjs';
import CaseSensitive from 'lucide/dist/esm/icons/case-sensitive.mjs';
import Diff from 'lucide/dist/esm/icons/diff.mjs';
import FileText from 'lucide/dist/esm/icons/file-text.mjs';
import GitCompare from 'lucide/dist/esm/icons/git-compare.mjs';
import Link from 'lucide/dist/esm/icons/link.mjs';
import ListOrdered from 'lucide/dist/esm/icons/list-ordered.mjs';
import Shuffle from 'lucide/dist/esm/icons/shuffle.mjs';
import TextQuote from 'lucide/dist/esm/icons/text-quote.mjs';
import WholeWord from 'lucide/dist/esm/icons/whole-word.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';

/** Lucide icons used only by the text tools; merged into page-icons.ts (a lazy chunk). */
export const TEXT_ICONS: Readonly<Record<string, IconNode[]>> = {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  Diff,
  FileText,
  GitCompare,
  Link,
  ListOrdered,
  Shuffle,
  TextQuote,
  WholeWord,
  X,
};
