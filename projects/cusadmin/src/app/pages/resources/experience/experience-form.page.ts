import { Component, OnInit, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { Experience } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { splitList, toPayload } from '@cusadmin/pages/resources/_shared/resource-io';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'experience';
/** Keys portfolio-node's updateExperienceBody lets PATCH clear with null. */
const NULLABLE = ['location', 'employmentType', 'endDate', 'summary'] as const;

/** Admin rows also carry the visibility flags (not part of the public Experience shape). */
type ExperienceRow = Experience & { showOnResume?: boolean; showOnWebsite?: boolean };

const EMPLOYMENT_TYPE_OPTIONS = [
  { name: 'Full-time', id: 'full-time' },
  { name: 'Part-time', id: 'part-time' },
  { name: 'Contract', id: 'contract' },
  { name: 'Freelance', id: 'freelance' },
  { name: 'Internship', id: 'internship' },
  { name: 'Military', id: 'military' },
];

const HALF = 'col-span-12 md:col-span-6';

/** ISO datetime from the API → 'YYYY-MM-DD' for the native date input. */
const toDateInput = (v: unknown): string => (typeof v === 'string' && v ? v.slice(0, 10) : '');

/** Create / edit an experience entry (conb-sites-admin form-page pattern: config-driven dynamic form). */
@Component({
  selector: 'app-experience-form',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicReactiveFormComponent, LoadingButtonComponent, PageLoaderComponent],
  templateUrl: './experience-form.page.html',
})
export class ExperienceFormPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly formConfig: FormFieldConfig[] = [
    { name: 'company', label: 'Company', type: 'text', required: true, maxLength: 120, colClass: HALF },
    { name: 'role', label: 'Role', type: 'text', required: true, maxLength: 120, colClass: HALF },
    { name: 'location', label: 'Location', type: 'text', maxLength: 120, colClass: HALF },
    { name: 'employmentType', label: 'Employment type', type: 'dropdown', options: EMPLOYMENT_TYPE_OPTIONS, colClass: HALF },
    { name: 'startDate', label: 'Start date', type: 'date', required: true, colClass: HALF },
    { name: 'endDate', label: 'End date', type: 'date', colClass: HALF, showWhen: { field: 'current', value: false } },
    { name: 'current', label: 'I currently work here', type: 'single-checkbox', defaultValue: false, colClass: 'col-span-12' },
    { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, maxLength: 500, colClass: 'col-span-12' },
    { name: 'highlights', label: 'Highlights (one per line, up to 10)', type: 'textarea', rows: 5, colClass: 'col-span-12' },
    { name: 'techStack', label: 'Tech stack (comma separated)', type: 'text', placeholder: 'Angular, NgRx, Node.js', colClass: 'col-span-12' },
    { name: 'order', label: 'Order', type: 'number', min: -1000, max: 1000, defaultValue: 0, colClass: HALF },
    { name: 'showOnWebsite', label: 'Show on website', type: 'single-checkbox', defaultValue: true, colClass: 'col-span-12 md:col-span-3' },
    { name: 'showOnResume', label: 'Show on resume', type: 'single-checkbox', defaultValue: true, colClass: 'col-span-12 md:col-span-3' },
  ];

  readonly saving = signal(false);
  readonly loading = signal(false);
  form!: FormGroup;
  id: string | null = null;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id');
    if (!this.id) {
      this.form = buildFormGroup(this.formConfig, {});
      return;
    }
    this.loading.set(true);
    this.svc.getById<ExperienceRow>(PATH, this.id).subscribe({
      next: (res) => {
        const row = res.data;
        this.form = buildFormGroup(this.formConfig, {
          ...row,
          startDate: toDateInput(row.startDate),
          endDate: toDateInput(row.endDate),
          highlights: (row.highlights ?? []).join('\n'),
          techStack: (row.techStack ?? []).join(', '),
        });
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.toast.error(getError(e, 'Failed to load experience'));
        void this.router.navigate(['/experience']);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields');
      return;
    }
    const v = this.form.getRawValue();
    const current = v['current'] === true;
    const startDate = String(v['startDate'] ?? '');
    const endDate = current ? '' : String(v['endDate'] ?? '');

    // 'YYYY-MM-DD' strings compare chronologically.
    if (startDate && endDate && endDate < startDate) {
      this.toast.error('End date must be on or after the start date');
      return;
    }

    const highlights = String(v['highlights'] ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const techStack = splitList(v['techStack']);

    const body = toPayload(
      {
        company: v['company'],
        role: v['role'],
        location: v['location'],
        employmentType: v['employmentType'],
        startDate,
        endDate,
        current,
        summary: v['summary'],
        order: Number(v['order'] ?? 0) || 0,
        showOnWebsite: v['showOnWebsite'] === true,
        showOnResume: v['showOnResume'] === true,
      },
      this.id ? 'update' : 'create',
      { nullable: NULLABLE },
    );
    // Empty lists are dropped by toPayload; send them explicitly so an edit can clear them.
    body['highlights'] = highlights;
    body['techStack'] = techStack;

    this.saving.set(true);
    const req$ = this.id
      ? this.svc.update<ExperienceRow>(PATH, this.id, body)
      : this.svc.create<ExperienceRow>(PATH, body);
    req$.subscribe({
      next: (res) => {
        this.toast.success(res.message || (this.id ? 'Experience updated' : 'Experience created'));
        void this.router.navigate(['/experience']);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.toast.error(getError(e, 'Save failed'));
      },
    });
  }
}
