import {  } from '@angular/common';
import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-custom-timefield',
  standalone: true,
  imports: [ ReactiveFormsModule],
  template: `
    <div class="fc-wrapper" [class]="fieldClass">
      @if (displayLabel) {
        <label
          [attr.for]="controlName"
          class="fc-label"
        >
          {{ displayLabel }}
          @if (hasRequiredValidator) {
            <span class="fc-required">*</span>
          }
        </label>
      }

      <div class="relative">
        <input
          type="time"
          [id]="controlName"
          [value]="internalDisplayValue"
          (input)="onInput($event)"
          (blur)="onBlur()"
          (focus)="isFocused = true"
          [placeholder]="placeholder"
          autocomplete="off"
          class="fc-control"
          [class.fc-focused]="isFocused"
          [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
          [style.colorScheme]="'light'"
        />
      </div>

      @if (control.invalid && control.touched) {
        <p class="fc-error-text">
          @if (control.hasError('required')) { {{ displayLabel }} is required. }
          @if (control.hasError('pattern')) { Invalid time format. }
        </p>
      }
    </div>
  `,
})
export class CustomTimeComponent implements OnInit, OnDestroy, OnChanges {
  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() minLength: number = 0;
  @Input() format: '12h' | '24h' = '24h';
  @Input() theme: string = 'white';
  @Input() fieldClass: string = '';

  displayLabel: string = '';
  isFocused: boolean = false;
  internalDisplayValue: string = ''; // always HH:mm for the native input
  private destroy$ = new Subject<void>();
  private isSettingFromControl = false;

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.displayLabel = label;
    });

    this.updateInternalDisplayFromControlValue(this.control.value);

    this.control.valueChanges
      .pipe(takeUntil(this.destroy$), distinctUntilChanged())
      .subscribe(value => {
        if (!this.isSettingFromControl) {
          this.updateInternalDisplayFromControlValue(value);
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['control'] && !changes['control'].firstChange) {
      this.updateInternalDisplayFromControlValue(this.control.value);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onBlur(): void {
    this.isFocused = false;
    this.control.markAsTouched();
  }

  private updateInternalDisplayFromControlValue(value: any): void {
    if (!value) {
      this.internalDisplayValue = '';
      return;
    }
    this.internalDisplayValue = this.to24HourFormat(value);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const hhmm = input.value;

    this.internalDisplayValue = hhmm;

    let valueToEmit: string;
    if (this.format === '12h') {
      valueToEmit = this.to12HourFormat(hhmm);
    } else {
      valueToEmit = hhmm;
    }

    this.isSettingFromControl = true;
    this.control.setValue(valueToEmit, { emitEvent: true });
    this.control.markAsDirty();
    this.isSettingFromControl = false;
  }

  private to24HourFormat(time: string): string {
    if (!time) return '';
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      return time;
    }
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return '';
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const modifier = match[3].toUpperCase();
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  private to12HourFormat(time24: string): string {
    if (!time24) return '';
    const [hoursStr, minutes] = time24.split(':');
    let hours = parseInt(hoursStr, 10);
    const modifier = hours >= 12 ? 'PM' : 'AM';
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${minutes} ${modifier}`;
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }
}