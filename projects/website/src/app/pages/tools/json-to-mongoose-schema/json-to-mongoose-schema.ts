import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolTextarea, ToolToggle } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { jsonToMongoose } from '../tool-logic';

const SAMPLE = '{"name": "Asif", "email": "a@b.com", "age": 30, "tags": ["node"], "address": {"city": "Lahore"}}';

/** /tools/json-to-mongoose-schema: infer a Mongoose schema + model from a JSON sample. */
@Component({
  selector: 'app-json-to-mongoose-schema',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolInput, ToolToggle, ToolOutput, ToolNote, ToolEmpty, ToolButton],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-mongoose-schema">
      <div class="tool-split">
        <app-tool-panel title="Input">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="sourceCtl.setValue(sample)" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!source()" (pressed)="sourceCtl.setValue('')" />
          </ng-container>
          <app-tool-textarea
            fieldId="mongoose-json"
            label="JSON document (or array of documents)"
            placeholder='{"name": "Asif", "email": "a@b.com", "tags": ["node"]}'
            [control]="sourceCtl"
            [rows]="10"
            [invalid]="result()?.ok === false"
          />
          <app-tool-input fieldId="mongoose-model" label="Model name" [control]="modelCtl" />
          <div class="tool-controls">
            <app-tool-toggle fieldId="mongoose-required" label="Mark fields required" hint="Adds required: true" [control]="requiredCtl" />
            <app-tool-toggle fieldId="mongoose-timestamps" label="timestamps: true" hint="createdAt and updatedAt" [control]="timestampsCtl" />
          </div>
        </app-tool-panel>

        <app-tool-panel title="Result">
          @if (result(); as r) {
            @if (r.ok) {
              <app-tool-output label="Mongoose schema" copyLabel="Copy schema" [value]="r.code" (copied)="trackCopy()" />
            } @else {
              <app-tool-note kind="error">{{ r.error }}</app-tool-note>
            }
          } @else {
            <app-tool-empty icon="database">Paste a JSON document on the left and the schema and model appear here.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class JsonToMongooseSchemaTool {
  private readonly markUsed = toolUsage('json-to-mongoose-schema');
  protected readonly trackCopy = toolCopied('json-to-mongoose-schema');

  protected readonly sample = SAMPLE;
  protected readonly sourceCtl = new FormControl('', { nonNullable: true });
  protected readonly modelCtl = new FormControl('User', { nonNullable: true });
  protected readonly requiredCtl = new FormControl(true, { nonNullable: true });
  protected readonly timestampsCtl = new FormControl(true, { nonNullable: true });

  protected readonly source = controlSignal(this.sourceCtl);
  private readonly modelName = controlSignal(this.modelCtl);
  private readonly required = controlSignal(this.requiredCtl);
  private readonly timestamps = controlSignal(this.timestampsCtl);
  protected readonly result = computed(() =>
    jsonToMongoose(this.source(), { modelName: this.modelName(), required: this.required(), timestamps: this.timestamps() }),
  );

  constructor() {
    this.sourceCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.result()?.ok && this.markUsed());
  }
}
