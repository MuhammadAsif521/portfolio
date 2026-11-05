import type { IconNode } from '@shared/components/icon-component/icon-component';
// Import each icon from its own module (see src/lucide-icons.d.ts), never from 'lucide' itself.
import FileText from 'lucide/dist/esm/icons/file-text.mjs';
import FileSpreadsheet from 'lucide/dist/esm/icons/file-spreadsheet.mjs';
import FileType from 'lucide/dist/esm/icons/file-type.mjs';
import Presentation from 'lucide/dist/esm/icons/presentation.mjs';
import NotebookText from 'lucide/dist/esm/icons/notebook-text.mjs';
import Table from 'lucide/dist/esm/icons/table.mjs';
import ZoomIn from 'lucide/dist/esm/icons/zoom-in.mjs';
import ZoomOut from 'lucide/dist/esm/icons/zoom-out.mjs';
import ArrowUp from 'lucide/dist/esm/icons/arrow-up.mjs';
import ArrowDown from 'lucide/dist/esm/icons/arrow-down.mjs';
import Lock from 'lucide/dist/esm/icons/lock.mjs';
import Image from 'lucide/dist/esm/icons/image.mjs';
import Files from 'lucide/dist/esm/icons/files.mjs';
import FileDown from 'lucide/dist/esm/icons/file-down.mjs';
import ChevronLeft from 'lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import Download from 'lucide/dist/esm/icons/download.mjs';
import Upload from 'lucide/dist/esm/icons/upload.mjs';
import Search from 'lucide/dist/esm/icons/search.mjs';
import List from 'lucide/dist/esm/icons/list.mjs';
import Copy from 'lucide/dist/esm/icons/copy.mjs';

/** Lucide icons used only by the documents tools; merged into page-icons.ts (a lazy chunk). */
export const DOCUMENTS_ICONS: Readonly<Record<string, IconNode[]>> = {
  FileText,
  FileSpreadsheet,
  FileType,
  Presentation,
  NotebookText,
  Table,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  Lock,
  Image,
  Files,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Search,
  List,
  Copy,
};
