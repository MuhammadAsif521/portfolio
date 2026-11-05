import { type Signal, computed } from '@angular/core';
import { FormControl } from '@angular/forms';
import { controlSignal } from '../../../../../ui/tool-kit/tool-form';

export type OptionControls<O> = { [K in keyof O]: FormControl<O[K]> };

/**
 * One FormControl per option (the shared form components need controls) plus a single signal with the whole
 * options object, so a tool re-converts whenever any option changes. Call in an injection context.
 */
export function optionControls<O extends object>(defaults: O): { controls: OptionControls<O>; value: Signal<O> } {
  const keys = Object.keys(defaults) as (keyof O)[];
  const controls = {} as OptionControls<O>;
  const signals = {} as { [K in keyof O]: Signal<O[K]> };
  for (const key of keys) {
    controls[key] = new FormControl(defaults[key], { nonNullable: true }) as FormControl<O[typeof key]>;
    signals[key] = controlSignal(controls[key]) as Signal<O[typeof key]>;
  }
  const value = computed(() => {
    const out = {} as O;
    for (const key of keys) out[key] = signals[key]();
    return out;
  });
  return { controls, value };
}

/** Dropdown options from "value: label" pairs. */
export function choices<T extends string>(pairs: readonly (readonly [T, string])[]): { id: T; name: string }[] {
  return pairs.map(([id, name]) => ({ id, name }));
}
