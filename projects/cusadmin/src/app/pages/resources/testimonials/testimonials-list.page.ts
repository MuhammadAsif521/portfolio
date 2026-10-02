import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import type { Testimonial } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';

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

/** Testimonials (simple resource): sortable list, create/edit on the testimonials form page, delete with confirm. */
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
  private readonly router = inject(Router);

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
    if (action === 'edit') void this.router.navigate(['/testimonials', row._id, 'edit']);
    if (action === 'delete') this.confirmDelete(row);
  }

  add(): void {
    void this.router.navigate(['/testimonials', 'new']);
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
