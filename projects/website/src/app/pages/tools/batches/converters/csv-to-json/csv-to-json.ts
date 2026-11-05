import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_CSV_TO_JSON, convertCsvToJson } from './csv-to-json.logic';

const SAMPLE = 'id,name,email,active,score,zip\n1,Asif Raza,asif@example.com,true,9.5,00123\n2,"Sara ""SJ"" Jones",,false,-3,54000\n3,"Lee, Kim",lee@example.com,TRUE,12,10001\n';

const DELIMITERS = choices([
  ['auto', 'Detect automatically'],
  [',', 'Comma ,'],
  [';', 'Semicolon ;'],
  ['\t', 'Tab (TSV)'],
  ['|', 'Pipe |'],
]);
const SHAPES = choices([
  ['objects', 'Array of objects'],
  ['arrays', 'Array of arrays'],
]);
const INDENTS = choices([
  ['2', '2 spaces'],
  ['4', '4 spaces'],
  ['tab', 'Tab'],
  ['minify', 'Minified'],
]);

/** /tools/csv-to-json: CSV and TSV to typed JSON, parsed by papaparse in a Web Worker above ~1 MB. */
@Component({
  selector: 'app-csv-to-json',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolSelect, ToolToggle],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="csv-to-json">
      <div class="tool-split">
        <app-converter-input
          title="CSV or TSV"
          fieldId="c2j-input"
          label="CSV to convert"
          placeholder="id,name&#10;1,Asif&#10;2,Sara"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
          [sample]="sample"
          [invalid]="failed()"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-select fieldId="c2j-delimiter" label="Delimiter" [control]="o.delimiter" [options]="delimiters" />
            <app-tool-select fieldId="c2j-shape" label="Output shape" [control]="o.shape" [options]="shapes" />
            <app-tool-select fieldId="c2j-indent" label="JSON style" [control]="o.indent" [options]="indents" />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="c2j-header" label="Header row" hint="First line holds the column names" [control]="o.header" />
            <app-tool-toggle
              fieldId="c2j-infer"
              label="Detect types"
              hint="Numbers, true/false and null. Long ids and 007 stay text"
              [control]="o.inferTypes"
            />
            <app-tool-toggle fieldId="c2j-trim" label="Trim spaces" hint="Around every cell and column name" [control]="o.trim" />
            <app-tool-toggle fieldId="c2j-skip" label="Skip empty lines" hint="Ignore blank lines between rows" [control]="o.skipEmpty" />
            <app-tool-toggle fieldId="c2j-null" label="Empty cells as null" hint="Instead of an empty string" [control]="o.emptyAsNull" />
          </div>
        </app-converter-input>

        <app-converter-result
          label="JSON"
          tool="csv-to-json"
          [view]="view()"
          [fileName]="fileName()"
          mime="application/json"
          emptyIcon="braces"
          emptyText="Paste CSV or TSV on the left, or load the sample. JSON appears here as you type."
          [swap]="{ slug: 'json-to-csv', label: 'Use as input in JSON to CSV' }"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class CsvToJsonTool {
  private readonly markUsed = toolUsage('csv-to-json');
  protected readonly trackCopy = toolCopied('csv-to-json');

  protected readonly sample = SAMPLE;
  protected readonly delimiters = DELIMITERS;
  protected readonly shapes = SHAPES;
  protected readonly indents = INDENTS;

  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_CSV_TO_JSON);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertCsvToJson,
    createWorker: () => new Worker(new URL('./csv-to-json.worker', import.meta.url), { type: 'module' }),
  });
  protected readonly view = this.runner.state;
  protected readonly failed = computed(() => this.view().result?.ok === false);
  protected readonly fileName = computed(() => renameFile(this.sourceName(), 'json', 'data'));

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
