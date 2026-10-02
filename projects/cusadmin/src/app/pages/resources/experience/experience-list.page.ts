import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import type { Experience } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'experience';

/** Admin rows also carry the visibility flags (not part of the public Experience shape). */
type ExperienceRow = Experience & { showOnResume?: boolean; showOnWebsite?: boolean };

/** Experience timeline (conb-sites-admin simple resource): sortable list, create/edit on the experience form page. */
@Component({
  selector: 'app-experience-list',
  standalone: true,
  imports: [DatePipe, CustomTableComponent, LoadingButtonComponent],
  templateUrl: './experience-list.page.html',
})
export class ExperienceListPage implements OnInit, AfterViewInit {
  private readonly svc = inject(ResourceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly columns: TableColumn[] = [
    { key: 'company', label: 'Company' },
    { key: 'role', label: 'Role' },
    { key: 'startDate', label: 'Dates', sortable: true, width: 'w-44' },
    { key: 'showOnWebsite', label: 'Website', align: 'center', width: 'w-28' },
    { key: 'showOnResume', label: 'Resume', align: 'center', width: 'w-28' },
    { key: 'order', label: 'Order', sortable: true, align: 'center', width: 'w-24' },
  ];
  readonly actions: TableAction[] = [
    { key: 'edit', label: 'Edit', icon: 'pencil', color: 'secondary' },
    { key: 'delete', label: 'Delete', icon: 'trash-2', color: 'error' },
  ];

  readonly rows = signal<ExperienceRow[]>([]);
  readonly loading = signal(false);
  readonly pagination = signal<PaginationMeta>({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 });

  cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @ViewChild('companyTpl', { static: true }) companyTpl!: TemplateRef<unknown>;
  @ViewChild('datesTpl', { static: true }) datesTpl!: TemplateRef<unknown>;
  @ViewChild('booleanTpl', { static: true }) booleanTpl!: TemplateRef<unknown>;

  private page = 1;
  private limit = 10;
  private sort = '';

  ngOnInit(): void {
    this.fetch();
  }

  ngAfterViewInit(): void {
    this.cellTemplates = {
      company: this.companyTpl,
      startDate: this.datesTpl,
      showOnWebsite: this.booleanTpl,
      showOnResume: this.booleanTpl,
    };
  }

  private fetch(): void {
    this.loading.set(true);
    this.svc
      .list<ExperienceRow>(PATH, { page: this.page, limit: this.limit, sort: this.sort || undefined })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.toast.error(getError(e, 'Failed to load experience'));
        },
      });
  }

  onPage(page: number): void {
    this.page = page;
    this.fetch();
  }

  onPageSize(size: number): void {
    this.limit = size;
    this.page = 1;
    this.fetch();
  }

  onSort(e: SortEvent): void {
    this.sort = !e.direction ? '' : e.direction === 'desc' ? `-${e.column}` : e.column;
    this.fetch();
  }

  onAction({ action, row }: { action: string; row: ExperienceRow }): void {
    if (action === 'edit') void this.router.navigate(['/experience', row._id, 'edit']);
    if (action === 'delete') this.confirmDelete(row);
  }

  add(): void {
    void this.router.navigate(['/experience', 'new']);
  }

  private confirmDelete(row: ExperienceRow): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete experience?',
        message: `"${row.role} at ${row.company}" will be permanently removed from the website timeline and the resume. This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'error',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.svc.remove(PATH, row._id).subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Experience deleted');
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
