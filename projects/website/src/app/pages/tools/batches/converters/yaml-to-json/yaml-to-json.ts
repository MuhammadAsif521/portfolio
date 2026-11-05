import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_YAML_TO_JSON, convertYamlToJson } from './yaml-to-json.logic';

const SAMPLE = `# Base settings reused with an anchor and a merge key
defaults: &defaults
  retries: 3
  timeout: 30
  tags: [api, internal]

production:
  <<: *defaults
  timeout: 10
  url: https://example.com
  active: yes
---
name: second document
version: 1.10
`;

const INDENTS = choices([
  ['2', '2 spaces'],
  ['4', '4 spaces'],
  ['tab', 'Tab'],
  ['minify', 'Minified'],
]);
const DOCUMENTS = choices([
  ['array', 'Array of all documents'],
  ['first', 'First document only'],
]);

/** /tools/yaml-to-json: YAML to JSON in js-yaml's safe mode, with alias-expansion limits and exact errors. */
@Component({
  selector: 'app-yaml-to-json',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolSelect, ToolToggle],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="yaml-to-json">
      <div class="tool-split">
        <app-converter-input
          title="YAML"
          fieldId="y2j-input"
          label="YAML to convert"
          placeholder="name: api&#10;ports:&#10;  - 80&#10;  - 443"
          accept=".yaml,.yml,.txt,application/yaml"
          [sample]="sample"
          [invalid]="failed()"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-select fieldId="y2j-indent" label="JSON style" [control]="o.indent" [options]="indents" />
            <app-tool-select fieldId="y2j-docs" label="Several documents" [control]="o.documents" [options]="documents" />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="y2j-sort" label="Sort keys" hint="Alphabetical, at every level" [control]="o.sortKeys" />
            <app-tool-toggle fieldId="y2j-merge" label="Expand merge keys" hint="<<: *base copies the base mapping in" [control]="o.mergeKeys" />
            <app-tool-toggle
              fieldId="y2j-alias"
              label="Allow anchors and aliases"
              hint="Switch off to reject &amp;a and *a in untrusted files"
              [control]="o.allowAliases"
            />
            <app-tool-toggle
              fieldId="y2j-11"
              label="YAML 1.1 rules"
              hint="yes/no as booleans, 0777 as octal, timestamps, !!set, !!binary"
              [control]="o.yaml11"
            />
          </div>
          <p class="tool-meta">Safe mode only: tags such as !!js/function or !!python/object are rejected, never run.</p>
        </app-converter-input>

        <app-converter-result
          label="JSON"
          tool="yaml-to-json"
          [view]="view()"
          [fileName]="fileName()"
          mime="application/json"
          emptyIcon="brackets"
          emptyText="Paste YAML on the left, or load the sample. JSON appears here as you type."
          [swap]="{ slug: 'json-to-yaml', label: 'Use as input in JSON to YAML' }"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class YamlToJsonTool {
  private readonly markUsed = toolUsage('yaml-to-json');
  protected readonly trackCopy = toolCopied('yaml-to-json');

  protected readonly sample = SAMPLE;
  protected readonly indents = INDENTS;
  protected readonly documents = DOCUMENTS;

  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_YAML_TO_JSON);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertYamlToJson,
    createWorker: () => new Worker(new URL('./yaml-to-json.worker', import.meta.url), { type: 'module' }),
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
