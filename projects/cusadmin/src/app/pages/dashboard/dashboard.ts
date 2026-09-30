import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, forkJoin, map, of, type Observable } from 'rxjs';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import { getUserFullName } from '@shared/utils/user.util';
import { CONTACT_SOURCE_LABELS, type ContactMessage } from '@cusadmin/core/models/contact-message.model';
import { selectProfileUser } from '@cusadmin/store/profile/profile.feature';
import { ResourceService, type ListParams } from '@cusadmin/services/resource.service';

interface StatCard {
  key: string;
  label: string;
  icon: string;
  link: string;
  value: number | null;
  /** Secondary line, e.g. "3 published". */
  hint?: string;
}

/**
 * Dashboard (conb-sites-admin summary layout). portfolio-node has no stats endpoint, so each count is a
 * `limit=1` list call reading `total`; a failed count shows "—" instead of breaking the page.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, IconComponent, PageLoaderComponent],
  templateUrl: './dashboard.html',
})
export class DashboardPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly user = toSignal(inject(Store).select(selectProfileUser), { initialValue: null });

  readonly sourceLabels = CONTACT_SOURCE_LABELS;
  readonly loading = signal(true);
  readonly cards = signal<StatCard[]>([]);
  readonly recent = signal<ContactMessage[]>([]);
  readonly quickLinks = [
    { label: 'New project', icon: 'folder-plus', link: '/projects/new' },
    { label: 'New blog post', icon: 'file-plus', link: '/blog/new' },
    { label: 'Update resume', icon: 'file-text', link: '/resume' },
    { label: 'Site settings', icon: 'settings', link: '/settings' },
  ];

  get name(): string {
    return getUserFullName(this.user());
  }

  ngOnInit(): void {
    forkJoin({
      projects: this.count('projects'),
      projectsLive: this.count('projects', { status: 'published' }),
      posts: this.count('blog'),
      postsLive: this.count('blog', { status: 'published' }),
      newMessages: this.count('contact', { status: 'new' }),
      messages: this.count('contact'),
      testimonials: this.count('testimonials'),
      experience: this.count('experience'),
      recent: this.svc.list<ContactMessage>('contact', { limit: 5, sort: '-createdAt' }).pipe(
        map((res) => res.items),
        catchError(() => of<ContactMessage[]>([])),
      ),
    }).subscribe((r) => {
      this.cards.set([
        { key: 'projects', label: 'Projects', icon: 'briefcase', link: '/projects', value: r.projects, hint: this.live(r.projectsLive) },
        { key: 'blog', label: 'Blog posts', icon: 'newspaper', link: '/blog', value: r.posts, hint: this.live(r.postsLive) },
        { key: 'messages', label: 'New messages', icon: 'mail', link: '/messages', value: r.newMessages, hint: r.messages === null ? undefined : `${r.messages} in total` },
        { key: 'testimonials', label: 'Testimonials', icon: 'message-square-quote', link: '/testimonials', value: r.testimonials },
        { key: 'experience', label: 'Experience entries', icon: 'history', link: '/experience', value: r.experience },
      ]);
      this.recent.set(r.recent);
      this.loading.set(false);
    });
  }

  private count(path: string, params: ListParams = {}): Observable<number | null> {
    return this.svc.list<unknown>(path, { ...params, limit: 1 }).pipe(
      map((res) => res.pagination.totalItems),
      catchError(() => of(null)),
    );
  }

  private live(n: number | null): string | undefined {
    return n === null ? undefined : `${n} published`;
  }
}
