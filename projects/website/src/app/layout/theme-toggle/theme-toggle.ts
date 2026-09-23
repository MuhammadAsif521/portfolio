import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { ThemeService, type ThemePreference } from '@shared/services/theme.service';

const MODES: Record<ThemePreference, { icon: string; label: string }> = {
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
  system: { icon: 'monitor', label: 'System' },
};
const NEXT: Record<ThemePreference, ThemePreference> = { light: 'dark', dark: 'system', system: 'light' };

/**
 * One button that cycles Light → Dark → System (brief: theme toggle icon button). The label always says
 * what's active and what a click will do, so it works for screen readers without a separate menu.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [class.theme-toggle--on-dark]="onDark()"
      [attr.aria-label]="ariaLabel()"
      [title]="ariaLabel()"
      (click)="theme.cycle()"
    >
      <!-- @for keyed by mode so the icon swap animates (old icon leaves, new one enters) -->
      @for (mode of [preference()]; track mode) {
        <span class="theme-toggle__icon">
          <i-lucide [name]="icon()" [size]="18" />
        </span>
      }
    </button>
  `,
  styles: `
    .theme-toggle {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--primary);
      cursor: pointer;
      overflow: hidden;
      transition:
        background-color var(--transition-fast),
        border-color var(--transition-fast);

      &:hover {
        background: var(--primary-soft);
        border-color: var(--primary-muted);
      }
    }

    .theme-toggle--on-dark {
      border-color: var(--band-dark-border);
      background: var(--band-dark-raised);
    }

    .theme-toggle__icon {
      display: inline-flex;
      animation: theme-icon-in var(--duration-normal) var(--ease-out);
    }

    @keyframes theme-icon-in {
      from {
        opacity: 0;
        transform: rotate(-90deg) scale(0.6);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  /** Styles the button for the dark nav bar. */
  readonly onDark = input(false);

  protected readonly preference = this.theme.preference;
  protected readonly current = computed(() => MODES[this.preference()]);
  protected readonly icon = computed(() => this.current().icon);
  protected readonly ariaLabel = computed(() => {
    const next = MODES[NEXT[this.preference()]];
    const resolved = this.preference() === 'system' ? ` (currently ${this.theme.theme()})` : '';
    return `Theme: ${this.current().label}${resolved}. Switch to ${next.label}.`;
  });
}
