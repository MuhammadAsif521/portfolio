import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import {
  CONTACT_SOURCE_LABELS,
  type ContactMessage,
  type ContactMessageSource,
  type ContactMessageStatus,
} from '@cusadmin/core/models/contact-message.model';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'contact';

type StatusFilter = ContactMessageStatus | '';

/** Contact inbox (conb-sites-admin list-page pattern): status filter, sortable table, open/read/archive/delete actions. */
@Component({
  selector: 'app-messages-list',
  standalone: true,
  imports: [DatePipe, CustomTableComponent],
  templateUrl: './messages-list.page.html',
})
export class MessagesListPage implements OnInit, AfterViewInit {
  private readonly svc = inject(ResourceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'read', label: 'Read' },
    { value: 'archived', label: 'Archived' },
  ];
  readonly columns: TableColumn[] = [
    { key: 'from', label: 'From', width: 'w-64' },
    { key: 'preview', label: 'Message', wrap: true },
    { key: 'source', label: 'Source', align: 'center', width: 'w-32' },
    { key: 'status', label: 'Status', align: 'center', width: 'w-28' },
    { key: 'createdAt', label: 'Received', sortable: true, width: 'w-48' },
  ];
  readonly actions: TableAction[] = [
    { key: 'open', label: 'Open', icon: 'eye', color: 'info' },
    { key: 'read', label: 'Mark as read', icon: 'mail-open', color: 'primary', hidden: (row: ContactMessage) => row.status !== 'new' },
    { key: 'archive', label: 'Archive', icon: 'archive', color: 'secondary', hidden: (row: ContactMessage) => row.status === 'archived' },
    { key: 'delete', label: 'Delete', icon: 'trash-2', color: 'error' },
  ];

  readonly rows = signal<ContactMessage[]>([]);
  readonly loading = signal(false);
  readonly status = signal<StatusFilter>('');
  readonly pagination = signal<PaginationMeta>({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 });

  cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @ViewChild('fromTpl', { static: true }) fromTpl!: TemplateRef<unknown>;
  @ViewChild('previewTpl', { static: true }) previewTpl!: TemplateRef<unknown>;
  @ViewChild('sourceTpl', { static: true }) sourceTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('dateTpl', { static: true }) dateTpl!: TemplateRef<unknown>;

  private page = 1;
  private limit = 10;
  private sort = '';

  ngOnInit(): void {
    this.fetch();
  }

  ngAfterViewInit(): void {
    this.cellTemplates = {
      from: this.fromTpl,
      preview: this.previewTpl,
      source: this.sourceTpl,
      status: this.statusTpl,
      createdAt: this.dateTpl,
    };
  }

  private fetch(): void {
    this.loading.set(true);
    this.svc
      .list<ContactMessage>(PATH, {
        page: this.page,
        limit: this.limit,
        sort: this.sort || undefined,
        status: this.status() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.toast.error(getError(e, 'Failed to load messages'));
        },
      });
  }

  setStatus(value: StatusFilter): void {
    if (this.status() === value) return;
    this.status.set(value);
    this.page = 1;
    this.fetch();
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

  onAction({ action, row }: { action: string; row: ContactMessage }): void {
    if (action === 'open') void this.router.navigate(['/messages', row._id]);
    if (action === 'read') this.setMessageStatus(row, 'read');
    if (action === 'archive') this.setMessageStatus(row, 'archived');
    if (action === 'delete') this.confirmDelete(row);
  }

  /** Subject, else the first ~80 chars of the message, else null (email-only quick box). */
  preview(row: ContactMessage): string | null {
    const subject = row.subject?.trim();
    if (subject) return subject;
    const text = row.message?.replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text;
  }

  sourceLabel(source: ContactMessageSource): string {
    return CONTACT_SOURCE_LABELS[source] ?? source;
  }

  private setMessageStatus(row: ContactMessage, status: ContactMessageStatus): void {
    this.svc.update<ContactMessage>(PATH, row._id, { status }).subscribe({
      next: (res) => {
        this.toast.success(res.message || 'Message updated');
        this.fetch();
      },
      error: (e: unknown) => this.toast.error(getError(e, 'Update failed')),
    });
  }

  private confirmDelete(row: ContactMessage): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete message?',
        message: `The message from "${row.name || row.email}" will be permanently deleted. This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'error',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.svc.remove(PATH, row._id).subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Message deleted');
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
