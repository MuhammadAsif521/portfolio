import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import type { FormFieldConfig } from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { Testimonial } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';
import { toPayload } from '@cusadmin/pages/resources/_shared/resource-io';
import {
  ResourceFormDialogComponent,
  ResourceFormDialogData,
} from '@cusadmin/pages/resources/resource-form-dialog/resource-form-dialog';

const PATH = 'testimonials';

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

/** portfolio-node PATCH accepts null for these (clears them). */
const NULLABLE = ['role', 'company', 'rating', 'sourceUrl'] as const;

const FIELDS: FormFieldConfig[] = [
  { name: 'name', label: 'Client name', type: 'text', required: true, maxLength: 80, colClass: 'col-span-12 md:col-span-6' },
  { name: 'role', label: 'Role', type: 'text', maxLength: 80, colClass: 'col-span-12 md:col-span-6' },
  { name: 'company', label: 'Company', type: 'text', maxLength: 120, colClass: 'col-span-12 md:col-span-6' },
  { name: 'source', label: 'Source', type: 'dropdown', options: SOURCE_OPTIONS, required: true, defaultValue: 'client', colClass: 'col-span-12 md:col-span-6' },
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
  { name: 'rating', label: 'Rating', type: 'dropdown', options: RATING_OPTIONS, defaultValue: '', colClass: 'col-span-12 md:col-span-6' },
  {
    name: 'sourceUrl',
    label: 'Source link',
    type: 'url',
    maxLength: 500,
    pattern: '^https?://.+',
    placeholder: 'https://… (where the quote can be verified)',
    colClass: 'col-span-12 md:col-span-6',
  },
  { name: 'order', label: 'Order', type: 'number', defaultValue: 0, colClass: 'col-span-12 md:col-span-6' },
  { name: 'showOnWebsite', label: 'Show on website', type: 'single-checkbox', defaultValue: true, colClass: 'col-span-12 md:col-span-6' },
];

/** Testimonials (simple resource): sortable list, create/edit in ResourceFormDialog, delete with confirm. */
@Component({
  selector: 'app-testimonials-list',
  standalone: true,
  imports: [CustomTableComponent, LoadingButtonComponent],
  templateUrl: './testimonials-list.page.html',
})
export class TestimonialsListPage implements OnInit, AfterViewInit {
  private readonly svc = inject(ResourceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Client', width: 'w-48' },
    { key: 'quote', label: 'Quote', wrap: true },
    { key: 'rating', label: 'Rating', align: 'center', width: 'w-28' },
    { key: 'source', label: 'Source', align: 'center', width: 'w-28' },
    { key: 'showOnWebsite', label: 'On website', align: 'center', width: 'w-28' },
    { key: 'order', label: 'Order', sortable: true, align: 'center', width: 'w-24' },
  ];
  readonly actions: TableAction[] = [
    { key: 'edit', label: 'Edit', icon: 'pencil', color: 'secondary' },
    { key: 'delete', label: 'Delete', icon: 'trash-2', color: 'error' },
  ];

  readonly rows = signal<AdminTestimonial[]>([]);
  readonly loading = signal(false);
  readonly pagination = signal<PaginationMeta>({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 });

  cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @ViewChild('nameTpl', { static: true }) nameTpl!: TemplateRef<unknown>;
  @ViewChild('quoteTpl', { static: true }) quoteTpl!: TemplateRef<unknown>;
  @ViewChild('ratingTpl', { static: true }) ratingTpl!: TemplateRef<unknown>;
  @ViewChild('sourceTpl', { static: true }) sourceTpl!: TemplateRef<unknown>;
  @ViewChild('booleanTpl', { static: true }) booleanTpl!: TemplateRef<unknown>;

  private page = 1;
  private limit = 10;
  /** Allowed: order | -createdAt | createdAt (empty = server default). */
  private sort = '';

  ngOnInit(): void {
    this.fetch();
  }

  ngAfterViewInit(): void {
    this.cellTemplates = {
      name: this.nameTpl,
      quote: this.quoteTpl,
      rating: this.ratingTpl,
      source: this.sourceTpl,
      showOnWebsite: this.booleanTpl,
    };
  }

  private fetch(): void {
    this.loading.set(true);
    this.svc
      .list<AdminTestimonial>(PATH, { page: this.page, limit: this.limit, sort: this.sort || undefined })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.toast.error(getError(e, 'Failed to load testimonials'));
        },
      });
  }

  onPage(page: number): void {
    this.page = page;
    this.fetch();
  }

  onPageSize(size: number): void {
    this.limit = Math.min(size, 50);
    this.page = 1;
    this.fetch();
  }

  onSort(e: SortEvent): void {
    // Only `order` is sortable, and the server allows it ascending only (no '-order'): any direction sorts by order.
    this.sort = e.column === 'order' && e.direction ? 'order' : '';
    this.fetch();
  }

  onAction({ action, row }: { action: string; row: AdminTestimonial }): void {
    if (action === 'edit') this.openForm(row);
    if (action === 'delete') this.confirmDelete(row);
  }

  add(): void {
    this.openForm();
  }

  truncate(text: unknown, max = 90): string {
    const s = String(text ?? '');
    return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
  }

  stars(n: unknown): string {
    const v = Number(n);
    return v >= 1 && v <= 5 ? '★'.repeat(v) : '';
  }

  sourceLabel(id: unknown): string {
    return SOURCE_OPTIONS.find((o) => o.id === id)?.name ?? String(id ?? '—');
  }

  private openForm(row?: AdminTestimonial): void {
    const mode = row ? 'update' : 'create';
    const data: ResourceFormDialogData = {
      title: row ? 'Edit testimonial' : 'Add testimonial (real client quote)',
      submitLabel: row ? 'Save changes' : 'Add Testimonial',
      fields: FIELDS,
      value: row
        ? {
            name: row.name,
            role: row.role ?? '',
            company: row.company ?? '',
            source: row.source,
            quote: row.quote,
            rating: row.rating ?? '',
            sourceUrl: row.sourceUrl ?? '',
            order: row.order ?? 0,
            showOnWebsite: row.showOnWebsite ?? true,
          }
        : undefined,
      onSubmit: (value) => {
        const rating = value['rating'] === '' || value['rating'] == null ? '' : Number(value['rating']);
        const body = toPayload(
          {
            ...value,
            rating,
            order: Number(value['order'] ?? 0),
            showOnWebsite: !!value['showOnWebsite'],
          },
          mode,
          { nullable: NULLABLE },
        );
        return row
          ? this.svc.update<AdminTestimonial>(PATH, row._id, body)
          : this.svc.create<AdminTestimonial>(PATH, body);
      },
    };

    this.dialog
      .open(ResourceFormDialogComponent, { data, autoFocus: false, width: '720px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((res: { message?: string } | null | undefined) => {
        if (!res) return;
        this.toast.success(res.message || (row ? 'Testimonial updated' : 'Testimonial added'));
        this.fetch();
      });
  }

  private confirmDelete(row: AdminTestimonial): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete testimonial?',
        message: `The testimonial from "${row.name}" will be permanently deleted. This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'error',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.svc.remove(PATH, row._id).subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Testimonial deleted');
                this.fetch();
                resolve(true);
              },
              error: (e: unknown) => {
                this.toast.error(getError(e, 'Delete failed'));
                resolve(false);
              },
            });
          }),
      },
    });
  }
}
