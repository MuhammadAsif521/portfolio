import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolChoice, ToolInput, ToolSelect, ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { baseName, safeFileName } from '../shared/files';
import { ImageError, createSurface, releaseSurface, surfaceToBlob } from '../shared/image-codec';
import { IpColor } from '../shared/ip-fields';
import { downloadBlob } from '../shared/zip';
import { MAX_SVG_BYTES, type PreparedSvg, SvgError, checkSvgText, prepareSvg, svgAtSize } from './svg-utils';
import { checkOutputSize } from '../shared/size-math';

const EXAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
  <rect width="120" height="80" rx="12" fill="#1d4ed8"/>
  <circle cx="40" cy="40" r="22" fill="#fbbf24"/>
  <path d="M62 56 L82 24 L102 56 Z" fill="#ffffff"/>
</svg>`;

const SIZE_MODES = [
  { id: 'scale', name: 'Scale' },
  { id: 'width', name: 'Width in pixels' },
];
const SCALES = [0.5, 1, 2, 3, 4, 8].map((n) => ({ id: String(n), name: `${n}x the SVG's own size` }));
const BACKGROUNDS = [
  { id: 'transparent', name: 'Transparent' },
  { id: 'white', name: 'White' },
  { id: 'black', name: 'Black' },
  { id: 'custom', name: 'Custom colour' },
];

/**
 * /tools/svg-to-png: cleans the SVG (DOMPurify SVG profile plus stricter rules), shows the cleaned version through an
 * <img>, and draws it onto a canvas at the chosen scale or width, on a transparent or coloured background. The SVG is
 * never inserted into the page as markup. Works for SVGs without width, height or viewBox, with a stated default.
 */
@Component({
  selector: 'app-svg-to-png',
  imports: [DecimalPipe, ToolLayout, ToolPanel, ToolSelect, ToolInput, ToolChoice, ToolTextarea, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpColor],
  styleUrls: ['../../../tool-ui.scss', './svg-to-png.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="svg-to-png">
      <div class="tool-split">
        <app-tool-panel title="SVG source">
          <app-custom-file-input
            controlName="svg-to-png-file"
            [label$]="fileLabel"
            accept=".svg,image/svg+xml"
            placeholder="Choose an SVG file, or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxFileMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          <app-tool-textarea fieldId="svg-to-png-code" label="Or paste SVG code" [control]="codeCtl" [rows]="9" [wrap]="false" placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>" />
          <div class="tool-presets">
            <button type="button" class="tool-chip-button" (click)="loadExample()">Load an example</button>
          </div>

          <app-tool-choice fieldId="svg-to-png-mode" label="Output size" [control]="modeCtl" [options]="sizeModes" />
          <div class="tool-controls">
            @if (mode() === 'scale') {
              <app-tool-select fieldId="svg-to-png-scale" label="Scale" [control]="scaleCtl" [options]="scales" />
            } @else {
              <app-tool-input fieldId="svg-to-png-width" label="Width (px)" type="number" [control]="widthCtl" [min]="1" [max]="16384" inputMode="numeric" hint="The height follows the SVG's shape." />
            }
            <app-tool-select fieldId="svg-to-png-bg" label="Background" [control]="bgCtl" [options]="backgrounds" />
          </div>
          @if (bg() === 'custom') {
            <app-ip-color fieldId="svg-to-png-bg-color" label="Background colour" [control]="bgColorCtl" />
          }
          @if (target(); as t) {
            <p class="tool-meta">{{ t.error ?? 'Output: ' + t.width + ' x ' + t.height + ' px' }}</p>
          }
          <app-tool-button kind="primary" icon="file-image" label="Render PNG" [fill]="true" [loading]="busy()" [disabled]="!prepared()" (pressed)="render()" />
        </app-tool-panel>

        <app-tool-panel title="Preview and PNG">
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          @if (prepared(); as p) {
            @if (!p.size.known) {
              <app-tool-note kind="warn">This SVG has no width, height or viewBox, so a default of {{ p.size.width }} x {{ p.size.height }} px is used. Set a width above to choose another size.</app-tool-note>
            }
            @if (p.removed.length) {
              <app-tool-note kind="info">Removed from this SVG before drawing: {{ p.removed.join(', ') }}. Scripts, links to other files and animation are never kept.</app-tool-note>
            }
            <figure class="svg__fig">
              <img class="svg__img" [src]="previewUrl()" alt="Preview of the cleaned SVG" />
              <figcaption>Cleaned SVG as the browser draws it. {{ p.size.known ? 'Own size' : 'Assumed size' }}: {{ p.size.width | number: '1.0-1' }} x {{ p.size.height | number: '1.0-1' }} px.</figcaption>
            </figure>
          } @else if (!error()) {
            <app-tool-empty icon="file-image">Choose an SVG file or paste its code. A safe preview appears here, then press Render PNG to get the image.</app-tool-empty>
          }
          @if (result(); as r) {
            <figure class="svg__fig">
              <img class="svg__img" [src]="r.url" [alt]="'Rendered PNG, ' + r.width + ' by ' + r.height + ' pixels'" />
              <figcaption>{{ r.width }} x {{ r.height }} px · {{ r.size }}</figcaption>
            </figure>
            <app-tool-button kind="primary" icon="download" [label]="'Download ' + r.name" [fill]="true" (pressed)="download()" />
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class SvgToPngTool {
  private readonly markUsed = toolUsage('svg-to-png');
  private readonly trackDownload = toolCopied('svg-to-png', { method: 'download' });

  protected readonly maxFileMb = MAX_SVG_BYTES / (1024 * 1024);
  protected readonly fileLabel = of('SVG file');
  protected readonly sizeModes = SIZE_MODES;
  protected readonly scales = SCALES;
  protected readonly backgrounds = BACKGROUNDS;

  protected readonly codeCtl = new FormControl<string>('', { nonNullable: true });
  protected readonly modeCtl = new FormControl<string>('scale', { nonNullable: true });
  protected readonly scaleCtl = new FormControl<string>('2', { nonNullable: true });
  protected readonly widthCtl = new FormControl<string>('1024', { nonNullable: true });
  protected readonly bgCtl = new FormControl<string>('transparent', { nonNullable: true });
  protected readonly bgColorCtl = new FormControl<string>('#ffffff', { nonNullable: true });

  private readonly code = controlSignal(this.codeCtl);
  protected readonly mode = controlSignal(this.modeCtl);
  private readonly scale = controlSignal(this.scaleCtl);
  private readonly width = controlSignal(this.widthCtl);
  protected readonly bg = controlSignal(this.bgCtl);
  private readonly bgColor = controlSignal(this.bgColorCtl);

  protected readonly prepared = signal<PreparedSvg | null>(null);
  protected readonly previewUrl = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly result = signal<{ url: string; width: number; height: number; size: string; name: string; blob: Blob } | null>(null);
  private fileName = 'image';
  private token = 0;

  /** Pixel size the PNG will have, or what to fix. */
  protected readonly target = computed(() => {
    const p = this.prepared();
    if (!p) return null;
    const k = this.mode() === 'scale' ? Number(this.scale()) : Number(this.width()) / p.size.width;
    const width = Math.round(p.size.width * k);
    const height = Math.round(p.size.height * k);
    const error = Number.isFinite(width) && Number.isFinite(height) ? checkOutputSize(width, height) : 'Enter a width in pixels.';
    return { width, height, error };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.token++;
      this.revokeAll();
    });
    // Clean and measure the SVG shortly after the code stops changing.
    effect((onCleanup) => {
      const text = this.code();
      const timer = setTimeout(() => void this.prepare(text), 250);
      onCleanup(() => clearTimeout(timer));
    });
    effect(() => {
      this.target();
      this.bg();
      this.bgColor();
      untracked(() => this.clearResult());
    });
  }

  protected loadExample(): void {
    this.fileName = 'example';
    this.codeCtl.setValue(EXAMPLE);
  }

  protected async onFile(file: File | null): Promise<void> {
    if (!file) return;
    if (file.size > MAX_SVG_BYTES) {
      this.error.set(`This file is over ${MAX_SVG_BYTES / 1024 / 1024} MB. Simplify the SVG first.`);
      return;
    }
    try {
      const text = await file.text();
      this.fileName = safeFileName(baseName(file.name), 'image');
      this.codeCtl.setValue(text);
    } catch {
      this.error.set('This file could not be read.');
    }
  }

  private async prepare(text: string): Promise<void> {
    const token = ++this.token;
    if (!text.trim()) {
      this.error.set('');
      this.setPrepared(null);
      return;
    }
    try {
      const prepared = await prepareSvg(text);
      if (token !== this.token) return;
      this.error.set('');
      this.setPrepared(prepared);
    } catch (error) {
      if (token !== this.token) return;
      this.setPrepared(null);
      this.error.set(error instanceof SvgError ? error.message : checkSvgText(text) || 'This SVG could not be read.');
    }
  }

  private setPrepared(prepared: PreparedSvg | null): void {
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl());
    this.previewUrl.set(prepared ? URL.createObjectURL(new Blob([prepared.markup], { type: 'image/svg+xml;charset=utf-8' })) : '');
    this.prepared.set(prepared);
    this.clearResult();
  }

  protected async render(): Promise<void> {
    const prepared = this.prepared();
    const t = this.target();
    if (!prepared || !t) return;
    if (t.error) {
      this.error.set(t.error);
      return;
    }
    this.markUsed();
    this.busy.set(true);
    this.error.set('');
    const url = URL.createObjectURL(new Blob([svgAtSize(prepared, t.width, t.height)], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const surface = createSurface(t.width, t.height);
      try {
        const color = this.bg() === 'white' ? '#ffffff' : this.bg() === 'black' ? '#000000' : this.bg() === 'custom' ? this.bgColor() : null;
        if (color) {
          surface.ctx.fillStyle = color;
          surface.ctx.fillRect(0, 0, t.width, t.height);
        }
        surface.ctx.imageSmoothingQuality = 'high';
        surface.ctx.drawImage(img, 0, 0, t.width, t.height);
        const blob = await surfaceToBlob(surface, 'png', 1);
        this.clearResult();
        const scaleSuffix = this.mode() === 'scale' && Number(this.scale()) !== 1 ? `@${this.scale()}x` : '';
        this.result.set({ url: URL.createObjectURL(blob), width: t.width, height: t.height, size: formatBytes(blob.size), name: `${this.fileName}${scaleSuffix}.png`, blob });
      } finally {
        releaseSurface(surface);
      }
    } catch (error) {
      this.error.set(
        error instanceof ImageError
          ? error.message
          : 'The browser could not draw this SVG. It may use features that browsers only support inside web pages, such as external fonts or images.',
      );
    } finally {
      URL.revokeObjectURL(url);
      this.busy.set(false);
    }
  }

  protected download(): void {
    const r = this.result();
    if (!r) return;
    downloadBlob(r.blob, r.name);
    this.trackDownload();
  }

  private clearResult(): void {
    const r = this.result();
    if (r) URL.revokeObjectURL(r.url);
    this.result.set(null);
  }

  private revokeAll(): void {
    this.clearResult();
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl());
  }
}
