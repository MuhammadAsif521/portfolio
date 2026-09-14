import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  QueryList,
  TemplateRef,
  Directive,
  computed,
  input,
  output,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { StepperOrientation } from '@angular/cdk/stepper'; 
import { LoadingButtonComponent } from '../loading-button/loading-button';
import { StepperStep } from './custom-stepper.interface';


@Directive({
  selector: 'ng-template[appCustomStep]',
  standalone: true,
})
export class CustomStepDirective {
  stepId = input.required<string | number>({ alias: 'appCustomStep' });

  constructor(public templateRef: TemplateRef<unknown>) {}
}

@Component({
  selector: 'app-custom-stepper',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, LoadingButtonComponent],
  templateUrl: './custom-stepper.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomStepperComponent implements AfterContentInit {
  steps = input.required<StepperStep[]>();
  activeIndex = input<number>(0);
  activeIndexChange = output<number>();

  linear = input<boolean>(false);
  clickable = input<boolean>(true);
  orientation = input<StepperOrientation>('horizontal');
  showActions = input<boolean>(true);

  previousLabel = input<string>('Previous');
  nextLabel = input<string>('Next');
  finishLabel = input<string>('Finish');

  /**
   * Passed from parent.
   * Used by final submit loading button.
   */
  finishLoading = input<boolean>(false);

  finished = output<void>();

  @ContentChildren(CustomStepDirective)
  projectedSteps!: QueryList<CustomStepDirective>;

  readonly lastIndex = computed(() => this.steps().length - 1);
  readonly activeStep = computed(() => this.steps()[this.activeIndex()] ?? null);

  private templates = new Map<string | number, TemplateRef<unknown>>();

  ngAfterContentInit(): void {
    this.buildTemplateMap();

    this.projectedSteps.changes.subscribe(() => {
      this.buildTemplateMap();
    });
  }

  private buildTemplateMap(): void {
    this.templates.clear();

    this.projectedSteps?.forEach((stepTemplate) => {
      this.templates.set(stepTemplate.stepId(), stepTemplate.templateRef);
    });
  }

  getActiveTemplate(): TemplateRef<unknown> | null {
    const step = this.activeStep();

    if (!step) return null;

    return this.templates.get(step.id) ?? null;
  }

  isHorizontal(): boolean {
    return this.orientation() === 'horizontal';
  }

  isVertical(): boolean {
    return this.orientation() === 'vertical';
  }

  isActive(index: number): boolean {
    return index === this.activeIndex();
  }

  isCompleted(index: number): boolean {
    const step = this.steps()[index];

    if (!step) return false;

    if (step.completed !== undefined) {
      return step.completed;
    }

    if (index < this.activeIndex()) {
      return this.isStepValid(step);
    }

    return false;
  }

  hasError(step: StepperStep): boolean {
    if (step.error) return true;

    if (step.control && step.control.invalid && step.control.touched) {
      return true;
    }

    return false;
  }

  getStepError(step: StepperStep): string | null {
    if (step.error) return step.error;

    if (step.control && step.control.invalid && step.control.touched) {
      return 'Please complete this step';
    }

    return null;
  }

  isStepValid(step: StepperStep): boolean {
    if (step.optional) return true;

    if (step.control) {
      return step.control.valid;
    }

    if (step.valid) {
      return step.valid();
    }

    return true;
  }

  canMoveTo(index: number): boolean {
    if (!this.linear()) return true;

    for (let i = 0; i < index; i++) {
      const step = this.steps()[i];

      if (!step) continue;

      if (!this.isStepValid(step)) {
        return false;
      }
    }

    return true;
  }

  canSelect(index: number, step: StepperStep): boolean {
    if (!this.clickable()) return false;
    if (step.disabled) return false;
    if (this.finishLoading()) return false;

    const currentIndex = this.activeIndex();

    if (index < currentIndex) {
      return step.editable !== false;
    }

    if (index === currentIndex) {
      return true;
    }

    return this.canMoveTo(index);
  }

  selectStep(index: number, step: StepperStep): void {
    if (!this.canSelect(index, step)) return;

    this.setActiveIndex(index);
  }

  next(): void {
    if (this.finishLoading()) return;

    const currentIndex = this.activeIndex();
    const currentStep = this.steps()[currentIndex];

    if (!currentStep) return;

    if (!this.isStepValid(currentStep)) {
      this.markStepAsTouched(currentStep);
      return;
    }

    if (currentIndex >= this.lastIndex()) {
      this.finished.emit();
      return;
    }

    this.setActiveIndex(currentIndex + 1);
  }

  previous(): void {
    if (this.finishLoading()) return;

    const currentIndex = this.activeIndex();

    if (currentIndex <= 0) return;

    this.setActiveIndex(currentIndex - 1);
  }

  reset(): void {
    this.setActiveIndex(0);

    this.steps().forEach((step) => {
      step.control?.reset();
    });
  }

  private setActiveIndex(index: number): void {
    if (index < 0 || index > this.lastIndex()) return;

    this.activeIndexChange.emit(index);
  }

  private markStepAsTouched(step: StepperStep): void {
    step.control?.markAllAsTouched();
    step.control?.updateValueAndValidity();
  }

  getCircleClasses(index: number, step: StepperStep): string {
    if (this.hasError(step)) {
      return 'bg-error text-on-error border-error';
    }

    if (this.isActive(index)) {
      return 'bg-primary text-on-primary border-primary shadow-md';
    }

    if (this.isCompleted(index)) {
      return 'bg-primary-container text-on-primary-container border-primary';
    }

    return 'bg-surface-container text-on-surface-variant border-outline-variant';
  }

  getTitleClasses(index: number, step: StepperStep): string {
    if (this.hasError(step)) {
      return 'text-error';
    }

    if (this.isActive(index)) {
      return 'text-primary';
    }

    return 'text-on-surface';
  }

  getLineClasses(index: number): string {
    if (index < this.activeIndex()) {
      return 'bg-primary';
    }

    return 'bg-outline-variant';
  }

  getStepIcon(index: number, step: StepperStep): string {
    if (this.hasError(step)) return '!';
    if (this.isCompleted(index)) return '✓';

    return String(index + 1);
  }
}