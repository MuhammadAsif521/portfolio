import {
  Component,
  ElementRef,
  forwardRef,
  inject,
  input,
  Input,
  OnDestroy,
  AfterViewInit,
  signal,
  ViewChild,
  ChangeDetectorRef,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser,  } from '@angular/common';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Observable, of, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [ ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
  templateUrl: './custom-input-phone.html',
  styleUrl: './custom-input-phone.scss',
})
export class PhoneInputComponent implements ControlValueAccessor, Validator, AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('phoneInputRef', { static: true })
  phoneInputRef!: ElementRef<HTMLInputElement>;

  // ── signal inputs (keep existing API) ──────────────────────────────
  @Input() label$: Observable<string> = of('Phone Number');
  placeholder = input<string>('');
  required = input<boolean>(false);
  showError = input<boolean>(true);
  initialCountry = input<string>('us');
  preferredCountries = input<string[]>(['us']);
  onlyCountries = input<string[]>(['us']);

  // ── @Input for template / dynamic form usage (like checkbox) ───────
  @Input() controlName!: string;
  @Input() control!: FormControl;
  @Input() label$Input!: Observable<string>;   // alias to avoid conflict with signal input
  @Input() requiredInput: boolean = false;
  @Input() disableInput: boolean = false;
  @Input() showErrorInput: boolean = true;
  @Input() initialCountryInput: string = 'us';
  @Input() preferredCountriesInput: string[] = ['us'];
  @Input() onlyCountriesInput: string[] = ['us'];

  isFocused = signal(false);
  isDisabled = signal(false);

  resolvedLabel: string = '';
  private destroy$ = new Subject<void>();
  private _iti: any = null;
  private _utilsReady = false;
  private _pendingValue = '';
  private _destroyed = false;

  onChange = (_: string) => { };
  onTouched = () => { this.cdr.markForCheck(); };
  private onValidatorChange = () => { };

  // ── Resolved getters (prefer @Input over signal input) ─────────────
  get _required(): boolean { return this.requiredInput || this.required(); }
  get _showError(): boolean { return this.showErrorInput && this.showError(); }
  get _initialCountry(): string { return this.initialCountryInput || this.initialCountry(); }
  get _preferredCountries(): string[] { return this.preferredCountriesInput?.length ? this.preferredCountriesInput : this.preferredCountries(); }
  get _onlyCountries(): string[] { return this.onlyCountriesInput?.length ? this.onlyCountriesInput : this.onlyCountries(); }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator?.((c) => c.errors?.['required'] ? { required: true } : null) || false;
  }

  ngAfterViewInit(): void {
    this.label$.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.resolvedLabel = label;
      this.cdr.markForCheck();
    });

    // Sync external FormControl → ITI when control value changes externally
    if (this.control) {
      this.control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((val) => {
        if (this._iti && val !== this._iti.getNumber()) {
          this._iti.setNumber(val || '');
        }
      });
    }

    if (!isPlatformBrowser(this.platformId)) return;
    void this._initITI();
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    this._iti?.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async _initITI(): Promise<void> {
    const itiImport = await import('intl-tel-input');
    const intlTelInput = (itiImport as any).default ?? itiImport;

    const options: any = {
      initialCountry: this._initialCountry,
      separateDialCode: true,
      formatOnDisplay: true,
      nationalMode: false,
      autoPlaceholder: 'aggressive',
      placeholderNumberType: 'MOBILE',
      countrySearch: true,
      fixDropdownWidth: false,
      strictMode: false,
      loadUtils: () => import('intl-tel-input/utils'),
    };

    if (this._onlyCountries.length) options.onlyCountries = this._onlyCountries;
    if (this._preferredCountries.length) options.preferredCountries = this._preferredCountries;

    this._iti = intlTelInput(this.phoneInputRef.nativeElement, options);

    if (this._pendingValue) {
      this._iti.setNumber(this._pendingValue);
    }

    // Also set from @Input control initial value
    if (this.control?.value) {
      this._iti.setNumber(this.control.value);
    }

    this.phoneInputRef.nativeElement.addEventListener('input', () => {
      this._applyPhoneMask();
      void this._emitValue();
    });
    this.phoneInputRef.nativeElement.addEventListener('countrychange', () => {
      void this._emitValue();
      this.cdr.markForCheck();
    });

    await this._iti.promise;
    if (this._destroyed) return;

    this._utilsReady = true;
    this.onValidatorChange();
    await this._emitValue();
    this.cdr.markForCheck();
  }

  // intl-tel-input's as-you-type formatter only inserts separators (and enforces length)
  // when the digits match a known number-plan template, so garbage input (e.g. all zeros)
  // is left as a plain, unbounded digit string. This always re-applies the separator layout
  // from the current example-number placeholder positionally, and hard-caps the digit count
  // to that placeholder's digit slots (e.g. 10 for US), regardless of whether the typed
  // digits form a plausible number.
  private _applyPhoneMask(): void {
    if (!this._iti || !this._utilsReady) return;

    const inputEl = this.phoneInputRef.nativeElement;
    const placeholder = inputEl.placeholder;
    if (!placeholder || !/[^0-9]/.test(placeholder)) return;

    const maxDigits = (placeholder.match(/\d/g) || []).length;
    const caretPos = inputEl.selectionStart ?? inputEl.value.length;
    const digitsBeforeCaret = inputEl.value.slice(0, caretPos).replace(/\D/g, '').length;
    const digits = inputEl.value.replace(/\D/g, '').slice(0, maxDigits);

    let masked = '';
    let digitIndex = 0;
    let caretInMasked = 0;
    for (const ch of placeholder) {
      if (digitIndex >= digits.length) break;
      if (/\d/.test(ch)) {
        masked += digits[digitIndex];
        digitIndex++;
      } else {
        masked += ch;
      }
      if (digitIndex === digitsBeforeCaret) caretInMasked = masked.length;
    }
    if (digitsBeforeCaret >= digits.length) caretInMasked = masked.length;

    if (masked === inputEl.value) return;

    inputEl.value = masked;
    inputEl.setSelectionRange(caretInMasked, caretInMasked);
  }

  private async _emitValue(): Promise<void> {
    if (!this._iti) return;

    if (!this._utilsReady) {
      const raw = this.phoneInputRef.nativeElement.value || '';
      this.onChange(raw);
      this.control?.setValue(raw, { emitEvent: false });
      return;
    }

    const rawValue = this.phoneInputRef.nativeElement.value.trim();
    if (!rawValue) {
      this.onChange('');
      this.control?.setValue('', { emitEvent: false });
      return;
    }

    const e164 = this._iti.getNumber();
    this.onChange(e164 || '');
    // Sync to @Input FormControl directly
    if (this.control && this.control.value !== e164) {
      this.control.setValue(e164 || '', { emitEvent: false });
      this.control.markAsDirty();
    }
    this.onValidatorChange();
    this.cdr.markForCheck();
  }

  // ── CVA ────────────────────────────────────────────────────────────
  writeValue(value: string): void {
    this._pendingValue = value || '';
    if (this._iti) this._iti.setNumber(this._pendingValue);
  }

  registerOnChange(fn: any): void { this.onChange = fn; }

  registerOnTouched(fn: any): void {
    this.onTouched = () => { fn(); this.cdr.markForCheck(); };
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (this._iti?.setDisabled) this._iti.setDisabled(isDisabled);
    this.cdr.markForCheck();
  }

  // ── Validator ──────────────────────────────────────────────────────
  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._iti) return null;

    const rawValue = this.phoneInputRef.nativeElement.value.trim();

    if (!rawValue) {
      if (this._required || control.hasValidator?.(Validators.required)) {
        return { required: true };
      }

      return null;
    }

    if (!this._utilsReady) return null;

    return this._iti.isValidNumber()
      ? null
      : { phoneInvalid: true };
  }

  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }

  hasError(): boolean {
    if (this.control) {
      return this.control.invalid && this.control.touched;
    }
    return false;
  }

  errorMessage(): string {
    if (this.control?.errors?.['required']) return `${this.resolvedLabel || 'Phone'} is required`;
    if (!this._iti || !this._utilsReady) return '';

    const code = this._iti.getValidationError?.();
    const messages: Record<number, string> = {
      1: 'Invalid country code',
      2: 'Number too short',
      3: 'Number too long',
      4: 'Not a valid number',
    };
    return messages[code] ?? 'Invalid phone number';
  }
}