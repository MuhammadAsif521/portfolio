import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { jsonToMongoose } from '../tool-logic';

/** /tools/json-to-mongoose-schema: infer a Mongoose schema + model from a JSON sample. */
@Component({
  selector: 'app-json-to-mongoose-schema',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-mongoose-schema">
      <div class="tool-field">
        <label class="tool-label" for="json">JSON document (or array of documents)</label>
        <textarea id="json" class="tool-textarea" spellcheck="false" autocomplete="off"
          placeholder='{"name": "Asif", "email": "a@b.com", "tags": ["node"]}' (input)="onInput($event)"></textarea>
      </div>
      <div class="tool-row">
        <div class="tool-field">
          <label class="tool-label" for="model">Model name</label>
          <input id="model" class="tool-input" value="User" autocomplete="off" (input)="modelName.set(value($event))" />
        </div>
        <label class="tool-field tool-check">
          <input type="checkbox" checked (change)="required.set(checked($event))" /> Mark fields required
        </label>
        <label class="tool-field tool-check">
          <input type="checkbox" checked (change)="timestamps.set(checked($event))" /> timestamps: true
        </label>
      </div>

      @if (result(); as r) {
        @if (r.ok) {
          <pre class="tool-output">{{ r.code }}</pre>
          <button type="button" class="tool-btn" (click)="copy(r.code)">Copy schema</button>
        } @else {
          <p class="tool-error" role="alert">{{ r.error }}</p>
        }
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class JsonToMongooseSchemaTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly source = signal('');
  protected readonly modelName = signal('User');
  protected readonly required = signal(true);
  protected readonly timestamps = signal(true);
  protected readonly result = computed(() =>
    jsonToMongoose(this.source(), { modelName: this.modelName(), required: this.required(), timestamps: this.timestamps() }),
  );
  protected readonly status = signal('');

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected onInput(event: Event): void {
    this.source.set((event.target as HTMLTextAreaElement).value);
    if (!this.used && this.result()?.ok) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'json-to-mongoose-schema' });
    }
  }

  protected async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'json-to-mongoose-schema' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
