import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_XML_TO_JSON, convertXmlToJson } from './xml-to-json.logic';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://example.com/catalog" updated="2024-03-05">
  <book id="b1" lang="en">
    <title>XML &amp; You</title>
    <price currency="USD">10.50</price>
    <tags><tag>xml</tag><tag>data</tag></tags>
    <summary><![CDATA[Handles <b>markup</b> as text.]]></summary>
  </book>
  <book id="b2">
    <title>Second Book</title>
    <price currency="EUR">8</price>
    <tags><tag>json</tag></tags>
  </book>
</catalog>
`;

const ATTRIBUTES = choices([
  ['prefix', 'Keys with a prefix'],
  ['group', 'Grouped under @attributes'],
  ['ignore', 'Leave them out'],
]);
const ARRAYS = choices([
  ['auto', 'Only when a tag repeats'],
  ['always', 'Every child is an array'],
]);
const CDATA = choices([
  ['merge', 'Merge into the text'],
  ['separate', 'Separate #cdata key'],
]);
const INDENTS = choices([
  ['2', '2 spaces'],
  ['4', '4 spaces'],
  ['tab', 'Tab'],
  ['minify', 'Minified'],
]);

/** /tools/xml-to-json: XML to JSON with fast-xml-parser; DOCTYPE entities are never expanded. */
@Component({
  selector: 'app-xml-to-json',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolSelect, ToolToggle, ToolInput],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="xml-to-json">
      <div class="tool-split">
        <app-converter-input
          title="XML"
          fieldId="x2j-input"
          label="XML to convert"
          placeholder='<order id="1"><item>Pen</item></order>'
          accept=".xml,.txt,.svg,.rss,.atom,text/xml,application/xml"
          [sample]="sample"
          [invalid]="failed()"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-select fieldId="x2j-attrs" label="Attributes" [control]="o.attributes" [options]="attributes" />
            <app-tool-select fieldId="x2j-arrays" label="Arrays" [control]="o.arrays" [options]="arrays" />
            <app-tool-select fieldId="x2j-cdata" label="CDATA" [control]="o.cdata" [options]="cdata" />
            <app-tool-select fieldId="x2j-indent" label="JSON style" [control]="o.indent" [options]="indents" />
          </div>
          <div class="tool-controls">
            <app-tool-input fieldId="x2j-prefix" label="Attribute prefix" placeholder="@" [control]="o.attributePrefix" />
            <app-tool-input fieldId="x2j-text" label="Text node name" placeholder="#text" [control]="o.textNodeName" />
            <app-tool-input
              fieldId="x2j-names"
              label="Always arrays (tag names)"
              placeholder="item, row"
              hint="Comma separated; applies in both array modes"
              [control]="o.arrayNames"
            />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="x2j-infer" label="Detect types" hint="Numbers and true/false. Long ids and 007 stay text" [control]="o.inferTypes" />
            <app-tool-toggle fieldId="x2j-ns" label="Strip namespace prefixes" hint="ns:tag becomes tag" [control]="o.removeNamespaces" />
            <app-tool-toggle fieldId="x2j-unwrap" label="Drop the root element" hint="Return its content only" [control]="o.unwrapRoot" />
            <app-tool-toggle fieldId="x2j-null" label="Empty elements as null" hint="Instead of an empty string" [control]="o.emptyAsNull" />
            <app-tool-toggle fieldId="x2j-comments" label="Keep comments" hint="Under a #comment key" [control]="o.comments" />
            <app-tool-toggle fieldId="x2j-decl" label="Keep the declaration" hint="The xml version line and other processing instructions" [control]="o.declaration" />
            <app-tool-toggle fieldId="x2j-order" label="Preserve order (mixed content)" hint="Changes the shape to arrays of nodes" [control]="o.preserveOrder" />
          </div>
          <p class="tool-meta">
            A DOCTYPE is ignored, so custom and external entities are never expanded. Namespace declarations stay as attributes.
          </p>
        </app-converter-input>

        <app-converter-result
          label="JSON"
          tool="xml-to-json"
          [view]="view()"
          [fileName]="fileName()"
          mime="application/json"
          emptyIcon="code-xml"
          emptyText="Paste XML on the left, or load the sample. JSON appears here as you type."
          [swap]="{ slug: 'json-to-xml', label: 'Use as input in JSON to XML' }"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class XmlToJsonTool {
  private readonly markUsed = toolUsage('xml-to-json');
  protected readonly trackCopy = toolCopied('xml-to-json');

  protected readonly sample = SAMPLE;
  protected readonly attributes = ATTRIBUTES;
  protected readonly arrays = ARRAYS;
  protected readonly cdata = CDATA;
  protected readonly indents = INDENTS;

  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_XML_TO_JSON);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertXmlToJson,
    createWorker: () => new Worker(new URL('./xml-to-json.worker', import.meta.url), { type: 'module' }),
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
