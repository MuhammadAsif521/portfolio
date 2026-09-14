// custom-stepper.types.ts
import { AbstractControl } from '@angular/forms';

export type StepperOrientation = 'horizontal' | 'vertical';

export interface StepperStep {
  id: string | number;
  title: string;
  description?: string; 
  optional?: boolean; 
  disabled?: boolean; 
  editable?: boolean; 
  completed?: boolean; 
  error?: string | null; 
  control?: AbstractControl | null; 
  valid?: () => boolean;
}