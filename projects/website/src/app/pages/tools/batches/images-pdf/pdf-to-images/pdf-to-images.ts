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
import { nextTask } from '../shared/async';
import { LIMITS, baseName, safeFileName } from '../shared/files';
import { ImageError } from '../shared/image-codec';
import { IpRange } from '../shared/ip-fields';
import { IpResults, type ResultRow } from '../shared/ip-results';
import { parsePageRanges } from '../shared/page-ranges';
import { type PdfHandle, PdfOpenError, openPdf, pageSizePoints, readPdfFile, renderPage } from '../shared/pdfjs';
import { downloadBlob, zipEntries } from '../shared/zip';

const FORMATS = [
  { id: 'png', name: 'PNG: sharp text, larger files' },
  { id: 'jpeg', name: 'JPEG: smaller files for photos and scans' },
];
const DPIS = [72, 96, 150, 200, 300].map((n) => ({ id: String(n), name: `${n} DPI${n === 72 ? ' (screen size)' : n === 150 ? ' (good for reading)' : n === 300 ? ' (print quality)' : ''}` }));

interface PageResult {
  page: number;
  name: string;
  status: 'queued' | 'working' | 'done' | 'error';
  detail: string;
  blob?: Blob;
  url?: string;
  width?: number;
  height?: number;
}

/**
 * /tools/pdf-to-images: renders PDF pages to PNG or JPEG with pdf.js, one page at a time (each canvas is freed
 * before the next page), at a chosen DPI and page range. Password-protected PDFs prompt for the password. Results
 * download one by one or as a ZIP. Nothing is uploaded.
 */
@Component({
  selector: 'app-pdf-to-images',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolInput, ToolChoice, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpRange, IpResults],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="pdf-to-images">
      <div class="tool-split">
        <app-tool-panel title="PDF file">
          <app-custom-file-input
            controlName="pdf-to-images-file"
            [label$]="fileLabel"
            accept="application/pdf,.pdf"
            placeholder="Choose a PDF, or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxFileMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          @if (needsPassword()) {
            <app-tool-note kind="warn">This PDF is password protected. Enter the password to render its pages. It is used only in this tab and is never sent anywhere.</app-tool-note>
            <app-tool-input fieldId="pdf-to-images-password" label="PDF password" type="password" [control]="passwordCtl" [mono]="false" />
            <app-tool-button kind="primary" label="Unlock PDF" icon="file-down" [fill]="true" [loading]="opening()" [disabled]="!password()" (pressed)="unlock()" />
          }
          @if (openError()) {
            <app-tool-note kind="error">{{ openError() }}</app-tool-note>
          }
          @if (pageCount(); as total) {
            <p class="tool-meta">{{ fileName() }} · {{ total }} {{ total === 1 ? 'page' : 'pages' }}@if (firstPage(); as p) { · first page {{ p }} }</p>
            <app-tool-choice fieldId="pdf-to-images-format" label="Image format" [control]="formatCtl" [options]="formats" />
            <div class="tool-controls">
              <app-tool-select fieldId="pdf-to-images-dpi" label="Resolution" [control]="dpiCtl" [options]="dpis" hint="72 DPI is the page's own size in pixels (1 point = 1 pixel)." />
              <app-tool-input fieldId="pdf-to-images-range" label="Pages (optional)" [control]="rangeCtl" [mono]="false" placeholder="All pages" [invalid]="!!rangeError()" hint="For example 1-3,5,8- . Leave empty for all pages." />
            </div>
            @if (rangeError()) {
              <app-tool-note kind="error">{{ rangeError() }}</app-tool-note>
            }
            @if (format() === 'jpeg') {
              <app-ip-range fieldId="pdf-to-images-quality" [label]="'JPEG quality: ' + quality() + '%'" [control]="qualityCtl" [min]="40" [max]="100" />
            }
            <app-tool-note kind="info">
              Pages are drawn on a white background. Fonts that are not embedded in the PDF are replaced by similar system fonts, so text can look slightly different from other viewers. Up to {{ maxPages }} pages per run.
            </app-tool-note>
            <app-tool-button
              kind="primary"
              icon="file-down"
              [label]="'Convert ' + selectedCount() + (selectedCount() === 1 ? ' page' : ' pages') + ' to ' + (format() === 'png' ? 'PNG' : 'JPEG')"
              [fill]="true"
              [loading]="busy()"
              [disabled]="!!rangeError() || !selectedCount()"
              (pressed)="convert()"
            />
          }
        </app-tool-panel>

        <app-tool-panel title="Page images">
          @if (notice()) {
            <app-tool-note kind="warn">{{ notice() }}</app-tool-note>
          }
          @if (rows().length) {
            <app-ip-results
              [rows]="resultRows()"
              [percent]="percent()"
              [busy]="busy()"
              [summary]="summary()"
              [zipLabel]="doneCount() > 1 ? 'Download all as ZIP' : ''"
              [zipping]="zipping()"
              icon="file-image"
              listLabel="Page images"
              (download)="download($event)"
              (zip)="zip()"
              (cancel)="cancel()"
            />
          } @else {
            <app-tool-empty icon="file-down">Choose a PDF, pick a format and resolution, then convert. Each page becomes one image, downloadable on its own or as a ZIP.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class PdfToImagesTool {
  private readonly markUsed = toolUsage('pdf-to-images');
  private readonly trackDownload = toolCopied('pdf-to-images', { method: 'download' });

  protected readonly maxFileMb = LIMITS.pdfFileBytes / (1024 * 1024);
  protected readonly maxPages = LIMITS.pagesToImages;
  protected readonly fileLabel = of('PDF to convert');
  protected readonly formats = FORMATS;
  protected readonly dpis = DPIS;

  protected readonly formatCtl = new FormControl<string>('png', { nonNullable: true });
  protected readonly dpiCtl = new FormControl<string>('150', { nonNullable: true });
  protected readonly rangeCtl = new FormControl<string>('', { nonNullable: true });
  protected readonly qualityCtl = new FormControl<string>('90', { nonNullable: true });
  protected readonly passwordCtl = new FormControl<string>('', { nonNullable: true });
  protected readonly format = controlSignal(this.formatCtl);
  private readonly dpi = controlSignal(this.dpiCtl);
  private readonly rangeText = controlSignal(this.rangeCtl);
  private readonly qualitySig = controlSignal(this.qualityCtl);
  protected readonly quality = computed(() => Math.min(100, Math.max(40, Number(this.qualitySig()) || 90)));
  protected readonly password = controlSignal(this.passwordCtl);

  protected readonly fileName = signal('');
  protected readonly pageCount = signal(0);
  protected readonly firstPage = signal('');
  protected readonly needsPassword = signal(false);
  protected readonly opening = signal(false);
  protected readonly openError = signal('');
  protected readonly busy = signal(false);
  protected readonly zipping = signal(false);
  protected readonly notice = signal('');
  protected readonly rows = signal<PageResult[]>([]);

  private file: File | null = null;
  private bytes: Uint8Array | null = null;
  private handle: PdfHandle | null = null;
  private abort: AbortController | null = null;
  private openToken = 0;

  private readonly parsed = computed(() => (this.pageCount() ? parsePageRanges(this.rangeText(), this.pageCount()) : null));
  protected readonly rangeError = computed(() => {
    const p = this.parsed();
    return p && !p.ok ? p.error : '';
  });
  private readonly selected = computed(() => {
    const p = this.parsed();
    return p && p.ok ? [...new Set(p.pages)] : [];
  });
  protected readonly selectedCount = computed(() => this.selected().length);
  protected readonly doneCount = computed(() => this.rows().filter((r) => r.status === 'done').length);
  protected readonly percent = computed(() => {
    const rows = this.rows();
    return rows.length ? Math.round((rows.filter((r) => r.status === 'done' || r.status === 'error').length / rows.length) * 100) : 0;
  });
  protected readonly summary = computed(() => {
    const rows = this.rows();
    if (!rows.length) return '';
    const done = rows.filter((r) => r.status === 'done');
    const bytes = done.reduce((sum, r) => sum + (r.blob?.size ?? 0), 0);
    const failed = rows.filter((r) => r.status === 'error').length;
    return `${done.length} of ${rows.length} pages done${failed ? `, ${failed} failed` : ''}${done.length ? ` · ${formatBytes(bytes)} in total` : ''}`;
  });
  protected readonly resultRows = computed<ResultRow[]>(() =>
    this.rows().map((r) => ({ id: r.page, name: r.name, status: r.status, detail: r.detail, thumb: r.url, canDownload: !!r.blob })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abort?.abort();
      this.openToken++;
      this.releaseResults();
      void this.handle?.close();
    });
    // New settings make rendered pages stale.
    effect(() => {
      this.format();
      this.dpi();
      this.quality();
      this.rangeText();
      untracked(() => {
        if (!this.busy() && this.rows().length) this.releaseResults();
      });
    });
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.abort?.abort();
    const token = ++this.openToken;
    this.releaseResults();
    await this.handle?.close();
    this.handle = null;
    this.bytes = null;
    this.file = picked;
    this.pageCount.set(0);
    this.firstPage.set('');
    this.needsPassword.set(false);
    this.openError.set('');
    this.passwordCtl.setValue('');
    this.rangeCtl.setValue('');
    this.fileName.set(picked?.name ?? '');
    if (!picked) return;
    this.opening.set(true);
    try {
      this.bytes = await readPdfFile(picked);
      await this.open(token);
    } catch (error) {
      this.fail(error, token);
    } finally {
      if (token === this.openToken) this.opening.set(false);
    }
  }

  protected async unlock(): Promise<void> {
    const token = ++this.openToken;
    this.opening.set(true);
    this.openError.set('');
    try {
      await this.open(token, this.password());
    } catch (error) {
      this.fail(error, token);
    } finally {
      if (token === this.openToken) this.opening.set(false);
    }
  }

  private async open(token: number, password?: string): Promise<void> {
    if (!this.bytes) return;
    const handle = await openPdf(this.bytes, password);
    if (token !== this.openToken) {
      await handle.close();
      return;
    }
    this.handle = handle;
    this.needsPassword.set(false);
    this.pageCount.set(handle.pageCount);
    try {
      const size = await pageSizePoints(handle, 1);
      this.firstPage.set(`${Math.round(size.width)} x ${Math.round(size.height)} pt`);
    } catch {
      this.firstPage.set('');
    }
  }

  private fail(error: unknown, token: number): void {
    if (token !== this.openToken) return;
    if (error instanceof PdfOpenError && error.kind === 'password') {
      this.needsPassword.set(true);
      this.openError.set('');
    } else if (error instanceof PdfOpenError && error.kind === 'wrong-password') {
      this.needsPassword.set(true);
      this.openError.set(error.message);
    } else if (error instanceof PdfOpenError) {
      this.openError.set(error.message);
    } else {
      this.openError.set('This file could not be opened as a PDF.');
    }
  }

  protected async convert(): Promise<void> {
    const handle = this.handle;
    const file = this.file;
    if (!handle || !file || this.busy()) return;
    let pages = this.selected();
    if (!pages.length) return;
    this.markUsed();
    this.releaseResults();
    this.notice.set('');
    if (pages.length > LIMITS.pagesToImages) {
      this.notice.set(`Only the first ${LIMITS.pagesToImages} of the ${pages.length} selected pages are converted in one run. Use the page range to do the rest.`);
      pages = pages.slice(0, LIMITS.pagesToImages);
    }
    const format = this.format() as 'png' | 'jpeg';
    const scale = Number(this.dpi()) / 72;
    const quality = this.quality() / 100;
    const digits = String(handle.pageCount).length;
    const stem = safeFileName(baseName(file.name), 'page');
    const ext = format === 'png' ? 'png' : 'jpg';
    this.rows.set(pages.map((page) => ({ page, name: `${stem}-page-${String(page).padStart(digits, '0')}.${ext}`, status: 'queued', detail: 'Waiting' })));
    const abort = (this.abort = new AbortController());
    this.busy.set(true);
    let total = 0;
    try {
      for (const page of pages) {
        if (abort.signal.aborted) break;
        if (total > LIMITS.pageImageBytes) {
          this.notice.set(`Stopped at page ${page} to keep memory use safe (over ${formatBytes(LIMITS.pageImageBytes)} of images). Download these, then convert the rest with a page range or a lower resolution.`);
          this.patchWhere((r) => r.status === 'queued', { status: 'queued', detail: 'Not converted' });
          break;
        }
        this.patch(page, { status: 'working', detail: 'Rendering…' });
        await nextTask();
        try {
          const rendered = await renderPage(handle, page, scale, format, quality);
          if (abort.signal.aborted) break;
          total += rendered.blob.size;
          this.patch(page, {
            status: 'done',
            blob: rendered.blob,
            url: URL.createObjectURL(rendered.blob),
            width: rendered.width,
            height: rendered.height,
            detail: `${rendered.width} x ${rendered.height} px · ${formatBytes(rendered.blob.size)}`,
          });
        } catch (error) {
          if (abort.signal.aborted) break;
          this.patch(page, { status: 'error', detail: error instanceof ImageError ? error.message : 'This page could not be drawn.' });
        }
        await nextTask();
      }
    } finally {
      this.patchWhere((r) => r.status === 'working', { status: 'queued', detail: 'Cancelled' });
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.abort?.abort();
  }

  protected download(id: number | string): void {
    const row = this.rows().find((r) => r.page === Number(id));
    if (!row?.blob) return;
    downloadBlob(row.blob, row.name);
    this.trackDownload();
  }

  protected async zip(): Promise<void> {
    const done = this.rows().filter((r) => r.blob);
    if (!done.length || this.zipping()) return;
    this.zipping.set(true);
    try {
      const stem = safeFileName(baseName(this.file?.name ?? 'pages'), 'pages');
      downloadBlob(await zipEntries(done.map((r) => ({ name: r.name, data: r.blob! }))), `${stem}-images.zip`);
      this.trackDownload();
    } catch {
      this.notice.set('Could not build the ZIP file. Download the pages one by one, or convert fewer pages at a time.');
    } finally {
      this.zipping.set(false);
    }
  }

  private patch(page: number, patch: Partial<PageResult>): void {
    this.rows.update((list) => list.map((r) => (r.page === page ? { ...r, ...patch } : r)));
  }

  private patchWhere(test: (r: PageResult) => boolean, patch: Partial<PageResult>): void {
    this.rows.update((list) => list.map((r) => (test(r) ? { ...r, ...patch } : r)));
  }

  private releaseResults(): void {
    this.rows().forEach((r) => r.url && URL.revokeObjectURL(r.url));
    this.rows.set([]);
    this.notice.set('');
  }
}
