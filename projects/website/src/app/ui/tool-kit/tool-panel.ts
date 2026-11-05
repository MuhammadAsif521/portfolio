import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let uid = 0;

/**
 * A titled surface of the tool workbench (input side or output side). Put header buttons in the
 * `[panelActions]` slot; the body is the default slot.
 */
@Component({
  selector: 'app-tool-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tool-panel.scss',
  template: `
    <section class="panel" [attr.aria-labelledby]="titleId">
      <header class="panel__head">
        <h3 class="panel__title" [id]="titleId">{{ title() }}</h3>
        <div class="panel__actions"><ng-content select="[panelActions]" /></div>
      </header>
      <div class="panel__body"><ng-content /></div>
    </section>
  `,
})
export class ToolPanel {
  readonly title = input.required<string>();
  protected readonly titleId = `tool-panel-${++uid}`;
}
