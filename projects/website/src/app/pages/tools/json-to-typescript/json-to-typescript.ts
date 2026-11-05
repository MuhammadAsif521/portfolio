import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { jsonToTypeScript, type TsStyle } from '../tool-logic';

/** /tools/json-to-typescript: infer nested interfaces/types from a JSON sample. */
@Component({
  selector: 'app-json-to-typescript',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-to-typescript">
      <div class="tool-field">
        <label class="tool-label" for="json">JSON</label>
        <textarea id="json" class="tool-textarea" spellcheck="false" autocomplete="off"
          placeholder='{"id": 1, "name": "Asif"}' (input)="onInput($event)"></textarea>
      </div>
      <div class="tool-row">
        <div class="tool-field">
          <label class="tool-label" for="root">Root type name</label>
          <input id="root" class="tool-input" value="Root" autocomplete="off" (input)="rootName.set(value($event))" />
        </div>
        <div class="tool-field">
          <label class="tool-label" for="style">Output</label>
          <select id="style" class="tool-select" (change)="style.set(value($event) === 'type' ? 'type' : 'interface')">
            <option value="interface">interface</option>
            <option value="type">type</option>
          </select>
        </div>
      </div>

      @if (result(); as r) {
        @if (r.ok) {
          <pre class="tool-output">{{ r.code }}</pre>
          <button type="button" class="tool-btn" (click)="copy(r.code)">Copy TypeScript</button>
        } @else {
          <p class="tool-error" role="alert">{{ r.error }}</p>
        }
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class JsonToTypescriptTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly source = signal('');
  protected readonly rootName = signal('Root');
  protected readonly style = signal<TsStyle>('interface');
  protected readonly result = computed(() => jsonToTypeScript(this.source(), this.rootName(), this.style()));
  protected readonly status = signal('');

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected onInput(event: Event): void {
    this.source.set((event.target as HTMLTextAreaElement).value);
    if (!this.used && this.result()?.ok) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'json-to-typescript' });
    }
  }

  protected async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'json-to-typescript' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
