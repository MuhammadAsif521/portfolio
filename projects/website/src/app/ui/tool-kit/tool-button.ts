import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';

/**
 * The tools' button: the shared LoadingButton with one fixed look. "primary" is the brand call to action,
 * "neutral" a quiet secondary button; `loading` shows the shared spinner and blocks repeat clicks.
 */
@Component({
  selector: 'app-tool-button',
  imports: [LoadingButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tool-button--fill]': 'fill()' },
  styles: `
    :host {
      display: inline-flex;
    }
    :host(.tool-button--fill) {
      display: flex;
      width: 100%;
    }
    :host(.tool-button--fill) ::ng-deep .btn-base {
      width: 100%;
    }
  `,
  template: `
    <app-loading-button
      variant="flat"
      radius="medium"
      [color]="kind()"
      [size]="size()"
      [icon]="icon()"
      [iconSize]="size() === 'small' ? 15 : 18"
      [buttonText]="label()"
      [type]="type()"
      [loading]="loading()"
      [disabled]="disabled()"
      (btnClick)="pressed.emit()"
    />
  `,
})
export class ToolButton {
  readonly label = input.required<string>();
  readonly kind = input<'primary' | 'neutral'>('neutral');
  readonly size = input<'small' | 'medium'>('medium');
  readonly icon = input<string>();
  readonly type = input<'button' | 'submit'>('button');
  readonly loading = input(false);
  readonly disabled = input(false);
  /** Stretch to the full width of the container. */
  readonly fill = input(false);
  readonly pressed = output<void>();
}
