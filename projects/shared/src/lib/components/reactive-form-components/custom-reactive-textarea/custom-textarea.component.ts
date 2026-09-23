import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-custom-reactive-textarea',
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <div class="fc-wrapper">
      @if (label && showLabel) {
        <label [attr.for]="controlName" class="fc-label">
          {{ label }}
          @if (hasRequiredValidator) { <span class="fc-required">*</span> }
        </label>
      }

      <textarea
        [formControl]="control"
        [id]="controlName"
        [placeholder]="placeholder"
        [rows]="rows"
        [attr.maxlength]="maxLength ?? null"
        [attr.aria-label]="showLabel ? null : ariaLabel || label || null"
        [attr.aria-required]="hasRequiredValidator || null"
        [attr.aria-invalid]="showError || null"
        [attr.aria-describedby]="showError ? controlName + '-error' : null"
        (focus)="isFocused = true"
        (blur)="isFocused = false"
        class="fc-control-textarea w-full"
        [class.fc-focused]="isFocused"
        [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
      ></textarea>

      <!-- Error (left) and optional character count (right) -->
      <div class="flex justify-between items-center mt-1">
        @if (showError) {
          <p class="fc-error-text" [id]="controlName + '-error'">
            @if (control.hasError('required')) { {{ label }} is required. }
            @else if (control.hasError('minlength')) {
              Please write at least {{ control.getError('minlength').requiredLength }} characters.
            }
            @else if (control.hasError('maxlength')) { Too long. }
          </p>
        } @else {
          <span></span>
        }
        @if (maxLength) {
          <span class="fc-hint" aria-hidden="true">{{ length }}/{{ maxLength }}</span>
        }
      </div>
    </div>
  `,
})
export class CustomReactiveTextareaComponent implements OnInit, OnDestroy {
  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() rows: number | undefined = 2;
  @Input() label$!: Observable<string>;
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;
  /** Caps input and shows a "n/max" counter. */
  @Input() maxLength?: number;
  /** Accessible name when the visible label is hidden (showLabel = false). */
  @Input() ariaLabel?: string;

  label: string = '';
  isFocused: boolean = false;
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

  get length(): number {
    return String(this.control?.value ?? '').length;
  }

  get showError(): boolean {
    return this.showHints && this.control.invalid && (this.control.dirty || this.control.touched);
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }
}
