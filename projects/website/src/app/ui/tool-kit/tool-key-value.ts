import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ToolCopy } from './tool-copy';

export interface ToolRow {
  label: string;
  value: string;
  /** Adds a copy button for this row. */
  copy?: boolean;
}

/** Label / value rows for the output console (decoded fields, converted formats). */
@Component({
  selector: 'app-tool-key-value',
  imports: [ToolCopy],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tool-key-value.scss',
  template: `
    <dl class="kv">
      @for (row of rows(); track row.label) {
        <div class="kv__row">
          <dt class="kv__label">{{ row.label }}</dt>
          <dd class="kv__value">{{ row.value }}</dd>
          @if (row.copy) {
            <app-tool-copy class="kv__copy" [dark]="true" [text]="row.value" (copied)="copied.emit(row.label)" />
          }
        </div>
      }
    </dl>
  `,
})
export class ToolKeyValue {
  readonly rows = input.required<readonly ToolRow[]>();
  /** Emits the label of the row whose value was copied. */
  readonly copied = output<string>();
}
