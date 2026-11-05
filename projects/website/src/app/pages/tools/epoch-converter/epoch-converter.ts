import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { parseEpoch, relativeTime } from '../tool-logic-2';

/** /tools/epoch-converter: Unix seconds/ms ⇄ dates. "Now" is only read in the browser, on demand. */
@Component({
  selector: 'app-epoch-converter',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="epoch-converter">
      <div class="tool-row">
        <div class="tool-field tool-grow">
          <label class="tool-label" for="epoch">Timestamp (seconds or milliseconds) or date</label>
          <input id="epoch" class="tool-input" autocomplete="off" spellcheck="false" placeholder="1767225600 or 2026-01-01T00:00:00Z"
            [value]="input()" (input)="onInput($event)" />
        </div>
        <button type="button" class="tool-btn" (click)="useNow()">Now</button>
      </div>

      @if (info(); as i) {
        <pre class="tool-output" role="status">Read as:     {{ i.unit }}
Seconds:     {{ i.seconds }}
Milliseconds:{{ ' ' + i.ms }}
UTC (ISO):   {{ i.iso }}
Local:       {{ local() }}
Relative:    {{ relative() }}</pre>
        <div class="tool-row">
          <button type="button" class="tool-btn" (click)="copy(i.seconds.toString())">Copy seconds</button>
          <button type="button" class="tool-btn" (click)="copy(i.ms.toString())">Copy milliseconds</button>
          <button type="button" class="tool-btn" (click)="copy(i.iso)">Copy ISO</button>
        </div>
      } @else if (input().trim()) {
        <p class="tool-error" role="alert">Enter a Unix timestamp or a date such as 2026-01-01T12:00:00Z.</p>
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class EpochConverterTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly input = signal('');
  protected readonly info = computed(() => parseEpoch(this.input()));
  protected readonly local = computed(() => {
    const i = this.info();
    return i ? new Date(i.ms).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) : '';
  });
  protected readonly relative = computed(() => {
    const i = this.info();
    return i ? relativeTime(i.ms) : '';
  });
  protected readonly status = signal('');

  protected onInput(event: Event): void {
    this.input.set((event.target as HTMLInputElement).value);
    this.markUsed();
  }

  protected useNow(): void {
    this.input.set(String(Math.floor(Date.now() / 1000)));
    this.markUsed();
  }

  private markUsed(): void {
    if (!this.used && this.info()) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'epoch-converter' });
    }
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'epoch-converter' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
