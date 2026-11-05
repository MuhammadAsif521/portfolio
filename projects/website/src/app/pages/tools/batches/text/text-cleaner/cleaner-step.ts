import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { merge } from 'rxjs';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { STEP_DEFS, type Step, type StepParams } from './text-cleaner.logic';

/**
 * One step of the cleaning pipeline: title, move/remove buttons and the step's own fields. The form controls
 * are created once from the step's initial values (so typing never loses focus) and report every change upward.
 */
@Component({
  selector: 'app-cleaner-step',
  imports: [ToolSelect, ToolInput, ToolToggle, ToolButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .cs {
      display: grid;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card-bg);
    }
    .cs__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .cs__num {
      display: inline-grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: var(--radius-pill);
      background: var(--primary-soft);
      color: var(--primary-ink);
      font-size: var(--text-xs);
      font-weight: 700;
    }
    .cs__title {
      margin: 0;
      color: var(--heading);
      font-size: var(--text-sm);
      font-weight: 600;
    }
    .cs__actions {
      display: flex;
      gap: 0.375rem;
      margin-left: auto;
    }
    .cs__summary {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--text-xs);
    }
  `,
  template: `
    <div class="cs" role="group" [attr.aria-label]="'Step ' + (index() + 1) + ': ' + def().label">
      <div class="cs__head">
        <span class="cs__num" aria-hidden="true">{{ index() + 1 }}</span>
        <h4 class="cs__title">{{ def().label }}</h4>
        <div class="cs__actions">
          <app-tool-button size="small" icon="arrow-up" label="Up" [disabled]="index() === 0" (pressed)="up.emit()" />
          <app-tool-button size="small" icon="arrow-down" label="Down" [disabled]="index() === count() - 1" (pressed)="down.emit()" />
          <app-tool-button size="small" icon="x" label="Remove" (pressed)="remove.emit()" />
        </div>
      </div>
      <p class="cs__summary">{{ def().summary }}</p>
      @if (def().fields.length) {
        <div class="tool-controls">
          @for (f of def().fields; track f.key) {
            @switch (f.kind) {
              @case ('select') {
                <app-tool-select [fieldId]="id(f.key)" [label]="f.label" [control]="$any(ctl(f.key))" [options]="f.options ?? []" [hint]="f.hint ?? ''" />
              }
              @case ('text') {
                <app-tool-input [fieldId]="id(f.key)" [label]="f.label" [control]="$any(ctl(f.key))" [placeholder]="f.placeholder ?? ''" [hint]="f.hint ?? ''" />
              }
              @case ('toggle') {
                <app-tool-toggle [fieldId]="id(f.key)" [label]="f.label" [control]="$any(ctl(f.key))" [hint]="f.hint ?? ''" />
              }
            }
          }
        </div>
      }
    </div>
  `,
})
export class CleanerStep implements OnInit {
  readonly step = input.required<Step>();
  readonly index = input.required<number>();
  readonly count = input.required<number>();
  readonly changed = output<StepParams>();
  readonly up = output<void>();
  readonly down = output<void>();
  readonly remove = output<void>();

  private readonly destroyRef = inject(DestroyRef);
  protected readonly def = computed(() => STEP_DEFS[this.step().type]);
  private controls: Record<string, FormControl<string | boolean>> = {};

  ngOnInit(): void {
    const { params, type } = this.step();
    for (const f of STEP_DEFS[type].fields) {
      const initial = params[f.key] ?? (f.kind === 'toggle' ? false : '');
      this.controls[f.key] = new FormControl<string | boolean>(initial, { nonNullable: true });
    }
    const all = Object.values(this.controls);
    if (all.length) {
      merge(...all.map((c) => c.valueChanges))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          const next: StepParams = {};
          for (const [key, control] of Object.entries(this.controls)) next[key] = control.value;
          this.changed.emit(next);
        });
    }
  }

  protected ctl(key: string): FormControl<string | boolean> {
    return this.controls[key];
  }

  protected id(key: string): string {
    return `cleaner-${this.step().id}-${key}`;
  }
}
