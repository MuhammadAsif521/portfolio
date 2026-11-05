import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolChoice, ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { LIMITS, baseName, probeImageSize, readJpegOrientation, withExt } from '../shared/files';
import { ImageBatch, batchRows, batchSummary } from '../shared/image-batch';
import { EXT, FORMAT_LABEL, type OutFormat, ImageError, decodeImage, readHead, releaseSurface, renderPlan, supportedFormats, surfaceToBlob } from '../shared/image-codec';
import { IpColor, IpRange } from '../shared/ip-fields';
import { IpResults } from '../shared/ip-results';
import { type FitMode, type ResizeOptions, type Smoothing, RESIZE_PRESETS, linkedSide, planResize } from '../shared/size-math';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif';

const MODES = [
  { id: 'pixels', name: 'Pixels' },
  { id: 'percent', name: 'Percent' },
  { id: 'preset', name: 'Preset size' },
];
const FITS = [
  { id: 'contain', name: 'Contain: whole image visible, padded' },
  { id: 'cover', name: 'Cover: fill the size, crop the edges' },
  { id: 'stretch', name: 'Stretch: fill the size, distort' },
];
const SMOOTHING = [
  { id: 'high', name: 'Best quality (smooth)' },
  { id: 'medium', name: 'Balanced' },
  { id: 'low', name: 'Fast' },
  { id: 'none', name: 'No smoothing (pixel art)' },
];
const PRESETS = RESIZE_PRESETS.map((p) => ({ id: p.id, name: p.name }));

/**
 * /tools/image-resizer: resize by pixels (optionally keeping the aspect ratio), by percent or to a social preset,
 * with contain, cover and stretch fit modes, a smoothing choice and an output format. Batch with ZIP; orientation
 * from EXIF is applied before resizing. Decoding and drawing happen on a canvas in the browser.
 */
@Component({
  selector: 'app-image-resizer',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolInput, ToolToggle, ToolChoice, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpRange, IpColor, IpResults],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="image-resizer">
      <div class="tool-split">
        <app-tool-panel title="Images and size">
          <app-custom-file-input
            controlName="image-resizer-files"
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
          <app-tool-choice fieldId="image-resizer-mode" label="Resize by" [control]="modeCtl" [options]="modes" />

          @switch (mode()) {
            @case ('pixels') {
              <div class="tool-controls">
                <app-tool-input fieldId="image-resizer-width" label="Width (px)" type="number" [control]="widthCtl" [min]="1" [max]="maxSide" inputMode="numeric" />
                <app-tool-input fieldId="image-resizer-height" label="Height (px)" type="number" [control]="heightCtl" [min]="1" [max]="maxSide" inputMode="numeric" />
              </div>
              <app-tool-toggle fieldId="image-resizer-lock" label="Keep aspect ratio" [control]="lockCtl" hint="Each image is scaled to fit inside the width and height, never distorted. With several images of different shapes, results differ in size." />
              @if (lock()) {
                <app-tool-toggle fieldId="image-resizer-upscale" label="Enlarge small images" [control]="upscaleCtl" hint="Off: images smaller than the box keep their size." />
              }
            }
            @case ('percent') {
              <app-ip-range fieldId="image-resizer-percent" [label]="'Scale: ' + percent() + '%'" [control]="percentCtl" [min]="5" [max]="400" />
            }
            @case ('preset') {
              <app-tool-select fieldId="image-resizer-preset" label="Preset" [control]="presetCtl" [options]="presets" hint="Sizes platforms recommend change over time; check the platform if exact dimensions matter." />
            }
          }

          @if (mode() === 'preset' || (mode() === 'pixels' && !lock())) {
            <app-tool-select fieldId="image-resizer-fit" label="When the shape differs" [control]="fitCtl" [options]="fits" />
            @if (fit() === 'contain') {
              <app-ip-color fieldId="image-resizer-background" label="Padding colour" [control]="backgroundCtl" />
              @if (format() !== 'jpeg') {
                <app-tool-toggle fieldId="image-resizer-transparent" label="Transparent padding" [control]="transparentCtl" hint="PNG and WebP only. Off: the padding uses the colour above." />
              }
            }
          }

          <div class="tool-controls">
            <app-tool-select fieldId="image-resizer-smoothing" label="Smoothing" [control]="smoothingCtl" [options]="smoothingOptions" />
            <app-tool-select fieldId="image-resizer-format" label="Output format" [control]="formatCtl" [options]="formatOptions()" />
          </div>
          @if (format() === 'jpeg' || format() === 'webp' || format() === 'avif') {
            <app-ip-range fieldId="image-resizer-quality" [label]="'Quality: ' + quality() + '%'" [control]="qualityCtl" [min]="1" [max]="100" />
          }

          @if (firstDims(); as d) {
            @if (planText()) {
              <p class="tool-meta">{{ planText() }}</p>
            }
          }
          <app-tool-note kind="info">Resized images are written fresh by your browser, so EXIF data (camera, date, GPS) is not copied. Photo orientation is applied to the pixels.</app-tool-note>
          @if (batch.notice()) {
            <app-tool-note kind="warn">{{ batch.notice() }}</app-tool-note>
          }
          <app-tool-button
            kind="primary"
            icon="maximize-2"
            [label]="batch.items().length > 1 ? 'Resize ' + batch.items().length + ' images' : 'Resize image'"
            [fill]="true"
            [loading]="batch.busy()"
            [disabled]="!batch.items().length"
            (pressed)="resize()"
          />
        </app-tool-panel>

        <app-tool-panel title="Resized files">
          @if (batch.items().length) {
            <app-ip-results
              [rows]="rows()"
              [percent]="batch.percent()"
              [busy]="batch.busy()"
              [summary]="summary()"
              [zipLabel]="batch.doneItems().length > 1 ? 'Download all as ZIP' : ''"
              [zipping]="batch.zipping()"
              icon="maximize-2"
              listLabel="Resized images"
              (download)="download($event)"
              (zip)="zip()"
              (cancel)="batch.cancel()"
            />
          } @else {
            <app-tool-empty icon="maximize-2">Choose images, set a size and press Resize. Each result shows its new pixel size and file size.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class ImageResizerTool {
  private readonly markUsed = toolUsage('image-resizer');
  private readonly trackDownload = toolCopied('image-resizer', { method: 'download' });

  protected readonly accept = ACCEPT;
  protected readonly maxFiles = LIMITS.imageFiles;
  protected readonly maxFileMb = LIMITS.imageFileBytes / (1024 * 1024);
  protected readonly maxSide = LIMITS.side;
  protected readonly fileLabel = of('Images to resize');
  protected readonly modes = MODES;
  protected readonly fits = FITS;
  protected readonly presets = PRESETS;
  protected readonly smoothingOptions = SMOOTHING;
  protected readonly batch = new ImageBatch();

  protected readonly modeCtl = new FormControl<string>('pixels', { nonNullable: true });
  protected readonly widthCtl = new FormControl<string>('1200', { nonNullable: true });
  protected readonly heightCtl = new FormControl<string>('', { nonNullable: true });
  protected readonly lockCtl = new FormControl<boolean>(true, { nonNullable: true });
  protected readonly upscaleCtl = new FormControl<boolean>(false, { nonNullable: true });
  protected readonly percentCtl = new FormControl<string>('50', { nonNullable: true });
  protected readonly presetCtl = new FormControl<string>('ig-square', { nonNullable: true });
  protected readonly fitCtl = new FormControl<string>('cover', { nonNullable: true });
  protected readonly backgroundCtl = new FormControl<string>('#ffffff', { nonNullable: true });
  protected readonly transparentCtl = new FormControl<boolean>(false, { nonNullable: true });
  protected readonly smoothingCtl = new FormControl<string>('high', { nonNullable: true });
  protected readonly formatCtl = new FormControl<string>('same', { nonNullable: true });
  protected readonly qualityCtl = new FormControl<string>('85', { nonNullable: true });

  protected readonly mode = controlSignal(this.modeCtl);
  private readonly widthSig = controlSignal(this.widthCtl);
  private readonly heightSig = controlSignal(this.heightCtl);
  protected readonly lock = controlSignal(this.lockCtl);
  private readonly upscale = controlSignal(this.upscaleCtl);
  private readonly percentSig = controlSignal(this.percentCtl);
  protected readonly percent = computed(() => Math.min(400, Math.max(1, Number(this.percentSig()) || 50)));
  private readonly preset = controlSignal(this.presetCtl);
  protected readonly fit = controlSignal(this.fitCtl);
  private readonly background = controlSignal(this.backgroundCtl);
  private readonly transparent = controlSignal(this.transparentCtl);
  private readonly smoothing = controlSignal(this.smoothingCtl);
  protected readonly format = controlSignal(this.formatCtl);
  private readonly qualitySig = controlSignal(this.qualityCtl);
  protected readonly quality = computed(() => Math.min(100, Math.max(1, Number(this.qualitySig()) || 85)));

  protected readonly formats = signal<OutFormat[]>(['png', 'jpeg', 'webp']);
  protected readonly formatOptions = computed(() => [
    { id: 'same', name: 'Same as the original' },
    ...this.formats().map((id) => ({ id, name: FORMAT_LABEL[id] })),
  ]);

  /** Pixel size of the first image (EXIF orientation applied), read from its header; null if unknown. */
  protected readonly firstDims = signal<{ width: number; height: number } | null>(null);
  protected readonly resizeOptions = computed<ResizeOptions>(() => ({
    mode: this.mode() as ResizeOptions['mode'],
    width: Number(this.widthSig()),
    height: Number(this.heightSig()),
    lock: this.lock(),
    percent: this.percent(),
    presetId: this.preset(),
    fit: this.fit() as FitMode,
    upscale: this.upscale(),
  }));
  protected readonly planText = computed(() => {
    const d = this.firstDims();
    if (!d) return '';
    const result = planResize(this.resizeOptions(), d.width, d.height);
    return 'error' in result ? result.error : `The first image goes from ${d.width} x ${d.height} px to ${result.plan.width} x ${result.plan.height} px.`;
  });

  protected readonly rows = computed(() => batchRows(this.batch.items()));
  protected readonly summary = computed(() => batchSummary(this.batch));
  private linking = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.batch.cancel());
    afterNextRender(() => {
      void supportedFormats().then((s) => this.formats.set((['png', 'jpeg', 'webp', 'avif'] as const).filter((f) => s[f])));
    });
    // Aspect-ratio lock: typing one side fills the other from the first image's shape.
    this.widthCtl.valueChanges.subscribe((v) => this.link(v, 'width'));
    this.heightCtl.valueChanges.subscribe((v) => this.link(v, 'height'));
    effect(() => {
      this.resizeOptions();
      this.smoothing();
      this.format();
      this.quality();
      this.background();
      this.transparent();
      untracked(() => {
        if (!this.batch.busy() && this.batch.items().some((i) => i.result || i.error)) this.batch.resetResults();
      });
    });
  }

  private link(value: string, from: 'width' | 'height'): void {
    const d = this.firstDims();
    if (this.linking || !this.lockCtl.value || !d) return;
    this.linking = true;
    const other = linkedSide(value, d.width / d.height, from);
    (from === 'width' ? this.heightCtl : this.widthCtl).setValue(other);
    this.linking = false;
  }

  protected async onFiles(files: File[] | File | null): Promise<void> {
    this.batch.setFiles(files);
    const first = this.batch.items()[0]?.file;
    if (!first) {
      this.firstDims.set(null);
      return;
    }
    try {
      const head = await readHead(first);
      const size = probeImageSize(head);
      const turned = readJpegOrientation(head) >= 5;
      if (this.batch.items()[0]?.file !== first) return;
      this.firstDims.set(size ? (turned ? { width: size.height, height: size.width } : size) : null);
      if (size && this.lockCtl.value) this.link(this.widthCtl.value, 'width');
    } catch {
      this.firstDims.set(null);
    }
  }

  protected async resize(): Promise<void> {
    this.markUsed();
    const options = this.resizeOptions();
    const smoothing = this.smoothing() as Smoothing;
    const choice = this.format();
    const quality = this.quality() / 100;
    const padding = this.transparent() ? null : this.background();
    const support = await supportedFormats();
    await this.batch.run(async (item, report) => {
      const decoded = await decodeImage(item.file);
      try {
        const own: Partial<Record<string, OutFormat>> = { png: 'png', jpeg: 'jpeg', webp: 'webp', avif: 'avif' };
        let format: OutFormat = choice === 'same' ? (own[decoded.kind] ?? 'png') : (choice as OutFormat);
        if (!support[format]) format = 'png';
        const result = planResize(options, decoded.width, decoded.height);
        if ('error' in result) throw new ImageError(result.error);
        report(`Resizing to ${result.plan.width} x ${result.plan.height}…`);
        const fill = format === 'jpeg' ? (padding ?? this.background()) : padding;
        const surface = renderPlan(decoded, result.plan, smoothing, fill);
        try {
          const blob = await surfaceToBlob(surface, format, quality);
          const note = decoded.kind === 'gif' ? 'first frame only' : undefined;
          return { blob, name: withExt(`${baseName(item.file.name)}-${result.plan.width}x${result.plan.height}`, EXT[format]), width: result.plan.width, height: result.plan.height, note };
        } finally {
          releaseSurface(surface);
        }
      } finally {
        decoded.close();
      }
    });
  }

  protected download(id: number | string): void {
    if (this.batch.download(Number(id))) this.trackDownload();
  }

  protected async zip(): Promise<void> {
    if (await this.batch.downloadZip('resized-images.zip')) this.trackDownload();
  }
}
