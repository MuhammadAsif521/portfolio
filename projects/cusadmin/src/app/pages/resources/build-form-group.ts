import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { FormFieldConfig } from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';

/**
 * Builds a fully-populated FormGroup from field configs and initial values so
 * that edit values — including nested groups and arrays — patch correctly, and
 * the DynamicReactiveForm reuses (rather than recreates) the controls.
 */
export function buildFormGroup(fields: FormFieldConfig[], value: Record<string, any> = {}): FormGroup {
  const group = new FormGroup({});
  let needsCoordinates = false;

  for (const field of fields) {
    if (field.type === 'group') {
      group.addControl(field.name, buildFormGroup(field.fields ?? [], value?.[field.name] ?? {}));
      continue;
    }
    if (field.type === 'array') {
      const arr = new FormArray<FormGroup>([]);
      const items: any[] = Array.isArray(value?.[field.name]) ? value[field.name] : [];
      const itemFields = field.arrayConfig?.itemFields ?? [];
      const min = field.arrayConfig?.minItems ?? 0;
      const seed = Math.max(items.length, min);
      for (let i = 0; i < seed; i++) arr.push(buildFormGroup(itemFields, items[i] ?? {}));
      group.addControl(field.name, arr);
      continue;
    }
    if (field.type === 'location') needsCoordinates = true;

    const validators = [];
    if (field.required) validators.push(Validators.required);
    if (field.minLength) validators.push(Validators.minLength(field.minLength));
    if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
    if (field.min !== undefined) validators.push(Validators.min(field.min));
    if (field.max !== undefined) validators.push(Validators.max(field.max));
    if (field.pattern) validators.push(Validators.pattern(field.pattern));
    if (field.type === 'email') validators.push(Validators.email);

    const initial = value?.[field.name] ?? field.defaultValue ?? '';
    group.addControl(field.name, new FormControl(initial, validators));
  }

  if (needsCoordinates && !group.get('coordinates')) {
    const c = value?.['coordinates'] ?? {};
    group.addControl(
      'coordinates',
      new FormGroup({ lat: new FormControl(c?.lat ?? null), lng: new FormControl(c?.lng ?? null) }),
    );
  }
  return group;
}
