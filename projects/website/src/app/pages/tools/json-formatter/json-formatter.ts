import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolTextarea, ToolSelect, ToolToggle } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { formatBytes, formatJson, type JsonFormat } from '../tool-logic-2';

const NEWLINE = String.fromCharCode(10);
const SAMPLE ='{"name":"Asif","skills":["Angular","Node.js","MongoDB"],"available":true,"address":{"city":"Lahore","zip":null}}';
const INDENTS = [
  { id: '2', name: '2 spaces' },
  { id: '4', name: '4 spaces' },
  { id: 'tab', name: 'Tab' },
  { id: 'minify', name: 'Minify' },
];

/** /tools/json-formatter: format / minify / validate with line and column errors. */
@Component({
  selector: 'app-json-formatter',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolSelect, ToolToggle, ToolOutput, ToolNote, ToolEmpty, ToolButton],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-formatter">
      <div class="tool-split">
        <app-tool-panel title="Input">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="sourceCtl.setValue(sample)" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!source()" (pressed)="sourceCtl.setValue('')" />
          </ng-container>
          <app-tool-textarea
            fieldId="json-input"
            label="JSON"
            placeholder='{"id": 1, "name": "Asif"}'
            [control]="sourceCtl"
            [rows]="12"
            [invalid]="result()?.ok === false"
          />
          <div class="tool-controls">
            <app-tool-select fieldId="json-indent" label="Output style" [control]="indentCtl" [options]="indents" />
            <app-tool-toggle fieldId="json-sort" label="Sort keys" hint="Alphabetical, at every level" [control]="sortCtl" />
          </div>
        </app-tool-panel>

        <app-tool-panel title="Result">
          @if (result(); as r) {
            @if (r.ok) {
              <app-tool-output
                label="Formatted JSON"
                [value]="r.code"
                [meta]="'Valid · ' + r.stats.keys + (r.stats.keys === 1 ? ' key · ' : ' keys · ') + size()"
                (copied)="trackCopy()"
              />
            } @else {
              <app-tool-note kind="error">
                <strong>Invalid JSON</strong>@if (r.line) { at line {{ r.line }}, column {{ r.column }}}: {{ r.error }}
              </app-tool-note>
              @if (snippet()) {
                <app-tool-output label="Where it breaks" [value]="snippet()" [copyText]="''" />
              }
            }
          } @else {
            <app-tool-empty icon="braces">Paste JSON on the left, or load the sample, to format, minify or validate it.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class JsonFormatterTool {
  private readonly markUsed = toolUsage('json-formatter');
  protected readonly trackCopy = toolCopied('json-formatter');

  protected readonly sample = SAMPLE;
  protected readonly indents = INDENTS;
  protected readonly sourceCtl = new FormControl('', { nonNullable: true });
  protected readonly indentCtl = new FormControl('2', { nonNullable: true });
  protected readonly sortCtl = new FormControl(false, { nonNullable: true });

  protected readonly source = controlSignal(this.sourceCtl);
  private readonly indent = controlSignal(this.indentCtl);
  private readonly sortKeys = controlSignal(this.sortCtl);

  protected readonly result = computed(() => formatJson(this.source(), { indent: this.toIndent(this.indent()), sortKeys: this.sortKeys() }));
  protected readonly size = computed(() => {
    const r = this.result();
    return r && r.ok ? formatBytes(r.stats.bytes) : '';
  });
  /** The offending line with a caret under the error column (the caret is capped at 200 chars). */
  protected readonly snippet = computed(() => {
    const r = this.result();
    if (!r || r.ok || r.snippet === undefined) return '';
    return r.column ? [r.snippet, ' '.repeat(Math.min(r.column - 1, 200)) + '^'].join(NEWLINE) : r.snippet;
  });

  constructor() {
    this.sourceCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => value.trim() && this.markUsed());
  }

  private toIndent(value: string): JsonFormat['indent'] {
    return value === 'minify' ? 'minify' : value === 'tab' ? '\t' : Number(value);
  }
}
