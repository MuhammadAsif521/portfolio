import type { IconNode } from '@shared/components/icon-component/icon-component';
// Import each icon from its own module (see src/lucide-icons.d.ts), never from 'lucide' itself.
import ArrowLeftRight from 'lucide/dist/esm/icons/arrow-left-right.mjs';
import ArrowRightLeft from 'lucide/dist/esm/icons/arrow-right-left.mjs';
import Brackets from 'lucide/dist/esm/icons/brackets.mjs';
import CodeXml from 'lucide/dist/esm/icons/code-xml.mjs';
import FileSpreadsheet from 'lucide/dist/esm/icons/file-spreadsheet.mjs';
import FileText from 'lucide/dist/esm/icons/file-text.mjs';
import Sheet from 'lucide/dist/esm/icons/sheet.mjs';
import Table from 'lucide/dist/esm/icons/table.mjs';

/** Lucide icons used only by the converters tools; merged into page-icons.ts (a lazy chunk). */
export const CONVERTERS_ICONS: Readonly<Record<string, IconNode[]>> = {
  ArrowLeftRight,
  ArrowRightLeft,
  Brackets,
  CodeXml,
  FileSpreadsheet,
  FileText,
  Sheet,
  Table,
};
