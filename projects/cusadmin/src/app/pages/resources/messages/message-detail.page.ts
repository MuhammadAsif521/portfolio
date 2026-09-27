import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import {
  CONTACT_SOURCE_LABELS,
  type ContactMessage,
  type ContactMessageStatus,
} from '@cusadmin/core/models/contact-message.model';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'contact';

/** One contact message: full text, metadata, reply/status/delete actions. Opening a new message marks it read. */
@Component({
  selector: 'app-message-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, LoadingButtonComponent, PageLoaderComponent],
  templateUrl: './message-detail.page.html',
})
export class MessageDetailPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly message = signal<ContactMessage | null>(null);
  readonly loading = signal(true);
  /** Status currently being saved (drives the button spinner). */
  readonly saving = signal<ContactMessageStatus | null>(null);

  readonly sourceLabel = computed(() => {
    const m = this.message();
    return m ? (CONTACT_SOURCE_LABELS[m.source] ?? m.source) : '';
  });

  readonly mailto = computed(() => {
    const m = this.message();
    if (!m) return '';
    const subject = m.subject?.trim() ? `Re: ${m.subject.trim()}` : 'Re: your message';
    // Keep '@' readable; everything else (incl. '?', '&') is percent-encoded so it can't break the URI.
    const to = encodeURIComponent(m.email).replace(/%40/g, '@');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}`;
  });

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.id) {
      void this.router.navigate(['/messages']);
      return;
    }
    this.svc.getById<ContactMessage>(PATH, this.id).subscribe({
      next: (res) => {
        this.message.set(res.data);
        this.loading.set(false);
        if (res.data.status === 'new') this.autoMarkRead();
      },
      error: (e: unknown) => {
        this.toast.error(getError(e, 'Failed to load message'));
        void this.router.navigate(['/messages']);
      },
    });
  }

  /** Silent: the server stamps readAt the first time status becomes 'read'. */
  private autoMarkRead(): void {
    this.svc.update<ContactMessage>(PATH, this.id, { status: 'read' }).subscribe({
      next: (res) => this.message.set(res.data ?? { ...this.message()!, status: 'read' }),
      error: (e: unknown) => this.toast.error(getError(e, 'Could not mark the message as read')),
    });
  }

  setStatus(status: ContactMessageStatus): void {
    if (this.saving()) return;
    this.saving.set(status);
    this.svc.update<ContactMessage>(PATH, this.id, { status }).subscribe({
      next: (res) => {
        this.message.set(res.data ?? { ...this.message()!, status });
        this.saving.set(null);
        this.toast.success(res.message || 'Message updated');
      },
      error: (e: unknown) => {
        this.saving.set(null);
        this.toast.error(getError(e, 'Update failed'));
      },
    });
  }

  reply(): void {
    window.location.href = this.mailto();
  }

  back(): void {
    void this.router.navigate(['/messages']);
  }

  confirmDelete(): void {
    const m = this.message();
    if (!m) return;
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete message?',
        message: `The message from "${m.name || m.email}" will be permanently deleted. This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'error',
        onConfirm: () =>
          new Promise<boolean>((resolve) => {
            this.svc.remove(PATH, m._id).subscribe({
              next: (res) => {
                this.toast.success(res.message || 'Message deleted');
                resolve(true);
                void this.router.navigate(['/messages']);
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
