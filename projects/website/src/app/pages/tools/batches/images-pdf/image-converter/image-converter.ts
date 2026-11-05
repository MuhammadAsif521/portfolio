import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolSelect } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { LIMITS, withExt } from '../shared/files';
import { ImageBatch, batchRows, batchSummary } from '../shared/image-batch';
import { EXT, FORMAT_LABEL, type OutFormat, decodeImage, releaseSurface, renderPlan, supportedFormats, surfaceToBlob } from '../shared/image-codec';
import { IpColor, IpRange } from '../shared/ip-fields';
import { IpResults } from '../shared/ip-results';
import { planMaxSide } from '../shared/size-math';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif';

const FORMAT_NAMES: Record<OutFormat, string> = {
  png: 'PNG: lossless, keeps transparency',
  jpeg: 'JPEG: small photos, no transparency',
  webp: 'WebP: small, keeps transparency',
  avif: 'AVIF: smallest, newer format',
};

/**
 * /tools/image-converter: decodes each image with the browser (EXIF orientation applied), draws it on a canvas and
 * writes PNG, JPEG, WebP or, where this browser can encode it, AVIF. Files are processed one at a time; the result
 * list shows sizes before and after and offers a ZIP. Nothing is uploaded.
 */
@Component({
  selector: 'app-image-converter',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpRange, IpColor, IpResults],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="image-converter">
      <div class="tool-split">
        <app-tool-panel title="Images">
          <app-custom-file-input
            controlName="image-converter-files"
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
            <app-tool-select fieldId="image-converter-format" label="Convert to" [control]="formatCtl" [options]="formatOptions()" />
            @if (format() !== 'png') {
              <app-ip-range fieldId="image-converter-quality" [label]="'Quality: ' + quality() + '%'" [control]="qualityCtl" [min]="1" [max]="100" />
            }
            @if (format() === 'jpeg') {
              <app-ip-color fieldId="image-converter-background" label="Background for transparent areas" [control]="backgroundCtl" hint="JPEG cannot be transparent, so transparent pixels are filled with this colour." />
            }
          </div>
          <app-tool-note kind="info">
            Each image is decoded and written again by your browser, so EXIF data (camera, date, GPS) and embedded colour profiles are not copied into the new file. Photo orientation is applied to the pixels. Animated GIF and WebP files convert their first frame only.
          </app-tool-note>
          @if (batch.notice()) {
            <app-tool-note kind="warn">{{ batch.notice() }}</app-tool-note>
          }
          <app-tool-button
            kind="primary"
            icon="file-output"
            [label]="batch.items().length > 1 ? 'Convert ' + batch.items().length + ' images' : 'Convert image'"
            [fill]="true"
            [loading]="batch.busy()"
            [disabled]="!batch.items().length"
            (pressed)="convert()"
          />
        </app-tool-panel>

        <app-tool-panel title="Converted files">
          @if (batch.items().length) {
            <app-ip-results
              [rows]="rows()"
              [percent]="batch.percent()"
              [busy]="batch.busy()"
              [summary]="summary()"
              [zipLabel]="batch.doneItems().length > 1 ? 'Download all as ZIP' : ''"
              [zipping]="batch.zipping()"
              icon="file-image"
              listLabel="Converted images"
              (download)="download($event)"
              (zip)="zip()"
              (cancel)="batch.cancel()"
            />
          } @else {
            <app-tool-empty icon="file-output">Choose one or more images, pick a format and press Convert. Results appear here with their sizes, ready to download one by one or as a ZIP.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class ImageConverterTool {
  private readonly markUsed = toolUsage('image-converter');
  private readonly trackDownload = toolCopied('image-converter', { method: 'download' });

  protected readonly accept = ACCEPT;
  protected readonly maxFiles = LIMITS.imageFiles;
  protected readonly maxFileMb = LIMITS.imageFileBytes / (1024 * 1024);
  protected readonly fileLabel = of('Images to convert');
  protected readonly batch = new ImageBatch();

  protected readonly available = signal<OutFormat[]>(['png', 'jpeg', 'webp']);
  protected readonly formatOptions = computed(() => this.available().map((id) => ({ id, name: FORMAT_NAMES[id] })));
  protected readonly formatCtl = new FormControl<string>('webp', { nonNullable: true });
  protected readonly qualityCtl = new FormControl<string>('85', { nonNullable: true });
  protected readonly backgroundCtl = new FormControl<string>('#ffffff', { nonNullable: true });
  protected readonly format = controlSignal(this.formatCtl) as unknown as () => OutFormat;
  protected readonly quality = computed(() => Math.min(100, Math.max(1, Number(this.qualitySig()) || 85)));
  private readonly qualitySig = controlSignal(this.qualityCtl);
  private readonly background = controlSignal(this.backgroundCtl);

  protected readonly rows = computed(() => batchRows(this.batch.items()));
  protected readonly summary = computed(() => batchSummary(this.batch));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.batch.cancel());
    afterNextRender(() => {
      void supportedFormats().then((support) => {
        const list = (['png', 'jpeg', 'webp', 'avif'] as const).filter((f) => support[f]);
        this.available.set(list);
        if (!list.includes(this.formatCtl.value as OutFormat)) this.formatCtl.setValue('png');
      });
    });
    // New settings make earlier results stale: forget them rather than show files that do not match.
    effect(() => {
      this.format();
      this.quality();
      this.background();
      untracked(() => {
        if (!this.batch.busy() && this.batch.items().some((i) => i.result || i.error)) this.batch.resetResults();
      });
    });
  }

  protected onFiles(files: File[] | File | null): void {
    this.batch.setFiles(files);
  }

  protected async convert(): Promise<void> {
    this.markUsed();
    const format = this.format();
    const quality = this.quality() / 100;
    const background = this.background();
    await this.batch.run(async (item, report) => {
      const decoded = await decodeImage(item.file);
      try {
        report(`Writing ${FORMAT_LABEL[format]}…`);
        const plan = planMaxSide(decoded.width, decoded.height, 0);
        const surface = renderPlan(decoded, plan, 'low', format === 'jpeg' ? background : null);
        try {
          const blob = await surfaceToBlob(surface, format, quality);
          const notes: string[] = [];
          if (format === 'jpeg' && decoded.kind !== 'jpeg') notes.push(`transparent areas filled with ${background}`);
          if (decoded.kind === 'gif') notes.push('first frame only');
          return { blob, name: withExt(item.file.name, EXT[format]), width: decoded.width, height: decoded.height, note: notes.join(', ') || undefined };
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
    if (await this.batch.downloadZip('converted-images.zip')) this.trackDownload();
  }
}
