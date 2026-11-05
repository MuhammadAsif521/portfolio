import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { parseEpoch, relativeTime } from '../tool-logic-2';

/** /tools/epoch-converter: Unix seconds/ms ⇄ dates. "Now" is only read in the browser, on demand. */
@Component({
  selector: 'app-epoch-converter',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolButton, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="epoch-converter">
      <div class="tool-split">
        <app-tool-panel title="Timestamp or date">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="clock" label="Use current time" (pressed)="useNow()" />
          </ng-container>
          <app-tool-input
            fieldId="epoch-input"
            label="Timestamp (seconds or milliseconds) or date"
            placeholder="1767225600 or 2026-01-01T00:00:00Z"
            hint="13 digits or more are read as milliseconds. Dates use ISO 8601."
            [control]="inputCtl"
            [invalid]="!!input().trim() && !info()"
          />
        </app-tool-panel>

        <app-tool-panel title="Converted">
          @if (info()) {
            <app-tool-output label="All formats" meta="Click Copy on any row">
              <app-tool-key-value [rows]="rows()" (copied)="trackCopy()" />
            </app-tool-output>
          } @else if (input().trim()) {
            <app-tool-note kind="error">Enter a Unix timestamp or a date such as 2026-01-01T12:00:00Z.</app-tool-note>
          } @else {
            <app-tool-empty icon="hourglass">Enter a timestamp or a date, or use the current time, to see it in every format.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class EpochConverterTool {
  private readonly markUsed = toolUsage('epoch-converter');
  protected readonly trackCopy = toolCopied('epoch-converter');

  protected readonly inputCtl = new FormControl('', { nonNullable: true });
  protected readonly input = controlSignal(this.inputCtl);
  protected readonly info = computed(() => parseEpoch(this.input()));
  protected readonly rows = computed<ToolRow[]>(() => {
    const i = this.info();
    if (!i) return [];
    return [
      { label: 'Read as', value: i.unit },
      { label: 'Seconds', value: String(i.seconds), copy: true },
      { label: 'Milliseconds', value: String(i.ms), copy: true },
      { label: 'UTC (ISO)', value: i.iso, copy: true },
      { label: 'Local', value: new Date(i.ms).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) },
      { label: 'Relative', value: relativeTime(i.ms) },
    ];
  });

  constructor() {
    this.inputCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.info() && this.markUsed());
  }

  protected useNow(): void {
    this.inputCtl.setValue(String(Math.floor(Date.now() / 1000)));
  }
}
