import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { PaginatedResponse, SiteSettings, ThemePalette } from '@shared/interfaces/auth.interface';
import type {
  BlogListQuery,
  BlogPost,
  BlogPostCard,
  ContactPayload,
  ContactReceipt,
  Experience,
  Project,
  ProjectCard,
  ProjectListQuery,
} from '@shared/interfaces/public-api.interface';
import { ApiService } from './api.service';

/**
 * Typed wrapper for portfolio-node's public endpoints (docs/specs/04-api.md). Built on ApiService, so
 * requests go through publicSessionInterceptor (session token in the browser, X-SSR-Key during SSR).
 * Each method unwraps the `{ status, statusCode, message, data }` envelope; errors stay HttpErrorResponse
 * (use getError() for a message).
 */
@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly api = inject(ApiService);

  /** Site settings plus the active brand palette (feed into ThemeService.applySiteSettings). */
  getSettings(): Observable<SiteSettings> {
    return this.api.get<SiteSettings>('/public/settings').pipe(map((res) => res.data));
  }

  getActiveTheme(): Observable<ThemePalette> {
    return this.api.get<ThemePalette>('/public/themes/active').pipe(map((res) => res.data));
  }

  listProjects(query: ProjectListQuery = {}): Observable<PaginatedResponse<ProjectCard>> {
    return this.api.get<PaginatedResponse<ProjectCard>>('/public/projects', { ...query }).pipe(map((res) => res.data));
  }

  getProject(slug: string): Observable<Project> {
    return this.api.get<Project>(`/public/projects/${encodeURIComponent(slug)}`).pipe(map((res) => res.data));
  }

  listPosts(query: BlogListQuery = {}): Observable<PaginatedResponse<BlogPostCard>> {
    return this.api.get<PaginatedResponse<BlogPostCard>>('/public/blog', { ...query }).pipe(map((res) => res.data));
  }

  getPost(slug: string): Observable<BlogPost> {
    return this.api.get<BlogPost>(`/public/blog/${encodeURIComponent(slug)}`).pipe(map((res) => res.data));
  }

  /** The career timeline, newest first. */
  getExperience(): Observable<Experience[]> {
    return this.api.get<Experience[]>('/public/experience').pipe(map((res) => res.data));
  }

  /** Contact form / CTA email box. Protected by the session; no reCAPTCHA call per message. */
  submitContact(payload: ContactPayload): Observable<ContactReceipt> {
    return this.api.post<ContactReceipt>('/public/contact', payload).pipe(map((res) => res.data));
  }
}
