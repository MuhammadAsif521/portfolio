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
import type { Project } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { splitList, toPayload, uploadImageFields } from '@cusadmin/pages/resources/_shared/resource-io';
import { SEO_FIELDS, STATUS_OPTIONS } from '@cusadmin/pages/resources/_shared/common-fields';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'projects';
/** Fields portfolio-node lets a PATCH clear with null (projects validator). */
const NULLABLE = ['client', 'content', 'coverImage', 'architectureDiagram', 'liveUrl', 'repoUrl'] as const;

/** Create / edit a project (conb-sites-admin form-page pattern: config-driven dynamic form). */
@Component({
  selector: 'app-projects-form',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicReactiveFormComponent, LoadingButtonComponent, PageLoaderComponent],
  templateUrl: './projects-form.page.html',
})
export class ProjectsFormPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly formConfig: FormFieldConfig[] = [
    { name: 'title', label: 'Title', type: 'text', required: true, minLength: 3, maxLength: 120, colClass: 'col-span-12 md:col-span-8' },
    { name: 'status', label: 'Status', type: 'dropdown', options: STATUS_OPTIONS, defaultValue: 'draft', required: true, colClass: 'col-span-12 md:col-span-4' },
    { name: 'slug', label: 'Slug', type: 'text', placeholder: 'Generated from the title if empty', maxLength: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', colClass: 'col-span-12 md:col-span-6' },
    { name: 'client', label: 'Client', type: 'text', maxLength: 120, colClass: 'col-span-12 md:col-span-6' },
    { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, required: true, maxLength: 300, colClass: 'col-span-12' },
    { name: 'content', label: 'Case study', type: 'richtext', colClass: 'col-span-12' },
    { name: 'techStack', label: 'Tech stack (comma separated)', type: 'text', placeholder: 'Angular, NgRx, Node.js', colClass: 'col-span-12' },
    { name: 'liveUrl', label: 'Live URL', type: 'url', placeholder: 'https://', colClass: 'col-span-12 md:col-span-6' },
    { name: 'repoUrl', label: 'Source URL', type: 'url', placeholder: 'https://', colClass: 'col-span-12 md:col-span-6' },
    { name: 'coverImage', label: 'Cover image', type: 'file', accept: 'image/*', colClass: 'col-span-12 md:col-span-6' },
    { name: 'architectureDiagram', label: 'Architecture diagram', type: 'file', accept: 'image/*', colClass: 'col-span-12 md:col-span-6' },
    { name: 'order', label: 'Order', type: 'number', defaultValue: 0, min: -1000, max: 1000, colClass: 'col-span-12 md:col-span-4' },
    { name: 'featured', label: 'Featured on the home page', type: 'single-checkbox', defaultValue: false, colClass: 'col-span-12 md:col-span-8' },
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
    this.svc.getById<Project>(PATH, this.id).subscribe({
      next: (res) => {
        const project = res.data;
        this.form = buildFormGroup(this.formConfig, { ...project, techStack: project.techStack.join(', ') });
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.toast.error(getError(e, 'Failed to load project'));
        void this.router.navigate(['/projects']);
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

    uploadImageFields(
      this.svc,
      [
        { name: 'coverImage', folder: 'projects', alt },
        { name: 'architectureDiagram', folder: 'projects', alt: `${alt} architecture diagram` },
      ],
      raw,
    )
      .pipe(
        switchMap((value) => {
          const techStack = splitList(value['techStack']);
          const body = toPayload(
            { ...value, techStack, order: Number(value['order'] ?? 0) },
            this.id ? 'update' : 'create',
            { nullable: NULLABLE },
          );
          // techStack isn't nullable; send [] so clearing it on edit sticks (toPayload drops empty lists).
          if (this.id && !techStack.length) body['techStack'] = [];
          return this.id ? this.svc.update<Project>(PATH, this.id, body) : this.svc.create<Project>(PATH, body);
        }),
      )
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Project saved');
          void this.router.navigate(['/projects']);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.toast.error(getError(e, 'Save failed'));
        },
      });
  }
}
