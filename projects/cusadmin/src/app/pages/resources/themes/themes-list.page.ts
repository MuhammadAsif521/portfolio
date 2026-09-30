import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import type { FormFieldConfig } from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { ThemePalette } from '@shared/interfaces/auth.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';
import { toPayload } from '@cusadmin/pages/resources/_shared/resource-io';
import {
  ResourceFormDialogComponent,
  ResourceFormDialogData,
} from '@cusadmin/pages/resources/resource-form-dialog/resource-form-dialog';

const PATH = 'themes';

/** Admin shape: the public palette plus the server-owned flags (read-only here) and timestamps. */
type AdminTheme = ThemePalette & { isActive: boolean; isDefault: boolean; createdAt?: string; updatedAt?: string };

/** portfolio-node hexColor: #RRGGBB (uppercased server-side). */
const HEX = '^#[0-9A-Fa-f]{6}$';

const FIELDS: FormFieldConfig[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, minLength: 2, maxLength: 50, colClass: 'col-span-12' },
  { name: 'primary', label: 'Primary', type: 'color', required: true, pattern: HEX, defaultValue: '#FD853A', placeholder: '#FD853A', colClass: 'col-span-12 md:col-span-4' },
  { name: 'secondary', label: 'Secondary', type: 'color', required: true, pattern: HEX, defaultValue: '#141414', placeholder: '#141414', colClass: 'col-span-12 md:col-span-4' },
  { name: 'accent', label: 'Accent', type: 'color', required: true, pattern: HEX, defaultValue: '#FEB173', placeholder: '#FEB173', colClass: 'col-span-12 md:col-span-4' },
];

/** Themes: brand palettes; one is active on the website. Activate/edit/delete, create/edit in ResourceFormDialog. */
@Component({
  selector: 'app-themes-list',
  standalone: true,
  imports: [DatePipe, CustomTableComponent, LoadingButtonComponent],
  templateUrl: './themes-list.page.html',
})
export class ThemesListPage implements OnInit, AfterViewInit {
  private readonly svc = inject(ResourceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Theme', sortable: true },
    { key: 'swatches', label: 'Colours', width: 'w-56' },
    { key: 'createdAt', label: 'Created', width: 'w-36' },
    { key: 'updatedAt', label: 'Updated', sortable: true, width: 'w-36' },
  ];
  readonly actions: TableAction[] = [
    { key: 'activate', label: 'Activate', icon: 'check-circle', color: 'success', hidden: (row: AdminTheme) => row.isActive },
    { key: 'edit', label: 'Edit', icon: 'pencil', color: 'secondary' },
    { key: 'delete', label: 'Delete', icon: 'trash-2', color: 'error', hidden: (row: AdminTheme) => row.isActive || row.isDefault },
  ];

  readonly rows = signal<AdminTheme[]>([]);
  readonly loading = signal(false);
  readonly pagination = signal<PaginationMeta>({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 });

  cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @ViewChild('nameTpl', { static: true }) nameTpl!: TemplateRef<unknown>;
  @ViewChild('swatchesTpl', { static: true }) swatchesTpl!: TemplateRef<unknown>;
  @ViewChild('dateTpl', { static: true }) dateTpl!: TemplateRef<unknown>;

  private page = 1;
  private limit = 10;
  /** Allowed: name | -name | -updatedAt (empty = server default: active, default, then name). */
  private sort = '';

  ngOnInit(): void {
    this.fetch();
  }

  ngAfterViewInit(): void {
    this.cellTemplates = {
      name: this.nameTpl,
      swatches: this.swatchesTpl,
      createdAt: this.dateTpl,
      updatedAt: this.dateTpl,
    };
  }

  private fetch(): void {
    this.loading.set(true);
    this.svc
      .list<AdminTheme>(PATH, { page: this.page, limit: this.limit, sort: this.sort || undefined })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.toast.error(getError(e, 'Failed to load themes'));
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
    // updatedAt is descending-only on the server ('-updatedAt'): any direction sorts newest first.
    if (!e.direction) this.sort = '';
    else if (e.column === 'name') this.sort = e.direction === 'desc' ? '-name' : 'name';
    else if (e.column === 'updatedAt') this.sort = '-updatedAt';
    else this.sort = '';
    this.fetch();
  }

  onAction({ action, row }: { action: string; row: AdminTheme }): void {
    if (action === 'activate') this.confirmActivate(row);
    if (action === 'edit') this.openForm(row);
    if (action === 'delete') this.confirmDelete(row);
  }

  add(): void {
    this.openForm();
  }

  private openForm(row?: AdminTheme): void {
    const mode = row ? 'update' : 'create';
    const data: ResourceFormDialogData = {
      title: row ? 'Edit theme' : 'Add theme',
      submitLabel: row ? 'Save changes' : 'Add Theme',
      fields: FIELDS,
      value: row
        ? { name: row.name, primary: row.primary, secondary: row.secondary, accent: row.accent }
        : undefined,
      onSubmit: (value) => {
        const hex = (v: unknown) => String(v ?? '').trim().toUpperCase();
        // isActive / isDefault are server-owned (strict schema): never sent.
        const body = toPayload(
          {
            name: value['name'],
            primary: hex(value['primary']),
            secondary: hex(value['secondary']),
            accent: hex(value['accent']),
          },
          mode,
        );
        return row ? this.svc.update<AdminTheme>(PATH, row._id, body) : this.svc.create<AdminTheme>(PATH, body);
      },
    };

    this.dialog
      .open(ResourceFormDialogComponent, { data, autoFocus: false, width: '720px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((res: { message?: string } | null | undefined) => {
        if (!res) return;
        this.toast.success(res.message || (row ? 'Theme updated' : 'Theme added'));
        this.fetch();
      });
  }

  private confirmActivate(row: AdminTheme): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Activate theme?',
        message: `The website will switch to "${row.name}" immediately.`,
        confirmText: 'Activate',
        cancelText: 'Cancel',
        tone: 'success',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.svc.action<AdminTheme>(PATH, row._id, 'activate').subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Theme activated');
                this.fetch();
                resolve(true);
              },
              error: (e: unknown) => {
                this.toast.error(getError(e, 'Activation failed'));
                resolve(false);
              },
            });
          }),
      },
    });
  }

  private confirmDelete(row: AdminTheme): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete theme?',
        message: `The theme "${row.name}" will be permanently deleted. This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'error',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            // 409 THEME_ACTIVE_UNDELETABLE / THEME_DEFAULT_UNDELETABLE surface via getError.
            this.svc.remove(PATH, row._id).subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Theme deleted');
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
