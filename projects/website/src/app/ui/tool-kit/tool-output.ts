import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ToolCopy } from './tool-copy';

/**
 * The dark "console" every tool result lands in: a header (label, optional status line, copy button) and a
 * scrollable, keyboard-focusable body. Pass `value` for plain text, or project richer content.
 */
@Component({
  selector: 'app-tool-output',
  imports: [ToolCopy],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tool-output.scss',
  template: `
    <div class="out">
      <div class="out__bar">
        <span class="out__label">{{ label() }}</span>
        @if (meta()) {
          <span class="out__meta">{{ meta() }}</span>
        }
        @if (copyText() ?? value(); as text) {
          <app-tool-copy class="out__copy" [dark]="true" [text]="text" [label]="copyLabel()" (copied)="copied.emit()" />
        }
      </div>
      <div class="out__scroll" role="region" tabindex="0" [attr.aria-label]="label()">
        @if (value()) {
          <pre class="out__code">{{ value() }}</pre>
        }
        <ng-content />
      </div>
    </div>
  `,
})
export class ToolOutput {
  readonly label = input('Output');
  /** Plain text result, rendered monospaced and copied by the header button. */
  readonly value = input('');
  /** Overrides what the header button copies (defaults to `value`). */
  readonly copyText = input<string | null>(null);
  readonly copyLabel = input('Copy');
  /** One-line status next to the label, e.g. "Valid JSON · 12 keys". */
  readonly meta = input('');
  readonly copied = output<void>();
}
