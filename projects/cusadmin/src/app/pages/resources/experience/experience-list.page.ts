import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Observable, throwError } from 'rxjs';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import type { FormFieldConfig } from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { Experience } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';
import {
  ResourceFormDialogComponent,
  ResourceFormDialogData,
} from '@cusadmin/pages/resources/resource-form-dialog/resource-form-dialog';
import { splitList, toPayload } from '@cusadmin/pages/resources/_shared/resource-io';

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

/** Experience timeline (conb-sites-admin simple resource): sortable list, create/edit in the resource dialog. */
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
    if (action === 'edit') this.openForm(row);
    if (action === 'delete') this.confirmDelete(row);
  }

  add(): void {
    this.openForm();
  }

  private buildFields(): FormFieldConfig[] {
    return [
      { name: 'company', label: 'Company', type: 'text', required: true, maxLength: 120, colClass: HALF },
      { name: 'role', label: 'Role', type: 'text', required: true, maxLength: 120, colClass: HALF },
      { name: 'location', label: 'Location', type: 'text', maxLength: 120, colClass: HALF },
      {
        name: 'employmentType',
        label: 'Employment type',
        type: 'dropdown',
        options: EMPLOYMENT_TYPE_OPTIONS,
        colClass: HALF,
      },
      { name: 'startDate', label: 'Start date', type: 'date', required: true, colClass: HALF },
      {
        name: 'endDate',
        label: 'End date',
        type: 'date',
        colClass: HALF,
        showWhen: { field: 'current', value: false },
      },
      { name: 'current', label: 'I currently work here', type: 'single-checkbox', defaultValue: false, colClass: 'col-span-12' },
      { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, maxLength: 500, colClass: 'col-span-12' },
      {
        name: 'highlights',
        label: 'Highlights (one per line, up to 10)',
        type: 'textarea',
        rows: 5,
        colClass: 'col-span-12',
      },
      {
        name: 'techStack',
        label: 'Tech stack (comma separated)',
        type: 'text',
        placeholder: 'Angular, NgRx, Node.js',
        colClass: 'col-span-12',
      },
      { name: 'order', label: 'Order', type: 'number', min: -1000, max: 1000, defaultValue: 0, colClass: HALF },
      { name: 'showOnWebsite', label: 'Show on website', type: 'single-checkbox', defaultValue: true, colClass: 'col-span-12 md:col-span-3' },
      { name: 'showOnResume', label: 'Show on resume', type: 'single-checkbox', defaultValue: true, colClass: 'col-span-12 md:col-span-3' },
    ];
  }

  private openForm(row?: ExperienceRow): void {
    const value: Record<string, unknown> | undefined = row
      ? {
          ...row,
          startDate: toDateInput(row.startDate),
          endDate: toDateInput(row.endDate),
          highlights: (row.highlights ?? []).join('\n'),
          techStack: (row.techStack ?? []).join(', '),
        }
      : undefined;

    const data: ResourceFormDialogData = {
      title: row ? 'Edit Experience' : 'Add Experience',
      submitLabel: row ? 'Save changes' : 'Create',
      fields: this.buildFields(),
      value,
      onSubmit: (v) => this.save(v, row),
    };

    this.dialog
      .open(ResourceFormDialogComponent, { data, autoFocus: false, width: '760px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((res: { message?: string } | null | undefined) => {
        if (!res) return;
        this.toast.success(res.message || (row ? 'Experience updated' : 'Experience created'));
        this.fetch();
      });
  }

  private save(v: Record<string, unknown>, row?: ExperienceRow): Observable<unknown> {
    const mode = row ? 'update' : 'create';
    const current = v['current'] === true;
    const startDate = String(v['startDate'] ?? '');
    const endDate = current ? '' : String(v['endDate'] ?? '');

    // 'YYYY-MM-DD' strings compare chronologically.
    if (startDate && endDate && endDate < startDate) {
      return throwError(() => new Error('End date must be on or after the start date'));
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
      mode,
      { nullable: NULLABLE },
    );
    // Empty lists are dropped by toPayload; send them explicitly so an edit can clear them.
    body['highlights'] = highlights;
    body['techStack'] = techStack;

    return row ? this.svc.update(PATH, row._id, body) : this.svc.create(PATH, body);
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
