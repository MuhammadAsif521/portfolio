import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';

/**
 * Inline "couldn't load" box with a Try again button, used instead of an empty state when a content
 * load failed. While the retry runs, the box stays (the button reads "Retrying…" and is aria-disabled
 * rather than disabled, so keyboard focus stays on it) and the result is announced via the live region.
 */
@Component({
  selector: 'app-load-error',
  imports: [IconComponent],
  templateUrl: './load-error.html',
  styleUrl: './load-error.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadError {
  /** Short headline, e.g. "Could not load the blog". */
  readonly heading = input.required<string>();
  /** What went wrong / what to do (the slot's message); a connection hint when absent. */
  readonly text = input<string | null>(null);
  /** True while the retry is in flight. */
  readonly retrying = input(false);
  /** Renders the headline as an <h1> (a page whose main content failed) instead of a paragraph. */
  readonly pageHeading = input(false);
  readonly retry = output<void>();

  protected onRetry(): void {
    if (!this.retrying()) this.retry.emit();
  }
}
