import type { IconNode } from '@shared/components/icon-component/icon-component';
// Import each icon from its own module (see src/lucide-icons.d.ts), never from 'lucide' itself.
import Archive from 'lucide/dist/esm/icons/archive.mjs';
import ArrowDown from 'lucide/dist/esm/icons/arrow-down.mjs';
import ArrowUp from 'lucide/dist/esm/icons/arrow-up.mjs';
import FileDown from 'lucide/dist/esm/icons/file-down.mjs';
import FileImage from 'lucide/dist/esm/icons/file-image.mjs';
import FileOutput from 'lucide/dist/esm/icons/file-output.mjs';
import FileStack from 'lucide/dist/esm/icons/file-stack.mjs';
import GripVertical from 'lucide/dist/esm/icons/grip-vertical.mjs';
import Images from 'lucide/dist/esm/icons/images.mjs';
import Maximize2 from 'lucide/dist/esm/icons/maximize-2.mjs';
import Minimize2 from 'lucide/dist/esm/icons/minimize-2.mjs';
import Scissors from 'lucide/dist/esm/icons/scissors.mjs';

/** Lucide icons used only by the images-pdf tools; merged into page-icons.ts (a lazy chunk). Download, X and Check already exist elsewhere. */
export const IMAGES_PDF_ICONS: Readonly<Record<string, IconNode[]>> = {
  Archive,
  ArrowDown,
  ArrowUp,
  FileDown,
  FileImage,
  FileOutput,
  FileStack,
  GripVertical,
  Images,
  Maximize2,
  Minimize2,
  Scissors,
};
