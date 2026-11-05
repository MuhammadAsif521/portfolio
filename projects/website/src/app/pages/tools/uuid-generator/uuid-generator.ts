import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { createUuidV7Generator, inspectUuid, uuidV4 } from '../tool-logic-2';

/** /tools/uuid-generator: v4 / v7, bulk, and an inspector. Generated only on click (never during SSR). */
@Component({
  selector: 'app-uuid-generator',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="uuid-generator">
      <div class="tool-row">
        <div class="tool-field">
          <label class="tool-label" for="ver">Version</label>
          <select id="ver" class="tool-select" (change)="version.set($any($event.target).value === '4' ? 4 : 7)">
            <option value="7">v7 (time-ordered)</option>
            <option value="4">v4 (random)</option>
          </select>
        </div>
        <div class="tool-field">
          <label class="tool-label" for="count">How many (1-1000)</label>
          <input id="count" class="tool-input" type="number" min="1" max="1000" [value]="count()"
            (input)="count.set(clamp($any($event.target).value))" />
        </div>
        <label class="tool-check"><input type="checkbox" (change)="upper.set(!upper())" /> Uppercase</label>
        <button type="button" class="tool-btn" (click)="generate()">Generate</button>
      </div>

      @if (output()) {
        <pre class="tool-output">{{ output() }}</pre>
        <button type="button" class="tool-btn" (click)="copy(output())">Copy {{ count() === 1 ? 'UUID' : 'all' }}</button>
      }

      <div class="tool-field tool-section">
        <label class="tool-label" for="inspect">Inspect a UUID</label>
        <input id="inspect" class="tool-input" autocomplete="off" spellcheck="false" (input)="inspectInput.set($any($event.target).value)" />
      </div>
      @if (inspected(); as i) {
        <p class="tool-status" role="status">Version {{ i.version }} · variant {{ i.variant }}@if (i.createdAt) { · created {{ i.createdAt }}}</p>
      } @else if (inspectInput().trim()) {
        <p class="tool-error" role="alert">Not a UUID (expected 8-4-4-4-12 hexadecimal digits).</p>
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class UuidGeneratorTool {
  private readonly analytics = inject(AnalyticsService);
  private readonly v7 = createUuidV7Generator();
  private used = false;

  protected readonly version = signal<4 | 7>(7);
  protected readonly count = signal(1);
  protected readonly upper = signal(false);
  private readonly values = signal<string[]>([]);
  protected readonly output = computed(() => {
    const text = this.values().join('\n');
    return this.upper() ? text.toUpperCase() : text;
  });
  protected readonly inspectInput = signal('');
  protected readonly inspected = computed(() => inspectUuid(this.inspectInput()));
  protected readonly status = signal('');

  protected clamp(value: string): number {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.min(1000, Math.max(1, n)) : 1;
  }

  protected generate(): void {
    const make = this.version() === 4 ? () => uuidV4() : this.v7;
    this.values.set(Array.from({ length: this.count() }, make));
    if (!this.used) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'uuid-generator' });
    }
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'uuid-generator' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
