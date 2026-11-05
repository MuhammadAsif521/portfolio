import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { explainCron } from '../tool-logic';

const PRESETS = ['*/15 * * * *', '0 9 * * 1-5', '30 2 * * *', '0 0 1 * *', '@hourly'];

/** /tools/cron-expression-explainer: plain-English description + next 5 runs in the visitor's time zone. */
@Component({
  selector: 'app-cron-expression-explainer',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolOutput, ToolNote, ToolEmpty],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="cron-expression-explainer">
      <div class="tool-split">
        <app-tool-panel title="Expression">
          <app-tool-input
            fieldId="cron-input"
            label="Cron expression (5 fields)"
            placeholder="*/15 9-17 * * 1-5"
            hint="minute hour day-of-month month day-of-week"
            [control]="expressionCtl"
            [invalid]="result()?.ok === false"
          />
          <div role="group" aria-label="Examples">
            <p class="tool-meta">Try an example</p>
            <div class="tool-presets">
              @for (p of presets; track p) {
                <button type="button" class="tool-chip-button" (click)="expressionCtl.setValue(p)">{{ p }}</button>
              }
            </div>
          </div>
        </app-tool-panel>

        <app-tool-panel title="Meaning">
          @if (result(); as r) {
            @if (r.ok) {
              <app-tool-output label="In plain English" copyLabel="Copy description" [value]="r.value.description" (copied)="trackCopy()" />
              <app-tool-output [label]="r.value.next.length ? 'Next ' + r.value.next.length + ' runs' : 'Next runs'" [meta]="r.value.next.length ? zone : ''" [copyText]="''">
                @if (r.value.next.length) {
                  <ol class="tool-list">
                    @for (run of r.value.next; track run.getTime()) {
                      <li>{{ format(run) }}</li>
                    }
                  </ol>
                } @else {
                  <p class="tool-code">This schedule never runs (for example 30 February).</p>
                }
              </app-tool-output>
            } @else {
              <app-tool-note kind="error">{{ r.error }}</app-tool-note>
            }
          } @else {
            <app-tool-empty icon="clock">Enter a cron expression, or pick an example, to read it in plain English.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class CronExpressionExplainerTool {
  private readonly markUsed = toolUsage('cron-expression-explainer');
  protected readonly trackCopy = toolCopied('cron-expression-explainer');

  protected readonly presets = PRESETS;
  protected readonly expressionCtl = new FormControl('', { nonNullable: true });
  protected readonly expression = controlSignal(this.expressionCtl);
  /** Next runs depend on "now", so they are only computed in the browser, on input. */
  protected readonly result = computed(() => explainCron(this.expression()));
  protected readonly zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';

  constructor() {
    this.expressionCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.result()?.ok && this.markUsed());
  }

  protected format(date: Date): string {
    return date.toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
