import {
  Component, Input, Output, EventEmitter, forwardRef,
  OnChanges, SimpleChanges, HostListener, OnDestroy, OnInit,
  ElementRef, ViewChild, NgZone, inject, ChangeDetectorRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import {  } from '@angular/common';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { DropdownCoordinatorService } from '@shared/services/dropdown-coordinator.service';
import { Subject, takeUntil } from 'rxjs';

let plainDropdownUid = 0;

@Component({
  selector: 'app-custom-dropdown',
  standalone: true,
  imports: [ FormsModule, IconComponent],
  template: `
   <div [class]="'relative w-full ' + (showLabel ? 'fc-wrapper' : 'font-body')">

    @if (label && showLabel) {
    <label [attr.for]="controlName" class="fc-label">{{ label }}</label>
    }

    <!-- Trigger -->
    <button #triggerBtn type="button" (click)="toggleDropdown($event)" [disabled]="disable"
        class="fc-control"
        [class.fc-compact]="size === 'compact'"
        [class.fc-open]="isOpen"
        [class.fc-invalid]="hasError"
        [class.fc-disabled]="disable"
        [attr.aria-expanded]="isOpen">

        <span class="truncate flex-1 text-left">
            @if (selectedOption) {
            <span>{{ selectedOption.name }}</span>
            } @else {
            <span style="color: var(--form-control-placeholder)">
                {{ value || placeholder || 'Select an option' }}
            </span>
            }
        </span>
        <i-lucide name="chevron-down" [size]="16" class="fc-chevron" [class.fc-chevron-open]="isOpen"></i-lucide>
    </button>

    <!-- Portal panel -->
    @if (isOpen && !disable) {
    <div #panelRef class="fc-panel"
        [style.top.px]="panelTop" [style.left.px]="panelLeft"
        [style.width.px]="panelWidth" [style.maxHeight.px]="240"
        style="overflow-y: auto;">

        @if (options.length === 0) {
        <div class="fc-empty">No options available</div>
        }

        @for (option of options; track option.value) {
        <div (click)="selectOption(option, $event)"
            class="fc-option"
            [class.fc-option-selected]="selectedOption?.value === option.value">
            <span>{{ option.name }}</span>
        </div>
        }
    </div>
    }

</div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDropdownComponent),
      multi: true
    }
  ]
})
export class CustomDropdownComponent implements ControlValueAccessor, OnChanges, OnInit, OnDestroy {
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private coordinator = inject(DropdownCoordinatorService);

  @Input() controlName!: string;
  @Input() placeholder: string = '';
  @Input() label: string = '';
  @Input() showLabel: boolean = true;
  @Input() value: any = null;
  @Input() options: { name: any; value: any }[] = [];
  @Input() disable: boolean = false;
  @Input() fieldClass: string = '';
  @Input() theme: string = 'white';
  @Input() class: string = '';
  @Input() hasError: boolean = false;
  @Input() size: 'default' | 'compact' = 'default';
  @Output() valueChange = new EventEmitter<any>();
  /** Primary output — this is what the app's templates bind to, e.g. (changedOuput)="handleSortValues($event)" */
  @Output() changedOuput = new EventEmitter<any>();

  @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('panelRef') panelRef?: ElementRef<HTMLDivElement>;

  private instanceId = `plain-dropdown-${++plainDropdownUid}`;
  private destroy$ = new Subject<void>();

  isOpen = false;
  hoveredOption: any = null;
  selectedOption: { name: any; value: any } | null = null;

  panelTop = 0;
  panelLeft = 0;
  panelWidth = 0;

  private scrollListener = () => this.updatePanelPosition();
  private resizeListener = () => this.updatePanelPosition();

  private onChangeFn: (val: any) => void = () => {};
  private onTouchedFn: () => void = () => {};

  ngOnInit(): void {
    this.coordinator.closeRequested$.pipe(takeUntil(this.destroy$)).subscribe(activeId => {
      if (activeId !== this.instanceId && this.isOpen) {
        this.close();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['options']) {
      this.selectedOption = this.options.find(o => o.value === this.value) || null;
    }
  }

  writeValue(value: any): void {
    this.value = value;
    this.selectedOption = this.options.find(o => o.value === value) || null;
  }

  registerOnChange(fn: any): void { this.onChangeFn = fn; }
  registerOnTouched(fn: any): void { this.onTouchedFn = fn; }
  setDisabledState(isDisabled: boolean): void { this.disable = isDisabled; }

  selectOption(option: { name: any; value: any }, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedOption = option;
    this.value = option.value;
    this.onChangeFn(option.value);
    this.onTouchedFn();
    this.valueChange.emit(option.value);
    this.changedOuput.emit(option.value);
    this.close();
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disable) return;

    if (this.isOpen) {
      this.close();
      return;
    }

    this.coordinator.open(this.instanceId);
    this.updatePanelPosition();
    this.isOpen = true;
    this.onTouchedFn();

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.scrollListener, true);
      window.addEventListener('resize', this.resizeListener);
    });
  }

  private updatePanelPosition(): void {
    if (!this.triggerBtn) return;
    this.ngZone.run(() => {
      const rect = this.triggerBtn.nativeElement.getBoundingClientRect();
      const panelH = Math.min(240, (this.options.length * 45) || 60);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const gap = 6;

      this.panelTop = spaceBelow >= panelH || spaceBelow >= spaceAbove
        ? rect.bottom + gap
        : rect.top - panelH - gap;

      this.panelLeft = rect.left;
      this.panelWidth = rect.width;
      this.cdr.markForCheck();
    });
  }

  private close(): void {
    this.isOpen = false;
    this.hoveredOption = null;
    this.coordinator.close(this.instanceId);
    window.removeEventListener('scroll', this.scrollListener, true);
    window.removeEventListener('resize', this.resizeListener);
  }

  @HostListener('document:click')
  onDocumentClick(): void { if (this.isOpen) this.close(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.isOpen) this.close(); }

  ngOnDestroy(): void {
    this.close();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
