import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '@shared/services/analytics.service';
import { HTTP_STATUSES, STATUS_CLASS_LABELS, type StatusClass } from '@shared/tools/http-status.data';
import { ToolLayout } from '../tool-layout/tool-layout';

const CLASSES = Object.keys(STATUS_CLASS_LABELS) as StatusClass[];

/** /tools/http-status-codes: searchable index linking to one indexable page per code. */
@Component({
  selector: 'app-http-status-codes',
  imports: [ToolLayout, RouterLink],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="http-status-codes">
      <div class="tool-field">
        <label class="tool-label" for="q">Find a status code</label>
        <input id="q" class="tool-input" autocomplete="off" placeholder="404, redirect, rate limit..." (input)="onInput($event)" />
      </div>
      @for (group of groups(); track group.kind) {
        <h2 class="tool-label tool-group">{{ group.label }}</h2>
        <ul class="tool-codes">
          @for (s of group.items; track s.code) {
            <li>
              <a [routerLink]="['/tools/http-status-codes', s.code]">
                <strong>{{ s.code }} {{ s.name }}</strong>
                <span>{{ s.summary }}</span>
              </a>
            </li>
          }
        </ul>
      } @empty {
        <p class="tool-status">No status code matches "{{ query() }}".</p>
      }
    </app-tool-layout>
  `,
})
export class HttpStatusCodesTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly query = signal('');
  protected readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const match = (s: (typeof HTTP_STATUSES)[number]) =>
      !q || String(s.code).startsWith(q) || s.name.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q);
    return CLASSES.map((kind) => ({
      kind,
      label: STATUS_CLASS_LABELS[kind],
      items: HTTP_STATUSES.filter((s) => s.kind === kind && match(s)),
    })).filter((g) => g.items.length);
  });

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    if (!this.used && this.query().trim()) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'http-status-codes' });
    }
  }
}
