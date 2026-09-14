import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IconComponent } from '../../icon-component/icon-component';
import { CustomDropdownComponent } from '../../form-components/custom-dropdown/custom-dropdown.component';
import {
  ALIGN_CONTROLS,
  BLOCK_STYLES,
  CannedResponse,
  FONT_FAMILIES,
  FONT_SIZES,
  HISTORY_CONTROLS,
  INLINE_CONTROLS,
  LIST_CONTROLS,
  RichTextPlaceholder,
  applyFontSizeAtSelection,
  createEditorImage,
  createPlaceholderChip,
  createResizableImageWrapper,
  flashChip,
  getMissingRequiredPlaceholders,
  getPresentPlaceholderKeys,
  getRawEditorHtml,
  insertNodeAtEditorCursor,
  isRequiredPlaceholder,
  parseHtmlToChips,
} from './editor-functions.util';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-custom-text-editor',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    CustomDropdownComponent,
    MatTooltipModule
  ],
  templateUrl: './rich-text-editor.html',
  styleUrl: 'rich-text-editor.scss',
})
export class RichTextEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() controlName!: string;
  @Input() placeholder = '';
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() minLength!: number;
  @Input() maxLength!: number;
  @Input() icon = '';
  @Input() value = '';
  @Input() isDisabled = false;
  @Input() showLabel = true;
  @Input() showHints = true;
  @Input() cannedResponses: CannedResponse[] | null = null;
  @Input() placeholders: RichTextPlaceholder[] = [];

  @Output() securityViolation = new EventEmitter<{ type: string; data: any }>();

  // ── View refs ─────────────────────────────────────────────────────────────
  @ViewChild('editorRef') editorRef!: ElementRef<HTMLDivElement>;
  @ViewChild('imageUpload') imageUpload!: ElementRef<HTMLInputElement>;

  // ── State ─────────────────────────────────────────────────────────────────
  label = '';
  isFocused = false;
  showCannedDropdown = false;
  hoveredCannedId: string | null = null;

  // Simple color values for inline pickers
  textColor = '#000000';
  bgColor = '#ffff00';

  // Selected values for dropdowns
  selectedBlockStyle = '';
  selectedFontFamily = '';
  selectedFontSize = '14px';

  phStatus: 'ok' | 'warn' = 'ok';
  missingPlaceholders: string[] = [];
  presentPlaceholders: string[] = [];

  // ── Toolbar config ────────────────────────────────────────────────────────
  historyControls = HISTORY_CONTROLS;
  inlineControls = INLINE_CONTROLS;
  alignControls = ALIGN_CONTROLS;
  listControls = LIST_CONTROLS;
  blockStyles = BLOCK_STYLES;
  fontFamilies = FONT_FAMILIES;
  fontSizes = FONT_SIZES;

  showImportModal = false;
  importHtmlValue = '';

  private destroy$ = new Subject<void>();
  private selectedImg: HTMLImageElement | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe(label => (this.label = label));

    if (this.value) this.control.patchValue(this.value, { emitEvent: false });
    if (this.isDisabled) this.control.disable({ emitEvent: false });
  }

  ngAfterViewInit(): void {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('defaultParagraphSeparator', false, 'div');

    const editor = this.editorRef.nativeElement;
    editor.innerHTML = this.control?.value ? parseHtmlToChips(this.control.value) : '';
    editor.contentEditable = String(!this.control?.disabled);

    editor.addEventListener('input', () => this.syncControlValue());
    editor.addEventListener('focus', () => (this.isFocused = true));
    editor.addEventListener('blur', () => {
      this.isFocused = false;
      this.control?.markAsTouched();
    });
    editor.addEventListener('keydown', (e: KeyboardEvent) => {
      this.preventDeleteOnProtected(e);
      this.handlePlaceholderDelete(e);
    });
    editor.addEventListener('cut', (e: ClipboardEvent) => this.preventDeleteOnProtected(e));
    editor.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      target.tagName === 'IMG' ? this.selectImage(target as HTMLImageElement) : this.deselectImage();
    });

    // Sync editor DOM when control value changes externally
    this.control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
      const editorEl = this.editorRef?.nativeElement;
      if (!editorEl) return;
      if (value !== getRawEditorHtml(editorEl)) {
        editorEl.innerHTML = value ? parseHtmlToChips(value) : '';
        this.updatePhStatus();
      }
    });

    this.updatePhStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Toolbar actions ───────────────────────────────────────────────────────

  execCmd(cmd: string, value?: string): void {
    if (this.control?.disabled) return;
    document.execCommand(cmd, false, value ?? undefined);
    this.editorRef.nativeElement.focus();
    this.syncControlValue();
  }

  isActive(cmd: string): boolean {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  }

  onBlockFormat(value: string): void {
    if (this.control?.disabled) return;
    this.selectedBlockStyle = value;
    document.execCommand('formatBlock', false, value || 'div');
    this.editorRef.nativeElement.focus();
    this.syncControlValue();
  }

  onFontFamily(value: string): void {
    if (this.control?.disabled) return;
    this.selectedFontFamily = value;
    document.execCommand('fontName', false, value);
    this.editorRef.nativeElement.focus();
    this.syncControlValue();
  }

  onFontSize(value: string): void {
    if (this.control?.disabled) return;
    this.selectedFontSize = value;
    applyFontSizeAtSelection(this.editorRef.nativeElement, value);
    this.syncControlValue();
  }

  onTextColor(event: Event): void {
    if (this.control?.disabled) return;
    this.textColor = (event.target as HTMLInputElement).value;
    document.execCommand('foreColor', false, this.textColor);
    this.editorRef.nativeElement.focus();
    this.syncControlValue();
  }

  onBgColor(event: Event): void {
    if (this.control?.disabled) return;
    this.bgColor = (event.target as HTMLInputElement).value;
    document.execCommand('hiliteColor', false, this.bgColor);
    this.editorRef.nativeElement.focus();
    this.syncControlValue();
  }

  insertLink(): void {
    const url = prompt('Enter URL:');
    if (url) this.execCmd('createLink', url);
  }

  // ── Image upload ──────────────────────────────────────────────────────────

  openImagePicker(): void {
    if (!this.control?.disabled) this.imageUpload.nativeElement.click();
  }

  onImageUpload(event: Event): void {
    if (this.control?.disabled) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.insertImageAtCursor(reader.result as string);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  private insertImageAtCursor(src: string): void {
    const img = createEditorImage(src);
    const wrapper = createResizableImageWrapper(img, () => this.syncControlValue());
    insertNodeAtEditorCursor(this.editorRef.nativeElement, wrapper, this.placeholders);
    this.syncControlValue();
  }

  private selectImage(img: HTMLImageElement): void {
    this.deselectImage();
    this.selectedImg = img;
    img.style.outline = '2px solid var(--secondary)';
  }

  private deselectImage(): void {
    if (!this.selectedImg) return;
    this.selectedImg.style.outline = '';
    this.selectedImg = null;
  }

  // ── Placeholder insertion ─────────────────────────────────────────────────

  insertPlaceholder(ph: RichTextPlaceholder): void {
    if (this.control?.disabled) return;
    const chip = createPlaceholderChip(ph.key);
    insertNodeAtEditorCursor(this.editorRef.nativeElement, chip, this.placeholders);
    this.syncControlValue();
  }

  // ── Canned responses ──────────────────────────────────────────────────────

  toggleCannedDropdown(): void {
    this.showCannedDropdown = !this.showCannedDropdown;
  }

  insertCannedResponse(response: CannedResponse): void {
    const current = this.control.value || '';
    const updated = current ? `${current}<br><br>${response.name}` : response.name;
    this.control.setValue(updated);
    this.control.markAsDirty();
    if (this.editorRef) {
      this.editorRef.nativeElement.innerHTML = parseHtmlToChips(updated);
      this.updatePhStatus();
    }
    this.showCannedDropdown = false;
  }

  // ── Sync & validation ─────────────────────────────────────────────────────

  private syncControlValue(): void {
    this.updatePhStatus();
    const value = getRawEditorHtml(this.editorRef.nativeElement);
    this.control.setValue(value, { emitEvent: false });
    this.control.markAsDirty();
    this.control.markAsTouched();

    if (this.missingPlaceholders.length) {
      this.control.setErrors({ ...(this.control.errors ?? {}), missingPlaceholders: this.missingPlaceholders });
    } else {
      const errors = { ...(this.control.errors ?? {}) };
      delete errors['missingPlaceholders'];
      this.control.setErrors(Object.keys(errors).length ? errors : null);
    }
  }

  updatePhStatus(): void {
    if (!this.editorRef) return;
    this.presentPlaceholders = getPresentPlaceholderKeys(this.editorRef.nativeElement);
    this.missingPlaceholders = getMissingRequiredPlaceholders(this.editorRef.nativeElement, this.placeholders);
    this.phStatus = this.missingPlaceholders.length === 0 ? 'ok' : 'warn';
  }

  isPresent(key: string): boolean {
    return this.presentPlaceholders.includes(key);
  }

  // ── Delete protection ─────────────────────────────────────────────────────

  private handlePlaceholderDelete(event: KeyboardEvent): void {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    if (!range.collapsed) {
      const chips = Array.from(this.editorRef.nativeElement.querySelectorAll('.ph-chip'));
      const blocked = chips.some(chip => {
        const el = chip as HTMLElement;
        return isRequiredPlaceholder(el.dataset['ph']!, this.placeholders) && range.intersectsNode(chip);
      });
      if (blocked) event.preventDefault();
      return;
    }

    const node = range.startContainer;
    const offset = range.startOffset;
    let adjacentChip: HTMLElement | null = null;

    if (event.key === 'Backspace') {
      adjacentChip =
        node.nodeType === Node.TEXT_NODE && offset === 0
          ? (node.previousSibling as HTMLElement)
          : node === this.editorRef.nativeElement
            ? (this.editorRef.nativeElement.childNodes[offset - 1] as HTMLElement)
            : null;
    }
    if (event.key === 'Delete') {
      adjacentChip =
        node.nodeType === Node.TEXT_NODE && offset === node.textContent?.length
          ? (node.nextSibling as HTMLElement)
          : node === this.editorRef.nativeElement
            ? (this.editorRef.nativeElement.childNodes[offset] as HTMLElement)
            : null;
    }

    if (
      adjacentChip?.classList?.contains('ph-chip') &&
      isRequiredPlaceholder(adjacentChip.dataset['ph']!, this.placeholders)
    ) {
      event.preventDefault();
      flashChip(adjacentChip);
    }
  }

  private preventDeleteOnProtected(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.type === 'keydown' && ke.key !== 'Backspace' && ke.key !== 'Delete') return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const node =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;

    const protectedEl = node?.closest('[contenteditable="false"], .contentNotEditable');
    if (protectedEl) {
      event.preventDefault();
      event.stopPropagation();
      this.securityViolation.emit({
        type: 'DELETE_ATTEMPT_ON_PROTECTED',
        data: { element: protectedEl.tagName, className: protectedEl.className },
      });
    }
  }

  openImportModal(): void {
    if (this.control?.disabled) return;
    this.importHtmlValue = this.control.value || '';
    this.showImportModal = true;
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.importHtmlValue = '';
  }

  confirmImportHtml(): void {
    if (!this.importHtmlValue?.trim()) {
      this.closeImportModal();
      return;
    }
    this.editorRef.nativeElement.innerHTML = parseHtmlToChips(this.importHtmlValue);
    this.syncControlValue();
    this.closeImportModal();
  }

  importHtml(): void {
    if (this.control?.disabled) return;
    const html = prompt('Paste raw HTML:');
    if (!html) return;
    this.editorRef.nativeElement.innerHTML = parseHtmlToChips(html);
    this.syncControlValue();
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) ?? false;
  }

  get requiredPlaceholders(): RichTextPlaceholder[] {
    return this.placeholders.filter(p => p.required);
  }

  get missingPlaceholderLabels(): string {
    return this.missingPlaceholders
      .map(key => this.placeholders.find(p => p.key === key)?.label ?? key)
      .join(', ');
  }


  get dropdownBlockStyles() {
    return this.blockStyles.map(style => ({ value: style.value, name: style.label }));
  }

  get dropdownFontFamilies() {
    return this.fontFamilies.map(font => ({ value: font.value, name: font.label }));
  }

  get dropdownFontSizes() {
    return this.fontSizes.map(size => ({ value: size.value, name: size.label }));
  }
}