import { AfterViewInit, Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { CustomTableComponent, SortEvent, TableAction, TableColumn } from '@shared/components/custom-table/custom-table';
import { CustomInputComponent } from '@shared/components/form-components/custom-input/custom-input.component';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import type { BlogPostCard } from '@shared/interfaces/public-api.interface';
import { environment } from '@shared/environment/environment';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'blog';

/** Blog posts list (conb-sites-admin list-page pattern): search, sortable table, edit/delete actions. */
@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [DatePipe, CustomTableComponent, CustomInputComponent, LoadingButtonComponent],
  templateUrl: './blog-list.page.html',
})
export class BlogListPage implements OnInit, AfterViewInit {
  private readonly svc = inject(ResourceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchPlaceholder = 'Search posts';
  readonly columns: TableColumn[] = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'tags', label: 'Tags', width: 'w-56' },
    { key: 'status', label: 'Status', align: 'center', width: 'w-28' },
    { key: 'readingTime', label: 'Read time', align: 'center', width: 'w-28' },
    { key: 'publishedAt', label: 'Published', sortable: true, width: 'w-36' },
  ];
  readonly actions: TableAction[] = [
    { key: 'view', label: 'View on site', icon: 'external-link', color: 'info', hidden: (row: BlogPostCard) => row.status !== 'published' },
    { key: 'edit', label: 'Edit', icon: 'pencil', color: 'secondary' },
    { key: 'delete', label: 'Delete', icon: 'trash-2', color: 'error' },
  ];

  readonly rows = signal<BlogPostCard[]>([]);
  readonly loading = signal(false);
  readonly pagination = signal<PaginationMeta>({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 });

  cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @ViewChild('dateTpl', { static: true }) dateTpl!: TemplateRef<unknown>;
  @ViewChild('tagsTpl', { static: true }) tagsTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('readingTimeTpl', { static: true }) readingTimeTpl!: TemplateRef<unknown>;

  private page = 1;
  private limit = 10;
  private sort = '';
  private searchTerm = '';
  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef)).subscribe((term) => {
      this.searchTerm = term.trim();
      this.page = 1;
      this.fetch();
    });
    this.fetch();
  }

  ngAfterViewInit(): void {
    this.cellTemplates = {
      publishedAt: this.dateTpl,
      tags: this.tagsTpl,
      status: this.statusTpl,
      readingTime: this.readingTimeTpl,
    };
  }

  private fetch(): void {
    this.loading.set(true);
    this.svc
      .list<BlogPostCard>(PATH, {
        page: this.page,
        limit: this.limit,
        q: this.searchTerm || undefined,
        sort: this.sort || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.toast.error(getError(e, 'Failed to load posts'));
        },
      });
  }

  onSearch(term: string): void {
    this.search$.next(term);
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

  onAction({ action, row }: { action: string; row: BlogPostCard }): void {
    if (action === 'edit') void this.router.navigate(['/blog', row._id, 'edit']);
    if (action === 'view') window.open(`${environment.siteUrl}/blog/${row.slug}`, '_blank', 'noopener');
    if (action === 'delete') this.confirmDelete(row);
  }

  add(): void {
    void this.router.navigate(['/blog', 'new']);
  }

  private confirmDelete(row: BlogPostCard): void {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete post?',
        message: `"${row.title}" will be permanently deleted, along with its cover image. This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'error',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.svc.remove(PATH, row._id).subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Post deleted');
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
