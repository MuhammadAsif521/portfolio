import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { decodeObjectId, objectIdFromDate } from '../tool-logic';

/** /tools/objectid-to-date: ObjectId → date, and date → boundary ObjectId for `_id` range queries. */
@Component({
  selector: 'app-objectid-to-date',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="objectid-to-date">
      <div class="tool-grid">
        <div>
          <div class="tool-field">
            <label class="tool-label" for="oid">ObjectId (24 hex characters)</label>
            <input id="oid" class="tool-input" autocomplete="off" spellcheck="false"
              placeholder="507f1f77bcf86cd799439011" (input)="id.set(text($event))" />
          </div>
          @if (decoded(); as d) {
            <pre class="tool-output">UTC:      {{ d.iso }}
Local:    {{ d.local }}
Unix s:   {{ d.seconds }}
Random:   {{ d.random }}
Counter:  {{ d.counter }}</pre>
            <button type="button" class="tool-btn" (click)="copy(d.iso)">Copy ISO date</button>
          } @else if (id().trim()) {
            <p class="tool-error" role="alert">An ObjectId is exactly 24 hexadecimal characters.</p>
          }
        </div>

        <div>
          <div class="tool-field">
            <label class="tool-label" for="when">Date (ISO, Unix seconds or milliseconds)</label>
            <input id="when" class="tool-input" autocomplete="off" spellcheck="false"
              placeholder="2026-01-01T00:00:00Z" (input)="when.set(text($event))" />
          </div>
          @if (fromDate(); as oid) {
            <pre class="tool-output">{{ oid }}</pre>
            <p class="tool-status">Use it as a lower bound: <code>{{ '{' }} _id: {{ '{' }} $gte: ObjectId("{{ oid }}") {{ '}' }} {{ '}' }}</code></p>
            <button type="button" class="tool-btn" (click)="copy(oid)">Copy ObjectId</button>
          } @else if (when().trim()) {
            <p class="tool-error" role="alert">Could not read that date.</p>
          }
        </div>
      </div>
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class ObjectIdToDateTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly id = signal('');
  protected readonly when = signal('');
  protected readonly decoded = computed(() => decodeObjectId(this.id()));
  protected readonly fromDate = computed(() => objectIdFromDate(this.when()));
  protected readonly status = signal('');

  protected text(event: Event): string {
    const value = (event.target as HTMLInputElement).value;
    if (!this.used && value.trim()) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'objectid-to-date' });
    }
    return value;
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'objectid-to-date' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
