import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { explainCron } from '../tool-logic';

const PRESETS = ['*/15 * * * *', '0 9 * * 1-5', '30 2 * * *', '0 0 1 * *', '@hourly'];

/** /tools/cron-expression-explainer: plain-English description + next 5 runs in the visitor's time zone. */
@Component({
  selector: 'app-cron-expression-explainer',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="cron-expression-explainer">
      <div class="tool-field">
        <label class="tool-label" for="cron">Cron expression (5 fields)</label>
        <input id="cron" class="tool-input" autocomplete="off" spellcheck="false" placeholder="*/15 9-17 * * 1-5"
          [value]="expression()" (input)="onInput($event)" />
      </div>
      <div class="tool-row" role="group" aria-label="Examples">
        @for (p of presets; track p) {
          <button type="button" class="tool-btn" (click)="expression.set(p)">{{ p }}</button>
        }
      </div>

      @if (result(); as r) {
        @if (r.ok) {
          <p class="tool-output" role="status">{{ r.value.description }}</p>
          @if (r.value.next.length) {
            <h3 class="tool-label">Next {{ r.value.next.length }} runs ({{ zone }})</h3>
            <ol class="tool-status">
              @for (run of r.value.next; track run.getTime()) {
                <li>{{ format(run) }}</li>
              }
            </ol>
          } @else {
            <p class="tool-status">This schedule never runs (for example 30 February).</p>
          }
          <button type="button" class="tool-btn" (click)="copy(r.value.description)">Copy description</button>
        } @else {
          <p class="tool-error" role="alert">{{ r.error }}</p>
        }
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class CronExpressionExplainerTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly presets = PRESETS;
  protected readonly expression = signal('');
  /** Next runs depend on "now", so they are only computed in the browser, on input. */
  protected readonly result = computed(() => explainCron(this.expression()));
  protected readonly status = signal('');
  protected readonly zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';

  protected format(date: Date): string {
    return date.toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected onInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
    if (!this.used && this.result()?.ok) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'cron-expression-explainer' });
    }
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'cron-expression-explainer' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
