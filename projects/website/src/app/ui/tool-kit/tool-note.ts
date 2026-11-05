import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';

export type ToolNoteKind = 'error' | 'warn' | 'info' | 'success';

const ICONS: Record<ToolNoteKind, string> = {
  error: 'circle-alert',
  warn: 'triangle-alert',
  info: 'info',
  success: 'circle-check',
};

/**
 * Inline message for a tool: errors are announced at once (role="alert"), success and info politely
 * (role="status"); warnings are static text. Message goes in the default slot.
 */
@Component({
  selector: 'app-tool-note',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tool-note.scss',
  host: { '[class]': '"note note--" + kind()', '[attr.role]': 'role()' },
  template: `
    <i-lucide class="note__icon" [name]="icon()" [size]="18" aria-hidden="true" />
    <div class="note__text"><ng-content /></div>
  `,
})
export class ToolNote {
  readonly kind = input<ToolNoteKind>('info');
  protected readonly icon = computed(() => ICONS[this.kind()]);
  protected readonly role = computed(() => (this.kind() === 'error' ? 'alert' : this.kind() === 'warn' ? null : 'status'));
}
