import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { formatBytes } from '../../../tool-logic-2';
import { MAX_INPUT_MB, WORKER_THRESHOLD, fail } from '../shared/convert-common';
import type { RunView } from '../shared/convert-runner';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_EXCEL, type ExcelOptions, type SheetRows, type WorkbookResult, readWorkbook, sheetToOutput } from './excel-to-json.logic';

const FORMATS = choices([
  ['json', 'JSON'],
  ['csv', 'CSV'],
]);
const SHAPES = choices([
  ['objects', 'Array of objects'],
  ['arrays', 'Array of arrays'],
]);
const DATES = choices([
  ['iso', '2024-03-05T14:30:00.000Z'],
  ['date', '2024-03-05'],
  ['datetime', '2024-03-05 14:30:00'],
]);
const EMPTY = choices([
  ['null', 'null'],
  ['omit', 'Leave the key out'],
  ['string', 'Empty string'],
]);
const INDENTS = choices([
  ['2', '2 spaces'],
  ['4', '4 spaces'],
  ['tab', 'Tab'],
  ['minify', 'Minified'],
]);
const DELIMITERS = choices([
  [',', 'Comma ,'],
  [';', 'Semicolon ;'],
  ['\t', 'Tab'],
]);

/** /tools/excel-to-json: opens an .xlsx in the browser (a Web Worker above ~1 MB) and writes one sheet as JSON or CSV. */
@Component({
  selector: 'app-excel-to-json',
  imports: [ToolLayout, ToolPanel, ToolNote, ToolSelect, ToolToggle, ToolInput, ConverterResult, CustomFileInputComponent],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="excel-to-json">
      <div class="tool-split">
        <app-tool-panel title="Workbook">
          <app-custom-file-input
            controlName="e2j-file"
            [label$]="fileLabel"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            placeholder="Choose an .xlsx file, or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Read in your browser, never uploaded. Up to {{ maxMb }} MB. Only .xlsx and .xlsm files, not the old .xls format.</p>
          @if (reading()) {
            <app-tool-note kind="info">Reading the workbook{{ big() ? ' in the background' : '' }}...</app-tool-note>
          }
          @if (readError()) {
            <app-tool-note kind="error">{{ readError() }}</app-tool-note>
          }
          @if (sheets(); as list) {
            <p class="tool-meta">
              <strong>{{ fileName() }}</strong> · {{ fileSize() }} · {{ list.length }} {{ list.length === 1 ? 'sheet' : 'sheets' }}
            </p>
          }

          <div class="tool-controls">
            <app-tool-select
              fieldId="e2j-sheet"
              label="Sheet"
              placeholder="Choose a file first"
              [control]="o.sheet"
              [options]="sheetOptions()"
            />
            <app-tool-input
              fieldId="e2j-header"
              label="Header row"
              placeholder="1"
              hint="Row number with the column names; 0 for none"
              inputMode="numeric"
              [control]="o.headerRow"
            />
            <app-tool-select fieldId="e2j-format" label="Output" [control]="o.format" [options]="formats" />
            @if (options().format === 'json') {
              <app-tool-select fieldId="e2j-shape" label="JSON shape" [control]="o.shape" [options]="shapes" />
              <app-tool-select fieldId="e2j-empty" label="Empty cells" [control]="o.empty" [options]="empty" />
              <app-tool-select fieldId="e2j-indent" label="JSON style" [control]="o.indent" [options]="indents" />
            } @else {
              <app-tool-select fieldId="e2j-delimiter" label="CSV delimiter" [control]="o.delimiter" [options]="delimiters" />
            }
            <app-tool-select fieldId="e2j-dates" label="Dates" [control]="o.dates" [options]="dates" />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="e2j-trim" label="Trim spaces" hint="Around text cells" [control]="o.trim" />
            <app-tool-toggle fieldId="e2j-skip" label="Skip empty rows" hint="Rows with no values" [control]="o.skipEmptyRows" />
            @if (options().format === 'csv') {
              <app-tool-toggle fieldId="e2j-bom" label="BOM for Excel" hint="Added to the downloaded file" [control]="o.bom" />
            }
          </div>
          <p class="tool-meta">
            Limits: cells show the value saved in the file (a formula's last result, never recalculated). Hidden rows and columns are
            included, merged cells keep only their top-left value, and charts, images and macros are ignored. Dates are read as stored (UTC).
          </p>
        </app-tool-panel>

        <app-converter-result
          [label]="options().format === 'json' ? 'JSON' : 'CSV'"
          tool="excel-to-json"
          [view]="view()"
          [fileName]="downloadName()"
          [mime]="options().format === 'json' ? 'application/json' : 'text/csv'"
          emptyIcon="file-spreadsheet"
          emptyText="Choose an .xlsx file on the left. Pick a sheet and the JSON or CSV appears here."
          [swap]="swap()"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class ExcelToJsonTool {
  private readonly markUsed = toolUsage('excel-to-json');
  protected readonly trackCopy = toolCopied('excel-to-json');

  protected readonly maxMb = MAX_INPUT_MB;
  protected readonly fileLabel = of('Excel file');
  protected readonly formats = FORMATS;
  protected readonly shapes = SHAPES;
  protected readonly dates = DATES;
  protected readonly empty = EMPTY;
  protected readonly indents = INDENTS;
  protected readonly delimiters = DELIMITERS;

  private readonly optionState = optionControls(DEFAULT_EXCEL);
  protected readonly o = this.optionState.controls;
  protected readonly options = this.optionState.value;

  protected readonly sheets = signal<SheetRows[] | null>(null);
  protected readonly fileName = signal('');
  protected readonly fileSize = signal('');
  protected readonly reading = signal(false);
  protected readonly big = signal(false);
  protected readonly readError = signal('');
  protected readonly view = signal<RunView>({ result: null, busy: 'none', ms: 0 });

  protected readonly sheetOptions = computed(() => (this.sheets() ?? []).map((s) => ({ id: s.name, name: `${s.name} (${s.rows.length.toLocaleString('en-US')} rows)` })));
  protected readonly swap = computed(() =>
    this.options().format === 'json'
      ? { slug: 'json-to-csv', label: 'Use as input in JSON to CSV' }
      : { slug: 'csv-to-json', label: 'Use as input in CSV to JSON' },
  );
  protected readonly downloadName = computed(() => {
    const sheets = this.sheets();
    const sheet = this.options().sheet;
    const ext = this.options().format;
    const base = renameFile(this.fileName(), ext, 'sheet');
    return sheets && sheets.length > 1 && sheet ? base.replace(/\.[^.]+$/, `-${sheet.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.${ext}`) : base;
  });

  private worker: Worker | null = null;
  private runSeq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.worker?.terminate();
      clearTimeout(this.timer);
      this.runSeq++;
    });
    effect(() => {
      const sheets = this.sheets();
      const options = this.options();
      untracked(() => this.convert(sheets, options));
    });
  }

  protected async onFile(picked: File | File[] | null): Promise<void> {
    const file = Array.isArray(picked) ? picked[0] : picked;
    this.worker?.terminate();
    this.worker = null;
    this.readError.set('');
    this.sheets.set(null);
    this.view.set({ result: null, busy: 'none', ms: 0 });
    this.o.sheet.setValue('');
    if (!file) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      this.readError.set(/\.xls$/i.test(file.name) ? 'This is an old .xls file. Open it in Excel or LibreOffice and save it as .xlsx first.' : 'Choose an .xlsx file. For CSV, use the CSV to JSON tool.');
      return;
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      this.readError.set(`That file is ${formatBytes(file.size)}. The limit is ${MAX_INPUT_MB} MB: a browser tab cannot hold much more.`);
      return;
    }
    this.markUsed();
    this.fileName.set(file.name);
    this.fileSize.set(formatBytes(file.size));
    this.reading.set(true);
    this.big.set(file.size > WORKER_THRESHOLD);
    try {
      const buffer = await file.arrayBuffer();
      const result = await this.read(buffer, file.size > WORKER_THRESHOLD);
      if (!result.ok) {
        this.readError.set(result.message);
        return;
      }
      const first = result.sheets.find((s) => s.rows.length > 0) ?? result.sheets[0];
      this.o.sheet.setValue(first.name);
      this.sheets.set(result.sheets);
    } catch {
      this.readError.set('This file could not be read. It may be damaged or too large for this browser tab.');
    } finally {
      this.reading.set(false);
    }
  }

  private read(buffer: ArrayBuffer, inWorker: boolean): Promise<WorkbookResult> {
    if (!inWorker || typeof Worker === 'undefined') return readWorkbook(buffer);
    return new Promise<WorkbookResult>((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./excel-to-json.worker', import.meta.url), { type: 'module' });
      } catch {
        void readWorkbook(buffer).then(resolve);
        return;
      }
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<WorkbookResult>) => {
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        resolve(event.data);
      };
      worker.onerror = () => {
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        resolve({ ok: false, message: 'The workbook is too large for this browser tab, or could not be read. Try a smaller file.' });
      };
      worker.postMessage(buffer, [buffer]);
    });
  }

  private convert(sheets: SheetRows[] | null, options: ExcelOptions): void {
    clearTimeout(this.timer);
    const id = ++this.runSeq;
    if (!sheets) {
      this.view.set({ result: null, busy: 'none', ms: 0 });
      return;
    }
    const sheet = sheets.find((s) => s.name === options.sheet) ?? sheets[0];
    this.view.update((v) => ({ ...v, busy: 'small' }));
    this.timer = setTimeout(async () => {
      const started = Date.now();
      let result;
      try {
        result = await sheetToOutput(sheet, options);
      } catch {
        result = fail('This sheet could not be converted.');
      }
      if (id === this.runSeq) this.view.set({ result, busy: 'none', ms: Date.now() - started });
    }, 120);
  }
}
