import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolChoice, ToolInput, ToolSelect } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { type ImageKind, LIMITS, probeImageSize, safeFileName, sniffImageKind } from '../shared/files';
import { readHead } from '../shared/image-codec';
import { IpReorder } from '../shared/ip-reorder';
import { ImageEmbedError, type PagePlanOptions, imagesToPdf } from '../shared/pdf-ops';
import { downloadBlob } from '../shared/zip';
import { loadPdfImage } from './pdf-image';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif';

const SIZES = [
  { id: 'a4', name: 'A4 (210 x 297 mm)' },
  { id: 'letter', name: 'US Letter (8.5 x 11 in)' },
  { id: 'fit', name: 'Fit to each image (96 DPI)' },
];
const ORIENTATIONS = [
  { id: 'auto', name: 'Automatic (by image shape)' },
  { id: 'portrait', name: 'Portrait' },
  { id: 'landscape', name: 'Landscape' },
];
const MARGINS = [
  { id: '0', name: 'None' },
  { id: '5', name: 'Small (5 mm)' },
  { id: '10', name: 'Medium (10 mm)' },
  { id: '20', name: 'Large (20 mm)' },
];
const FITS = [
  { id: 'contain', name: 'Fit inside the page' },
  { id: 'cover', name: 'Fill the page (crop edges)' },
];

interface Item {
  id: number;
  file: File;
  name: string;
  kind: ImageKind;
  thumb: string;
  meta: string;
}

/**
 * /tools/images-to-pdf: one PDF page per image, built with pdf-lib. JPEG and PNG files are embedded as they are;
 * other formats (and JPEGs with an EXIF rotation) are redrawn on a canvas first. Reorder by dragging or with the
 * move buttons, remove images, and choose page size, orientation, margins and fit. Nothing leaves the browser.
 */
@Component({
  selector: 'app-images-to-pdf',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolChoice, ToolInput, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpReorder],
  styleUrls: ['../../../tool-ui.scss', './images-to-pdf.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="images-to-pdf">
      <div class="tool-split">
        <app-tool-panel title="Images">
          @for (key of [inputKey()]; track key) {
            <app-custom-file-input
              controlName="images-to-pdf-files"
              [label$]="fileLabel"
              [accept]="accept"
              placeholder="Add images, or drag them here"
              [multiple]="true"
              [showLabel]="false"
              [maxFileSize]="maxFileMb"
              [scanFiles]="false"
              [sanitizeNames]="false"
              (file)="onFiles($event)"
            />
          }
          @for (note of notices(); track note) {
            <app-tool-note kind="warn">{{ note }}</app-tool-note>
          }
          @if (items().length) {
            <app-ip-reorder [items]="items()" label="Images, one per page, in page order" (reorder)="reorder($event)" (remove)="remove($event)">
              <ng-template #row let-item>
                <div class="row">
                  <img class="row__thumb" [src]="item.thumb" [alt]="'Thumbnail of ' + item.name" loading="lazy" decoding="async" />
                  <div class="row__text">
                    <span class="row__name" [title]="item.name">{{ item.name }}</span>
                    <span class="row__meta">{{ item.meta }}</span>
                  </div>
                </div>
              </ng-template>
            </app-ip-reorder>
            <div class="tool-actions">
              <app-tool-button size="small" label="Clear all" (pressed)="clear()" />
            </div>
          }
        </app-tool-panel>

        <app-tool-panel title="PDF settings">
          <div class="tool-controls">
            <app-tool-select fieldId="images-to-pdf-size" label="Page size" [control]="sizeCtl" [options]="sizes" />
            <app-tool-select fieldId="images-to-pdf-margin" label="Margin" [control]="marginCtl" [options]="margins" />
          </div>
          @if (size() !== 'fit') {
            <app-tool-choice fieldId="images-to-pdf-orientation" label="Orientation" [control]="orientationCtl" [options]="orientations" />
            <app-tool-select fieldId="images-to-pdf-fit" label="Image fit" [control]="fitCtl" [options]="fits" />
          }
          <app-tool-input fieldId="images-to-pdf-name" label="File name" [control]="nameCtl" [mono]="false" hint="The .pdf extension is added for you." />
          <app-tool-note kind="info">
            JPEG and PNG files go into the PDF unchanged. Other formats, and JPEGs that carry a rotation flag, are redrawn first (PNG, or JPEG at 92% quality for rotated JPEGs). Photo metadata such as GPS is not copied into the PDF.
          </app-tool-note>
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          <app-tool-button
            kind="primary"
            icon="images"
            [label]="items().length ? 'Create PDF from ' + items().length + (items().length === 1 ? ' image' : ' images') : 'Create PDF'"
            [fill]="true"
            [loading]="busy()"
            [disabled]="!items().length"
            (pressed)="build()"
          />
          @if (busy()) {
            <p class="tool-meta" role="status">{{ progress() }}</p>
          }
          @if (result(); as r) {
            <app-tool-note kind="success">
              Created {{ r.name }}: {{ r.pages }} {{ r.pages === 1 ? 'page' : 'pages' }}, {{ r.size }} (the images were {{ r.inputSize }}).
            </app-tool-note>
            <app-tool-button kind="primary" icon="download" [label]="'Download ' + r.name" [fill]="true" (pressed)="download()" />
          } @else if (!busy() && !items().length) {
            <app-tool-empty icon="images">Add images, put them in order, then create the PDF. Each image becomes one page.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class ImagesToPdfTool {
  private readonly markUsed = toolUsage('images-to-pdf');
  private readonly trackDownload = toolCopied('images-to-pdf', { method: 'download' });

  protected readonly accept = ACCEPT;
  protected readonly maxFileMb = LIMITS.imageFileBytes / (1024 * 1024);
  protected readonly fileLabel = of('Images to combine');
  protected readonly sizes = SIZES;
  protected readonly orientations = ORIENTATIONS;
  protected readonly margins = MARGINS;
  protected readonly fits = FITS;

  protected readonly sizeCtl = new FormControl<string>('a4', { nonNullable: true });
  protected readonly orientationCtl = new FormControl<string>('auto', { nonNullable: true });
  protected readonly marginCtl = new FormControl<string>('10', { nonNullable: true });
  protected readonly fitCtl = new FormControl<string>('contain', { nonNullable: true });
  protected readonly nameCtl = new FormControl<string>('images', { nonNullable: true });
  protected readonly size = controlSignal(this.sizeCtl);
  private readonly orientation = controlSignal(this.orientationCtl);
  private readonly margin = controlSignal(this.marginCtl);
  private readonly fit = controlSignal(this.fitCtl);
  private readonly fileName = controlSignal(this.nameCtl);

  protected readonly items = signal<Item[]>([]);
  protected readonly notices = signal<string[]>([]);
  protected readonly inputKey = signal(0);
  protected readonly busy = signal(false);
  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly result = signal<{ blob: Blob; name: string; pages: number; size: string; inputSize: string } | null>(null);
  private nextId = 1;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.items().forEach((i) => URL.revokeObjectURL(i.thumb)));
    // Changed settings or order make the earlier PDF stale.
    effect(() => {
      this.items();
      this.size();
      this.orientation();
      this.margin();
      this.fit();
      this.fileName();
      untracked(() => this.result.set(null));
    });
  }

  protected async onFiles(files: File[] | File | null): Promise<void> {
    // The shared input shows its own list; this tool keeps the one list that matters (page order), so the input
    // is remounted empty after every pick and stays a plain drop zone.
    setTimeout(() => this.inputKey.update((k) => k + 1));
    if (!files) return;
    const picked = Array.isArray(files) ? files : [files];
    const notices: string[] = [];
    const added: Item[] = [];
    for (const file of picked) {
      if (this.items().length + added.length >= LIMITS.imageFiles) {
        notices.push(`Only ${LIMITS.imageFiles} images fit in one PDF here. The rest were left out.`);
        break;
      }
      try {
        const head = await readHead(file);
        const kind = sniffImageKind(head);
        if (kind === 'unknown' || kind === 'svg') {
          notices.push(`${file.name} is not a PNG, JPEG, WebP, GIF, BMP or AVIF image, so it was skipped.`);
          continue;
        }
        const dims = probeImageSize(head);
        if (dims && dims.width * dims.height > LIMITS.pixels) {
          notices.push(`${file.name} is ${Math.round((dims.width * dims.height) / 1e6)} megapixels, over the ${LIMITS.pixels / 1e6} MP limit, so it was skipped.`);
          continue;
        }
        const label = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', gif: 'GIF', bmp: 'BMP', avif: 'AVIF' }[kind];
        added.push({
          id: this.nextId++,
          file,
          name: file.name,
          kind,
          thumb: URL.createObjectURL(file),
          meta: [label, dims ? `${dims.width} x ${dims.height} px` : '', formatBytes(file.size)].filter(Boolean).join(' · '),
        });
      } catch {
        notices.push(`${file.name} could not be read, so it was skipped.`);
      }
    }
    this.notices.set(notices);
    this.error.set('');
    this.items.update((list) => [...list, ...added]);
  }

  protected reorder(ids: number[]): void {
    const byId = new Map(this.items().map((i) => [i.id, i]));
    this.items.set(ids.map((id) => byId.get(id)).filter((i): i is Item => !!i));
  }

  protected remove(id: number): void {
    const gone = this.items().find((i) => i.id === id);
    if (gone) URL.revokeObjectURL(gone.thumb);
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  protected clear(): void {
    this.items().forEach((i) => URL.revokeObjectURL(i.thumb));
    this.items.set([]);
    this.notices.set([]);
  }

  protected async build(): Promise<void> {
    const items = this.items();
    if (!items.length || this.busy()) return;
    this.markUsed();
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    const options: PagePlanOptions = {
      size: this.size() as PagePlanOptions['size'],
      orientation: this.orientation() as PagePlanOptions['orientation'],
      marginMm: Number(this.margin()),
      fit: this.fit() as PagePlanOptions['fit'],
    };
    const stem = safeFileName(this.fileName().replace(/\.pdf$/i, ''), 'images');
    try {
      const bytes = await imagesToPdf(
        items.length,
        (i, mode) => loadPdfImage(items[i].file, items[i].kind, mode),
        options,
        (done, total) => this.progress.set(done >= total ? 'Saving the PDF…' : `Adding image ${done + 1} of ${total}…`),
        stem,
      );
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      this.result.set({
        blob,
        name: `${stem}.pdf`,
        pages: items.length,
        size: formatBytes(blob.size),
        inputSize: formatBytes(items.reduce((sum, i) => sum + i.file.size, 0)),
      });
    } catch (error) {
      if (error instanceof ImageEmbedError) {
        this.error.set(`"${items[error.index]?.name ?? 'An image'}" could not be added to the PDF. It may be damaged. Remove it and try again.`);
      } else if (error instanceof Error && error.name === 'RangeError') {
        this.error.set('Your browser ran out of memory building this PDF. Try fewer or smaller images.');
      } else {
        this.error.set('The PDF could not be created. Try again, or remove the last images you added.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected download(): void {
    const r = this.result();
    if (!r) return;
    downloadBlob(r.blob, r.name);
    this.trackDownload();
  }
}
