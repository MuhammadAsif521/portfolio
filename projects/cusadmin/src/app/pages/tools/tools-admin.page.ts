import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import type { SiteSettings } from '@shared/interfaces/auth.interface';
import { ToastService } from '@shared/services/toast.service';
import { TOOLS } from '@shared/tools/tools.manifest';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'settings';

/**
 * Switch the website's free tools on and off. Saves Site Settings `disabledTools` (only that key). A
 * switched-off tool answers 404 on the website and leaves the tools hub, related links, sitemap.xml and
 * llms.txt. Turning off "HTTP Status Codes" also hides its per-code pages.
 */
@Component({
  selector: 'app-tools-admin',
  imports: [MatSlideToggleModule, LoadingButtonComponent, PageLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <app-page-loader />
    } @else if (loadFailed()) {
      <p class="text-sm text-muted">Could not load the settings.</p>
      <app-loading-button buttonText="Try again" variant="stroked" size="small" (click)="load()" />
    } @else {
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <p class="m-0 text-xs text-muted">
          {{ enabledCount() }} of {{ tools.length }} tools are live. A switched-off tool returns 404 and is removed
          from the sitemap, llms.txt and every related-tools list.
        </p>
        <app-loading-button class="ml-auto" buttonText="Save changes" icon="save" variant="flat" color="primary"
          size="small" radius="small" [loading]="saving()" [disabled]="!dirty()" (click)="save()" />
      </div>

      <ul class="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        @for (tool of tools; track tool.slug) {
          <li class="rounded-xl border border-heading/10 p-4">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <p class="m-0 font-semibold">{{ tool.name }}</p>
                <p class="m-0 mt-1 text-xs text-muted">/tools/{{ tool.slug }} · {{ tool.category }}</p>
                <p class="m-0 mt-2 text-sm text-muted">{{ tool.description }}</p>
              </div>
              <mat-slide-toggle [checked]="!disabled().has(tool.slug)" (change)="toggle(tool.slug, $event.checked)"
                [attr.aria-label]="(disabled().has(tool.slug) ? 'Enable ' : 'Disable ') + tool.name" />
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class ToolsAdminPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);

  protected readonly tools = TOOLS;
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly disabled = signal<Set<string>>(new Set());
  private readonly saved = signal<Set<string>>(new Set());

  protected readonly enabledCount = computed(() => TOOLS.filter((t) => !this.disabled().has(t.slug)).length);
  protected readonly dirty = computed(() => {
    const a = this.disabled();
    const b = this.saved();
    return a.size !== b.size || [...a].some((slug) => !b.has(slug));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.svc.getOne<SiteSettings>(PATH).subscribe({
      next: (res) => {
        this.apply(res.data.disabledTools);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.loadFailed.set(true);
        this.toast.error(getError(e, 'Failed to load settings'));
      },
    });
  }

  protected toggle(slug: string, enabled: boolean): void {
    const next = new Set(this.disabled());
    if (enabled) next.delete(slug);
    else next.add(slug);
    this.disabled.set(next);
  }

  protected save(): void {
    this.saving.set(true);
    // Keep the manifest order so the stored list is stable.
    const disabledTools = TOOLS.map((t) => t.slug).filter((slug) => this.disabled().has(slug));
    this.svc.update<SiteSettings>(PATH, null, { disabledTools }).subscribe({
      next: (res) => {
        this.apply(res.data.disabledTools);
        this.saving.set(false);
        this.toast.success('Tools updated');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.toast.error(getError(e, 'Save failed'));
      },
    });
  }

  private apply(list: readonly string[] | undefined): void {
    const set = new Set(list ?? []);
    this.disabled.set(new Set(set));
    this.saved.set(set);
  }
}
