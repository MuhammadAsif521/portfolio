import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { LIMITS, savingLabel } from '../shared/files';
import { ImageBatch, batchRows, batchSummary } from '../shared/image-batch';
import { type OutFormat, ImageError, supportedFormats } from '../shared/image-codec';
import { IpColor, IpRange } from '../shared/ip-fields';
import { IpResults } from '../shared/ip-results';
import { parseSizeInput } from '../shared/size-math';
import { type CompressOptions, compressImage } from './compress';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif';

const MAX_SIDE_OPTIONS = [
  { id: '0', name: 'Keep original size' },
  ...[4096, 3000, 2560, 2048, 1600, 1280, 1024, 800].map((n) => ({ id: String(n), name: `Longest side at most ${n} px` })),
];

const PNG_OPTIONS = [
  { id: '256', name: 'Reduce to 256 colours (much smaller, lossy)' },
  { id: '128', name: 'Reduce to 128 colours' },
  { id: '64', name: 'Reduce to 64 colours' },
  { id: '0', name: 'Lossless re-encode (little or no saving)' },
];

interface Preview {
  beforeUrl: string;
  afterUrl: string;
  name: string;
  beforeBytes: number;
  afterBytes: number;
  beforeSize: string;
  afterSize: string;
  note: string;
  kept: boolean;
}

/**
 * /tools/image-compressor: re-encodes JPEG, WebP, AVIF and PNG in the browser. A slider (or a target file size,
 * found by searching quality) sets the result; a live before/after preview of one image shows the real output; a
 * batch run produces the files and a ZIP. PNG is reduced to a palette (lossy) because canvas PNG is lossless.
 */
@Component({
  selector: 'app-image-compressor',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolInput, ToolToggle, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpRange, IpColor, IpResults],
  styleUrls: ['../../../tool-ui.scss', './image-compressor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="image-compressor">
      <div class="tool-split">
        <app-tool-panel title="Images and settings">
          <app-custom-file-input
            controlName="image-compressor-files"
            [label$]="fileLabel"
            [accept]="accept"
            placeholder="Choose images, or drag them here"
            [multiple]="true"
            [showLabel]="false"
            [maxFiles]="maxFiles"
            [maxFileSize]="maxFileMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFiles($event)"
          />
          <div class="tool-controls">
            <app-tool-select fieldId="image-compressor-format" label="Output format" [control]="formatCtl" [options]="formatOptions()" />
            <app-tool-select fieldId="image-compressor-maxside" label="Resize" [control]="maxSideCtl" [options]="maxSideOptions" />
          </div>
          @if (!targetOn()) {
            @if (format() !== 'png') {
              <app-ip-range fieldId="image-compressor-quality" [label]="'Quality: ' + quality() + '%'" [control]="qualityCtl" [min]="1" [max]="100" hint="Applies to JPEG, WebP and AVIF. Lower is smaller." />
            }
          }
          @if (format() === 'png' || format() === 'auto') {
            <app-tool-select
              fieldId="image-compressor-png"
              label="PNG compression"
              [control]="pngCtl"
              [options]="pngOptions"
              hint="Canvas cannot make a lossless PNG smaller, so PNG shrinks by reducing colours. Flat graphics and screenshots keep their look; photos and gradients can show banding."
            />
          }
          <app-tool-toggle fieldId="image-compressor-target-on" label="Aim for a target file size" [control]="targetOnCtl" hint="Searches for the highest quality that fits, and shrinks the pixel size if it has to." />
          @if (targetOn()) {
            <app-tool-input
              fieldId="image-compressor-target"
              label="Target size per image (KB or MB)"
              [control]="targetCtl"
              [mono]="false"
              [invalid]="!!targetCtl.value && targetBytes() === null"
              hint="For example 200 KB or 1.5 MB. Images already smaller than this are still re-encoded at the best quality."
            />
          }
          @if (format() === 'jpeg' || format() === 'auto') {
            <app-ip-color fieldId="image-compressor-background" label="Background for transparent areas" [control]="backgroundCtl" hint="Used only when a transparent image is written as JPEG." />
          }
          <app-tool-note kind="info">
            Images are decoded and written again by your browser, so EXIF data (camera, date, GPS) and colour profiles are not copied into the result. If re-encoding would not make a file smaller, you get the original back unchanged.
          </app-tool-note>
          @if (batch.notice()) {
            <app-tool-note kind="warn">{{ batch.notice() }}</app-tool-note>
          }
          <app-tool-button
            kind="primary"
            icon="minimize-2"
            [label]="batch.items().length > 1 ? 'Compress ' + batch.items().length + ' images' : 'Compress image'"
            [fill]="true"
            [loading]="batch.busy()"
            [disabled]="!batch.items().length || (targetOn() && targetBytes() === null)"
            (pressed)="compress()"
          />
        </app-tool-panel>

        <app-tool-panel title="Result">
          @if (!batch.items().length) {
            <app-tool-empty icon="minimize-2">Choose images to see a live before and after preview, then compress them all at once and download a ZIP.</app-tool-empty>
          } @else {
            @if (batch.items().length > 1) {
              <app-tool-select fieldId="image-compressor-preview" label="Preview image" [control]="previewCtl" [options]="previewOptions()" />
            }
            <div class="cmp" aria-live="polite">
              @if (previewError()) {
                <app-tool-note kind="error">{{ previewError() }}</app-tool-note>
              } @else if (preview(); as p) {
                <figure class="cmp__fig">
                  <img class="cmp__img" [src]="p.beforeUrl" [alt]="'Original of ' + p.name" />
                  <figcaption><strong>Original</strong> {{ p.beforeSize }}</figcaption>
                </figure>
                <figure class="cmp__fig" [class.cmp__fig--stale]="previewBusy()">
                  <img class="cmp__img" [src]="p.afterUrl" [alt]="'Compressed version of ' + p.name" />
                  <figcaption>
                    <strong>Compressed</strong> {{ p.afterSize }} ({{ p.saving }})
                    <span class="cmp__note">{{ p.note }}</span>
                  </figcaption>
                </figure>
              }
              @if (previewBusy()) {
                <p class="tool-meta">Updating preview…</p>
              }
            </div>
            <app-ip-results
              [rows]="rows()"
              [percent]="batch.percent()"
              [busy]="batch.busy()"
              [summary]="summary()"
              [zipLabel]="batch.doneItems().length > 1 ? 'Download all as ZIP' : ''"
              [zipping]="batch.zipping()"
              icon="minimize-2"
              listLabel="Compressed images"
              (download)="download($event)"
              (zip)="zip()"
              (cancel)="batch.cancel()"
            />
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class ImageCompressorTool {
  private readonly markUsed = toolUsage('image-compressor');
  private readonly trackDownload = toolCopied('image-compressor', { method: 'download' });

  protected readonly accept = ACCEPT;
  protected readonly maxFiles = LIMITS.imageFiles;
  protected readonly maxFileMb = LIMITS.imageFileBytes / (1024 * 1024);
  protected readonly fileLabel = of('Images to compress');
  protected readonly maxSideOptions = MAX_SIDE_OPTIONS;
  protected readonly pngOptions = PNG_OPTIONS;
  protected readonly batch = new ImageBatch();

  protected readonly formats = signal<OutFormat[]>(['jpeg', 'webp', 'png']);
  protected readonly formatOptions = computed(() => [
    { id: 'auto', name: 'Same as the original' },
    ...this.formats().map((id) => ({ id, name: { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', avif: 'AVIF' }[id] })),
  ]);
  protected readonly formatCtl = new FormControl<string>('auto', { nonNullable: true });
  protected readonly maxSideCtl = new FormControl<string>('0', { nonNullable: true });
  protected readonly qualityCtl = new FormControl<string>('75', { nonNullable: true });
  protected readonly pngCtl = new FormControl<string>('256', { nonNullable: true });
  protected readonly targetOnCtl = new FormControl<boolean>(false, { nonNullable: true });
  protected readonly targetCtl = new FormControl<string>('200 KB', { nonNullable: true });
  protected readonly backgroundCtl = new FormControl<string>('#ffffff', { nonNullable: true });
  protected readonly previewCtl = new FormControl<string>('', { nonNullable: true });

  protected readonly format = controlSignal(this.formatCtl);
  private readonly maxSide = controlSignal(this.maxSideCtl);
  private readonly qualitySig = controlSignal(this.qualityCtl);
  protected readonly quality = computed(() => Math.min(100, Math.max(1, Number(this.qualitySig()) || 75)));
  private readonly pngSig = controlSignal(this.pngCtl);
  protected readonly targetOn = controlSignal(this.targetOnCtl);
  private readonly targetText = controlSignal(this.targetCtl);
  protected readonly targetBytes = computed(() => (this.targetOn() ? parseSizeInput(this.targetText()) : null));
  private readonly background = controlSignal(this.backgroundCtl);
  private readonly previewId = controlSignal(this.previewCtl);

  protected readonly options = computed<CompressOptions>(() => ({
    format: this.format() as CompressOptions['format'],
    quality: this.quality() / 100,
    maxSide: Number(this.maxSide()) || 0,
    pngColors: Number(this.pngSig()),
    targetBytes: this.targetBytes(),
    background: this.background(),
  }));

  protected readonly rows = computed(() => batchRows(this.batch.items()));
  protected readonly summary = computed(() => batchSummary(this.batch));
  protected readonly previewOptions = computed(() => this.batch.items().map((i) => ({ id: String(i.id), name: i.file.name })));
  private readonly previewFile = computed(() => {
    const items = this.batch.items();
    return items.find((i) => String(i.id) === this.previewId())?.file ?? items[0]?.file ?? null;
  });

  protected readonly preview = signal<(Preview & { saving: string }) | null>(null);
  protected readonly previewBusy = signal(false);
  protected readonly previewError = signal('');
  private previewToken = 0;
  private originalUrl: { file: File; url: string } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.batch.cancel();
      this.previewToken++;
      this.dropPreviewUrls();
    });
    afterNextRender(() => {
      void supportedFormats().then((support) => this.formats.set((['jpeg', 'webp', 'avif', 'png'] as const).filter((f) => support[f])));
    });
    // New settings make earlier batch results stale.
    effect(() => {
      this.options();
      untracked(() => {
        if (!this.batch.busy() && this.batch.items().some((i) => i.result || i.error)) this.batch.resetResults();
      });
    });
    // Live preview of one image, a little after the last change.
    effect((onCleanup) => {
      const file = this.previewFile();
      const options = this.options();
      if (!file) {
        untracked(() => this.clearPreview());
        return;
      }
      if (options.targetBytes === null && this.targetOn()) return;
      const timer = setTimeout(() => void this.refreshPreview(file, options), 400);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected onFiles(files: File[] | File | null): void {
    this.batch.setFiles(files);
    if (!this.batch.items().some((i) => String(i.id) === this.previewCtl.value)) this.previewCtl.setValue('');
  }

  private async refreshPreview(file: File, options: CompressOptions): Promise<void> {
    const token = ++this.previewToken;
    this.previewBusy.set(true);
    try {
      const support = await supportedFormats();
      const result = await compressImage(file, options, support);
      if (token !== this.previewToken) return;
      if (this.originalUrl?.file !== file) {
        if (this.originalUrl) URL.revokeObjectURL(this.originalUrl.url);
        this.originalUrl = { file, url: URL.createObjectURL(file) };
      }
      const old = this.preview();
      this.preview.set({
        beforeUrl: this.originalUrl.url,
        afterUrl: URL.createObjectURL(result.blob),
        name: file.name,
        beforeBytes: file.size,
        afterBytes: result.blob.size,
        beforeSize: `${formatBytes(file.size)}`,
        afterSize: formatBytes(result.blob.size),
        saving: savingLabel(file.size, result.blob.size),
        note: result.note,
        kept: result.keptOriginal,
      });
      if (old) URL.revokeObjectURL(old.afterUrl);
      this.previewError.set('');
    } catch (error) {
      if (token !== this.previewToken) return;
      this.previewError.set(error instanceof ImageError ? error.message : 'This image could not be previewed. It may be damaged.');
      this.clearAfter();
    } finally {
      if (token === this.previewToken) this.previewBusy.set(false);
    }
  }

  private clearAfter(): void {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old.afterUrl);
    this.preview.set(null);
  }

  private clearPreview(): void {
    this.previewToken++;
    this.clearAfter();
    this.dropPreviewUrls();
    this.previewBusy.set(false);
    this.previewError.set('');
  }

  private dropPreviewUrls(): void {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old.afterUrl);
    if (this.originalUrl) URL.revokeObjectURL(this.originalUrl.url);
    this.originalUrl = null;
  }

  protected async compress(): Promise<void> {
    this.markUsed();
    const options = this.options();
    const support = await supportedFormats();
    await this.batch.run(async (item, report) => {
      const r = await compressImage(item.file, options, support, report);
      return { blob: r.blob, name: r.name, width: r.width, height: r.height, note: r.note };
    });
  }

  protected download(id: number | string): void {
    if (this.batch.download(Number(id))) this.trackDownload();
  }

  protected async zip(): Promise<void> {
    if (await this.batch.downloadZip('compressed-images.zip')) this.trackDownload();
  }
}
