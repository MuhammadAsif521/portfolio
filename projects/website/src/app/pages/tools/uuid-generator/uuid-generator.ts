import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolToggle } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { createUuidV7Generator, inspectUuid, uuidV4 } from '../tool-logic-2';

const VERSIONS = [
  { id: '7', name: 'v7 (time-ordered)' },
  { id: '4', name: 'v4 (random)' },
];

/** /tools/uuid-generator: v4 / v7, bulk, and an inspector. Generated only on click (never during SSR). */
@Component({
  selector: 'app-uuid-generator',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolInput, ToolToggle, ToolButton, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="uuid-generator">
      <div class="tool-split">
        <app-tool-panel title="Generate">
          <div class="tool-controls">
            <app-tool-select fieldId="uuid-version" label="Version" [control]="versionCtl" [options]="versions" />
            <app-tool-input
              fieldId="uuid-count"
              label="How many (1-1000)"
              type="number"
              inputMode="numeric"
              [min]="1"
              [max]="1000"
              [mono]="false"
              [control]="countCtl"
            />
          </div>
          <app-tool-toggle fieldId="uuid-upper" label="Uppercase" hint="Shows the letters A-F in capitals" [control]="upperCtl" />
          <app-tool-button kind="primary" icon="wand-sparkles" label="Generate" [fill]="true" (pressed)="generate()" />
          @if (output()) {
            <app-tool-output
              [label]="values().length === 1 ? 'UUID' : 'UUIDs'"
              [copyLabel]="values().length === 1 ? 'Copy UUID' : 'Copy all'"
              [meta]="values().length + ' generated'"
              [value]="output()"
              (copied)="trackCopy()"
            />
          } @else {
            <app-tool-empty icon="fingerprint-pattern">Press Generate to create UUIDs. Nothing is created until you do.</app-tool-empty>
          }
        </app-tool-panel>

        <app-tool-panel title="Inspect a UUID">
          <app-tool-input
            fieldId="uuid-inspect"
            label="UUID"
            placeholder="0190a4e6-6c3a-7b1e-8f3a-2c9d5e1b7a40"
            [control]="inspectCtl"
            [invalid]="!!inspectInput().trim() && !inspected()"
          />
          @if (inspected()) {
            <app-tool-output label="Details">
              <app-tool-key-value [rows]="rows()" />
            </app-tool-output>
          } @else if (inspectInput().trim()) {
            <app-tool-note kind="error">Not a UUID (expected 8-4-4-4-12 hexadecimal digits).</app-tool-note>
          } @else {
            <app-tool-empty icon="fingerprint-pattern">Paste any UUID to see its version, variant and, for v7, when it was created.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class UuidGeneratorTool {
  private readonly v7 = createUuidV7Generator();
  private readonly markUsed = toolUsage('uuid-generator');
  protected readonly trackCopy = toolCopied('uuid-generator');

  protected readonly versions = VERSIONS;
  protected readonly versionCtl = new FormControl('7', { nonNullable: true });
  protected readonly countCtl = new FormControl('1', { nonNullable: true });
  protected readonly upperCtl = new FormControl(false, { nonNullable: true });
  protected readonly inspectCtl = new FormControl('', { nonNullable: true });

  private readonly version = controlSignal(this.versionCtl);
  private readonly countText = controlSignal(this.countCtl);
  private readonly upper = controlSignal(this.upperCtl);
  protected readonly inspectInput = controlSignal(this.inspectCtl);

  protected readonly count = computed(() => {
    const n = Math.floor(Number(this.countText()));
    return Number.isFinite(n) ? Math.min(1000, Math.max(1, n)) : 1;
  });
  protected readonly values = signal<string[]>([]);
  protected readonly output = computed(() => {
    const text = this.values().join('\n');
    return this.upper() ? text.toUpperCase() : text;
  });
  protected readonly inspected = computed(() => inspectUuid(this.inspectInput()));
  protected readonly rows = computed<ToolRow[]>(() => {
    const i = this.inspected();
    if (!i) return [];
    return [
      { label: 'Version', value: String(i.version) },
      { label: 'Variant', value: i.variant },
      ...(i.createdAt ? [{ label: 'Created', value: i.createdAt, copy: true }] : []),
    ];
  });

  protected generate(): void {
    const make = this.version() === '4' ? () => uuidV4() : this.v7;
    this.values.set(Array.from({ length: this.count() }, make));
    this.markUsed();
  }
}
