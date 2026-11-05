import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';

export interface ResultRow {
  id: number | string;
  name: string;
  status: 'queued' | 'working' | 'done' | 'error';
  /** Second line: sizes and notes when done, the live step while working, the error when failed. */
  detail: string;
  /** Small preview (an object URL the tool owns). */
  thumb?: string;
  canDownload?: boolean;
}

/**
 * The result list every images-pdf tool ends with: an overall progress bar, a one-line summary with the total size
 * before and after, a "download all as ZIP" button, and one row per file with its own status and download button.
 */
@Component({
  selector: 'app-ip-results',
  imports: [ToolButton, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: grid; gap: 0.75rem; min-width: 0; }
    .bar { height: 0.375rem; overflow: hidden; border-radius: var(--radius-pill); background: var(--border); }
    .bar > span { display: block; height: 100%; background: var(--brand-gradient); transition: width 0.2s ease; }
    .summary { margin: 0; color: var(--heading); font-size: var(--text-sm); font-weight: 600; line-height: 1.5; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .list { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; max-height: 30rem; overflow: auto; }
    .row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; padding: 0.625rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card-bg); }
    .row--error { border-color: color-mix(in srgb, var(--error) 45%, transparent); background: color-mix(in srgb, var(--error) 7%, var(--card-bg)); }
    .thumb { width: 2.75rem; height: 2.75rem; border-radius: var(--radius-sm, 0.375rem); object-fit: cover; background: var(--border); }
    .dot { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: var(--radius-sm, 0.375rem); background: var(--primary-soft); color: var(--primary-ink); }
    .main { min-width: 0; display: grid; gap: 0.125rem; }
    .name { overflow: hidden; color: var(--heading); font-size: var(--text-sm); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .detail { color: var(--text-muted); font-size: var(--text-xs); line-height: 1.45; overflow-wrap: anywhere; }
    .row--error .detail { color: var(--error); }
    .state { color: var(--text-muted); font-size: var(--text-xs); }
  `,
  template: `
    @if (busy() || (percent() > 0 && percent() < 100)) {
      <div class="bar" role="progressbar" aria-label="Overall progress" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="percent()">
        <span [style.width.%]="percent()"></span>
      </div>
    }
    @if (summary()) {
      <p class="summary" role="status">{{ summary() }}</p>
    }
    @if (zipLabel() || busy()) {
      <div class="actions">
        @if (zipLabel()) {
          <app-tool-button kind="primary" icon="archive" [label]="zipLabel()" [loading]="zipping()" [disabled]="busy()" (pressed)="zip.emit()" />
        }
        @if (busy()) {
          <app-tool-button label="Cancel" (pressed)="cancel.emit()" />
        }
      </div>
    }
    <ul class="list" [attr.aria-label]="listLabel()">
      @for (row of rows(); track row.id) {
        <li class="row" [class.row--error]="row.status === 'error'">
          @if (row.thumb) {
            <img class="thumb" [src]="row.thumb" [alt]="'Preview of ' + row.name" loading="lazy" decoding="async" />
          } @else {
            <span class="dot" aria-hidden="true"><i-lucide [name]="icon()" [size]="20" /></span>
          }
          <div class="main">
            <span class="name" [title]="row.name">{{ row.name }}</span>
            <span class="detail">{{ row.detail || labelOf(row.status) }}</span>
          </div>
          @if (row.status === 'done' && row.canDownload !== false) {
            <app-tool-button size="small" icon="download" label="Download" (pressed)="download.emit(row.id)" />
          } @else if (row.status === 'working') {
            <span class="state">Working…</span>
          }
        </li>
      }
    </ul>
  `,
})
export class IpResults {
  readonly rows = input.required<readonly ResultRow[]>();
  readonly percent = input(0);
  readonly busy = input(false);
  readonly summary = input('');
  /** Text of the ZIP button; empty hides it. */
  readonly zipLabel = input('');
  readonly zipping = input(false);
  readonly icon = input('file-image');
  readonly listLabel = input('Files');
  readonly download = output<number | string>();
  readonly zip = output<void>();
  readonly cancel = output<void>();

  protected labelOf(status: ResultRow['status']): string {
    return status === 'queued' ? 'Waiting' : status === 'working' ? 'Working…' : status === 'error' ? 'Failed' : 'Done';
  }
}
