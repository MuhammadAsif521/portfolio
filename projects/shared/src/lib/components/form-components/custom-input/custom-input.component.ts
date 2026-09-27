import { NgClass } from '@angular/common';
import { Component, Input, EventEmitter, Output, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-custom-input',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div [ngClass]="containerClass" class="font-body">
      @if (label && showLabel) {
        <label [attr.for]="controlName"
            class="mb-1.5 block text-[0.875rem] font-[600] uppercase text-muted" >
          {{ label }}
        </label>
      }

      <div class="relative">
        <input
          [type]="type || 'text'"
          [id]="controlName"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [attr.minlength]="minLength || null"
          [attr.maxlength]="maxLength || null"
          autocomplete="off"
          [(ngModel)]="value"
          (ngModelChange)="handleChange($event)"
          (focus)="isFocused = true"
          (blur)="isFocused = false"
          class="w-full rounded-xl border px-4 py-3.5 text-[13px] font-medium outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          [style.background]="isFocused ? 'var(--form-control-bg-active)' : 'var(--form-control-bg)'"
          [style.borderColor]="isFocused ? 'var(--form-control-border-active)' : 'var(--form-control-border)'"
          [style.boxShadow]="isFocused ? 'var(--form-focus-shadow)' : 'none'"
          [style.color]="'var(--form-control-text)'"
          [class]="
            'w-full rounded-xl border px-4 py-3.5 text-[13px] font-medium outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ' +
            fieldClass
          "
        />
      </div>
    </div>
  `,
})
export class CustomInputComponent implements OnChanges {
  @Input() controlName!: string;
  @Input() type: string = 'text';
  @Input() placeholder: string = '';
  @Input() label: string = '';
  @Input() showLabel: boolean = true;
  @Input() minLength!: number;
  @Input() value: string = '';
  @Input() maxLength!: number;
  @Input() suggestions: any = null;
  @Input() disabled: boolean = false;
  @Input() class: string = '';
  @Input() theme: string = 'white';
  @Input() fieldClass: string = '';
  @Output() onChange: EventEmitter<string> = new EventEmitter<string>();

  containerClass: any = {};
  isFocused: boolean = false;

  handleChange(e: any) {
    this.onChange.emit(e);
  }

  ngOnChanges(): void {
    this.containerClass = {
      [this.fieldClass]: !!this.fieldClass,
    };
  }
}
