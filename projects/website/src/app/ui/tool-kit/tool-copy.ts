import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';

/**
 * Copy-to-clipboard button with visible and announced feedback ("Copied" / "Copy failed"). The clipboard
 * is only touched on click, so it is safe to server-render. Emits `copied` after a successful copy.
 */
@Component({
  selector: 'app-tool-copy',
  imports: [LoadingButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tool-copy--dark]': 'dark()' },
  styles: `
    :host {
      display: inline-flex;
    }
    :host(.tool-copy--dark) ::ng-deep .btn-base.btn-flat.btn-color-neutral {
      border-color: var(--band-dark-border);
      background: color-mix(in srgb, #fff 7%, transparent);
      color: var(--band-dark-text);
    }
    :host(.tool-copy--dark) ::ng-deep .btn-base.btn-flat.btn-color-neutral:hover:not(:disabled) {
      background: color-mix(in srgb, #fff 14%, transparent);
    }
  `,
  template: `
    <app-loading-button
      variant="flat"
      color="neutral"
      size="small"
      radius="medium"
      [icon]="state() === 'copied' ? 'check' : 'copy'"
      [iconSize]="15"
      [buttonText]="state() === 'copied' ? 'Copied' : state() === 'failed' ? 'Copy failed' : label()"
      [disabled]="!text()"
      (btnClick)="copy()"
    />
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
  `,
})
export class ToolCopy {
  /** The text that lands on the clipboard. */
  readonly text = input.required<string>();
  readonly label = input('Copy');
  /** Light-on-dark styling for use inside the output console. */
  readonly dark = input(false);
  readonly copied = output<void>();

  protected readonly state = signal<'idle' | 'copied' | 'failed'>('idle');
  protected readonly announcement = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(): Promise<void> {
    clearTimeout(this.timer);
    try {
      await navigator.clipboard.writeText(this.text());
      this.state.set('copied');
      this.announcement.set(`${this.label()}: copied to clipboard.`);
      this.copied.emit();
    } catch {
      this.state.set('failed');
      this.announcement.set('Copy failed. Select the text and copy it manually.');
    }
    this.timer = setTimeout(() => this.state.set('idle'), 2200);
  }
}
