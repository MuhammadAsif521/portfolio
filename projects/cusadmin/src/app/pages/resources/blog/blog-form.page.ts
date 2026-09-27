import { Component, OnInit, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { BlogPost } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { splitList, toPayload, uploadImageFields } from '@cusadmin/pages/resources/_shared/resource-io';
import { SEO_FIELDS, STATUS_OPTIONS } from '@cusadmin/pages/resources/_shared/common-fields';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'blog';
/** Fields portfolio-node lets a PATCH clear with null (blog validator). */
const NULLABLE = ['coverImage'] as const;

/**
 * Create / edit a blog post (conb-sites-admin form-page pattern: config-driven dynamic form).
 * readingTime and publishedAt are server-owned and have no controls, so they are never sent.
 */
@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicReactiveFormComponent, LoadingButtonComponent, PageLoaderComponent],
  templateUrl: './blog-form.page.html',
})
export class BlogFormPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly formConfig: FormFieldConfig[] = [
    { name: 'title', label: 'Title', type: 'text', required: true, minLength: 3, maxLength: 150, colClass: 'col-span-12 md:col-span-8' },
    { name: 'status', label: 'Status', type: 'dropdown', options: STATUS_OPTIONS, defaultValue: 'draft', required: true, colClass: 'col-span-12 md:col-span-4' },
    { name: 'slug', label: 'Slug', type: 'text', placeholder: 'Generated from the title if empty', maxLength: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', colClass: 'col-span-12 md:col-span-6' },
    { name: 'tags', label: 'Tags (comma separated)', type: 'text', placeholder: 'angular, ngrx, performance', colClass: 'col-span-12 md:col-span-6' },
    { name: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 3, required: true, maxLength: 300, colClass: 'col-span-12' },
    { name: 'content', label: 'Content', type: 'richtext', required: true, colClass: 'col-span-12' },
    { name: 'coverImage', label: 'Cover image', type: 'file', accept: 'image/*', colClass: 'col-span-12 md:col-span-6' },
    SEO_FIELDS,
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
    this.svc.getById<BlogPost>(PATH, this.id).subscribe({
      next: (res) => {
        const post = res.data;
        this.form = buildFormGroup(this.formConfig, { ...post, tags: (post.tags ?? []).join(', ') });
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.toast.error(getError(e, 'Failed to load post'));
        void this.router.navigate(['/blog']);
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
    const raw = this.form.getRawValue();
    const alt = String(raw.title ?? '').trim();

    uploadImageFields(this.svc, [{ name: 'coverImage', folder: 'blog', alt }], raw)
      .pipe(
        switchMap((value) => {
          const tags = splitList(value['tags']);
          const body = toPayload({ ...value, tags }, this.id ? 'update' : 'create', { nullable: NULLABLE });
          // tags is notNullable on PATCH but [] is valid: send it so clearing every tag sticks.
          if (this.id && !tags.length) body['tags'] = [];
          return this.id ? this.svc.update<BlogPost>(PATH, this.id, body) : this.svc.create<BlogPost>(PATH, body);
        }),
      )
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Post saved');
          void this.router.navigate(['/blog']);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.toast.error(getError(e, 'Save failed'));
        },
      });
  }
}
