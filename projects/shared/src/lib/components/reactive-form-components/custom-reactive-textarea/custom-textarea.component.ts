import {  } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-custom-reactive-textarea',
  imports: [ FormsModule, ReactiveFormsModule],
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
        (focus)="isFocused = true"
        (blur)="isFocused = false"
        class="fc-control-textarea w-full"
        [class.fc-focused]="isFocused"
        [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
      ></textarea>

      <!-- Character hint row -->
      <div class="flex justify-between items-center mt-1">
        @if (showHints && control.invalid && (control.dirty || control.touched) && control.hasError('required')) {
          <p class="fc-error-text">{{ label }} is required.</p>
        } @else {
          <span></span>
        }
      </div>
    </div>
  `,
})
export class CustomReactiveTextareaComponent implements OnInit, OnDestroy {
  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() rows: number = 2;
  @Input() label$!: Observable<string>;
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }
}
