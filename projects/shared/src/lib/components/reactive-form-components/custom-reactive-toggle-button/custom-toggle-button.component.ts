import {  } from '@angular/common';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-custom-reactive-toggle-button',
  imports: [ FormsModule, ReactiveFormsModule],
  template: `
    <div class="fc-wrapper">
      <label
        class="group flex w-fit cursor-pointer items-center gap-4"
        [class.opacity-50]="control.disabled"
        [class.pointer-events-none]="control.disabled"
      >
        <div class="relative flex-shrink-0">
          <input
            type="checkbox"
            [formControl]="control"
            [id]="controlName"
            class="sr-only"
          />
          <div class="fc-toggle-track" [class.fc-toggle-on]="control.value"></div>
          <div
            class="fc-toggle-thumb absolute left-0.5 top-0.5"
            [class.fc-toggle-thumb-on]="control.value"
          ></div>
        </div>

        @if (showLabel && (label || placeholder)) {
          <div>
            @if (label) {
              <p class="text-[13px] font-medium leading-tight" style="color: var(--form-control-text)">
                {{ label }}
              </p>
            }
            @if (placeholder) {
              <p class="mt-0.5 text-xs leading-tight" style="color: var(--text-muted)">{{ placeholder }}</p>
            }
          </div>
        }
      </label>
    </div>
  `,
})
export class CustomReactiveToggleButtonComponent implements OnInit, OnDestroy {
  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;

  label: string = '';
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
