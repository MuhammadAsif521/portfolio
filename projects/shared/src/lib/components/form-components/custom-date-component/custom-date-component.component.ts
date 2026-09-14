import { Component, Input, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CustomDropdownComponent } from '@shared/components/form-components/custom-dropdown/custom-dropdown.component';
import { Observable, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-custom-date-component',
  standalone: true,
  imports: [ReactiveFormsModule, CustomDropdownComponent],
  template: `
    <div class="fc-wrapper">
      @if (dateType === 'year') {
        <app-custom-dropdown
          [controlName]="controlName"
          [label]="label"
          [showLabel]="showLabel"
          [placeholder]="placeholder || 'Select year'"
          [options]="yearOptions"
          [value]="control.value"
          [disable]="control.disabled"
          (onChange)="onYearChange($event)"
        />
      } @else {
        @if (label && showLabel) {
          <label [attr.for]="controlName" class="fc-label">
            {{ label }}
          </label>
        }

        <div class="relative">
          <input
            [type]="dateType"
            [formControl]="control"
            [id]="controlName"
            [placeholder]="placeholder"
            [attr.min]="min || null"
            [attr.max]="max || null"
            (focus)="isFocused = true"
            (blur)="isFocused = false"
            class="fc-control"
            [class.fc-focused]="isFocused"
            [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
          />
        </div>
      }

      @if (control.invalid && (control.dirty || control.touched)) {
        <p class="fc-error-text">
          {{ errorMessage }}
        </p>
      }
    </div>
  `,
})
export class CustomDateComponentComponent implements OnInit, OnChanges, OnDestroy {
  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() showLabel: boolean = true;
  @Input() label$!: Observable<string>;
  @Input() minLength!: number;
  @Input() theme: string = 'white';
  @Input() fieldClass: string = '';
  @Input() class: string = '';

  @Input() min: any | null = null;
  @Input() max: any | null = null;

  // date | month | year
  @Input() dateType: 'date' | 'month' | 'year' = 'date';

  label: string = '';
  isFocused: boolean = false;
  yearOptions: { name: string; value: number }[] = [];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.label$.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });

    if (this.dateType === 'year') {
      this.buildYearOptions();
    }
  }

  ngOnChanges(): void { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildYearOptions(): void {
    const maxYear = this.max ? Number(this.max) : new Date().getFullYear() + 10;
    const minYear = this.min ? Number(this.min) : maxYear - 100;

    this.yearOptions = [];
    for (let y = maxYear; y >= minYear; y--) {
      this.yearOptions.push({ name: String(y), value: y });
    }
  }

  onYearChange(value: any): void {
    this.control.setValue(value);
    this.control.markAsDirty();
    this.control.markAsTouched();
  }

  get errorMessage(): string {
    switch (this.dateType) {
      case 'month':
        return 'Please select a valid month';
      case 'year':
        return 'Please select a valid year';
      default:
        return 'Please enter a valid date (MM/DD/YYYY)';
    }
  }
}