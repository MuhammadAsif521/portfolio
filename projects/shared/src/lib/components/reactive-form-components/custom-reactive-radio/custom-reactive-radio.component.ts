import {  } from '@angular/common';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-custom-reactive-radio',
  imports: [ FormsModule, ReactiveFormsModule],
  template: `
    <div class="fc-wrapper">
      @if (label) {
        <label [attr.for]="controlName" class="fc-label">
          {{ label }}
        </label>
      }

      <div class="fc-row-group" [class.fc-invalid]="control.invalid && (control.dirty || control.touched)">
        @for (option of options; track option.id) {
          <label
            class="fc-row-option"
            [class.fc-row-option-active]="control.value === option.id"
          >
            <!-- Custom radio circle -->
            <span class="fc-radio" [class.fc-radio-active]="control.value === option.id">
              @if (control.value === option.id) {
                <span class="fc-radio-dot"></span>
              }
            </span>

            <input
              type="radio"
              [formControl]="control"
              [value]="option.id"
              class="sr-only"
            />

            <span class="text-[13px] font-medium" style="color: rgb(var(--form-control-text))">
              {{ option.name }}
            </span>
          </label>
        }
      </div>

      @if (control?.invalid && control?.touched && control?.errors?.['required']) {
        <p class="fc-error-text">{{ label }} is required.</p>
      }
    </div>
  `,
})
export class CustomReactiveRadioComponent implements OnInit, OnDestroy {
  @Input() controlName!: string;
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() options: { name: string; id: any }[] = [];
  @Input() required: boolean = false;
  @Input() disable: boolean = false;

  label: string = '';
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    if (this.disable) {
      this.control.disable();
    }
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
