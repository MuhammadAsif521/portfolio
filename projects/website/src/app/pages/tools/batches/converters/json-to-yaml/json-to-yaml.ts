import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { choices, optionControls } from '../shared/option-controls';
import { DEFAULT_JSON_TO_YAML, convertJsonToYaml } from './json-to-yaml.logic';

const SAMPLE = JSON.stringify(
  {
    name: 'api-gateway',
    replicas: 3,
    enabled: true,
    version: '1.10',
    country: 'no',
    ports: [80, 443],
    env: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
    description: 'Routes public traffic\nto the internal services.',
    limits: null,
  },
  null,
  2,
);

const INDENTS = [
  { id: 2, name: '2 spaces' },
  { id: 3, name: '3 spaces' },
  { id: 4, name: '4 spaces' },
  { id: 6, name: '6 spaces' },
];
const WIDTHS = [
  { id: 80, name: 'Fold at 80 columns' },
  { id: 120, name: 'Fold at 120 columns' },
  { id: 40, name: 'Fold at 40 columns' },
  { id: -1, name: 'Never fold' },
];
const QUOTING = choices([
  ['minimal-single', "Only when needed, 'single'"],
  ['minimal-double', 'Only when needed, "double"'],
  ['all-single', "Every string, 'single'"],
  ['all-double', 'Every string, "double"'],
]);

/** /tools/json-to-yaml: JSON to YAML with js-yaml's dumper; style options only, never a change of meaning. */
@Component({
  selector: 'app-json-to-yaml',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolSelect, ToolToggle],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-yaml">
      <div class="tool-split">
        <app-converter-input
          title="JSON"
          fieldId="j2y-input"
          label="JSON to convert"
          placeholder='{"name": "api", "ports": [80, 443]}'
          accept=".json,.txt,application/json"
          [sample]="sample"
          [invalid]="failed()"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-select fieldId="j2y-indent" label="Indent" [control]="o.indent" [options]="indents" />
            <app-tool-select fieldId="j2y-width" label="Long text" [control]="o.lineWidth" [options]="widths" />
            <app-tool-select fieldId="j2y-quoting" label="Quoting" [control]="o.quoting" [options]="quoting" />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="j2y-sort" label="Sort keys" hint="Alphabetical, at every level" [control]="o.sortKeys" />
            <app-tool-toggle
              fieldId="j2y-multi"
              label="One document per array item"
              hint="A top-level array becomes several --- documents"
              [control]="o.multiDocument"
            />
            <app-tool-toggle fieldId="j2y-flush" label="Flush list items" hint="- item at the key's indent (Kubernetes style)" [control]="o.flushLists" />
          </div>
          <p class="tool-meta">Anchors and aliases (&amp;a, *a) are never written: repeated data is repeated in full.</p>
        </app-converter-input>

        <app-converter-result
          label="YAML"
          tool="json-to-yaml"
          [view]="view()"
          [fileName]="fileName()"
          mime="application/yaml"
          emptyIcon="file-code"
          emptyText="Paste JSON on the left, or load the sample. YAML appears here as you type."
          [swap]="{ slug: 'yaml-to-json', label: 'Use as input in YAML to JSON' }"
          (copied)="trackCopy()"
        />
      </div>
    </app-tool-layout>
  `,
})
export class JsonToYamlTool {
  private readonly markUsed = toolUsage('json-to-yaml');
  protected readonly trackCopy = toolCopied('json-to-yaml');

  protected readonly sample = SAMPLE;
  protected readonly indents = INDENTS;
  protected readonly widths = WIDTHS;
  protected readonly quoting = QUOTING;

  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_JSON_TO_YAML);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertJsonToYaml,
    createWorker: () => new Worker(new URL('./json-to-yaml.worker', import.meta.url), { type: 'module' }),
  });
  protected readonly view = this.runner.state;
  protected readonly failed = computed(() => this.view().result?.ok === false);
  protected readonly fileName = computed(() => renameFile(this.sourceName(), 'yaml', 'data'));

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
