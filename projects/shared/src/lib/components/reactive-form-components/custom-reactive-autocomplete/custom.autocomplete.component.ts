import {
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import {  } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, startWith, takeUntil } from 'rxjs';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { DropdownCoordinatorService } from '@shared/services/dropdown-coordinator.service';

interface User {
  name: string;
  id: string;
}

let autocompleteUid = 0;

@Component({
  selector: 'app-custom-reactive-autocomplete',
  standalone: true,
  imports: [ FormsModule, ReactiveFormsModule, IconComponent],
  template: `
    <div [class]="'relative w-full ' + (showLabel ? 'mb-2 md:mb-6' : '')" style="font-family: var(--font-body)"
      (click)="$event.stopPropagation()">

      @if (label && showLabel) {
        <label [attr.for]="controlName"
          class="mb-1.5 block text-[0.875rem] font-[600] uppercase text-muted" >
          {{ label }}
          @if (hasRequiredValidator) {
            <span class="ml-0.5" style="color: var(--error)">*</span>
          }
        </label>
      }

      <!-- Single Mode -->
      @if (!multiple) {
        <div class="relative">
          <div
            class="flex w-full items-center justify-between gap-2 rounded-xl border outline-none transition-all duration-200 px-4"
            [style.background]="(isFocused || showPanel) ? 'var(--form-control-bg-active)' : 'var(--form-control-bg)'"
            [style.borderColor]="control.invalid && (control.dirty || control.touched)
              ? 'var(--error)'
              : ((isFocused || showPanel) ? 'var(--form-control-border-active)' : 'var(--form-control-border)')"
            [style.boxShadow]="(isFocused || showPanel) ? 'var(--form-focus-shadow)' : 'none'">
            <input
              #triggerInput
              type="text"
              [id]="controlName"
              [placeholder]="placeholder"
              [formControl]="inputControl"
              (focus)="onInputFocus(); isFocused = true"
              (blur)="isFocused = false"
              autocomplete="off"
              class="w-full bg-transparent py-3.5 text-[13px] font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
              style="color: var(--form-control-text)"
            />
            <span class="pointer-events-none shrink-0" style="color: var(--form-control-icon)">
              <i-lucide name="search" [size]="16" />
            </span>
          </div>

          <!-- Single Panel -->
          @if (showPanel && filteredUsers.length > 0) {
            <div #panelRef
              class="fixed z-[9999] overflow-y-auto rounded-xl border"
              [style.top.px]="panelTop"
              [style.left.px]="panelLeft"
              [style.width.px]="panelWidth"
              [style.maxHeight.px]="240"
              style="background: var(--form-control-bg-active); border-color: var(--form-control-border); box-shadow: var(--shadow-lg)">
              @for (option of filteredUsers; track option.id) {
                <div
                  (click)="onSingleSelected(option)"
                  (mouseenter)="hoveredOptionId = option.id"
                  (mouseleave)="hoveredOptionId = null"
                  class="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium transition-colors duration-150"
                  [style.background]="isSelected(option.id) ? 'var(--primary)' : (hoveredOptionId === option.id ? 'var(--form-control-hover-bg)' : 'transparent')"
                  [style.color]="isSelected(option.id) ? 'var(--on-primary)' : 'var(--form-control-text)'">
                  <span>{{ option.name }}</span>
                  @if (isSelected(option.id)) {
                    <i-lucide name="check" [size]="15" />
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Multiple Mode -->
      @if (multiple) {
        <div
          class="rounded-xl border transition-all duration-200"
          [style.background]="(isFocused || showPanel) ? 'var(--form-control-bg-active)' : 'var(--form-control-bg)'"
          [style.borderColor]="control.invalid && (control.dirty || control.touched)
            ? 'var(--error)'
            : ((isFocused || showPanel) ? 'var(--form-control-border-active)' : 'var(--form-control-border)')"
          [style.boxShadow]="(isFocused || showPanel) ? 'var(--form-focus-shadow)' : 'none'">

          <!-- Chips -->
          @if (selectedUsers.length > 0) {
            <div class="flex flex-wrap gap-1.5 px-3.5 pt-3.5">
              @for (user of visibleSelectedUsers; track user.id) {
                <span
                  class="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style="background: var(--form-chip-bg); border-color: var(--form-chip-border); color: var(--form-chip-text)">
                  <span class="truncate">{{ user.name }}</span>
                  @if (!disable) {
                    <button type="button" (click)="remove(user)"
                      class="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style="color: var(--form-chip-text)">
                     <i-lucide name="x" [size]="16" color="error" />
                    </button>
                  }
                </span>
              }
              @if (selectedUsers.length > 3) {
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style="background: var(--form-chip-summary-bg); color: var(--form-chip-summary-text)">
                  {{ selectedUsers.length }} selected
                </span>
              }
            </div>
          }

          <!-- Input -->
          <div class="relative px-3.5 py-3">
            <input
              #triggerInput
              type="text"
              [id]="controlName"
              [placeholder]="selectedUsers.length ? 'Search more...' : placeholder"
              [formControl]="inputControl"
              (focus)="onInputFocus(); isFocused = true"
              (blur)="isFocused = false"
              autocomplete="off"
              class="w-full bg-transparent pr-8 text-[13px] font-medium outline-none"
              style="color: var(--form-control-text)"
            />
            <span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" style="color: var(--form-control-icon)">
              <i-lucide name="search" [size]="16" />
            </span>
          </div>
        </div>

        <!-- Multiple Panel -->
        @if (showPanel && filteredUsers.length > 0) {
          <div #panelRef
            class="fixed z-[9999] overflow-y-auto rounded-xl border"
            [style.top.px]="panelTop"
            [style.left.px]="panelLeft"
            [style.width.px]="panelWidth"
            [style.maxHeight.px]="240"
            style="background: var(--form-control-bg-active); border-color: var(--form-control-border); box-shadow: var(--shadow-lg)">
            @for (option of filteredUsers; track option.id) {
              <div
                (click)="toggleSelection(option); $event.stopPropagation()"
                (mouseenter)="hoveredOptionId = option.id"
                (mouseleave)="hoveredOptionId = null"
                class="flex cursor-pointer items-center gap-3 px-4 py-3 text-[13px] font-medium transition-colors duration-150"
                [style.background]="isSelected(option.id) ? 'var(--form-control-bg-active)' : (hoveredOptionId === option.id ? 'var(--form-control-hover-bg)' : 'transparent')"
                style="color: var(--form-control-text)">
                <span
                  class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors"
                  [style.background]="isSelected(option.id) ? 'var(--primary)' : 'transparent'"
                  [style.borderColor]="isSelected(option.id) ? 'var(--primary)' : (hoveredOptionId === option.id ? 'var(--form-control-border-active)' : 'var(--form-control-border)')">
                  @if (isSelected(option.id)) {
                    <i-lucide name="check" [size]="10" />
                  }
                </span>
                <span class="flex-1">{{ option.name }}</span>
              </div>
            }
          </div>
        }
      }

      @if (showHints && control.invalid && (control.dirty || control.touched)) {
        <p class="mt-1.5 text-xs" style="color: var(--error)">
          @if (control.hasError('required')) { {{ label }} is required. }
        </p>
      }
    </div>
  `,
})
export class CustomReactiveAutocompleteComponent implements OnInit, OnDestroy, OnChanges {
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private coordinator = inject(DropdownCoordinatorService);
  private instanceId = `autocomplete-${++autocompleteUid}`;

  @ViewChild('triggerInput') triggerInput!: ElementRef<HTMLInputElement>;

  @Input() controlName!: string;
  @Input() placeholder: string = 'Search...';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() disable: boolean = false;
  @Input() multiple: boolean = false;
  @Input() showLabel: boolean = true;
  @Input() showHints: boolean = true;

  private _options: User[] = [];
  @Input()
  set options(value: User[]) {
    this._options = (value || []).map(o => ({ ...o, id: String(o.id) }));
    if (this.multiple) this.syncSelectedUsers();
    this.updateFilteredUsers(this.inputControl.value || '');
  }
  get options(): User[] { return this._options; }

  label = '';
  inputControl = new FormControl('');
  selectedUsers: User[] = [];
  filteredUsers: User[] = [];
  showPanel = false;
  isFocused = false;
  hoveredOptionId: string | null = null;

  panelTop = 0;
  panelLeft = 0;
  panelWidth = 0;

  private destroy$ = new Subject<void>();
  private scrollListener = () => this.updatePanelPosition();
  private resizeListener = () => this.updatePanelPosition();

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe(l => this.label = l || '');

    // Close this panel whenever another dropdown/picker on the page opens
    this.coordinator.closeRequested$.pipe(takeUntil(this.destroy$)).subscribe(activeId => {
      if (activeId !== this.instanceId && this.showPanel) {
        this.closePanel();
        this.cdr.markForCheck();
      }
    });

    this.inputControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.coordinator.open(this.instanceId);
      this.updateFilteredUsers(value || '');
      this.showPanel = true;
      this.updatePanelPosition();
    });

    if (this.multiple) {
      this.control.valueChanges.pipe(startWith(this.control.value), takeUntil(this.destroy$))
        .subscribe(() => this.syncSelectedUsers());
    } else {
      this.control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
        this.inputControl.setValue(this.getDisplayValue(value), { emitEvent: false });
      });
      this.inputControl.setValue(this.getDisplayValue(this.control.value), { emitEvent: false });
    }

    if (this.disable) {
      this.inputControl.disable();
      this.control.disable();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disable']) {
      this.disable ? this.inputControl.disable() : this.inputControl.enable();
      this.disable ? this.control.disable() : this.control.enable();
    }
    if (changes['options'] && this.multiple) this.syncSelectedUsers();
  }

  get visibleSelectedUsers(): User[] { return this.selectedUsers.slice(0, 3); }

  get hasRequiredValidator(): boolean { return !!this.control?.hasValidator(Validators.required); }

  isSelected(id: string): boolean {
    if (this.multiple) return this.selectedUsers.some(u => u.id === id);
    return String(this.control.value) === id;
  }

  private syncSelectedUsers(): void {
    const values = (this.control.value || []).map(String);
    this.selectedUsers = this.options.filter(o => values.includes(o.id));
  }

  private updateFilteredUsers(query: string): void {
    const q = query.toLowerCase().trim();
    this.filteredUsers = this.options.filter(o => o.name.toLowerCase().includes(q));
  }

  private getDisplayValue(id: any): string {
    if (!id) return '';
    return this.options.find(o => o.id === String(id))?.name || '';
  }

  private updatePanelPosition(): void {
    if (!this.triggerInput) return;
    this.ngZone.run(() => {
      const rect = this.triggerInput.nativeElement.closest('.rounded-xl')?.getBoundingClientRect()
        ?? this.triggerInput.nativeElement.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const panelH = Math.min(240, this.filteredUsers.length * 45 + 2);
      this.panelTop = spaceBelow >= panelH + 2 ? rect.bottom + 3 : rect.top - panelH - 3;
      this.panelLeft = rect.left;
      this.panelWidth = rect.width;
      this.cdr.markForCheck();
    });
  }

  onInputFocus(): void {
    this.coordinator.open(this.instanceId);
    if (this.multiple) this.inputControl.setValue('', { emitEvent: false });
    this.updateFilteredUsers(this.inputControl.value || '');
    this.updatePanelPosition();
    this.showPanel = true;
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.scrollListener, true);
      window.addEventListener('resize', this.resizeListener);
    });
  }

  onSingleSelected(option: User): void {
    this.control.setValue(option.id);
    this.control.markAsTouched();
    this.inputControl.setValue(option.name, { emitEvent: false });
    this.closePanel();
  }

  toggleSelection(user: User): void {
    const idx = this.selectedUsers.findIndex(u => u.id === user.id);
    if (idx === -1) this.selectedUsers.push(user);
    else this.selectedUsers.splice(idx, 1);
    this.control.setValue(this.selectedUsers.map(u => u.id));
    this.control.markAsTouched();
    this.inputControl.setValue('', { emitEvent: false });
    this.updateFilteredUsers('');
  }

  remove(user: User): void { this.toggleSelection(user); }

  private closePanel(): void {
    this.showPanel = false;
    this.hoveredOptionId = null;
    this.coordinator.close(this.instanceId);
    window.removeEventListener('scroll', this.scrollListener, true);
    window.removeEventListener('resize', this.resizeListener);
  }

  @HostListener('document:click')
  onDocumentClick(): void { if (this.showPanel) this.closePanel(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.showPanel) this.closePanel(); }

  ngOnDestroy(): void {
    this.closePanel();
    this.destroy$.next();
    this.destroy$.complete();
  }
}