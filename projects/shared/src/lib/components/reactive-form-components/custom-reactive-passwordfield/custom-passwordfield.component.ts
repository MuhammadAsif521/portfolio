import {  } from '@angular/common';
import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IconComponent } from "@shared/components/icon-component/icon-component";

@Component({
  selector: 'app-custom-reactive-passwordfield',
  imports: [ FormsModule, ReactiveFormsModule, IconComponent],
  template: `
    <div class="fc-wrapper">
      @if (showLabel && label) {
        <label [attr.for]="controlName" class="fc-label">
          {{ label }}
          @if (hasRequiredValidator) { <span class="fc-required">*</span> }
        </label>
      }

      <div class="relative">
        <input
          [attr.type]="showPassword ? 'text' : 'password'"
          [formControl]="control"
          [id]="controlName"
          [placeholder]="placeholder"
          [attr.minlength]="minLength || null"
          autocomplete="off"
          (focus)="isFocused = true"
          (blur)="isFocused = false"
          class="fc-control pr-12"
          [class.fc-focused]="isFocused"
          [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
        />

        <!-- Show/Hide toggle -->
        <button
          type="button"
          (click)="handlePassword()"
          class="fc-icon-btn absolute right-3 top-1/2 -translate-y-1/2"
          [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
        >
          @if (!showPassword) {
            <i-lucide name="eye" [size]="20"/>
          } @else {
            <i-lucide name="eye-off" [size]="20"/>
          }
        </button>
      </div>

      <!-- Password strength hints -->
      @if (showHints && (control.invalid || control.valid) && (control.dirty || control.touched)) {
        <div class="mt-3 space-y-1.5">
          @for (err of errorList; track err.type) {
            <div class="flex items-center gap-2">
              <span class="fc-dot" [class.fc-dot-error]="control.hasError(err.type)"></span>
              <span
                class="text-[11px] font-medium"
                [style.color]="control.hasError(err.type) ? 'rgb(var(--error-color))' : 'rgb(var(--primary-color))'"
              >
                {{ err.message }}
              </span>
            </div>
          }
        </div>
      }

      @if (showHints && control.hasError('required') && control.touched) {
        <p class="fc-error-text">{{ label }} is required.</p>
      }
    </div>
  `,
})
export class CustomReactivePasswordfieldComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() controlName!: string;
  @Input() type: string = 'password';
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() minLength!: number;
  @Input() maxLength!: number;
  @Input() icon: string = '';
  @Input() value: string = '';
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;

  showPassword: boolean = false;
  label: string = '';
  isFocused: boolean = false;
  private destroy$ = new Subject<void>();

  errorList = [
    {
      type: 'passwordInvalid',
      message: 'At least one uppercase, lowercase & special character.',
    },
    { type: 'length', message: 'Minimum 12 characters.' },
  ];

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });
    if (this.value) {
      this.control.patchValue(this.value);
    }
  }

  handlePassword(): void {
    this.showPassword = !this.showPassword; 
    this.cdr.markForCheck();
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}