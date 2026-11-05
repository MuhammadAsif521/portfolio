import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { HTTP_STATUSES, STATUS_CLASS_LABELS, type StatusClass } from '@shared/tools/http-status.data';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';

const CLASSES = Object.keys(STATUS_CLASS_LABELS) as StatusClass[];
const TABS: NavTab[] = [
  { label: 'All', value: 'all' },
  ...CLASSES.map((kind) => ({ label: STATUS_CLASS_LABELS[kind].slice(0, 3), value: kind })),
];

/** /tools/http-status-codes: searchable index linking to one indexable page per code. */
@Component({
  selector: 'app-http-status-codes',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolEmpty, TabsComponent, RouterLink],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="http-status-codes">
      <div class="tool-stack">
        <app-tool-panel title="Find a status code">
          <app-tool-input
            fieldId="status-search"
            label="Search by code, name or meaning"
            placeholder="404, redirect, rate limit..."
            [mono]="false"
            [control]="queryCtl"
          />
          <div role="group" aria-label="Filter by class">
            <app-custom-tabs [tabs]="tabs" [activeTab]="kind()" (activeTabChange)="kind.set($event)" />
          </div>
          <p class="tool-meta" role="status">{{ count() }} {{ count() === 1 ? 'status code' : 'status codes' }}</p>
        </app-tool-panel>

        <div class="tool-groups">
          @for (group of groups(); track group.kind) {
            <section [attr.aria-labelledby]="'status-group-' + group.kind">
              <h3 class="tool-group" [id]="'status-group-' + group.kind">{{ group.label }}</h3>
              <ul class="tool-codes">
                @for (s of group.items; track s.code) {
                  <li>
                    <a [routerLink]="['/tools/http-status-codes', s.code]">
                      <span class="tool-code-num">{{ s.code }}</span>
                      <strong>{{ s.name }}</strong>
                      <span>{{ s.summary }}</span>
                    </a>
                  </li>
                }
              </ul>
            </section>
          } @empty {
            <app-tool-empty icon="search">No status code matches "{{ query() }}". Try a number such as 404, or a word such as redirect.</app-tool-empty>
          }
        </div>
      </div>
    </app-tool-layout>
  `,
})
export class HttpStatusCodesTool {
  private readonly markUsed = toolUsage('http-status-codes');

  protected readonly tabs = TABS;
  protected readonly kind = signal('all');
  protected readonly queryCtl = new FormControl('', { nonNullable: true });
  protected readonly query = controlSignal(this.queryCtl);
  protected readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const only = this.kind();
    const match = (s: (typeof HTTP_STATUSES)[number]) =>
      !q || String(s.code).startsWith(q) || s.name.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q);
    return CLASSES.filter((kind) => only === 'all' || only === kind)
      .map((kind) => ({
        kind,
        label: STATUS_CLASS_LABELS[kind],
        items: HTTP_STATUSES.filter((s) => s.kind === kind && match(s)),
      }))
      .filter((g) => g.items.length);
  });
  protected readonly count = computed(() => this.groups().reduce((total, g) => total + g.items.length, 0));

  constructor() {
    this.queryCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => v.trim() && this.markUsed());
  }
}
