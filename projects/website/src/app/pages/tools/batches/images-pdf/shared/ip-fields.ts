import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { ToolInput } from '../../../../../ui/tool-kit/tool-fields';

/**
 * A slider and a colour picker built on the tool kit's text field (the shared reactive textfield renders
 * `type="range"` and `type="color"` natively); only the look of the control changes. The value is a string.
 */
const STYLES = `
  .ip-range .fc-control { padding: 0; border: 0; background: transparent; box-shadow: none; height: 2rem; accent-color: var(--primary); cursor: pointer; }
  .ip-color .fc-control { width: 5rem; height: 2.75rem; padding: 0.25rem; cursor: pointer; }
`;

@Component({
  selector: 'app-ip-range',
  imports: [ToolInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: STYLES,
  host: { class: 'ip-range' },
  template: `<app-tool-input type="range" [fieldId]="fieldId()" [label]="label()" [control]="control()" [min]="min()" [max]="max()" [hint]="hint()" [mono]="false" />`,
})
export class IpRange {
  readonly fieldId = input.required<string>();
  /** Include the current value, e.g. "Quality: 80%". */
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly min = input(1);
  readonly max = input(100);
  readonly hint = input('');
}

@Component({
  selector: 'app-ip-color',
  imports: [ToolInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: STYLES,
  host: { class: 'ip-color' },
  template: `<app-tool-input type="color" [fieldId]="fieldId()" [label]="label()" [control]="control()" [hint]="hint()" [mono]="false" />`,
})
export class IpColor {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly hint = input('');
}
