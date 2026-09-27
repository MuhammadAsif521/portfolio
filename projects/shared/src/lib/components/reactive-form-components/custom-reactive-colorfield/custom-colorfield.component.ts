import {  } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { IconComponent } from "@shared/components/icon-component/icon-component";
import { DropdownCoordinatorService } from '@shared/services/dropdown-coordinator.service';

let colorfieldUid = 0;

@Component({
  selector: 'app-custom-reactive-colorfield',
  imports: [ FormsModule, ReactiveFormsModule, IconComponent],
  template: `
    <div class="relative fc-wrapper" (click)="$event.stopPropagation()">
      @if (label && showLabel) {
        <label [attr.for]="controlName" class="fc-label">
          {{ label }}
          @if (hasRequiredValidator) { <span class="fc-required">*</span> }
        </label>
      }

      <!-- Trigger row -->
      <button
        type="button"
        (click)="togglePicker()"
        class="fc-control"
        [class.fc-open]="showPicker"
        [class.fc-invalid]="control.invalid && (control.dirty || control.touched) && !showPicker"
      >
        <!-- Color swatch preview -->
        <span class="fc-swatch" [style.background]="control.value || defaultColor"></span>

        <span class="flex-1 text-left font-mono text-[13px]"
              [style.color]="control.value ? 'var(--form-control-text)' : 'var(--text-muted)'">
          {{ control.value || placeholder || 'Pick a color' }}
        </span>

        <i-lucide name="palette" color="gray" [size]="18"/>
      </button>

      <!-- Color picker panel -->
      @if (showPicker) {
        <div class="fc-panel-inline w-64">

          <!-- Native color input -->
          <div class="mb-3">
            <label class="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em]" style="color: var(--text-muted)">
              Custom Color
            </label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                [value]="control.value || defaultColor"
                (input)="onNativeColorChange($event)"
                class="h-10 w-10 cursor-pointer rounded-lg border bg-transparent p-0.5"
                style="border-color: var(--form-control-border)"
              />
              <input
                type="text"
                [value]="control.value || ''"
                (input)="onHexInput($event)"
                (blur)="onHexBlur($event)"
                placeholder="#FD853A"
                maxlength="7"
                class="fc-control flex-1 font-mono"
              />
            </div>
          </div>

          <!-- Preset swatches -->
          <div>
            <label class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em]" style="color: var(--text-muted)">
              Presets
            </label>
            <div class="grid grid-cols-6 gap-1.5">
              @for (color of presetColors; track color) {
                <button
                  type="button"
                  (click)="selectPreset(color)"
                  class="w-8 h-8 rounded-lg border-2 transition-all duration-150 hover:scale-110"
                  [style.background]="color"
                  [style.borderColor]="control.value === color ? 'var(--primary)' : 'transparent'"
                  [title]="color"
                ></button>
              }
            </div>
          </div>

          <!-- Done button -->
          <button
            type="button"
            (click)="showPicker = false"
            class="fc-panel-action mt-3"
          >
            Done
          </button>
        </div>
      }

      @if (showHints && control.invalid && (control.dirty || control.touched) && control.hasError('required')) {
        <p class="fc-error-text">{{ label }} is required.</p>
      }
    </div>
  `,
})
export class CustomReactiveColorfieldComponent implements OnInit, OnDestroy {
  private coordinator = inject(DropdownCoordinatorService);
  private instanceId = `colorfield-${++colorfieldUid}`;

  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;

  label = '';
  showPicker = false;
  defaultColor = '#FD853A';

  presetColors = [
    '#FD853A', '#FEB173', '#FB6514', '#141414',
    '#1D2939', '#344054', '#12B76A', '#2E90FA',
    '#7A5AF8', '#F04438', '#F2F4F7', '#FFFFFF',
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe((label) => {
      this.label = label;
    });

    // Close this picker whenever another dropdown/picker on the page opens
    this.coordinator.closeRequested$.pipe(takeUntil(this.destroy$)).subscribe(activeId => {
      if (activeId !== this.instanceId && this.showPicker) {
        this.showPicker = false;
      }
    });

    if (typeof window !== 'undefined') {
      const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
      if (themeColor) {
        // stored as RGB channels e.g. "26 43 30" — convert to hex for the native color input
        const parts = themeColor.split(' ').map(Number);
        if (parts.length === 3 && parts.every(n => !isNaN(n))) {
          this.defaultColor = '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
        }
      }
    }
  }

  togglePicker(): void {
    this.showPicker = !this.showPicker;
    if (this.showPicker) {
      this.coordinator.open(this.instanceId);
    } else {
      this.coordinator.close(this.instanceId);
    }
  }

  onNativeColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.control.patchValue(input.value);
    this.control.markAsTouched();
  }

  onHexInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      this.control.patchValue(val);
    }
  }

  onHexBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      this.control.patchValue(val);
    } else if (this.control.value) {
      (event.target as HTMLInputElement).value = this.control.value;
    }
  }

  selectPreset(color: string): void {
    this.control.patchValue(color);
    this.control.markAsTouched();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('app-custom-reactive-colorfield')) {
      this.showPicker = false;
      this.coordinator.close(this.instanceId);
    }
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

  ngOnDestroy(): void {
    this.coordinator.close(this.instanceId);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
