import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { PREVIEW_LIMIT, plural } from './convert-common';
import type { RunView } from './convert-runner';
import { HANDOFF_KEY } from './converter-input';
import { downloadText } from './download';

/** Largest output handed to the sibling tool through the router state. */
const HANDOFF_LIMIT = 2_000_000;

/**
 * The result side of every text converter: the output console with copy, a download button, the reverse
 * ("swap") button that opens the sibling tool with this output as its input, warnings, and exact errors with
 * line, column and a source excerpt. Long output is shown truncated; copy and download use all of it.
 */
@Component({
  selector: 'app-converter-result',
  imports: [ToolPanel, ToolOutput, ToolNote, ToolEmpty, ToolButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../tool-ui.scss',
  template: `
    <app-tool-panel title="Result">
      @if (view().busy === 'big') {
        <app-tool-note kind="info">Converting a large input in the background. The page stays usable.</app-tool-note>
      }
      @if (view().result; as r) {
        @if (r.ok) {
          @for (w of r.warnings; track $index) {
            <app-tool-note kind="warn">{{ w }}</app-tool-note>
          }
          <app-tool-output
            [label]="label()"
            [value]="shown()"
            [copyText]="r.output"
            [copyLabel]="'Copy ' + label()"
            [meta]="metaLine()"
            (copied)="copied.emit()"
          />
          @if (truncated()) {
            <app-tool-note kind="info">
              Showing the first {{ previewKb }} KB of {{ sizeText() }}. Copy and Download use the full result.
            </app-tool-note>
          }
          <div class="tool-actions">
            <app-tool-button kind="primary" size="small" icon="download" [label]="'Download ' + fileName()" (pressed)="download()" />
            @if (swap(); as s) {
              <app-tool-button size="small" icon="arrow-right-left" [label]="s.label" (pressed)="swapNow(s.slug)" />
            }
          </div>
        } @else {
          <app-tool-note kind="error">
            <strong>{{ r.error.message }}</strong>
            @if (r.error.line) {
              (line {{ r.error.line }}@if (r.error.column) {, column {{ r.error.column }}})
            }
          </app-tool-note>
          @if (r.error.snippet) {
            <app-tool-output label="Where it breaks" [value]="r.error.snippet" [copyText]="''" />
          }
          @for (w of r.warnings ?? []; track $index) {
            <app-tool-note kind="warn">{{ w }}</app-tool-note>
          }
        }
      } @else if (view().busy === 'none') {
        <app-tool-empty [icon]="emptyIcon()">{{ emptyText() }}</app-tool-empty>
      }
    </app-tool-panel>
  `,
})
export class ConverterResult {
  readonly view = input.required<RunView>();
  /** Console title, e.g. "CSV". */
  readonly label = input('Result');
  /** Download file name, e.g. "orders.csv". */
  readonly fileName = input.required<string>();
  readonly mime = input('text/plain');
  readonly emptyText = input('Paste your data on the left, or load the sample.');
  readonly emptyIcon = input('braces');
  /** Reverse button: opens the sibling tool with this output as its input. */
  readonly swap = input<{ slug: string; label: string } | null>(null);
  /** Slug for analytics. */
  readonly tool = input('converter');
  /** Fires after a successful copy (analytics). */
  readonly copied = output<void>();

  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  protected readonly previewKb = Math.round(PREVIEW_LIMIT / 1000);
  protected readonly okResult = computed(() => {
    const r = this.view().result;
    return r && r.ok ? r : null;
  });
  protected readonly shown = computed(() => {
    const r = this.okResult();
    if (!r) return '';
    if (r.output.length <= PREVIEW_LIMIT) return r.output;
    const cut = r.output.lastIndexOf('\n', PREVIEW_LIMIT);
    return r.output.slice(0, cut > PREVIEW_LIMIT / 2 ? cut : PREVIEW_LIMIT) + '\n…';
  });
  protected readonly truncated = computed(() => (this.okResult()?.output.length ?? 0) > PREVIEW_LIMIT);
  protected readonly sizeText = computed(() => plural(this.okResult()?.output.length ?? 0, 'character'));
  protected readonly metaLine = computed(() => {
    const v = this.view();
    const r = this.okResult();
    if (!r) return '';
    return [...r.meta, ...(v.ms > 500 ? [`${(v.ms / 1000).toFixed(1)} s`] : [])].join(' · ');
  });

  protected download(): void {
    const r = this.okResult();
    if (!r) return;
    downloadText(this.fileName(), r.output, this.mime(), r.bom);
    this.analytics.track('result_copied', { tool: this.tool(), method: 'download' });
  }

  protected swapNow(slug: string): void {
    const r = this.okResult();
    const state = r && r.output.length <= HANDOFF_LIMIT ? { [HANDOFF_KEY]: r.output } : undefined;
    void this.router.navigate(['/tools', slug], state ? { state } : undefined);
  }
}
