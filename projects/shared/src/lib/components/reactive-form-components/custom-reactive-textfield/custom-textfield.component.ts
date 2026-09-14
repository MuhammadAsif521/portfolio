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
        [min]="minLength"
        [max]="maxLength"
        autocomplete="off"
        (focus)="onFocus()"
        (blur)="onBlur()"
        class="fc-control"
        [class.fc-focused]="isFocused"
        [class.fc-invalid]="control.invalid && (control.dirty || control.touched)" />

      @if (showHints && control.invalid && (control.dirty || control.touched)) {
        <p class="fc-error-text">
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
  @Input() pattern: string = '';
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;
  @Input() min!: string | number;
  @Input() max!: string | number;

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
  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
