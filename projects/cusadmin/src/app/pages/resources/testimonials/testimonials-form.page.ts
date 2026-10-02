import { Component, OnInit, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { Testimonial } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { toPayload } from '@cusadmin/pages/resources/_shared/resource-io';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'testimonials';
/** portfolio-node PATCH accepts null for these (clears them). */
const NULLABLE = ['role', 'company', 'rating', 'sourceUrl'] as const;

/** Admin shape: the public Testimonial plus the admin-only visibility flag. */
type AdminTestimonial = Testimonial & { showOnWebsite: boolean };

const SOURCE_OPTIONS = [
  { name: 'Client (direct)', id: 'client' },
  { name: 'Fiverr', id: 'fiverr' },
  { name: 'Upwork', id: 'upwork' },
  { name: 'LinkedIn', id: 'linkedin' },
  { name: 'Other', id: 'other' },
];

const RATING_OPTIONS = [
  { name: 'No rating', id: '' },
  ...[5, 4, 3, 2, 1].map((n) => ({ name: `${'★'.repeat(n)} (${n})`, id: n })),
];

const HALF = 'col-span-12 md:col-span-6';

/** Create / edit a testimonial (conb-sites-admin form-page pattern). Real client quotes only. */
@Component({
  selector: 'app-testimonials-form',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicReactiveFormComponent, LoadingButtonComponent, PageLoaderComponent],
  templateUrl: './testimonials-form.page.html',
})
export class TestimonialsFormPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly formConfig: FormFieldConfig[] = [
    { name: 'name', label: 'Client name', type: 'text', required: true, maxLength: 80, colClass: HALF },
    { name: 'role', label: 'Role', type: 'text', maxLength: 80, colClass: HALF },
    { name: 'company', label: 'Company', type: 'text', maxLength: 120, colClass: HALF },
    { name: 'source', label: 'Source', type: 'dropdown', options: SOURCE_OPTIONS, required: true, defaultValue: 'client', colClass: HALF },
    {
      name: 'quote',
      label: 'Quote',
      type: 'textarea',
      rows: 4,
      required: true,
      minLength: 10,
      maxLength: 600,
      placeholder: "Paste the client's exact words (real quotes only, never rewritten or invented)",
      colClass: 'col-span-12',
    },
    { name: 'rating', label: 'Rating', type: 'dropdown', options: RATING_OPTIONS, defaultValue: '', colClass: HALF },
    {
      name: 'sourceUrl',
      label: 'Source link',
      type: 'url',
      maxLength: 500,
      pattern: '^https?://.+',
      placeholder: 'https://… (where the quote can be verified)',
      colClass: HALF,
    },
    { name: 'order', label: 'Order', type: 'number', defaultValue: 0, colClass: HALF },
    { name: 'showOnWebsite', label: 'Show on website', type: 'single-checkbox', defaultValue: true, colClass: HALF },
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
    this.svc.getById<AdminTestimonial>(PATH, this.id).subscribe({
      next: (res) => {
        const row = res.data;
        this.form = buildFormGroup(this.formConfig, {
          name: row.name,
          role: row.role ?? '',
          company: row.company ?? '',
          source: row.source,
          quote: row.quote,
          rating: row.rating ?? '',
          sourceUrl: row.sourceUrl ?? '',
          order: row.order ?? 0,
          showOnWebsite: row.showOnWebsite ?? true,
        });
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.toast.error(getError(e, 'Failed to load testimonial'));
        void this.router.navigate(['/testimonials']);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields');
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    // '' = "No rating": toPayload drops it on create and sends null (clears it) on update.
    const rating = value['rating'] === '' || value['rating'] == null ? '' : Number(value['rating']);
    const body = toPayload(
      {
        ...value,
        rating,
        order: Number(value['order'] ?? 0),
        showOnWebsite: !!value['showOnWebsite'],
      },
      this.id ? 'update' : 'create',
      { nullable: NULLABLE },
    );
    const req$ = this.id
      ? this.svc.update<AdminTestimonial>(PATH, this.id, body)
      : this.svc.create<AdminTestimonial>(PATH, body);
    req$.subscribe({
      next: (res) => {
        this.toast.success(res.message || (this.id ? 'Testimonial updated' : 'Testimonial added'));
        void this.router.navigate(['/testimonials']);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.toast.error(getError(e, 'Save failed'));
      },
    });
  }
}
