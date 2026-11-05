import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, merge, of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
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
  headerNames,
  viewToCsv,
  viewToJson,
  type SortDir,
  type WidthMode,
} from '../shared/grid-data';
import {
  CSV_MAX_MB,
  CSV_WARN_MB,
  DELIMITER_NAMES,
  MAX_ROWS,
  detectDelimiter,
  detectEncoding,
  parseCsv,
  type Encoding,
  type ParsedCsv,
} from './csv-parse';

const DELIMITER_OPTIONS = [
  { id: 'auto', name: 'Auto-detect' },
  { id: ',', name: 'Comma  ,' },
  { id: ';', name: 'Semicolon  ;' },
  { id: '\t', name: 'Tab' },
  { id: '|', name: 'Pipe  |' },
];
const ENCODING_OPTIONS = [
  { id: 'auto', name: 'Auto-detect' },
  { id: 'utf-8', name: 'UTF-8' },
  { id: 'windows-1252', name: 'Windows-1252 (Western Europe)' },
  { id: 'iso-8859-1', name: 'ISO-8859-1' },
  { id: 'utf-16le', name: 'UTF-16 LE' },
  { id: 'utf-16be', name: 'UTF-16 BE' },
];
const WIDTH_OPTIONS = [
  { id: 'narrow', name: 'Narrow' },
  { id: 'auto', name: 'Auto-fit' },
  { id: 'wide', name: 'Wide' },
];

export const CSV_SAMPLE = [
  'id,name,city,amount,note',
  '1,"Khan, Asif",Lahore,1250.50,"Said ""hello"""',
  '2,Maria Lopez,Madrid,980,',
  '3,Chen Wei,Shanghai,15400.25,"Two lines',
  'in one cell"',
  '4,Sara Ahmed,Karachi,310,ok',
  '5,Jonas Berg,Oslo,77.9,',
].join('\n');

/**
 * /tools/csv-viewer: Papa Parse (lazy chunk) streams the file in 1 MB chunks, so the page keeps responding
 * while it loads; DocGrid draws only the visible cells. Delimiter and encoding are detected and can be
 * overridden; filter, sort and export act on the rows shown.
 */
@Component({
  selector: 'app-csv-viewer',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolSelect, ToolToggle, ToolButton, ToolNote, ToolEmpty, ToolKeyValue, CustomFileInputComponent, DocGrid],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .csv-controls {
      display: grid;
      gap: 0.75rem 1rem;
      align-items: end;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    }
    .csv-status {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
  `,
  template: `
    <app-tool-layout slug="csv-viewer">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Delimited file">
            <app-custom-file-input
              controlName="csv-file"
              [label$]="fileLabel"
              accept=".csv,.tsv,.txt,.tab,text/csv,text/tab-separated-values,text/plain"
              placeholder="Choose a CSV, TSV or TXT file, or drag it here"
              [multiple]="false"
              [showLabel]="false"
              [maxFileSize]="maxMb"
              [scanFiles]="false"
              [sanitizeNames]="false"
              (file)="onFile($event)"
            />
            <p class="tool-meta">Read in your browser and never uploaded. Up to {{ maxMb }} MB.</p>
            <div class="tool-actions">
              <app-tool-button size="small" icon="table" label="Try a sample" (pressed)="loadSample()" />
            </div>
            <div class="csv-controls">
              <app-tool-select fieldId="csv-delimiter" label="Delimiter" [control]="delimiterCtl" [options]="delimiterOptions" />
              <app-tool-select fieldId="csv-encoding" label="Encoding" [control]="encodingCtl" [options]="encodingOptions" />
            </div>
            <app-tool-toggle fieldId="csv-header" label="First row is a header" hint="Names the columns and is used as keys in JSON" [control]="headerCtl" />
            @if (largeWarning()) {
              <app-tool-note kind="warn">{{ largeWarning() }}</app-tool-note>
            }
            @if (busy()) {
              <app-tool-note kind="info">Reading the file… {{ progress() }}%</app-tool-note>
            }
            @if (error()) {
              <app-tool-note kind="error">{{ error() }}</app-tool-note>
            }
          </app-tool-panel>

          <app-tool-panel title="File details">
            @if (details().length) {
              <app-tool-key-value [rows]="details()" />
              @for (n of notes(); track n.text) {
                <app-tool-note [kind]="n.kind">{{ n.text }}</app-tool-note>
              }
            } @else {
              <app-tool-empty icon="table">Delimiter, encoding, rows and columns show here once a file is open. Auto-detect handles most files; override it if the columns look wrong.</app-tool-empty>
            }
          </app-tool-panel>
        </div>

        <app-tool-panel title="Table">
          @if (parsed(); as p) {
            <div class="tool-stack">
              <div class="csv-controls">
                <app-tool-input fieldId="csv-filter" label="Filter rows" placeholder="Type to keep matching rows" [mono]="false" [control]="queryCtl" />
                <app-tool-select fieldId="csv-filter-col" label="Search in" [control]="columnCtl" [options]="columnOptions()" />
                <app-tool-select fieldId="csv-width" label="Column width" [control]="widthCtl" [options]="widthOptions" />
              </div>
              <div class="tool-actions">
                <app-tool-button size="small" icon="download" label="Download CSV" [disabled]="!view().length" (pressed)="exportCsv()" />
                <app-tool-button size="small" icon="download" label="Download JSON" [disabled]="!view().length" (pressed)="exportJson()" />
              </div>
              <p class="csv-status" aria-live="polite">{{ status() }}</p>
              @if (sortNote()) {
                <app-tool-note kind="info">{{ sortNote() }}</app-tool-note>
              }
              @if (p.columns) {
                <app-doc-grid
                  [columns]="labels()"
                  [widths]="widths()"
                  [rowCount]="view().length"
                  [cellAt]="cellAt()"
                  [rowLabel]="rowLabel()"
                  [sortCol]="sortCol()"
                  [sortDir]="sortDir()"
                  [resetKey]="view()"
                  label="Delimited data"
                  (sortToggle)="toggleSort($event)"
                />
              } @else {
                <app-tool-empty icon="table">This file has no rows.</app-tool-empty>
              }
            </div>
          } @else {
            <app-tool-empty icon="table">Open a file to browse it as a table: sort by clicking a header, filter with the box, then export what you see.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class CsvViewerTool {
  private readonly markUsed = toolUsage('csv-viewer');
  protected readonly trackDownload = toolCopied('csv-viewer', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxMb = CSV_MAX_MB;
  protected readonly fileLabel = of('Delimited file');
  protected readonly delimiterOptions = DELIMITER_OPTIONS;
  protected readonly encodingOptions = ENCODING_OPTIONS;
  protected readonly widthOptions = WIDTH_OPTIONS;

  protected readonly delimiterCtl = new FormControl('auto', { nonNullable: true });
  protected readonly encodingCtl = new FormControl('auto', { nonNullable: true });
  protected readonly headerCtl = new FormControl(true, { nonNullable: true });
  protected readonly queryCtl = new FormControl('', { nonNullable: true });
  protected readonly columnCtl = new FormControl('-1', { nonNullable: true });
  protected readonly widthCtl = new FormControl('auto', { nonNullable: true });

  protected readonly busy = signal(false);
  protected readonly progress = signal(0);
  protected readonly error = signal('');
  protected readonly parsed = signal<ParsedCsv | null>(null);
  protected readonly used = signal<{ delimiter: string; encoding: Encoding; delimiterAuto: boolean; encodingAuto: boolean } | null>(null);
  protected readonly sortCol = signal(-1);
  protected readonly sortDir = signal<SortDir>('asc');
  protected readonly view = signal<Uint32Array>(new Uint32Array(0));
  private readonly query = signal('');
  private readonly header = controlSignal(this.headerCtl);
  private readonly widthMode = controlSignal(this.widthCtl);
  private readonly column = controlSignal(this.columnCtl);
  private file: File | null = null;
  private fileJob = 0;
  private viewJob = 0;
  private parseAbort: { aborted: boolean } | null = null;
  private viewAbort: { aborted: boolean } | null = null;

  protected readonly largeWarning = signal('');
  protected readonly dataRows = computed(() => Math.max(0, (this.parsed()?.rows.length ?? 0) - (this.header() ? 1 : 0)));
  protected readonly labels = computed(() => {
    const p = this.parsed();
    if (!p) return [];
    return this.header() ? headerNames(p.rows[0], p.columns) : Array.from({ length: p.columns }, (_, i) => columnLabel(i));
  });
  protected readonly columnOptions = computed(() => [
    { id: '-1', name: 'All columns' },
    ...this.labels().slice(0, 500).map((name, i) => ({ id: String(i), name })),
  ]);
  protected readonly widths = computed(() => {
    const p = this.parsed();
    return p ? columnWidths(p.rows, this.labels(), this.widthMode() as WidthMode) : [];
  });
  protected readonly cellAt = computed(() => {
    const rows = this.parsed()?.rows ?? [];
    const view = this.view();
    return (row: number, col: number): string => rows[view[row]]?.[col] ?? '';
  });
  protected readonly rowLabel = computed(() => {
    const view = this.view();
    return (row: number): number => view[row] + 1;
  });
  protected readonly status = computed(() => {
    const shown = this.view().length;
    const total = this.dataRows();
    const rows = shown === total ? `${total.toLocaleString('en-US')} rows` : `${shown.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} rows`;
    return `${rows} · ${(this.parsed()?.columns ?? 0).toLocaleString('en-US')} columns`;
  });
  protected readonly sortNote = computed(() =>
    this.dataRows() > SORT_LIMIT ? `Sorting is available for up to ${SORT_LIMIT.toLocaleString('en-US')} rows; this file has more.` : '',
  );

  protected readonly details = computed<ToolRow[]>(() => {
    const p = this.parsed();
    const u = this.used();
    if (!p || !u || !this.file) return [];
    return [
      { label: 'File', value: this.file.name },
      { label: 'Size', value: formatBytes(this.file.size) },
      { label: 'Delimiter', value: `${DELIMITER_NAMES[u.delimiter] ?? u.delimiter}${u.delimiterAuto ? ' (auto-detected)' : ''}` },
      { label: 'Encoding', value: `${ENCODING_OPTIONS.find((o) => o.id === u.encoding)?.name ?? u.encoding}${u.encodingAuto ? ' (auto-detected)' : ''}` },
      { label: 'Rows', value: `${p.rows.length.toLocaleString('en-US')}${this.header() ? ' including the header' : ''}` },
      { label: 'Columns', value: p.columns.toLocaleString('en-US') },
    ];
  });
  protected readonly notes = computed(() => {
    const p = this.parsed();
    if (!p) return [];
    const out: { kind: 'warn' | 'info'; text: string }[] = [];
    if (p.replacementChars) {
      out.push({ kind: 'warn', text: 'Some characters could not be decoded. The file is probably not in this encoding: try Windows-1252 or UTF-16.' });
    }
    if (p.irregularRows) {
      out.push({
        kind: 'info',
        text: `${p.irregularRows.toLocaleString('en-US')} rows have a different number of fields than the first row. Short rows are padded with empty cells. If that looks wrong, try another delimiter.`,
      });
    }
    if (p.quoteIssues) {
      out.push({ kind: 'warn', text: 'A quoted value is not closed properly in this file, so some rows may be merged or split unexpectedly.' });
    }
    if (p.truncated) {
      out.push({ kind: 'warn', text: `This file has more than ${MAX_ROWS.toLocaleString('en-US')} rows. Only the first ${MAX_ROWS.toLocaleString('en-US')} are loaded.` });
    }
    return out;
  });

  constructor() {
    this.queryCtl.valueChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((v) => this.query.set(v));
    merge(this.delimiterCtl.valueChanges, this.encodingCtl.valueChanges)
      .pipe(debounceTime(50), takeUntilDestroyed())
      .subscribe(() => {
        if (this.file) void this.load(this.file);
      });
    effect(() => {
      const p = this.parsed();
      const startRow = this.header() ? 1 : 0;
      const query = this.query();
      const column = Number(this.column());
      const sortCol = this.sortCol();
      const sortDir = this.sortDir();
      untracked(() => void this.rebuild(p, startRow, query, column, sortCol, sortDir));
    });
    this.destroyRef.onDestroy(() => {
      this.fileJob++;
      this.viewJob++;
      if (this.parseAbort) this.parseAbort.aborted = true;
      if (this.viewAbort) this.viewAbort.aborted = true;
    });
  }

  private async rebuild(p: ParsedCsv | null, startRow: number, query: string, column: number, sortCol: number, sortDir: SortDir): Promise<void> {
    const job = ++this.viewJob;
    if (this.viewAbort) this.viewAbort.aborted = true;
    const abort = (this.viewAbort = { aborted: false });
    if (!p) {
      this.view.set(new Uint32Array(0));
      return;
    }
    const result = await buildView(p.rows, { startRow, query, column: column < p.columns ? column : -1, sortCol, sortDir, signal: abort });
    if (result && job === this.viewJob) this.view.set(result);
  }

  protected onFile(picked: File | null): void {
    this.file = picked;
    this.queryCtl.setValue('');
    this.query.set('');
    this.columnCtl.setValue('-1');
    this.sortCol.set(-1);
    if (!picked) {
      this.fileJob++;
      if (this.parseAbort) this.parseAbort.aborted = true;
      this.parsed.set(null);
      this.used.set(null);
      this.error.set('');
      this.busy.set(false);
      this.largeWarning.set('');
      return;
    }
    void this.load(picked);
  }

  protected loadSample(): void {
    const sample = new File([CSV_SAMPLE], 'sample.csv', { type: 'text/csv' });
    this.onFile(sample);
  }

  private async load(file: File): Promise<void> {
    const job = ++this.fileJob;
    if (this.parseAbort) this.parseAbort.aborted = true;
    const abort = (this.parseAbort = { aborted: false });
    this.error.set('');
    this.largeWarning.set('');
    if (file.size > CSV_MAX_MB * MB) {
      this.parsed.set(null);
      this.error.set(`That file is larger than ${CSV_MAX_MB} MB. Split it first (for example by rows) and open the pieces.`);
      return;
    }
    if (file.size > CSV_WARN_MB * MB) {
      this.largeWarning.set('This is a large file. It is read in pieces, but it will take a while and use a lot of memory, especially on a phone.');
    }
    this.busy.set(true);
    this.progress.set(0);
    try {
      const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
      const encodingChoice = this.encodingCtl.value;
      const encoding = (encodingChoice === 'auto' ? detectEncoding(head, file.size > head.length) : encodingChoice) as Encoding;
      if (!encoding.startsWith('utf-16') && head.subarray(0, 4096).includes(0)) {
        throw new Error('binary');
      }
      const sample = new TextDecoder(encoding).decode(head, { stream: true });
      const delimiterChoice = this.delimiterCtl.value;
      const delimiter = delimiterChoice === 'auto' ? detectDelimiter(sample) : delimiterChoice;
      const result = await parseCsv(file, {
        delimiter,
        encoding,
        signal: abort,
        onProgress: (fraction) => {
          if (job === this.fileJob) this.progress.set(Math.round(fraction * 100));
        },
      });
      if (job !== this.fileJob || abort.aborted) return;
      this.used.set({ delimiter, encoding, delimiterAuto: delimiterChoice === 'auto', encodingAuto: encodingChoice === 'auto' });
      this.sortCol.set(-1);
      this.parsed.set(result);
      this.markUsed();
    } catch (error) {
      if (job !== this.fileJob) return;
      this.parsed.set(null);
      this.used.set(null);
      this.error.set(
        (error as Error)?.message === 'binary'
          ? 'This looks like a binary file, not text. Choose a .csv, .tsv or .txt file, or pick the right encoding (UTF-16 files are binary-looking).'
          : 'Something went wrong while reading this file. Try again, or choose a different file.',
      );
    } finally {
      if (job === this.fileJob) this.busy.set(false);
    }
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

  protected exportCsv(): void {
    const p = this.parsed();
    if (!p) return;
    const header = this.header() ? this.labels() : null;
    downloadFile(`${baseName(this.file?.name ?? 'data')}-export.csv`, viewToCsv(p.rows, this.view(), p.columns, header), 'text/csv;charset=utf-8');
    this.trackDownload();
  }

  protected exportJson(): void {
    const p = this.parsed();
    if (!p) return;
    const header = this.header() ? this.labels() : null;
    downloadFile(`${baseName(this.file?.name ?? 'data')}-export.json`, viewToJson(p.rows, this.view(), p.columns, header, false), 'application/json;charset=utf-8');
    this.trackDownload();
  }
}
