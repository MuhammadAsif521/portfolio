import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { DynamicReactiveFormComponent, type FormFieldConfig } from './dynamic-reactive-form.component';

const field: FormFieldConfig = { name: 'accentColor', label: 'Accent colour', type: 'text' };

@Component({
  imports: [DynamicReactiveFormComponent],
  template: `<app-dynamic-reactive-form [config]="config" [formGroup]="form()" [level]="0" />`,
})
class Host {
  readonly config = field;
  readonly form = signal(new FormGroup({ accentColor: new FormControl('#111111') }));
}

describe('DynamicReactiveFormComponent', () => {
  it('re-binds to a replaced FormGroup so later edits are not lost', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const field = fixture.debugElement.children[0].componentInstance as DynamicReactiveFormComponent;
    const first = fixture.componentInstance.form();
    expect(field.control).toBe(first.get('accentColor'));

    // e.g. the resume page rebuilds its form from the saved data after "Save profile"
    const second = new FormGroup({ accentColor: new FormControl('#222222') });
    fixture.componentInstance.form.set(second);
    fixture.detectChanges();

    expect(field.control).toBe(second.get('accentColor'));
    field.control.setValue('#ABCDEF');
    expect(second.value.accentColor).toBe('#ABCDEF');
    expect(first.value.accentColor).toBe('#111111');
  });
});
