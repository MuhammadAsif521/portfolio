import {
    Component,
    Input,
    OnInit,
    OnDestroy,
    Output,
    EventEmitter,
    ElementRef,
    ViewChildren,
    QueryList,
    inject,
} from '@angular/core';
import { FormControl, FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Renderer2 } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-custom-input-otp',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
    <div class="mb-2 md:mb-6 font-body w-full">

      @if (showLabel && label) {
        <label
          class="mb-1.5 block text-[0.875rem] font-[600] uppercase text-muted" 
        >
          {{ label }}
          @if (required) {
            <span class="ml-0.5" style="color: var(--error)">*</span>
          }
        </label>
      }

      <div class="flex gap-2 md:gap-3">
        @for (ctrl of otpControls; track $index) {
          <input
            #otpInput
            type="text"
            inputmode="numeric"
            maxlength="1"
            [formControl]="ctrl"
            [id]="controlName + '_' + $index"
            autocomplete="off"
            (focus)="onFocus($index)"
            (blur)="onBlur($index)"
            (input)="onInput($event, $index)"
            (keydown)="onKeydown($event, $index)"
            (paste)="onPaste($event)"
            class="w-12 h-12 rounded-xl border text-center text-[15px] font-semibold outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            [style.background]="focusedIndex === $index ? 'var(--form-control-bg-active)' : 'var(--form-control-bg)'"
            [style.borderColor]="
              (ctrl.invalid && (ctrl.dirty || ctrl.touched))
                ? 'var(--error)'
                : (focusedIndex === $index ? 'var(--form-control-border-active)' : 'var(--form-control-border)')
            "
            [style.boxShadow]="focusedIndex === $index ? 'var(--form-focus-shadow)' : 'none'"
            [style.color]="'var(--form-control-text)'"
          />
        }
      </div>

      @if (showHints && isInvalid()) {
        <p class="mt-1.5 text-xs" style="color: var(--error)">
          @if (otpLength === 0) { OTP is required. }
          @else if (currentValue().length < length) { Please enter all {{ length }} digits. }
        </p>
      }

    </div>
  `,
})
export class CustomInputOtpComponent implements OnInit, OnDestroy {
    @Input() controlName!: string;
    @Input() length: number = 6;
    @Input() type: string = '';
    @Input() control!: FormControl;
    @Input() label$!: Observable<string>;
    @Input() required: boolean = false;
    @Input() showLabel: boolean = true;
    @Input() showHints: boolean = true;

    @Output() completed = new EventEmitter<string>();

    @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

    label: string = '';
    focusedIndex: number = -1;
    otpControls: FormControl[] = [];

    private destroy$ = new Subject<void>();
    private renderer = inject(Renderer2);
    private fb = inject(FormBuilder);

    // ─── Lifecycle ──────────────────────────────────────────────────────────────

    ngOnInit(): void {
        // Build individual digit controls
        this.otpControls = Array.from({ length: this.length }, () => new FormControl(''));

        // Label observable (same as textfield pattern)
        if (this.label$) {
            this.label$.pipe(takeUntil(this.destroy$)).subscribe((l) => (this.label = l));
        }

        // Seed from parent control value if pre-filled
        if (this.control?.value) {
            this.patchFromString(this.control.value);
        }

        // Sync individual cells → master control
        this.otpControls.forEach((ctrl) => {
            ctrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.syncToMaster());
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ─── Focus helpers ──────────────────────────────────────────────────────────

    onFocus(index: number): void {
        this.focusedIndex = index;
    }

    onBlur(index: number): void {
        this.focusedIndex = -1;
        this.otpControls[index].markAsTouched();
        this.control?.markAsTouched();
    }

    focusCell(index: number): void {
        const inputs = this.otpInputs.toArray();
        if (inputs[index]) {
            setTimeout(() => inputs[index].nativeElement.focus(), 0);
        }
    }

    // ─── Input handling ─────────────────────────────────────────────────────────

    onInput(event: Event, index: number): void {
        const input = event.target as HTMLInputElement;
        const val = input.value.replace(/\D/g, '').slice(-1); // digits only, last char

        this.otpControls[index].setValue(val, { emitEvent: true });
        input.value = val;

        if (val && index < this.length - 1) {
            this.focusCell(index + 1);
        }

        this.checkCompleted();
    }

    onKeydown(event: KeyboardEvent, index: number): void {
        if (event.key === 'Backspace') {
            if (!this.otpControls[index].value && index > 0) {
                this.otpControls[index - 1].setValue('');
                this.focusCell(index - 1);
            } else {
                this.otpControls[index].setValue('');
            }
        } else if (event.key === 'ArrowLeft' && index > 0) {
            this.focusCell(index - 1);
        } else if (event.key === 'ArrowRight' && index < this.length - 1) {
            this.focusCell(index + 1);
        }
    }

    onPaste(event: ClipboardEvent): void {
        event.preventDefault();
        const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, this.length) ?? '';
        this.patchFromString(pasted);
        this.syncToMaster();
        // Focus last filled or next empty
        const nextIndex = Math.min(pasted.length, this.length - 1);
        this.focusCell(nextIndex);
        this.checkCompleted();
    }

    // ─── Utility ────────────────────────────────────────────────────────────────

    private patchFromString(value: string): void {
        const digits = value.replace(/\D/g, '').split('');
        this.otpControls.forEach((ctrl, i) => {
            ctrl.setValue(digits[i] ?? '', { emitEvent: false });
        });
    }

    private syncToMaster(): void {
        const combined = this.currentValue();
        this.control?.setValue(combined, { emitEvent: true });
    }

    currentValue(): string {
        return this.otpControls.map((c) => c.value ?? '').join('');
    }

    get otpLength(): number {
        return this.currentValue().length;
    }

    isInvalid(): boolean {
        const allTouched = this.otpControls.every((c) => c.touched);
        return allTouched && this.currentValue().length < this.length;
    }

    private checkCompleted(): void {
        const val = this.currentValue();
        if (val.length === this.length) {
            this.completed.emit(val);
        }
    }

    // Public focus method (same as textfield)
    focus(): void {
        this.focusCell(0);
    }
}