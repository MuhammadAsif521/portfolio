import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {  } from '@angular/common';
import { IconComponent } from "@shared/components/icon-component/icon-component";

@Component({
  selector: 'app-custom-reactive-checkbox',
  imports: [ FormsModule, ReactiveFormsModule, IconComponent],
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
            [class.fc-row-option-active]="isChecked(option.id)"
          >
            <!-- Custom checkbox box -->
            <span class="fc-check" [class.fc-check-active]="isChecked(option.id)">
              @if (isChecked(option.id)) {
              <i-lucide name="check" color="on-primary" [size]="15"/>
              }
            </span>

            <input
              type="checkbox"
              class="sr-only"
              [checked]="isChecked(option.id)"
              (change)="onCheckboxChange($any($event.target).checked, option.id)"
            />

            <span class="text-[13px] font-medium" style="color: var(--form-control-text)">
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
export class CustomReactiveCheckboxComponent implements OnInit, OnDestroy {
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
    if (!this.control.value) {
      this.control.setValue([]);
    }
  }

  isChecked(id: any): boolean {
    const value = this.control.value || [];
    return value.includes(id);
  }

  onCheckboxChange(checked: boolean, id: any): void {
    const currentValue = this.control.value || [];
    if (checked) {
      this.control.setValue([...currentValue, id]);
    } else {
      this.control.setValue(currentValue.filter((v: any) => v !== id));
    }
    this.control.markAsTouched();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
