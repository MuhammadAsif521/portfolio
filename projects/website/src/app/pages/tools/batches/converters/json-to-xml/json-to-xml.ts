import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_JSON_TO_XML, convertJsonToXml } from './json-to-xml.logic';

const SAMPLE = JSON.stringify(
  {
    order: {
      '@id': 1001,
      '@status': 'paid',
      customer: { name: 'Asif Raza', email: 'asif@example.com' },
      items: { item: [{ '@sku': 'PEN-1', '#text': 'Blue pen', qty: 2 }, { '@sku': 'PAD-9', '#text': 'Notepad <A5>', qty: 1 }] },
      'ship to': { city: 'Lahore' },
      note: null,
    },
  },
  null,
  2,
);

const INDENTS = choices([
  ['2', '2 spaces'],
  ['4', '4 spaces'],
  ['tab', 'Tab'],
  ['minify', 'Minified'],
]);
const EMPTY = choices([
  ['selfclose', 'Self-closing <a/>'],
  ['pair', 'Open and close <a></a>'],
]);
const NULLS = choices([
  ['empty', 'Empty element'],
  ['omit', 'Leave out'],
]);

/** /tools/json-to-xml: JSON to well-formed XML; invalid names are renamed and every rename is reported. */
@Component({
  selector: 'app-json-to-xml',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolSelect, ToolToggle, ToolInput],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-xml">
      <div class="tool-split">
        <app-converter-input
          title="JSON"
          fieldId="j2x-input"
          label="JSON to convert"
          placeholder='{"order": {"@id": 1, "item": ["Pen", "Pad"]}}'
          accept=".json,.txt,application/json"
          [sample]="sample"
          [invalid]="failed()"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-input
              fieldId="j2x-root"
              label="Root element name"
              placeholder="auto"
              hint="Empty: a single top-level key is the root, else root"
              [control]="o.rootName"
            />
            <app-tool-input fieldId="j2x-item" label="Array item name" placeholder="item" hint="For arrays that have no key" [control]="o.itemName" />
            <app-tool-input fieldId="j2x-prefix" label="Attribute prefix" placeholder="@" hint="Keys starting with it become attributes" [control]="o.attributePrefix" />
            <app-tool-input fieldId="j2x-text" label="Text node key" placeholder="#text" hint="Text of an element that also has attributes" [control]="o.textNodeName" />
          </div>
          <div class="tool-controls">
            <app-tool-select fieldId="j2x-indent" label="Indent" [control]="o.indent" [options]="indents" />
            <app-tool-select fieldId="j2x-empty" label="Empty elements" [control]="o.emptyElements" [options]="empty" />
            <app-tool-select fieldId="j2x-null" label="null values" [control]="o.nullAs" [options]="nulls" />
          </div>
          <app-tool-toggle fieldId="j2x-decl" label="XML declaration" hint='Start with &lt;?xml version="1.0" encoding="UTF-8"?&gt;' [control]="o.declaration" />
        </app-converter-input>

        <app-converter-result
          label="XML"
          tool="json-to-xml"
          [view]="view()"
          [fileName]="fileName()"
          mime="application/xml"
          emptyIcon="arrow-left-right"
          emptyText="Paste JSON on the left, or load the sample. XML appears here as you type."
          [swap]="{ slug: 'xml-to-json', label: 'Use as input in XML to JSON' }"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class JsonToXmlTool {
  private readonly markUsed = toolUsage('json-to-xml');
  protected readonly trackCopy = toolCopied('json-to-xml');

  protected readonly sample = SAMPLE;
  protected readonly indents = INDENTS;
  protected readonly empty = EMPTY;
  protected readonly nulls = NULLS;

  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_JSON_TO_XML);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertJsonToXml,
    createWorker: () => new Worker(new URL('./json-to-xml.worker', import.meta.url), { type: 'module' }),
  });
  protected readonly view = this.runner.state;
  protected readonly failed = computed(() => this.view().result?.ok === false);
  protected readonly fileName = computed(() => renameFile(this.sourceName(), 'xml', 'data'));

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
