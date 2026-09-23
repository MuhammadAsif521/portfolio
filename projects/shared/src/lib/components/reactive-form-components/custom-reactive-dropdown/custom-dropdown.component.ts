import {
  Component, EventEmitter, HostListener, Input, OnDestroy, OnInit,
  Output, ElementRef, ViewChild, NgZone, OnChanges, DoCheck,
  ChangeDetectorRef, inject
} from '@angular/core';
import {  } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { DropdownCoordinatorService } from '@shared/services/dropdown-coordinator.service';

export interface DropdownOption { name: string; id: any; }
export interface DropdownGroup {
  name: string;
  disabled?: boolean;
  options: DropdownOption[];
}

let dropdownUid = 0;

@Component({
  selector: 'app-custom-reactive-dropdown',
  standalone: true,
  imports: [ ReactiveFormsModule, IconComponent],
  template: `
    <div [class]="'relative w-full ' + (showLabel ? 'fc-wrapper' : 'font-body')">

      @if (label && showLabel) {
        <label [attr.for]="controlName" class="fc-label">
          {{ label }}
          @if (hasRequiredValidator) {
            <span class="fc-required">*</span>
          }
        </label>
      }

      <!-- Trigger Button -->
      <button #triggerBtn type="button"
        (click)="toggleDropdown($event)"
        [disabled]="disable"
        class="fc-control"
        [class.fc-compact]="size === 'compact'"
        [class.fc-open]="isOpen"
        [class.fc-invalid]="control.invalid && (control.dirty || control.touched)"
        [class.fc-disabled]="disable"
        [attr.aria-expanded]="isOpen">

        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          @if (multiple && selectedOptions.length) {
            <span class="fc-chip-summary">{{ selectedOptions.length }} selected</span>
          } @else if (!multiple && singleSelectedOption) {
            <span class="truncate text-[13px] font-medium">{{ singleSelectedOption.name }}</span>
          } @else {
            <span class="truncate text-[13px] font-medium" style="color: rgb(var(--form-control-placeholder))">
              {{ placeholder }}
            </span>
          }
        </div>

        <i-lucide name="chevron-down" [size]="16" class="fc-chevron" [class.fc-chevron-open]="isOpen" />
      </button>

      <!-- Portal Panel -->
      @if (isOpen && !disable) {
        <div #panelRef
          class="fc-panel"
          [style.top.px]="panelTop"
          [style.left.px]="panelLeft"
          [style.width.px]="panelWidth">

          @if (showSearch) {
          <div class="fc-panel-search">
            <div class="flex items-center gap-2 rounded-lg w-full">
              @if (multiple) {
              <button type="button"
                (click)="toggleSelectAll(); $event.stopPropagation()"
                class="fc-check"
                [class.fc-check-active]="allSelected || someSelected">
                @if (allSelected || someSelected) {
                  <i-lucide name="check" [size]="10" />
                }
              </button>
              }
              <div class="fc-search-box">
                <i-lucide name="search" [size]="14" />
                <input
                  type="text"
                  [formControl]="searchControl"
                  placeholder="Search..."
                  autocomplete="off"
                  (click)="$event.stopPropagation()" />
                @if (searchControl.value) {
                  <button type="button" (click)="searchControl.setValue(''); $event.stopPropagation()">
                    <i-lucide name="x" [size]="13" />
                  </button>
                }
              </div>
            </div>
          </div>
          }

          <!-- Options List -->
          <div class="overflow-y-auto" [style.maxHeight.px]="200">

            @if (optionGroups?.length) {
              @if (!filteredGroups.length) {
                <div class="fc-empty">No results found</div>
              }
              @for (group of filteredGroups; track group.name) {
                <div [class.opacity-60]="group.disabled">
                  <div class="fc-group-label">{{ group.name }}</div>
                  @for (item of group.options; track item.id) {
                    <div
                      (click)="toggleSelection(item.id, group.disabled, $event)"
                      class="fc-option"
                      [class.fc-option-selected]="!multiple && isSelected(item.id)"
                      [class.fc-option-selected-multi]="multiple && isSelected(item.id)">
                      <div class="flex items-center gap-3">
                        @if (multiple) {
                          <span class="fc-check" [class.fc-check-active]="isSelected(item.id)">
                            @if (isSelected(item.id)) { <i-lucide name="check" [size]="10" /> }
                          </span>
                        }
                        <span>{{ item.name }}</span>
                      </div>
                      @if (!multiple && isSelected(item.id)) {
                        <i-lucide name="check" [size]="15" />
                      }
                    </div>
                  }
                </div>
              }
            } @else {
              @if (!filteredOptions.length) {
                <div class="fc-empty">{{ options.length ? 'No results found' : 'No options available' }}</div>
              }
              @for (item of filteredOptions; track item.id) {
                <div
                  (click)="toggleSelection(item.id, false, $event)"
                  class="fc-option"
                  [class.fc-option-selected]="!multiple && isSelected(item.id)"
                  [class.fc-option-selected-multi]="multiple && isSelected(item.id)">
                  <div class="flex items-center gap-3">
                    @if (multiple) {
                      <span class="fc-check" [class.fc-check-active]="isSelected(item.id)">
                        @if (isSelected(item.id)) { <i-lucide name="check" [size]="12" /> }
                      </span>
                    }
                    <span>{{ item.name }}</span>
                  </div>
                  @if (!multiple && isSelected(item.id)) {
                    <i-lucide name="check" [size]="15" />
                  }
                </div>
              }
            }

          </div>
        </div>
      }

      @if (showHints && control.invalid && (control.dirty || control.touched) && control.hasError('required')) {
        <p class="fc-error-text">{{ label }} is required.</p>
      }
    </div>
  `,
})
export class CustomReactiveDropdownComponent implements OnInit, OnDestroy, OnChanges, DoCheck {
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private coordinator = inject(DropdownCoordinatorService);

  @Input() controlName!: string;
  @Input() placeholder: string = 'Select option';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() options: DropdownOption[] = [];
  @Input() optionGroups: DropdownGroup[] = [];
  @Input() disable: boolean = false;
  @Input() multiple: boolean = false;
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;
  @Input() showSearch: boolean | undefined = false;
  @Input() size: 'default' | 'compact' = 'default';
  @Output() onChange = new EventEmitter<any>();

  @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLButtonElement>;

  private instanceId = `reactive-dropdown-${++dropdownUid}`;

  label = '';
  isOpen = false;
  hoveredOptionId: any = null;
  selectedValues: any[] = [];

  searchControl = new FormControl('');
  filteredOptions: DropdownOption[] = [];
  filteredGroups: DropdownGroup[] = [];

  panelTop = 0;
  panelLeft = 0;
  panelWidth = 0;

  private destroy$ = new Subject<void>();
  private scrollListener = () => this.updatePanelPosition();
  private resizeListener = () => this.updatePanelPosition();
  private lastSeenValue: any;

  ngOnInit(): void {
    if (this.disable) this.control.disable();

    this.label$?.pipe(takeUntil(this.destroy$)).subscribe(label => this.label = label);

    this.updateSelectedFromControl();
    this.lastSeenValue = this.control.value;
    this.control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateSelectedFromControl();
    });

    this.searchControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => {
      this.updateFilteredOptions(val || '');
    });

    this.updateFilteredOptions('');

    // Close this dropdown whenever another dropdown/picker on the page opens
    this.coordinator.closeRequested$.pipe(takeUntil(this.destroy$)).subscribe(activeId => {
      if (activeId !== this.instanceId && this.isOpen) {
        this.close();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnChanges(): void {
    this.updateSelectedFromControl();
    this.updateFilteredOptions(this.searchControl.value || '');
  }

  // Catches control.setValue(x, { emitEvent: false }) calls from parents,
  // which intentionally suppress valueChanges (e.g. to avoid feedback loops)
  // but would otherwise leave this dropdown's displayed label stale.
  ngDoCheck(): void {
    if (this.control && this.control.value !== this.lastSeenValue) {
      this.lastSeenValue = this.control.value;
      this.updateSelectedFromControl();
    }
  }

  private updateSelectedFromControl(): void {
    const val = this.control.value;
    if (this.multiple) {
      this.selectedValues = Array.isArray(val) ? val : (val ? [val] : []);
    } else {
      this.selectedValues = val != null ? [val] : [];
    }
  }

  private updateFilteredOptions(query: string): void {
    const q = query.toLowerCase().trim();
    if (this.optionGroups?.length) {
      this.filteredGroups = this.optionGroups
        .map(group => ({
          ...group,
          options: group.options.filter(o => o.name.toLowerCase().includes(q))
        }))
        .filter(group => group.options.length > 0);
    } else {
      this.filteredOptions = this.options.filter(o => o.name.toLowerCase().includes(q));
    }
  }

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) || false;
  }

  get selectedOptions(): DropdownOption[] {
    return this.getAllOptions().filter(opt => this.selectedValues.includes(opt.id));
  }

  get singleSelectedOption(): DropdownOption | undefined {
    return this.getAllOptions().find(opt => opt.id === this.selectedValues[0]);
  }

  getAllOptions(): DropdownOption[] {
    if (this.optionGroups?.length) return this.optionGroups.flatMap(g => g.options);
    return this.options;
  }

  isSelected(id: any): boolean {
    return this.selectedValues.includes(id);
  }

  get allSelected(): boolean {
    const visibleIds = this.optionGroups?.length
      ? this.filteredGroups.flatMap(g => g.options).map(o => o.id)
      : this.filteredOptions.map(o => o.id);
    return visibleIds.length > 0 && visibleIds.every(id => this.isSelected(id));
  }

  get someSelected(): boolean {
    const visibleIds = this.optionGroups?.length
      ? this.filteredGroups.flatMap(g => g.options).map(o => o.id)
      : this.filteredOptions.map(o => o.id);
    return visibleIds.some(id => this.isSelected(id)) && !this.allSelected;
  }

  toggleSelectAll(): void {
    const visibleIds = this.optionGroups?.length
      ? this.filteredGroups.flatMap(g => g.options).map(o => o.id)
      : this.filteredOptions.map(o => o.id);

    if (this.allSelected) {
      const newValue = this.selectedValues.filter(id => !visibleIds.includes(id));
      this.control.setValue(newValue);
    } else {
      const merged = [...new Set([...this.selectedValues, ...visibleIds])];
      this.control.setValue(merged);
    }

    this.control.markAsTouched();
    this.onChange.emit(this.control.value);
    this.updateSelectedFromControl();
  }

  toggleSelection(id: any, disabled: boolean = false, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.disable || disabled) return;

    let newValue: any;
    if (this.multiple) {
      newValue = this.selectedValues.includes(id)
        ? this.selectedValues.filter(v => v !== id)
        : [...this.selectedValues, id];
    } else {
      newValue = id;
      this.close();
    }

    this.control.setValue(newValue);
    this.control.markAsTouched();
    this.onChange.emit(newValue);
    this.updateSelectedFromControl();
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disable) return;

    if (this.isOpen) {
      this.close();
      return;
    }

    // Tell every other dropdown/picker on the page to close before this one opens
    this.coordinator.open(this.instanceId);

    this.searchControl.setValue('', { emitEvent: false });
    this.updateFilteredOptions('');
    this.updatePanelPosition();
    this.isOpen = true;
    this.control.markAsTouched();

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.scrollListener, true);
      window.addEventListener('resize', this.resizeListener);
    });
  }

  private updatePanelPosition(): void {
    if (!this.triggerBtn) return;

    this.ngZone.run(() => {
      const rect = this.triggerBtn.nativeElement.getBoundingClientRect();

      const searchBarH = this.showSearch ? 56 : 0;
      const optionCount = this.optionGroups?.length
        ? this.optionGroups.flatMap(g => g.options).length
        : this.options.length;
      const listH = Math.min(200, optionCount * 45 || 60);
      const panelH = searchBarH + listH + 8;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const gap = 6;

      if (spaceBelow >= panelH || spaceBelow >= spaceAbove) {
        this.panelTop = rect.bottom + gap;
      } else {
        this.panelTop = rect.top - panelH - gap;
      }

      this.panelLeft = rect.left;
      this.panelWidth = rect.width;
      this.cdr.markForCheck();
    });
  }

  private close(): void {
    this.isOpen = false;
    this.hoveredOptionId = null;
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
