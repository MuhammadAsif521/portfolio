import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-custom-reactive-timefield',
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <div class="fc-wrapper">
      @if (label && showLabel) {
        <label [attr.for]="controlName" class="fc-label">
          {{ label }}
          @if (hasRequiredValidator) { <span class="fc-required">*</span> }
        </label>
      }

      <div class="relative">
        <input
          type="time"
          [id]="controlName"
          [formControl]="control"
          [placeholder]="placeholder"
          autocomplete="off"
          (focus)="isFocused = true"
          (blur)="isFocused = false"
          class="fc-control pr-12"
          [class.fc-focused]="isFocused"
          [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
          [style.colorScheme]="'light'"
        />
      </div>

      @if (showHints && control.invalid && control.touched) {
        <div class="mt-1.5 space-y-0.5">
          @if (control.hasError('required')) {
            <p class="fc-error-text">Time is required.</p>
          }
          @if (control.hasError('pattern')) {
            <p class="fc-error-text">Invalid time format.</p>
          }
        </div>
      }
    </div>
  `,
})
export class CustomReactiveTimeComponent implements OnInit, OnDestroy {
  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() format: number = 24;
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;

  label: string = '';
  isFocused: boolean = false;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
