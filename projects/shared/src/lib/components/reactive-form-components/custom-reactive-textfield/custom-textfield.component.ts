import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Renderer2 } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-custom-reactive-textfield',
  imports: [ReactiveFormsModule],
  template: `
    <div class="fc-wrapper">
      @if (showLabel && label) {
        <label [for]="controlName" class="fc-label">
          {{ label }}
          @if (hasRequiredValidator) { <span class="fc-required">*</span> }
        </label>
      }

      <input
        #inputElement
        [type]="type"
        [formControl]="control"
        [id]="controlName"
        [placeholder]="placeholder"
        [attr.min]="min ?? null"
        [attr.max]="max ?? null"
        [attr.maxlength]="maxLength ?? null"
        [attr.autocomplete]="autocomplete"
        [attr.inputmode]="inputMode ?? null"
        [attr.aria-label]="showLabel ? null : ariaLabel || label || null"
        [attr.aria-required]="hasRequiredValidator || null"
        [attr.aria-invalid]="showError || null"
        [attr.aria-describedby]="showError ? controlName + '-error' : null"
        (focus)="onFocus()"
        (blur)="onBlur()"
        class="fc-control"
        [class.fc-focused]="isFocused"
        [class.fc-invalid]="control.invalid && (control.dirty || control.touched)" />

      @if (showError) {
        <p class="fc-error-text" [id]="controlName + '-error'">
          @if (control.hasError('required')) { {{ label }} is required. }
          @if (control.hasError('minlength')) { Too short. }
          @if (control.hasError('maxlength')) { Too long. }
          @if (control.hasError('email')) { Invalid email address. }
          @if (control.hasError('pattern')) { Invalid format. }
        </p>
      }
    </div>
  `,
})
export class CustomReactiveTextfieldComponent implements OnInit, OnDestroy {
  @Input() controlName!: string;
  @Input() type: string = '';
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() minLength!: number;
  @Input() maxLength!: number;
  @Input() value: string = '';
  @Input() pattern: string | any = '';
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;
  @Input() min!: string | number;
  @Input() max!: string | number;
  /** Browser autofill hint, e.g. "email" or "name" (off by default). */
  @Input() autocomplete = 'off';
  @Input() inputMode?: string;
  /** Accessible name when the visible label is hidden (showLabel = false). */
  @Input() ariaLabel?: string;

  label: string = '';
  isFocused: boolean = false;
  private destroy$ = new Subject<void>();
  renderer = inject(Renderer2);
  @ViewChild('inputElement') inputElement!: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });
    if (this.value) {
      this.control.patchValue(this.value);
    }
  }

  focus(): void {
    if (this.inputElement) {
      setTimeout(() => {
        this.renderer.selectRootElement(this.inputElement.nativeElement).focus();
      }, 0);
    }
  }
  onFocus(): void {
    this.isFocused = true;
  }

  onBlur(): void {
    this.isFocused = false;
    this.control.markAsTouched();
  }
  get showError(): boolean {
    return this.showHints && this.control.invalid && (this.control.dirty || this.control.touched);
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
