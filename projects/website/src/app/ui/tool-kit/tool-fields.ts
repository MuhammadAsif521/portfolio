import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import type { FormControl } from '@angular/forms';
import { CustomReactiveCheckboxComponent } from '@shared/components/reactive-form-components/custom-reactive-checkbox/custom-reactive-checkbox.component';
import {
  CustomReactiveDropdownComponent,
  type DropdownOption,
} from '@shared/components/reactive-form-components/custom-reactive-dropdown/custom-dropdown.component';
import { CustomReactiveRadioComponent } from '@shared/components/reactive-form-components/custom-reactive-radio/custom-reactive-radio.component';
import { CustomReactiveTextareaComponent } from '@shared/components/reactive-form-components/custom-reactive-textarea/custom-textarea.component';
import { CustomReactiveTextfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-textfield/custom-textfield.component';
import { CustomReactiveToggleButtonComponent } from '@shared/components/reactive-form-components/custom-reactive-toggle-button/custom-toggle-button.component';

/*
 * Thin wrappers that put the shared reactive form components behind a signal-friendly API (label as a plain
 * string, one `id`, one `hint` line) and give every tool the same spacing and monospace code styling. The
 * actual inputs, labels, validation text and keyboard behaviour all come from the shared components.
 * Styles are global (ViewEncapsulation.None) because they reach into the shared components' markup.
 */

const FIELD_STYLES = `
  .tk-field { display: block; min-width: 0; }
  .tk-field .fc-wrapper { margin-bottom: 0; }
  .tk-field .fc-label { text-transform: none; font-size: var(--text-sm); letter-spacing: 0; }
  .tk-field--mono .fc-control,
  .tk-field--mono .fc-control-textarea { font-family: var(--font-mono); letter-spacing: -0.01em; }
  .tk-field--code .fc-control-textarea { min-height: 12rem; line-height: 1.55; white-space: pre; overflow-wrap: normal; overflow: auto; }
  .tk-field--wrap .fc-control-textarea { white-space: pre-wrap; overflow-wrap: anywhere; }
  .tk-field.tk-field--invalid .fc-control,
  .tk-field.tk-field--invalid .fc-control-textarea { border-color: var(--error); }
  .tk-field.tk-field--invalid .fc-control-textarea:focus-visible,
  .tk-field.tk-field--invalid .fc-control:focus-visible { box-shadow: 0 0 0 4px var(--error-soft); }
  .tk-hint { margin: 0.375rem 0 0; color: var(--text-muted); font-size: var(--text-xs); line-height: 1.45; }
  .tk-field .fc-row-group { background: transparent; }
  .tk-field .fc-row-option { font-size: var(--text-sm); }
`;

@Component({
  selector: 'app-tool-input',
  imports: [CustomReactiveTextfieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: FIELD_STYLES,
  host: {
    class: 'tk-field',
    '[class.tk-field--mono]': 'mono()',
    '[class.tk-field--invalid]': 'invalid()',
    spellcheck: 'false',
  },
  template: `
    <app-custom-reactive-textfield
      [controlName]="fieldId()"
      [control]="control()"
      [label$]="label$"
      [type]="type()"
      [placeholder]="placeholder()"
      [inputMode]="inputMode()"
      [min]="$any(min())"
      [max]="$any(max())"
      [maxLength]="$any(maxLength())"
    />
    @if (hint()) {
      <p class="tk-hint">{{ hint() }}</p>
    }
  `,
})
export class ToolInput {
  /** Unique on the page: becomes the input's id (not set on the host, so ids stay unique), so the label is tied to it. */
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly type = input('text');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly mono = input(true);
  readonly invalid = input(false);
  readonly inputMode = input<string>();
  readonly min = input<number>();
  readonly max = input<number>();
  readonly maxLength = input<number>();
  protected readonly label$ = toObservable(this.label);
}

@Component({
  selector: 'app-tool-textarea',
  imports: [CustomReactiveTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: FIELD_STYLES,
  host: {
    class: 'tk-field tk-field--code',
    '[class.tk-field--wrap]': 'wrap()',
    '[class.tk-field--mono]': 'mono()',
    '[class.tk-field--invalid]': 'invalid()',
    spellcheck: 'false',
  },
  template: `
    <app-custom-reactive-textarea
      [controlName]="fieldId()"
      [control]="control()"
      [label$]="label$"
      [placeholder]="placeholder()"
      [rows]="rows()"
      [maxLength]="$any(maxLength())"
    />
    @if (hint()) {
      <p class="tk-hint">{{ hint() }}</p>
    }
  `,
})
export class ToolTextarea {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly placeholder = input('');
  readonly hint = input('');
  readonly rows = input(10);
  /** Wrap long lines (prose, Base64) instead of scrolling sideways (code). */
  readonly wrap = input(false);
  readonly mono = input(true);
  readonly invalid = input(false);
  readonly maxLength = input<number>();
  protected readonly label$ = toObservable(this.label);
}

@Component({
  selector: 'app-tool-select',
  imports: [CustomReactiveDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: FIELD_STYLES,
  host: { class: 'tk-field' },
  template: `
    <app-custom-reactive-dropdown
      [controlName]="fieldId()"
      [control]="control()"
      [label$]="label$"
      [options]="$any(options())"
      [placeholder]="placeholder()"
    />
    @if (hint()) {
      <p class="tk-hint">{{ hint() }}</p>
    }
  `,
})
export class ToolSelect {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<any>>();
  readonly options = input.required<readonly DropdownOption[]>();
  readonly placeholder = input('Select option');
  readonly hint = input('');
  protected readonly label$ = toObservable(this.label);
}

@Component({
  selector: 'app-tool-toggle',
  imports: [CustomReactiveToggleButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: FIELD_STYLES,
  host: { class: 'tk-field' },
  template: `
    <app-custom-reactive-toggle-button
      [controlName]="fieldId()"
      [control]="control()"
      [label$]="label$"
      [placeholder]="hint()"
    />
  `,
})
export class ToolToggle {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<boolean>>();
  /** Second line under the label explaining what the switch does. */
  readonly hint = input('');
  protected readonly label$ = toObservable(this.label);
}

/** A radio group (one value) or checkbox group (a list of values) laid out in a wrapping row. */
@Component({
  selector: 'app-tool-choice',
  imports: [CustomReactiveRadioComponent, CustomReactiveCheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: FIELD_STYLES,
  host: { class: 'tk-field' },
  template: `
    @if (kind() === 'radio') {
      <app-custom-reactive-radio
        [controlName]="fieldId()"
        [control]="control()"
        [label$]="label$"
        [options]="$any(options())"
        layout="inline"
      />
    } @else {
      <app-custom-reactive-checkbox
        [controlName]="fieldId()"
        [control]="control()"
        [label$]="label$"
        [options]="$any(options())"
        layout="inline"
      />
    }
    @if (hint()) {
      <p class="tk-hint">{{ hint() }}</p>
    }
  `,
})
export class ToolChoice {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<any>>();
  readonly options = input.required<readonly { id: string | number; name: string }[]>();
  readonly kind = input<'radio' | 'checkbox'>('radio');
  readonly hint = input('');
  protected readonly label$ = toObservable(this.label);
}
