import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_JSON_TO_CSV, convertJsonToCsv } from './json-to-csv.logic';

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: 'Asif Raza', email: 'asif@example.com', address: { city: 'Lahore', zip: '54000' }, tags: ['node', 'angular'], active: true, joined: '2024-03-05T14:30:00Z' },
    { id: 2, name: 'Sara "SJ" Jones', email: null, address: { city: 'Leeds' }, tags: [], active: false, joined: '2023-11-20T09:00:00Z', note: '=HYPERLINK("http://example.com")' },
  ],
  null,
  2,
);

const DELIMITERS = choices([
  [',', 'Comma ,'],
  [';', 'Semicolon ;'],
  ['\t', 'Tab'],
  ['|', 'Pipe |'],
]);
const NESTED = choices([
  ['flatten', 'Flatten to a.b.c columns'],
  ['stringify', 'Keep as a JSON string'],
]);
const ARRAYS = choices([
  ['json', 'JSON string in one cell'],
  ['join', 'Joined list: a; b; c'],
  ['columns', 'One column per item'],
]);
const ORDER = choices([
  ['first-seen', 'Order of first appearance'],
  ['alphabetical', 'Alphabetical'],
]);
const NEWLINES = choices([
  ['\n', 'LF (Unix, macOS)'],
  ['\r\n', 'CRLF (Windows, RFC 4180)'],
]);
const NULLS = choices([
  ['empty', 'Empty cell'],
  ['null', 'The text null'],
]);
const DATES = choices([
  ['keep', 'Leave as written'],
  ['excel', 'Excel-friendly (UTC)'],
]);
const ROOTS = choices([
  ['auto', 'Detect (array, envelope or columns)'],
  ['row', 'One row'],
  ['keyed', 'One row per key'],
]);

/** /tools/json-to-csv: rows and columns from any JSON, written by papaparse, in a Web Worker above ~1 MB. */
@Component({
  selector: 'app-json-to-csv',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolSelect, ToolToggle, ToolInput],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-csv">
      <div class="tool-split">
        <app-converter-input
          title="JSON"
          fieldId="j2c-input"
          label="JSON to convert"
          placeholder='[{"id": 1, "name": "Asif"}, {"id": 2, "name": "Sara"}]'
          accept=".json,.txt,application/json"
          [sample]="sample"
          [invalid]="failed()"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-select fieldId="j2c-delimiter" label="Delimiter" [control]="o.delimiter" [options]="delimiters" />
            <app-tool-select fieldId="j2c-newline" label="Line endings" [control]="o.newline" [options]="newlines" />
            <app-tool-select fieldId="j2c-nested" label="Nested objects" [control]="o.nested" [options]="nested" />
            <app-tool-select fieldId="j2c-arrays" label="Arrays" [control]="o.arrays" [options]="arrays" />
            <app-tool-select fieldId="j2c-order" label="Column order" [control]="o.columnOrder" [options]="order" />
            <app-tool-select fieldId="j2c-null" label="null values" [control]="o.nullAs" [options]="nulls" />
            <app-tool-select fieldId="j2c-dates" label="ISO dates" [control]="o.dates" [options]="dates" />
            <app-tool-select fieldId="j2c-root" label="Top-level object" [control]="o.rootObject" [options]="roots" />
          </div>
          <app-tool-input
            fieldId="j2c-path"
            label="Path to the rows (optional)"
            placeholder="data.users"
            hint="Leave empty to detect. Use dots for keys and numbers for array positions."
            [control]="o.path"
          />
          <div class="tool-controls">
            <app-tool-toggle fieldId="j2c-header" label="Header row" hint="First line holds the column names" [control]="o.header" />
            <app-tool-toggle fieldId="j2c-quote" label="Quote every cell" hint="Otherwise only when needed" [control]="o.quoteAll" />
            <app-tool-toggle fieldId="j2c-bom" label="BOM for Excel" hint="Added to the downloaded file, not the text" [control]="o.bom" />
            <app-tool-toggle
              fieldId="j2c-guard"
              label="CSV injection guard"
              hint="Prefix cells starting with = + - @ with a single quote"
              [control]="o.guardFormulas"
            />
          </div>
        </app-converter-input>

        <app-converter-result
          label="CSV"
          tool="json-to-csv"
          [view]="view()"
          [fileName]="fileName()"
          mime="text/csv"
          emptyIcon="table"
          emptyText="Paste JSON on the left, or load the sample. Rows and columns appear here as you type."
          [swap]="{ slug: 'csv-to-json', label: 'Use as input in CSV to JSON' }"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class JsonToCsvTool {
  private readonly markUsed = toolUsage('json-to-csv');
  protected readonly trackCopy = toolCopied('json-to-csv');

  protected readonly sample = SAMPLE;
  protected readonly delimiters = DELIMITERS;
  protected readonly newlines = NEWLINES;
  protected readonly nested = NESTED;
  protected readonly arrays = ARRAYS;
  protected readonly order = ORDER;
  protected readonly nulls = NULLS;
  protected readonly dates = DATES;
  protected readonly roots = ROOTS;

  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_JSON_TO_CSV);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertJsonToCsv,
    createWorker: () => new Worker(new URL('./json-to-csv.worker', import.meta.url), { type: 'module' }),
  });
  protected readonly view = this.runner.state;
  protected readonly failed = computed(() => this.view().result?.ok === false);
  protected readonly fileName = computed(() => renameFile(this.sourceName(), 'csv', 'data'));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.runner.dispose());
    effect(() => {
      const text = this.text();
      const options = this.options.value();
      untracked(() => {
        if (text.trim()) this.markUsed();
        this.runner.run(text, options);
      });
    });
  }
}
