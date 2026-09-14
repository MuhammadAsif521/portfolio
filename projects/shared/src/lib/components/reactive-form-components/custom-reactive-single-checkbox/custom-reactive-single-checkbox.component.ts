import {  } from '@angular/common';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-custom-reactive-single-checkbox',
  imports: [ FormsModule, ReactiveFormsModule],
  template: `
   <div class="my-2 font-body">
  <label
    class="fc-row-option border"
    [class.fc-row-option-active]="control.value"
    [style.background]="'rgb(var(--background-color))'"
    [style.borderColor]="control.invalid && control.touched ? 'rgb(var(--error-color))' : (control.value ? 'rgb(var(--form-control-border-active))' : 'rgb(var(--form-control-border))')"
  >
    <span class="fc-check" [class.fc-check-active]="control.value">
      @if (control.value) {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="h-3 w-3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      }
    </span>

    <input
      type="checkbox"
      [formControl]="control"
      class="sr-only"
    />

    <span class="text-[11px] font-semibold uppercase tracking-[0.16em]" style="color: rgb(var(--form-control-text))">
      {{ label }}
      @if (hasRequiredValidator) {
        <span class="fc-required">*</span>
      }
    </span>
  </label>

  @if (control?.invalid && control?.touched && control?.errors?.['required']) {
    <p class="mt-2 text-[10px] uppercase tracking-[0.12em] fc-error-text">
      {{ label }} is required
    </p>
  }
</div>
   `
})
export class CustomReactiveSingleCheckboxComponent {
  @Input() controlName!: string;
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() options: { name: string, id: any }[] = [];
  @Input() required: boolean = false;
  @Input() disable: boolean = false;


  label: string = '';
  private destroy$ = new Subject<void>();

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

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
