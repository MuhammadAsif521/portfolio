import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { formatBytes, formatJson, type JsonFormat } from '../tool-logic-2';

/** /tools/json-formatter: format / minify / validate with line and column errors. */
@Component({
  selector: 'app-json-formatter',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-formatter">
      <div class="tool-field">
        <label class="tool-label" for="json">JSON</label>
        <textarea id="json" class="tool-textarea" spellcheck="false" autocomplete="off" (input)="onInput($event)"></textarea>
      </div>
      <div class="tool-row">
        <div class="tool-field">
          <label class="tool-label" for="indent">Output</label>
          <select id="indent" class="tool-select" (change)="setIndent($any($event.target).value)">
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
            <option value="minify">Minify</option>
          </select>
        </div>
        <label class="tool-check"><input type="checkbox" (change)="sortKeys.set(!sortKeys())" /> Sort keys</label>
      </div>

      @if (result(); as r) {
        @if (r.ok) {
          <p class="tool-status" role="status">Valid JSON · {{ r.stats.keys }} keys · {{ size() }}</p>
          <pre class="tool-output">{{ r.code }}</pre>
          <button type="button" class="tool-btn" (click)="copy(r.code)">Copy</button>
        } @else {
          <p class="tool-error" role="alert">
            Invalid JSON@if (r.line) { at line {{ r.line }}, column {{ r.column }}}: {{ r.error }}
          </p>
          @if (r.snippet !== undefined) {
            <pre class="tool-output">{{ r.snippet }}
{{ pointer() }}</pre>
          }
        }
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class JsonFormatterTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly source = signal('');
  protected readonly indent = signal<JsonFormat['indent']>(2);
  protected readonly sortKeys = signal(false);
  protected readonly result = computed(() => formatJson(this.source(), { indent: this.indent(), sortKeys: this.sortKeys() }));
  protected readonly size = computed(() => {
    const r = this.result();
    return r && r.ok ? formatBytes(r.stats.bytes) : '';
  });
  /** A caret under the error column (long lines are shown in full; the caret is capped at 200 chars). */
  protected readonly pointer = computed(() => {
    const r = this.result();
    return r && !r.ok && r.column ? `${' '.repeat(Math.min(r.column - 1, 200))}^` : '';
  });
  protected readonly status = signal('');

  protected setIndent(value: string): void {
    this.indent.set(value === 'minify' ? 'minify' : value === 'tab' ? '\t' : Number(value));
  }

  protected onInput(event: Event): void {
    this.source.set((event.target as HTMLTextAreaElement).value);
    if (!this.used && this.source().trim()) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'json-formatter' });
    }
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'json-formatter' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
