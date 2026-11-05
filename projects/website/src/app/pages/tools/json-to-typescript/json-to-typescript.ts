import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolChoice, ToolInput, ToolTextarea } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { jsonToTypeScript, type TsStyle } from '../tool-logic';

const SAMPLE = '{"id": 1, "name": "Asif", "tags": ["angular", "node"], "profile": {"city": "Lahore", "remote": true}}';
const STYLES = [
  { id: 'interface', name: 'interface' },
  { id: 'type', name: 'type alias' },
];

/** /tools/json-to-typescript: infer nested interfaces/types from a JSON sample. */
@Component({
  selector: 'app-json-to-typescript',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolInput, ToolChoice, ToolOutput, ToolNote, ToolEmpty, ToolButton],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-typescript">
      <div class="tool-split">
        <app-tool-panel title="Input">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="sourceCtl.setValue(sample)" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!source()" (pressed)="sourceCtl.setValue('')" />
          </ng-container>
          <app-tool-textarea
            fieldId="ts-json"
            label="JSON"
            placeholder='{"id": 1, "name": "Asif"}'
            [control]="sourceCtl"
            [rows]="12"
            [invalid]="result()?.ok === false"
          />
          <div class="tool-controls">
            <app-tool-input fieldId="ts-root" label="Root type name" [control]="rootCtl" />
            <app-tool-choice fieldId="ts-style" label="Output" [control]="styleCtl" [options]="styles" />
          </div>
        </app-tool-panel>

        <app-tool-panel title="Result">
          @if (result(); as r) {
            @if (r.ok) {
              <app-tool-output label="TypeScript" copyLabel="Copy TypeScript" [value]="r.code" (copied)="trackCopy()" />
            } @else {
              <app-tool-note kind="error">{{ r.error }}</app-tool-note>
            }
          } @else {
            <app-tool-empty icon="file-code">Paste a JSON sample on the left and the interfaces appear here, nested objects included.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class JsonToTypescriptTool {
  private readonly markUsed = toolUsage('json-to-typescript');
  protected readonly trackCopy = toolCopied('json-to-typescript');

  protected readonly sample = SAMPLE;
  protected readonly styles = STYLES;
  protected readonly sourceCtl = new FormControl('', { nonNullable: true });
  protected readonly rootCtl = new FormControl('Root', { nonNullable: true });
  protected readonly styleCtl = new FormControl('interface', { nonNullable: true });

  protected readonly source = controlSignal(this.sourceCtl);
  private readonly rootName = controlSignal(this.rootCtl);
  private readonly style = controlSignal(this.styleCtl);
  protected readonly result = computed(() =>
    jsonToTypeScript(this.source(), this.rootName(), (this.style() === 'type' ? 'type' : 'interface') satisfies TsStyle),
  );

  constructor() {
    this.sourceCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.result()?.ok && this.markUsed());
  }
}
