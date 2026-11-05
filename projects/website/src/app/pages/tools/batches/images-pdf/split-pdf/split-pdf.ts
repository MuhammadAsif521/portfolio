import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import type { PDFDocument } from 'pdf-lib';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolChoice, ToolInput } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { nextTask } from '../shared/async';
import { LIMITS, baseName, isPdf, safeFileName } from '../shared/files';
import { IpResults, type ResultRow } from '../shared/ip-results';
import { everyN, formatRanges, groupLabel, parsePageRanges } from '../shared/page-ranges';
import { PdfLibError, extractPages, openPdfLib } from '../shared/pdf-ops';
import { type PdfHandle, openPdf, readPdfFile, renderThumbnail } from '../shared/pdfjs';
import { downloadBlob, zipEntries } from '../shared/zip';
import { PageThumb } from './page-thumb';

const MODES = [
  { id: 'ranges', name: 'Page ranges: one file per range' },
  { id: 'every', name: 'Every N pages' },
  { id: 'each', name: 'Every page as its own file' },
  { id: 'extract', name: 'Pick pages: one new PDF' },
];

interface Output {
  id: number;
  name: string;
  pages: number[];
  status: 'queued' | 'working' | 'done' | 'error';
  detail: string;
  blob?: Blob;
}

/**
 * /tools/split-pdf: splits one PDF with pdf-lib by page ranges, every N pages, one file per page, or a picked set of
 * pages in a single new PDF. Page thumbnails come from pdf.js and render only as they scroll into view. Several
 * outputs are offered one by one and as a ZIP. Encrypted PDFs are refused with a clear message.
 */
@Component({
  selector: 'app-split-pdf',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolChoice, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpResults, PageThumb],
  styleUrls: ['../../../tool-ui.scss', './split-pdf.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="split-pdf">
      <div class="tool-split">
        <app-tool-panel title="PDF and split options">
          <app-custom-file-input
            controlName="split-pdf-file"
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
          @if (loading()) {
            <p class="tool-meta" role="status">Reading the PDF…</p>
          }
          @if (loadError()) {
            <app-tool-note kind="error">{{ loadError() }}</app-tool-note>
          }
          @if (pageCount(); as total) {
            <p class="tool-meta">{{ fileName() }} · {{ total }} {{ total === 1 ? 'page' : 'pages' }}</p>
            <app-tool-choice fieldId="split-pdf-mode" label="Split by" [control]="modeCtl" [options]="modes" />
            @switch (mode()) {
              @case ('ranges') {
                <app-tool-input fieldId="split-pdf-ranges" label="Page ranges" [control]="rangesCtl" [mono]="false" placeholder="1-3,5,8-" [invalid]="!!rangeError()" hint="Each comma-separated part becomes its own PDF: 1-3,5,8- gives pages 1 to 3, page 5, and page 8 to the end." />
              }
              @case ('every') {
                <app-tool-input fieldId="split-pdf-every" label="Pages per file" type="number" [control]="everyCtl" [min]="1" [max]="total" inputMode="numeric" [invalid]="!!rangeError()" [hint]="'A ' + total + '-page PDF gives ' + groups().length + ' files.'" />
              }
              @case ('extract') {
                <app-tool-input fieldId="split-pdf-extract" label="Pages to keep" [control]="extractCtl" [mono]="false" placeholder="Click pages on the right, or type 1-3,5" [invalid]="!!rangeError()" hint="All selected pages go into one new PDF, in page order." />
              }
              @default {
                <p class="tool-meta">{{ total }} files will be created, one per page.</p>
              }
            }
            @if (rangeError()) {
              <app-tool-note kind="error">{{ rangeError() }}</app-tool-note>
            }
            <app-tool-note kind="info">
              Pages are copied as they are. Bookmarks, form fields and the original document title and author are not carried into the new files.
            </app-tool-note>
            <app-tool-button
              kind="primary"
              icon="scissors"
              [label]="groups().length > 1 ? 'Split into ' + groups().length + ' files' : 'Create PDF'"
              [fill]="true"
              [loading]="busy()"
              [disabled]="!groups().length || !!rangeError()"
              (pressed)="split()"
            />
          }
        </app-tool-panel>

        <app-tool-panel title="Pages and results">
          @if (!pageCount()) {
            <app-tool-empty icon="scissors">Choose a PDF to see its pages. Then split it by range, every N pages, page by page, or pick the pages you want.</app-tool-empty>
          } @else {
            @if (mode() === 'extract') {
              <p class="tool-meta">Click pages to select them. {{ selectedPages().length }} selected.</p>
            }
            <div class="thumbs" role="group" aria-label="PDF pages">
              @for (p of thumbPages(); track p) {
                <app-page-thumb [page]="p" [loader]="thumbLoader" [selectable]="mode() === 'extract'" [selected]="selectedSet().has(p)" (toggle)="toggle($event)" />
              }
            </div>
            @if (pageCount() > thumbPages().length) {
              <p class="tool-meta">Previews are shown for the first {{ thumbPages().length }} pages. Type page numbers for the rest.</p>
            }
          }
          @if (notice()) {
            <app-tool-note kind="warn">{{ notice() }}</app-tool-note>
          }
          @if (outputs().length) {
            <app-ip-results
              [rows]="resultRows()"
              [percent]="percent()"
              [busy]="busy()"
              [summary]="summary()"
              [zipLabel]="doneCount() > 1 ? 'Download all as ZIP' : ''"
              [zipping]="zipping()"
              icon="file-stack"
              listLabel="Split PDFs"
              (download)="download($event)"
              (zip)="zip()"
              (cancel)="cancel()"
            />
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class SplitPdfTool {
  private readonly markUsed = toolUsage('split-pdf');
  private readonly trackDownload = toolCopied('split-pdf', { method: 'download' });

  protected readonly maxFileMb = LIMITS.pdfFileBytes / (1024 * 1024);
  protected readonly fileLabel = of('PDF to split');
  protected readonly modes = MODES;

  protected readonly modeCtl = new FormControl<string>('ranges', { nonNullable: true });
  protected readonly rangesCtl = new FormControl<string>('', { nonNullable: true });
  protected readonly everyCtl = new FormControl<string>('2', { nonNullable: true });
  protected readonly extractCtl = new FormControl<string>('', { nonNullable: true });
  protected readonly mode = controlSignal(this.modeCtl);
  private readonly rangesText = controlSignal(this.rangesCtl);
  private readonly everyText = controlSignal(this.everyCtl);
  private readonly extractText = controlSignal(this.extractCtl);

  protected readonly fileName = signal('');
  protected readonly pageCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly zipping = signal(false);
  protected readonly notice = signal('');
  protected readonly outputs = signal<Output[]>([]);

  private file: File | null = null;
  private source: PDFDocument | null = null;
  private handle: PdfHandle | null = null;
  private abort: AbortController | null = null;
  private loadToken = 0;
  private readonly thumbUrls = new Map<number, string>();
  private thumbQueue: Promise<unknown> = Promise.resolve();

  protected readonly thumbPages = computed(() => Array.from({ length: Math.min(this.pageCount(), LIMITS.thumbPages) }, (_, i) => i + 1));

  /** The page groups the current mode would produce, or [] while the settings are invalid. */
  private readonly plan = computed<{ groups: number[][]; error: string }>(() => {
    const total = this.pageCount();
    if (!total) return { groups: [], error: '' };
    switch (this.mode()) {
      case 'ranges': {
        const parsed = parsePageRanges(this.rangesText(), total);
        if (!parsed.ok) return { groups: [], error: parsed.error };
        return { groups: this.rangesText().trim() ? parsed.groups : [], error: this.rangesText().trim() ? '' : 'Enter at least one page or range.' };
      }
      case 'every': {
        const n = Number(this.everyText());
        if (!Number.isInteger(n) || n < 1) return { groups: [], error: 'Enter a whole number of pages, 1 or more.' };
        return { groups: everyN(total, n), error: '' };
      }
      case 'extract': {
        if (!this.extractText().trim()) return { groups: [], error: '' };
        const parsed = parsePageRanges(this.extractText(), total);
        if (!parsed.ok) return { groups: [], error: parsed.error };
        return { groups: [[...new Set(parsed.pages)].sort((a, b) => a - b)], error: '' };
      }
      default:
        return { groups: everyN(total, 1), error: '' };
    }
  });
  protected readonly groups = computed(() => this.plan().groups);
  protected readonly rangeError = computed(() => {
    const e = this.plan().error;
    if (e) return e;
    return this.groups().length > LIMITS.splitFiles ? `That would create ${this.groups().length} files. The limit is ${LIMITS.splitFiles} per run.` : '';
  });
  protected readonly selectedPages = computed(() => {
    const parsed = this.pageCount() ? parsePageRanges(this.extractText(), this.pageCount()) : null;
    return parsed && parsed.ok && this.extractText().trim() ? [...new Set(parsed.pages)].sort((a, b) => a - b) : [];
  });
  protected readonly selectedSet = computed(() => new Set(this.selectedPages()));

  protected readonly doneCount = computed(() => this.outputs().filter((o) => o.status === 'done').length);
  protected readonly percent = computed(() => {
    const outputs = this.outputs();
    return outputs.length ? Math.round((outputs.filter((o) => o.status === 'done' || o.status === 'error').length / outputs.length) * 100) : 0;
  });
  protected readonly summary = computed(() => {
    const outputs = this.outputs();
    if (!outputs.length) return '';
    const done = outputs.filter((o) => o.status === 'done');
    const bytes = done.reduce((sum, o) => sum + (o.blob?.size ?? 0), 0);
    return `${done.length} of ${outputs.length} files done${done.length ? ` · ${formatBytes(bytes)} in total` : ''}`;
  });
  protected readonly resultRows = computed<ResultRow[]>(() =>
    this.outputs().map((o) => ({ id: o.id, name: o.name, status: o.status, detail: o.detail, canDownload: !!o.blob })),
  );

  protected readonly thumbLoader = (page: number): Promise<string> => this.thumb(page);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abort?.abort();
      this.loadToken++;
      this.dispose();
    });
    // New settings make earlier outputs stale.
    effect(() => {
      this.mode();
      this.rangesText();
      this.everyText();
      this.extractText();
      untracked(() => {
        if (!this.busy() && this.outputs().length) this.outputs.set([]);
      });
    });
  }

  private dispose(): void {
    this.thumbUrls.forEach((url) => URL.revokeObjectURL(url));
    this.thumbUrls.clear();
    this.thumbQueue = Promise.resolve();
    void this.handle?.close();
    this.handle = null;
    this.source = null;
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.abort?.abort();
    const token = ++this.loadToken;
    this.dispose();
    this.file = picked;
    this.pageCount.set(0);
    this.outputs.set([]);
    this.notice.set('');
    this.loadError.set('');
    this.extractCtl.setValue('');
    this.fileName.set(picked?.name ?? '');
    if (!picked) return;
    this.loading.set(true);
    try {
      const bytes = await readPdfFile(picked);
      if (!isPdf(bytes.subarray(0, 1100))) throw new PdfLibError('invalid', 'This does not look like a PDF file.');
      const source = await openPdfLib(bytes);
      if (token !== this.loadToken) return;
      this.source = source;
      this.pageCount.set(source.getPageCount());
      // Previews are optional: if pdf.js cannot open the file, splitting still works.
      try {
        const handle = await openPdf(bytes);
        if (token !== this.loadToken) {
          await handle.close();
          return;
        }
        this.handle = handle;
      } catch {
        this.handle = null;
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      this.loadError.set(error instanceof Error && 'kind' in error ? error.message : 'This file could not be read as a PDF.');
    } finally {
      if (token === this.loadToken) this.loading.set(false);
    }
  }

  private thumb(page: number): Promise<string> {
    const cached = this.thumbUrls.get(page);
    if (cached) return Promise.resolve(cached);
    // One preview at a time keeps the page responsive on long documents.
    const job = this.thumbQueue.then(async () => {
      const handle = this.handle;
      if (!handle) throw new Error('no preview');
      const again = this.thumbUrls.get(page);
      if (again) return again;
      const url = await renderThumbnail(handle, page);
      if (handle !== this.handle) {
        URL.revokeObjectURL(url);
        throw new Error('stale');
      }
      this.thumbUrls.set(page, url);
      return url;
    });
    this.thumbQueue = job.catch(() => undefined);
    return job;
  }

  protected toggle(page: number): void {
    const set = new Set(this.selectedPages());
    if (set.has(page)) set.delete(page);
    else set.add(page);
    this.extractCtl.setValue(formatRanges([...set]));
  }

  protected async split(): Promise<void> {
    const source = this.source;
    const file = this.file;
    const groups = this.groups();
    if (!source || !file || !groups.length || this.busy()) return;
    this.markUsed();
    this.notice.set('');
    const stem = safeFileName(baseName(file.name), 'document');
    const outputs: Output[] = groups.map((pages, i) => ({
      id: i + 1,
      name: `${stem}-${groupLabel(pages)}.pdf`,
      pages,
      status: 'queued',
      detail: `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`,
    }));
    // The same range typed twice would give two files with the same name; the ZIP and the list make them unique.
    this.outputs.set(outputs);
    const abort = (this.abort = new AbortController());
    this.busy.set(true);
    try {
      for (const output of outputs) {
        if (abort.signal.aborted) break;
        this.patch(output.id, { status: 'working', detail: 'Writing…' });
        await nextTask();
        try {
          const bytes = await extractPages(source, output.pages);
          if (abort.signal.aborted) break;
          const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
          this.patch(output.id, { status: 'done', blob, detail: `${output.pages.length} ${output.pages.length === 1 ? 'page' : 'pages'} · ${formatBytes(blob.size)}` });
        } catch (error) {
          if (abort.signal.aborted) break;
          this.patch(output.id, { status: 'error', detail: error instanceof Error && error.name === 'RangeError' ? 'Ran out of memory for this file.' : 'This file could not be written.' });
        }
        await nextTask();
      }
    } finally {
      this.outputs.update((list) => list.map((o) => (o.status === 'working' ? { ...o, status: 'queued', detail: 'Cancelled' } : o)));
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.abort?.abort();
  }

  protected download(id: number | string): void {
    const output = this.outputs().find((o) => o.id === Number(id));
    if (!output?.blob) return;
    downloadBlob(output.blob, output.name);
    this.trackDownload();
  }

  protected async zip(): Promise<void> {
    const done = this.outputs().filter((o) => o.blob);
    if (!done.length || this.zipping()) return;
    this.zipping.set(true);
    try {
      const stem = safeFileName(baseName(this.file?.name ?? 'split'), 'split');
      downloadBlob(await zipEntries(done.map((o) => ({ name: o.name, data: o.blob! }))), `${stem}-split.zip`);
      this.trackDownload();
    } catch {
      this.notice.set('Could not build the ZIP file. Download the files one by one, or split into fewer files.');
    } finally {
      this.zipping.set(false);
    }
  }

  private patch(id: number, patch: Partial<Output>): void {
    this.outputs.update((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
}
