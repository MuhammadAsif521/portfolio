import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';

/** Placeholder for a result area that has nothing to show yet: says what to do, not that it is empty. */
@Component({
  selector: 'app-tool-empty',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tool-empty.scss',
  template: `
    <i-lucide class="empty__icon" [name]="icon()" [size]="22" aria-hidden="true" />
    <p class="empty__text"><ng-content /></p>
  `,
})
export class ToolEmpty {
  readonly icon = input('wand-sparkles');
}
