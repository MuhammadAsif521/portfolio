import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, of } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { formatBytes } from '../../../tool-logic-2';
import { DocGrid } from '../shared/doc-grid';
import { MB, baseName, downloadFile } from '../shared/doc-utils';
import {
  SORT_LIMIT,
  buildView,
  columnLabel,
  columnWidths,
  formatCell,
  headerNames,
  viewToCsv,
  viewToJson,
  type SortDir,
  type WidthMode,
} from '../shared/grid-data';
import { XLSX_MAX_MB, XlsxError, readWorkbook, type SheetModel } from './xlsx-read';

const WIDTH_OPTIONS = [
  { id: 'narrow', name: 'Narrow' },
  { id: 'auto', name: 'Auto-fit' },
  { id: 'wide', name: 'Wide' },
];

/**
 * /tools/xlsx-viewer: read-excel-file (lazy chunk, parses in a worker) gives the saved values of every sheet;
 * DocGrid draws only what is on screen, so large sheets scroll smoothly. Filter, sort and export act on the
 * rows currently shown.
 */
@Component({
  selector: 'app-xlsx-viewer',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolInput,
    ToolSelect,
    ToolToggle,
    ToolButton,
    ToolNote,
    ToolEmpty,
    ToolKeyValue,
    TabsComponent,
    CustomFileInputComponent,
    DocGrid,
  ],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .xl-controls {
      display: grid;
      gap: 0.75rem 1rem;
      align-items: end;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    }
    .xl-status {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
  `,
  template: `
    <app-tool-layout slug="xlsx-viewer">
      <div class="tool-stack">
        <app-tool-panel title="Excel workbook">
          <app-custom-file-input
            controlName="xlsx-file"
            [label$]="fileLabel"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            placeholder="Choose an .xlsx file or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Read in your browser and never uploaded. Up to {{ maxMb }} MB; .xlsx only (not .xls).</p>
          @if (busy()) {
            <app-tool-note kind="info">Reading the workbook…</app-tool-note>
          }
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          @if (rows().length) {
            <app-tool-key-value [rows]="rows()" />
          }
        </app-tool-panel>

        <app-tool-panel title="Sheet">
          @if (sheets().length) {
            <div class="tool-stack">
              <div role="group" aria-label="Sheets">
                <app-custom-tabs [tabs]="tabs()" [activeTab]="activeTab()" (activeTabChange)="selectSheet($event)" />
              </div>
              <div class="xl-controls">
                <app-tool-input fieldId="xlsx-filter" label="Filter rows" placeholder="Type to keep matching rows" [mono]="false" [control]="queryCtl" />
                <app-tool-select fieldId="xlsx-width" label="Column width" [control]="widthCtl" [options]="widthOptions" />
                <app-tool-toggle fieldId="xlsx-header" label="First row is a header" hint="Names the columns and is used as keys in JSON" [control]="headerCtl" />
              </div>
              <div class="tool-actions">
                <app-tool-button size="small" icon="download" label="Download CSV" [disabled]="!view().length" (pressed)="exportCsv()" />
                <app-tool-button size="small" icon="download" label="Download JSON" [disabled]="!view().length" (pressed)="exportJson()" />
              </div>
              <p class="xl-status" aria-live="polite">{{ status() }}</p>
              @if (sortNote()) {
                <app-tool-note kind="info">{{ sortNote() }}</app-tool-note>
              }
              @if (columnCount()) {
                <app-doc-grid
                  [columns]="labels()"
                  [widths]="widths()"
                  [rowCount]="view().length"
                  [cellAt]="cellAt()"
                  [rowLabel]="rowLabel()"
                  [sortCol]="sortCol()"
                  [sortDir]="sortDir()"
                  [resetKey]="view()"
                  [label]="'Sheet ' + (current()?.name ?? '')"
                  (sortToggle)="toggleSort($event)"
                />
              } @else {
                <app-tool-empty icon="file-spreadsheet">This sheet has no cells with values.</app-tool-empty>
              }
              <app-tool-note kind="info">
                Shows the values Excel saved: formulas are not recalculated, and charts, pictures, colours, merged cells and conditional formatting are not shown. Dates appear as ISO dates.
              </app-tool-note>
            </div>
          } @else {
            <app-tool-empty icon="file-spreadsheet">Choose an .xlsx file. Every sheet becomes a tab you can scroll, filter, sort and export.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class XlsxViewerTool {
  private readonly markUsed = toolUsage('xlsx-viewer');
  protected readonly trackDownload = toolCopied('xlsx-viewer', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxMb = XLSX_MAX_MB;
  protected readonly fileLabel = of('Excel workbook');
  protected readonly widthOptions = WIDTH_OPTIONS;
  protected readonly queryCtl = new FormControl('', { nonNullable: true });
  protected readonly widthCtl = new FormControl('auto', { nonNullable: true });
  protected readonly headerCtl = new FormControl(true, { nonNullable: true });

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sheets = signal<SheetModel[]>([]);
  protected readonly activeIndex = signal(0);
  protected readonly sortCol = signal(-1);
  protected readonly sortDir = signal<SortDir>('asc');
  protected readonly view = signal<Uint32Array>(new Uint32Array(0));
  private readonly query = signal('');
  private readonly header = controlSignal(this.headerCtl);
  private readonly widthMode = controlSignal(this.widthCtl);
  private file: { name: string; size: number } | null = null;
  private fileJob = 0;
  private viewJob = 0;
  private abort: { aborted: boolean } | null = null;

  protected readonly tabs = computed<NavTab[]>(() => this.sheets().map((s, i) => ({ label: s.name, value: String(i) })));
  protected readonly activeTab = computed(() => String(this.activeIndex()));
  protected readonly current = computed(() => this.sheets()[this.activeIndex()] ?? null);
  protected readonly columnCount = computed(() => this.current()?.columns ?? 0);
  private readonly dataRows = computed(() => Math.max(0, (this.current()?.rows.length ?? 0) - (this.header() ? 1 : 0)));

  protected readonly labels = computed(() => {
    const sheet = this.current();
    if (!sheet) return [];
    return this.header() ? headerNames(sheet.rows[0], sheet.columns) : Array.from({ length: sheet.columns }, (_, i) => columnLabel(i));
  });
  protected readonly widths = computed(() => {
    const sheet = this.current();
    return sheet ? columnWidths(sheet.rows, this.labels(), this.widthMode() as WidthMode) : [];
  });
  protected readonly cellAt = computed(() => {
    const rows = this.current()?.rows ?? [];
    const view = this.view();
    return (row: number, col: number): string => formatCell(rows[view[row]]?.[col]);
  });
  protected readonly rowLabel = computed(() => {
    const view = this.view();
    return (row: number): number => view[row] + 1;
  });
  protected readonly status = computed(() => {
    const shown = this.view().length;
    const total = this.dataRows();
    const rows = shown === total ? `${total.toLocaleString('en-US')} rows` : `${shown.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} rows`;
    return `${rows} · ${this.columnCount().toLocaleString('en-US')} columns`;
  });
  protected readonly sortNote = computed(() =>
    this.dataRows() > SORT_LIMIT ? `Sorting is available for up to ${SORT_LIMIT.toLocaleString('en-US')} rows; this sheet has more.` : '',
  );
  protected readonly rows = computed<ToolRow[]>(() => {
    const names = this.sheets();
    if (!names.length || !this.file) return [];
    return [
      { label: 'File', value: this.file.name },
      { label: 'Size', value: formatBytes(this.file.size) },
      { label: 'Sheets', value: names.map((s) => s.name).join(', ') },
    ];
  });

  constructor() {
    this.queryCtl.valueChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((v) => this.query.set(v));
    effect(() => {
      const sheet = this.current();
      const startRow = this.header() ? 1 : 0;
      const query = this.query();
      const sortCol = this.sortCol();
      const sortDir = this.sortDir();
      untracked(() => void this.rebuild(sheet, startRow, query, sortCol, sortDir));
    });
    this.destroyRef.onDestroy(() => {
      this.fileJob++;
      this.viewJob++;
      if (this.abort) this.abort.aborted = true;
    });
  }

  private async rebuild(sheet: SheetModel | null, startRow: number, query: string, sortCol: number, sortDir: SortDir): Promise<void> {
    const job = ++this.viewJob;
    if (this.abort) this.abort.aborted = true;
    const abort = (this.abort = { aborted: false });
    if (!sheet) {
      this.view.set(new Uint32Array(0));
      return;
    }
    const result = await buildView(sheet.rows, { startRow, query, sortCol, sortDir, signal: abort });
    if (result && job === this.viewJob) this.view.set(result);
  }

  protected async onFile(picked: File | null): Promise<void> {
    const job = ++this.fileJob;
    this.busy.set(false);
    this.error.set('');
    this.sheets.set([]);
    this.file = null;
    this.sortCol.set(-1);
    this.activeIndex.set(0);
    if (!picked) return;
    if (picked.size > XLSX_MAX_MB * MB) {
      this.error.set(`That workbook is larger than ${XLSX_MAX_MB} MB. Save only the sheets you need as a smaller .xlsx and try again.`);
      return;
    }
    this.busy.set(true);
    try {
      const sheets = await readWorkbook(picked);
      if (job !== this.fileJob) return; // a newer file was chosen while this one was being read
      this.file = { name: picked.name, size: picked.size };
      this.queryCtl.setValue('');
      this.query.set('');
      this.sheets.set(sheets);
      this.markUsed();
    } catch (error) {
      if (job !== this.fileJob) return;
      this.error.set(error instanceof XlsxError ? error.message : 'Something went wrong while reading this file. Try again, or choose a different file.');
    } finally {
      if (job === this.fileJob) this.busy.set(false);
    }
  }

  protected selectSheet(value: string): void {
    const index = Number(value);
    if (!Number.isInteger(index) || index === this.activeIndex()) return;
    this.sortCol.set(-1);
    this.activeIndex.set(index);
  }

  protected toggleSort(col: number): void {
    if (this.sortCol() !== col) {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    } else if (this.sortDir() === 'asc') {
      this.sortDir.set('desc');
    } else {
      this.sortCol.set(-1);
      this.sortDir.set('asc');
    }
  }

  private fileBase(): string {
    return `${baseName(this.file?.name ?? 'workbook')}-${baseName(this.current()?.name ?? 'sheet', 'sheet')}`;
  }

  protected exportCsv(): void {
    const sheet = this.current();
    if (!sheet) return;
    const header = this.header() ? this.labels() : null;
    downloadFile(`${this.fileBase()}.csv`, viewToCsv(sheet.rows, this.view(), sheet.columns, header), 'text/csv;charset=utf-8');
    this.trackDownload();
  }

  protected exportJson(): void {
    const sheet = this.current();
    if (!sheet) return;
    const header = this.header() ? this.labels() : null;
    downloadFile(`${this.fileBase()}.json`, viewToJson(sheet.rows, this.view(), sheet.columns, header), 'application/json;charset=utf-8');
    this.trackDownload();
  }
}
