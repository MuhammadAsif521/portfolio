import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  EventEmitter,
  Output,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import {
  FormArray,
  FormGroup,
  FormControl,
  AbstractControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import {  } from '@angular/common'; 
import { CustomDateComponentComponent } from '@shared/components/form-components/custom-date-component/custom-date-component.component';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { PhoneInputComponent } from '@shared/components/reactive-form-components/custom-input-phone/custom-input-phone';
import { CustomLocationInputComponent, ParsedPlace } from '@shared/components/reactive-form-components/custom-location-input/custom-location-input.component';
import { CustomReactiveAutocompleteComponent } from '@shared/components/reactive-form-components/custom-reactive-autocomplete/custom.autocomplete.component';
import { CustomReactiveCheckboxComponent } from '@shared/components/reactive-form-components/custom-reactive-checkbox/custom-reactive-checkbox.component';
import { CustomReactiveColorfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-colorfield/custom-colorfield.component';
import { CustomReactiveDropdownComponent } from '@shared/components/reactive-form-components/custom-reactive-dropdown/custom-dropdown.component';
import { CustomInputOtpComponent } from '@shared/components/reactive-form-components/custom-reactive-input-otp/custom-reactive-input-otp';
import { CustomReactivePasswordfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-passwordfield/custom-passwordfield.component';
import { CustomReactiveRadioComponent } from '@shared/components/reactive-form-components/custom-reactive-radio/custom-reactive-radio.component';
import { CustomReactiveSingleCheckboxComponent } from '@shared/components/reactive-form-components/custom-reactive-single-checkbox/custom-reactive-single-checkbox.component';
import { CustomReactiveTextareaComponent } from '@shared/components/reactive-form-components/custom-reactive-textarea/custom-textarea.component';
import { CustomReactiveTextfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-textfield/custom-textfield.component';
import { CustomReactiveToggleButtonComponent } from '@shared/components/reactive-form-components/custom-reactive-toggle-button/custom-toggle-button.component';
import { RichTextEditorComponent } from '@shared/components/reactive-form-components/rich-text-editor/rich-text-editor';
import { CustomTimeComponent } from '@shared/components/form-components/custom-time-component/custom-time-component.component';

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'phone'
  | 'otp'
  | 'textarea'
  | 'number'
  | 'password'
  | 'toggle'
  | 'dropdown'
  | 'multiselect'
  | 'autocomplete'
  | 'date'
  | 'time'
  | 'datetime'
  | 'url'
  | 'integer'
  | 'decimal'
  | 'cascading'
  | 'color'
  | 'checkbox'
  | 'single-checkbox'
  | 'radio'
  | 'richtext'
  | 'heading'
  | 'paragraph'
  | 'signature'
  | 'group'
  | 'array'
  | 'file'
  | 'month'
  | 'year'
  | 'location';

export interface FormFieldConfig {
  name: string;
  label?: string;
  type: FieldType;

  rows?: number;
  placeholder?: string;
  colClass?: string;
  hidden?: boolean;
  disabled?: boolean;
  tooltip?: string;
  icon?: string;
  iconPos?: 'pre' | 'post';

  required?: boolean;
  defaultValue?: any;
  minLength?: number;
  maxLength?: number;
  min?: number |  any;
  max?: number | any;
  pattern?: string;
  searchable?: boolean;
  showHints?: boolean;

  options?: { name: string; id: any }[];
  multiple?: boolean;

  format?: any;

  accept?: string;
  maxFileSize?: number;
  maxFiles?: number;
  showPreview?: boolean;
  cropConfig?: { maxWidth: number; maxHeight: number; aspectRatio?: number };

  defaultCountryCode?: string;
  phoneOutputFormat?: 'e164' | 'national' | 'raw';

  fields?: FormFieldConfig[];

  showWhen?: {
    field: string;
    value: any | any[];
  };

  arrayConfig?: {
    itemFields: FormFieldConfig[];
    minItems?: number;
    maxItems?: number;
  };
}

@Component({
  selector: 'app-dynamic-reactive-form',
  templateUrl: './dynamic-reactive-form.component.html',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CustomReactiveTextfieldComponent,
    CustomReactiveTextareaComponent,
    CustomReactivePasswordfieldComponent,
    RichTextEditorComponent,
    CustomReactiveDropdownComponent,
    CustomReactiveAutocompleteComponent,
    CustomFileInputComponent,
    CustomDateComponentComponent,
    CustomReactiveToggleButtonComponent,
    CustomReactiveCheckboxComponent,
    CustomReactiveRadioComponent,
    CustomReactiveSingleCheckboxComponent,
    CustomReactiveColorfieldComponent,
    IconComponent,
    CustomInputOtpComponent,
    CustomLocationInputComponent,
    PhoneInputComponent,
    CustomTimeComponent
],
})
export class DynamicReactiveFormComponent implements OnInit, OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() config!: FormFieldConfig;
  @Input() formGroup!: FormGroup;
  @Input() arrayIndex?: number;
  @Input() parentArray?: FormArray;
  @Input() level = 0;

  @Output() placeSelected = new EventEmitter<{ fieldName: string; place: ParsedPlace }>();

  control!: FormControl;
  label$!: Observable<any>;


  ngOnInit(): void {
    this.label$ = of(this.config.label);
    this.initControl();

    if (this.config.showWhen) {
      this.formGroup
        .get(this.config.showWhen.field)
        ?.valueChanges.subscribe(() => {
          if (!this.isVisible()) {
            this.control.reset();
          }
          this.cdr.markForCheck(); // 👈 add this
        });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && this.control) {
      this.updateDisabledState();
    }
  }

  private initControl(): void {
    let abstractControl: AbstractControl | null = null;

    const parentForm =
      this.parentArray && this.arrayIndex !== undefined
        ? (this.parentArray.at(this.arrayIndex) as FormGroup)
        : this.formGroup;

    if (parentForm) {
      abstractControl = parentForm.get(this.config.name);
    }

    if (this.config.type === 'group') {
      if (!abstractControl) {
        abstractControl = new FormGroup({});
        parentForm.setControl(this.config.name, abstractControl);
      }

      return;
    }

    if (this.config.type === 'array') {
      if (!abstractControl) {
        abstractControl = new FormArray([]);
        parentForm.setControl(this.config.name, abstractControl);
      }

      const min = this.config.arrayConfig?.minItems ?? 0;
      const array = abstractControl as FormArray;

      while (array.length < min) {
        this.addArrayItem();
      }

      return;
    }

    const validators = [];

    if (this.config.type === 'year') {
      validators.push(Validators.pattern('^[0-9]{4}$'));
      if (this.config.min !== undefined) validators.push(Validators.min(this.config.min));
      if (this.config.max !== undefined) validators.push(Validators.max(this.config.max));
    }

    if (this.config.required) validators.push(Validators.required);
    if (this.config.minLength) {
      validators.push(Validators.minLength(this.config.minLength));
    }
    if (this.config.maxLength) {
      validators.push(Validators.maxLength(this.config.maxLength));
    }
    if (this.config.min !== undefined) {
      validators.push(Validators.min(this.config.min));
    }
    if (this.config.max !== undefined) {
      validators.push(Validators.max(this.config.max));
    }
    if (this.config.pattern) {
      validators.push(Validators.pattern(this.config.pattern));
    }
    if (this.config.type === 'email') {
      validators.push(Validators.email);
    }

    if (!abstractControl) {
      abstractControl = new FormControl(this.config.defaultValue ?? '', validators);
      parentForm.setControl(this.config.name, abstractControl);
    }

    this.control = abstractControl as FormControl;
    this.updateDisabledState();
  }

  isVisible(): boolean {
    if (!this.config.showWhen) {
      return true;
    }

    const { field, value } = this.config.showWhen;

    const parent =
      this.parentArray && this.arrayIndex !== undefined
        ? (this.parentArray.at(this.arrayIndex) as FormGroup)
        : this.formGroup;

    const control = parent.get(field);

    if (!control) return false;

    const currentValue = control.value;

    if (Array.isArray(currentValue)) {
      if (Array.isArray(value)) {
        return value.some(v => currentValue.includes(v));
      }

      return currentValue.includes(value);
    }

    if (Array.isArray(value)) {
      return value.includes(currentValue);
    }

    return currentValue === value;
  }

  private updateDisabledState(): void {
    if (!this.control) return;

    if (this.config.disabled) {
      this.control.disable({ emitEvent: false });
    } else {
      this.control.enable({ emitEvent: false });
    }
  }

  getNestedFormGroup(): FormGroup {
    if (this.parentArray && this.arrayIndex !== undefined) {
      return this.parentArray.at(this.arrayIndex) as FormGroup;
    }

    return this.formGroup.get(this.config.name) as FormGroup;
  }

  getFormArray(): FormArray {
    if (this.parentArray && this.arrayIndex !== undefined) {
      return (this.parentArray.at(this.arrayIndex) as FormGroup).get(
        this.config.name
      ) as FormArray;
    }

    return this.formGroup.get(this.config.name) as FormArray;
  }

  getFormArrayItem(index: number): FormGroup {
    return this.getFormArray().at(index) as FormGroup;
  }

  onPlaceSelected(place: ParsedPlace): void {
    // Patch sibling controls in the same formGroup automatically
    this.formGroup.patchValue({
      address: place.formattedAddress ?? '',
      city: place.city?.name ?? '',
      state: place.state?.name ?? '',
      country: place.country?.name ?? '',
      zipCode: place.zipCode ?? '',
      // coordinates: {
      //   lat: place.coordinates?.lat ?? null,
      //   lng: place.coordinates?.lng ?? null,
      // },
    });

    this.markGroupValid(this.formGroup);
  }

  private markGroupValid(group: FormGroup): void {
    Object.keys(group.controls).forEach(key => {
      const ctrl = group.get(key);
      if (ctrl instanceof FormGroup) {
        this.markGroupValid(ctrl);
      } else {
        ctrl?.markAsDirty();
        ctrl?.markAsTouched();
        ctrl?.updateValueAndValidity({ emitEvent: false });
      }
    });
    group.updateValueAndValidity({ emitEvent: false });
  }

  onFileSelected(file: File | File[]): void {
    this.control.setValue(file);
    this.control.markAsDirty();
    this.control.markAsTouched();
    this.control.updateValueAndValidity();
  }

  addArrayItem(): void {
    if (!this.config.arrayConfig) return;

    const array = this.getFormArray();
    const maxItems = this.config.arrayConfig.maxItems;

    if (maxItems && array.length >= maxItems) return;

    const itemGroup = new FormGroup({});

    this.config.arrayConfig.itemFields.forEach((field) => {
      const validators = [];

      if (field.required) validators.push(Validators.required);
      if (field.minLength) validators.push(Validators.minLength(field.minLength));
      if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.max !== undefined) validators.push(Validators.max(field.max));
      if (field.pattern) validators.push(Validators.pattern(field.pattern));
      if (field.type === 'email') validators.push(Validators.email);

      if (field.type === 'array') {
        itemGroup.addControl(field.name, new FormArray([]));
      } else if (field.type === 'group') {
        itemGroup.addControl(field.name, new FormGroup({}));
      } else {
        itemGroup.addControl(
          field.name,
          new FormControl(field.defaultValue ?? '', validators)
        );
      }
    });

    array.push(itemGroup);
  }

  removeArrayItem(index: number): void {
    const array = this.getFormArray();
    const minItems = this.config.arrayConfig?.minItems || 0;

    if (array.length <= minItems) return;

    array.removeAt(index);
  }

  isMaxItemsReached(): boolean {
    if (!this.config.arrayConfig?.maxItems) return false;

    return this.getFormArray().length >= this.config.arrayConfig.maxItems;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private getFormattedAddress(place: any): string {
    return String(
      place?.formattedAddress ||
      place?.formatted_address ||
      place?.address ||
      place?.label ||
      place?.description ||
      ''
    ).trim();
  }
}

export function mapToOptions(
  data: any[] = [],
  nameKey: string = 'name',
  idKey: string = 'id'
) {
  if (!Array.isArray(data)) return [];

  return data.map((item) => ({ name: item?.[nameKey], id: item?.[idKey] }));
}

export function updateFieldOptions(
  config: any[],
  fieldName: string,
  options: any[] = []
) {
  const field = config.find((f) => f.name === fieldName);

  if (!field) return [...config];

  field.options = options;

  return [...config];
}