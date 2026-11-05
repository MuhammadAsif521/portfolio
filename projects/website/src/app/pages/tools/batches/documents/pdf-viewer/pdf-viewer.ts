import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { formatBytes } from '../../../tool-logic-2';
import { MB, baseName, downloadFile } from '../shared/doc-utils';
import { openPdf, type PasswordRequest } from './pdf-engine';
import {
  MAX_HITS,
  PDF_MAX_MB,
  PdfError,
  ZOOM_STEPS,
  buildPageText,
  checkPdfBytes,
  findHits,
  fitWidthScale,
  formatPdfDate,
  hitRect,
  pdfOpenMessage,
  previewText,
  renderRatio,
  snippet,
  stepZoom,
  type Matrix,
  type PageText,
  type TextRun,
} from './pdf-logic';
import { PdfThumb } from './pdf-thumb';

const THUMB_LIMIT = 300;
const ZOOM_OPTIONS = [{ id: 'fit', name: 'Fit width' }, ...ZOOM_STEPS.map((z) => ({ id: String(z), name: `${z}%` }))];

/** pdf.js text items without the marked-content markers. */
const toRuns = (items: readonly unknown[]): TextRun[] => items.filter((item) => typeof item === 'object' && item !== null && 'str' in item) as TextRun[];

interface SearchHit {
  page: number;
  start: number;
  end: number;
  text: string;
}

interface PageContext {
  page: number;
  runs: TextRun[];
  text: PageText;
  matrix: Matrix;
  scale: number;
}

interface Mark {
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
}

/**
 * /tools/pdf-viewer: pdf.js in its own lazy chunk. One page is drawn at a time (and its memory released when
 * you move on), thumbnails draw only while visible, and text for search / extraction is read page by page.
 * Passwords are used locally by pdf.js and go nowhere else.
 */
@Component({
  selector: 'app-pdf-viewer',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolInput,
    ToolSelect,
    ToolToggle,
    ToolButton,
    ToolOutput,
    ToolNote,
    ToolEmpty,
    ToolKeyValue,
    CustomFileInputComponent,
    PdfThumb,
  ],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .pdf-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .pdf-bar > * {
      min-width: 0;
    }
    .pdf-bar__page {
      width: 5.5rem;
    }
    .pdf-bar__zoom {
      width: 9rem;
    }
    .pdf-bar__find {
      flex: 1 1 14rem;
    }
    .pdf-bar__of {
      align-self: center;
      color: var(--text-muted);
      font-size: var(--text-sm);
      white-space: nowrap;
    }
    .pdf-body {
      display: grid;
      gap: 0.75rem;
    }
    .pdf-body--thumbs {
      grid-template-columns: 8.5rem minmax(0, 1fr);
    }
    .pdf-thumbs {
      display: grid;
      align-content: start;
      gap: 0.25rem;
      max-height: min(44rem, 75vh);
      overflow-y: auto;
      padding: 0.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card-bg);
    }
    .pdf-stage {
      min-height: 18rem;
      max-height: min(44rem, 75vh);
      overflow: auto;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-muted);
    }
    .pdf-stage:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
      border-color: var(--primary);
    }
    .pdf-sheet {
      position: relative;
      margin-inline: auto;
      background: var(--paper);
      box-shadow: 0 1px 6px rgb(0 0 0 / 0.25);
    }
    .pdf-sheet canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .pdf-hit {
      position: absolute;
      border-radius: 2px;
      background: color-mix(in srgb, #ffd23f 55%, transparent);
      pointer-events: none;
    }
    .pdf-hit--on {
      background: color-mix(in srgb, var(--primary) 60%, transparent);
      outline: 2px solid var(--primary);
    }
    .pdf-hits {
      display: grid;
      gap: 0.25rem;
      max-height: 12rem;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
      font-size: var(--text-sm);
    }
    .pdf-hits button {
      display: grid;
      grid-template-columns: 3.5rem minmax(0, 1fr);
      gap: 0.5rem;
      width: 100%;
      padding: 0.25rem 0.5rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .pdf-hits button:hover,
    .pdf-hits button[aria-current='true'] {
      background: var(--primary-soft);
    }
    .pdf-hits button:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .pdf-hits span:first-child {
      color: var(--text-muted);
    }
    .pdf-pw {
      display: grid;
      gap: 0.75rem;
    }
    @media (max-width: 40rem) {
      .pdf-body--thumbs {
        grid-template-columns: 1fr;
      }
      .pdf-thumbs {
        grid-auto-flow: column;
        grid-auto-columns: 7rem;
        max-height: none;
        overflow: auto hidden;
      }
    }
  `,
  template: `
    <app-tool-layout slug="pdf-viewer">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="PDF file">
            <app-custom-file-input
              controlName="pdf-file"
              [label$]="fileLabel"
              accept=".pdf,application/pdf"
              placeholder="Choose a PDF or drag it here"
              [multiple]="false"
              [showLabel]="false"
              [maxFileSize]="maxMb"
              [scanFiles]="false"
              [sanitizeNames]="false"
              (file)="onFile($event)"
            />
            <p class="tool-meta">Opened in your browser and never uploaded. Up to {{ maxMb }} MB.</p>
            @if (needsPassword()) {
              <div class="pdf-pw" role="group" aria-label="Password required">
                <app-tool-note kind="warn">
                  @if (passwordWrong()) {
                    That password did not work. Try again.
                  } @else {
                    This PDF is password protected. Enter its password to open it. It is used only inside this page.
                  }
                </app-tool-note>
                <app-tool-input fieldId="pdf-password" label="Password" type="password" [mono]="false" [control]="passwordCtl" />
                <app-tool-button kind="primary" icon="lock" label="Open PDF" [fill]="true" (pressed)="submitPassword()" />
              </div>
            } @else if (busy()) {
              <app-tool-note kind="info">Opening the PDF…</app-tool-note>
            }
            @if (error()) {
              <app-tool-note kind="error">{{ error() }}</app-tool-note>
            }
            @if (rows().length) {
              <app-tool-key-value [rows]="rows()" />
            }
          </app-tool-panel>

          <app-tool-panel title="Text">
            @if (pdfDoc()) {
              <div class="tool-actions">
                <app-tool-button size="small" icon="file-text" label="Extract all text" [loading]="extracting()" (pressed)="extractText()" />
                @if (fullText()) {
                  <app-tool-button size="small" icon="download" label="Download .txt" (pressed)="downloadText()" />
                }
              </div>
              @if (extracting() || (searching() && textProgress() < pageCount())) {
                <app-tool-note kind="info">Reading text: page {{ textProgress() }} of {{ pageCount() }}…</app-tool-note>
              }
              @if (fullText(); as full) {
                @if (full.trim()) {
                  <app-tool-output label="Extracted text" [meta]="full.length.toLocaleString('en-US') + ' characters'" [value]="preview().shown" [copyText]="full" copyLabel="Copy all text" (copied)="trackCopy()" />
                  @if (preview().truncated) {
                    <p class="tool-meta">Showing the first 100,000 characters. Copy and download include all of it.</p>
                  }
                } @else {
                  <app-tool-note kind="warn">No text found. This PDF may be scanned pages (pictures of text); there is no OCR here.</app-tool-note>
                }
              } @else {
                <app-tool-empty icon="file-text">Extract every page's text to copy or download it. Page breaks are blank lines.</app-tool-empty>
              }
            } @else {
              <app-tool-empty icon="file-type">Open a PDF to read, search and copy its text. Scanned pages have no text layer.</app-tool-empty>
            }
          </app-tool-panel>
        </div>

        <app-tool-panel title="Viewer">
          <div class="tool-stack">
            <div class="pdf-bar">
              <app-tool-button size="small" icon="chevron-left" label="Previous" [disabled]="!pdfDoc() || current() <= 1" (pressed)="goTo(current() - 1)" />
              <div class="pdf-bar__page">
                <app-tool-input fieldId="pdf-page" label="Page" type="number" [mono]="false" [control]="pageCtl" [min]="1" [max]="pageCount() || 1" />
              </div>
              <span class="pdf-bar__of">of {{ pageCount() || 0 }}</span>
              <app-tool-button size="small" icon="chevron-right" label="Next" [disabled]="!pdfDoc() || current() >= pageCount()" (pressed)="goTo(current() + 1)" />
              <div class="pdf-bar__zoom">
                <app-tool-select fieldId="pdf-zoom" label="Zoom" [control]="zoomCtl" [options]="zoomOptions" />
              </div>
              <app-tool-button size="small" icon="zoom-out" label="Out" [disabled]="!pdfDoc()" (pressed)="zoomBy(-1)" />
              <app-tool-button size="small" icon="zoom-in" label="In" [disabled]="!pdfDoc()" (pressed)="zoomBy(1)" />
            </div>
            <div class="pdf-bar">
              <div class="pdf-bar__find">
                <app-tool-input fieldId="pdf-search" label="Find in document" placeholder="Search all pages" [mono]="false" [control]="searchCtl" />
              </div>
              <app-tool-button size="small" icon="chevron-left" label="Previous match" [disabled]="hits().length === 0" (pressed)="stepHit(-1)" />
              <app-tool-button size="small" icon="chevron-right" label="Next match" [disabled]="hits().length === 0" (pressed)="stepHit(1)" />
              <span class="pdf-bar__of" aria-live="polite">{{ searchStatus() }}</span>
              <app-tool-toggle fieldId="pdf-thumbs" label="Thumbnails" [control]="thumbsCtl" />
            </div>
            @if (searchHint()) {
              <app-tool-note kind="info">{{ searchHint() }}</app-tool-note>
            }
            @if (hits().length) {
              <ul class="pdf-hits" aria-label="Search results">
                @for (h of shownHits(); track $index) {
                  <li>
                    <button type="button" [attr.aria-current]="hitIndex() === $index" (click)="pickHit($index)">
                      <span>Page {{ h.page }}</span>
                      <span>{{ h.text }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
            <div class="pdf-body" [class.pdf-body--thumbs]="showThumbs() && pdfDoc()">
              @if (showThumbs()) {
                @if (pdfDoc(); as doc) {
                  <div class="pdf-thumbs" role="list" aria-label="Page thumbnails">
                    @for (n of thumbPages(); track n) {
                      <app-pdf-thumb role="listitem" [doc]="doc" [page]="n" [active]="n === current()" (pick)="goTo($event)" />
                    }
                  </div>
                }
              }
              <div #stage class="pdf-stage" role="region" tabindex="0" aria-label="PDF page. Page Up and Page Down change page." (keydown)="onKey($event)">
                <div class="pdf-sheet" [hidden]="!pdfDoc()" [style.width.px]="sheet().w" [style.height.px]="sheet().h">
                  <canvas #canvas role="img" [attr.aria-label]="'Page ' + current() + ' of ' + pageCount()"></canvas>
                  @for (m of marks(); track $index) {
                    <span class="pdf-hit" [class.pdf-hit--on]="m.on" aria-hidden="true" [style.left.px]="m.x" [style.top.px]="m.y" [style.width.px]="m.w" [style.height.px]="m.h"></span>
                  }
                </div>
                @if (!pdfDoc()) {
                  <app-tool-empty icon="file-type">The page appears here. Zoom with the list or the buttons, jump with the page box, and use Page Up / Page Down to turn pages.</app-tool-empty>
                }
              </div>
            </div>
            @if (renderError()) {
              <app-tool-note kind="warn">{{ renderError() }}</app-tool-note>
            }
          </div>
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class PdfViewerTool {
  private readonly markUsed = toolUsage('pdf-viewer');
  protected readonly trackCopy = toolCopied('pdf-viewer');
  private readonly trackDownload = toolCopied('pdf-viewer', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxMb = PDF_MAX_MB;
  protected readonly fileLabel = of('PDF file');
  protected readonly zoomOptions = ZOOM_OPTIONS;

  protected readonly pageCtl = new FormControl('1', { nonNullable: true });
  protected readonly zoomCtl = new FormControl('fit', { nonNullable: true });
  protected readonly searchCtl = new FormControl('', { nonNullable: true });
  protected readonly passwordCtl = new FormControl('', { nonNullable: true });
  protected readonly thumbsCtl = new FormControl(false, { nonNullable: true });
  protected readonly showThumbs = controlSignal(this.thumbsCtl);

  protected readonly pdfDoc = signal<PDFDocumentProxy | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly renderError = signal('');
  protected readonly needsPassword = signal(false);
  protected readonly passwordWrong = signal(false);
  protected readonly rows = signal<ToolRow[]>([]);
  protected readonly pageCount = signal(0);
  protected readonly current = signal(1);
  protected readonly sheet = signal({ w: 0, h: 0 });
  protected readonly marks = signal<Mark[]>([]);

  protected readonly hits = signal<SearchHit[]>([]);
  protected readonly hitIndex = signal(-1);
  protected readonly searching = signal(false);
  protected readonly searchHint = signal('');
  protected readonly textProgress = signal(0);
  protected readonly extracting = signal(false);
  protected readonly fullText = signal('');

  protected readonly preview = computed(() => previewText(this.fullText()));
  protected readonly thumbPages = computed(() => Array.from({ length: Math.min(this.pageCount(), THUMB_LIMIT) }, (_, i) => i + 1));
  protected readonly shownHits = computed(() => this.hits());
  protected readonly searchStatus = computed(() => {
    const n = this.hits().length;
    if (this.searching()) return 'Searching…';
    if (!this.searchCtlValue().trim()) return '';
    if (!n) return 'No matches';
    const shown = this.hitIndex() + 1;
    return `${shown} of ${n.toLocaleString('en-US')}${n >= MAX_HITS ? '+' : ''}`;
  });
  private readonly searchCtlValue = controlSignal(this.searchCtl);

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private task: PDFDocumentLoadingTask | null = null;
  private passwordRequest: PasswordRequest | null = null;
  private job = 0;
  private renderSeq = 0;
  private renderTask: RenderTask | null = null;
  private pageCtx: PageContext | null = null;
  private zoomMode: 'fit' | number = 'fit';
  private scalePct = 100;
  private fileName = 'document.pdf';
  private texts: string[] = [];
  private textsJob: Promise<void> | null = null;
  private lastStageWidth = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.pageCtl.valueChanges.pipe(debounceTime(450), takeUntilDestroyed()).subscribe((v) => {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n !== this.current() && this.pdfDoc()) this.goTo(n);
    });
    this.zoomCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      this.zoomMode = v === 'fit' ? 'fit' : Number(v) || 100;
      void this.renderPage();
    });
    this.searchCtl.valueChanges.pipe(debounceTime(350), takeUntilDestroyed()).subscribe((v) => void this.runSearch(v));

    afterNextRender(() => {
      const el = this.stage().nativeElement;
      this.lastStageWidth = el.clientWidth;
      const observer = new ResizeObserver(() => {
        const width = el.clientWidth;
        if (Math.abs(width - this.lastStageWidth) < 3) return;
        this.lastStageWidth = width;
        if (this.zoomMode !== 'fit' || !this.pdfDoc()) return;
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => void this.renderPage(), 150);
      });
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.resizeTimer);
      this.job++;
      this.renderTask?.cancel();
      void this.task?.destroy();
    });
  }

  // ── opening ───────────────────────────────────────────────────────────────

  protected async onFile(picked: File | null): Promise<void> {
    const job = ++this.job;
    await this.closeDocument();
    if (!picked) return;
    if (picked.size > PDF_MAX_MB * MB) {
      this.error.set(`That PDF is larger than ${PDF_MAX_MB} MB. Split it or compress it first: the whole file is held in memory.`);
      return;
    }
    this.busy.set(true);
    try {
      const bytes = new Uint8Array(await picked.arrayBuffer());
      checkPdfBytes(bytes);
      const opened = await openPdf(
        bytes,
        (request) => {
          if (job !== this.job) return;
          this.passwordRequest = request;
          this.passwordWrong.set(request.wrong);
          this.needsPassword.set(true);
        },
        (task) => {
          if (job === this.job) this.task = task;
        },
      );
      if (job !== this.job) {
        void opened.task.destroy();
        return;
      }
      this.needsPassword.set(false);
      this.fileName = picked.name;
      this.pdfDoc.set(opened.doc);
      this.pageCount.set(opened.doc.numPages);
      this.current.set(1);
      this.pageCtl.setValue('1', { emitEvent: false });
      this.thumbsCtl.setValue(typeof window !== 'undefined' && window.innerWidth >= 900);
      this.markUsed();
      void this.readInfo(opened.doc, picked, job);
      await this.renderPage();
      const query = this.searchCtl.value;
      if (query.trim()) void this.runSearch(query);
    } catch (error) {
      if (job !== this.job) return;
      this.needsPassword.set(false);
      this.error.set(error instanceof PdfError ? error.message : pdfOpenMessage(error));
    } finally {
      if (job === this.job) this.busy.set(false);
    }
  }

  protected submitPassword(): void {
    const password = this.passwordCtl.value;
    if (!password || !this.passwordRequest) return;
    const request = this.passwordRequest;
    this.passwordRequest = null;
    this.needsPassword.set(false);
    this.passwordCtl.setValue('');
    request.submit(password);
  }

  private async closeDocument(): Promise<void> {
    this.renderSeq++;
    this.renderTask?.cancel();
    this.renderTask = null;
    const task = this.task;
    this.task = null;
    this.passwordRequest = null;
    this.pdfDoc.set(null);
    this.pageCount.set(0);
    this.rows.set([]);
    this.error.set('');
    this.renderError.set('');
    this.needsPassword.set(false);
    this.busy.set(false);
    this.hits.set([]);
    this.hitIndex.set(-1);
    this.marks.set([]);
    this.searchHint.set('');
    this.fullText.set('');
    this.texts = [];
    this.textsJob = null;
    this.pageCtx = null;
    this.sheet.set({ w: 0, h: 0 });
    this.passwordCtl.setValue('');
    if (task) await task.destroy().catch(() => undefined);
  }

  private async readInfo(doc: PDFDocumentProxy, file: File, job: number): Promise<void> {
    const rows: ToolRow[] = [
      { label: 'File', value: file.name },
      { label: 'Size', value: formatBytes(file.size) },
      { label: 'Pages', value: String(doc.numPages) },
    ];
    try {
      const meta = await doc.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;
      const add = (label: string, value: unknown) => {
        const text = typeof value === 'string' ? value.trim() : '';
        if (text) rows.push({ label, value: text });
      };
      add('Title', info['Title']);
      add('Author', info['Author']);
      add('Subject', info['Subject']);
      add('Creator', info['Creator']);
      add('Producer', info['Producer']);
      add('Created', formatPdfDate(info['CreationDate']));
      add('Modified', formatPdfDate(info['ModDate']));
      add('PDF version', info['PDFFormatVersion']);
    } catch {
      // Metadata is optional: the viewer works without it.
    }
    if (job === this.job) this.rows.set(rows);
  }

  // ── page display ──────────────────────────────────────────────────────────

  protected goTo(page: number): void {
    const doc = this.pdfDoc();
    if (!doc) return;
    const n = Math.min(doc.numPages, Math.max(1, Math.round(page)));
    this.pageCtl.setValue(String(n), { emitEvent: false });
    this.stage().nativeElement.scrollTo?.({ top: 0 });
    if (n === this.current() && this.pageCtx?.page === n) return;
    this.current.set(n);
    void this.renderPage();
  }

  protected zoomBy(direction: 1 | -1): void {
    const next = stepZoom(this.scalePct, direction);
    this.zoomCtl.setValue(String(next));
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.pdfDoc() || event.ctrlKey || event.metaKey || event.altKey) return;
    const el = this.stage().nativeElement;
    const fits = el.scrollWidth <= el.clientWidth;
    if (event.key === 'PageDown' || (event.key === 'ArrowRight' && fits)) {
      event.preventDefault();
      this.goTo(this.current() + 1);
    } else if (event.key === 'PageUp' || (event.key === 'ArrowLeft' && fits)) {
      event.preventDefault();
      this.goTo(this.current() - 1);
    } else if (event.key === 'Home' && event.shiftKey) {
      event.preventDefault();
      this.goTo(1);
    } else if (event.key === 'End' && event.shiftKey) {
      event.preventDefault();
      this.goTo(this.pageCount());
    }
  }

  private async renderPage(): Promise<void> {
    const doc = this.pdfDoc();
    if (!doc) return;
    const seq = ++this.renderSeq;
    this.renderTask?.cancel();
    this.renderTask = null;
    this.renderError.set('');
    const pageNumber = this.current();
    try {
      const page = await doc.getPage(pageNumber);
      if (seq !== this.renderSeq) return;
      const base = page.getViewport({ scale: 1 });
      const available = Math.max(120, this.stage().nativeElement.clientWidth - 34);
      const scale = this.zoomMode === 'fit' ? fitWidthScale(base.width, available) : this.zoomMode / 100;
      this.scalePct = Math.round(scale * 100);
      const viewport = page.getViewport({ scale });
      const ratio = renderRatio(viewport.width, viewport.height, window.devicePixelRatio);
      const canvas = this.canvas().nativeElement;
      canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
      canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
      this.sheet.set({ w: viewport.width, h: viewport.height });
      this.marks.set([]);
      this.pageCtx = null;

      const task = page.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      this.renderTask = task;
      await task.promise;
      if (seq !== this.renderSeq) return;

      const content = await page.getTextContent();
      if (seq !== this.renderSeq) return;
      const runs = toRuns(content.items);
      this.pageCtx = {
        page: pageNumber,
        runs,
        text: buildPageText(runs),
        matrix: viewport.transform as unknown as Matrix,
        scale: viewport.scale,
      };
      this.drawMarks();
      page.cleanup();
    } catch (error) {
      if (seq !== this.renderSeq || (error as { name?: string })?.name === 'RenderingCancelledException') return;
      this.renderError.set('This page could not be drawn. Other pages may still work.');
    }
  }

  private drawMarks(): void {
    const ctx = this.pageCtx;
    if (!ctx) {
      this.marks.set([]);
      return;
    }
    const out: Mark[] = [];
    const current = this.hitIndex();
    this.hits().forEach((hit, index) => {
      if (hit.page !== ctx.page) return;
      for (const span of ctx.text.spans) {
        const rect = hitRect(ctx.runs[span.run], span, hit, ctx.matrix, ctx.scale);
        if (rect) out.push({ ...rect, on: index === current });
      }
    });
    this.marks.set(out);
  }

  // ── text: search and extraction ───────────────────────────────────────────

  private ensureTexts(): Promise<void> {
    const doc = this.pdfDoc();
    if (!doc) return Promise.resolve();
    if (this.textsJob) return this.textsJob;
    const job = this.job;
    this.textsJob = (async () => {
      for (let i = this.texts.length; i < doc.numPages; i++) {
        if (job !== this.job) return;
        try {
          const page = await doc.getPage(i + 1);
          const content = await page.getTextContent();
          this.texts[i] = buildPageText(toRuns(content.items)).text;
          page.cleanup();
        } catch {
          this.texts[i] = '';
        }
        if (i % 4 === 0 || i === doc.numPages - 1) this.textProgress.set(i + 1);
      }
    })();
    return this.textsJob;
  }

  protected async extractText(): Promise<void> {
    if (!this.pdfDoc()) return;
    const job = this.job;
    this.extracting.set(true);
    await this.ensureTexts();
    if (job !== this.job) return;
    this.fullText.set(this.texts.join('\n\n'));
    this.extracting.set(false);
  }

  protected downloadText(): void {
    downloadFile(`${baseName(this.fileName)}.txt`, this.fullText(), 'text/plain;charset=utf-8');
    this.trackDownload();
  }

  private async runSearch(query: string): Promise<void> {
    const doc = this.pdfDoc();
    const job = this.job;
    this.searchHint.set('');
    if (!doc || !query.trim()) {
      this.hits.set([]);
      this.hitIndex.set(-1);
      this.drawMarks();
      return;
    }
    this.searching.set(true);
    await this.ensureTexts();
    if (job !== this.job) return;
    const found: SearchHit[] = [];
    for (let p = 0; p < this.texts.length && found.length < MAX_HITS; p++) {
      const text = this.texts[p] ?? '';
      for (const hit of findHits(text, query, MAX_HITS - found.length)) {
        found.push({ page: p + 1, start: hit.start, end: hit.end, text: snippet(text, hit) });
      }
    }
    this.searching.set(false);
    if (!found.length) {
      this.hitIndex.set(-1);
      this.hits.set([]);
      if (this.texts.every((t) => !t.trim())) this.searchHint.set('This PDF has no text layer (scanned pages?), so there is nothing to search.');
      this.drawMarks();
      return;
    }
    this.hits.set(found);
    if (found.length >= MAX_HITS) this.searchHint.set(`Showing the first ${MAX_HITS.toLocaleString('en-US')} matches. Narrow the search to see others.`);
    this.pickHit(Math.max(0, found.findIndex((h) => h.page >= this.current())));
  }

  protected stepHit(direction: 1 | -1): void {
    const n = this.hits().length;
    if (!n) return;
    this.pickHit((this.hitIndex() + direction + n) % n);
  }

  protected pickHit(index: number): void {
    const hit = this.hits()[index];
    if (!hit) return;
    this.hitIndex.set(index);
    if (hit.page === this.current() && this.pageCtx?.page === hit.page) this.drawMarks();
    else this.goTo(hit.page);
  }
}
