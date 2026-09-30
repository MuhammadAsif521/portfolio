import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { API_BASE_URL } from '@shared/config/api.tokens';
import { WITH_CREDENTIALS, type ApiResponse, type PaginatedResponse } from '@shared/interfaces/auth.interface';
import type { AssetImage } from '@shared/interfaces/entities.interface';
import { ApiService } from '@shared/services/api.service';
import { toPaginationMeta } from '@shared/utils/pagination.util';

export interface ListParams {
  page?: number;
  limit?: number;
  /** Server sort key: 'field' ascending, '-field' descending (each resource has its own allow-list). */
  sort?: string;
  /** Full-text search (projects, blog). */
  q?: string;
  [filter: string]: string | number | boolean | string[] | undefined;
}

export interface ListResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** Folders portfolio-node accepts for image uploads. */
export type UploadFolder = 'projects' | 'blog' | 'settings';

/** POST /admin/uploads response. */
export interface UploadedImage extends AssetImage {
  size: number;
  contentType: string;
}

/**
 * Generic admin CRUD over portfolio-node's /api/v1/admin/<path> (conb-sites-admin ResourceService,
 * adapted): paginated lists, get/create/update(PATCH)/delete, custom actions and image uploads.
 * Responses keep the { status, statusCode, message, data } envelope so pages can toast `message`.
 */
@Injectable({ providedIn: 'root' })
export class ResourceService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);
  private readonly base = '/admin';

  list<T>(path: string, params: ListParams = {}): Observable<ListResult<T>> {
    return this.api.get<PaginatedResponse<T>>(`${this.base}/${path}`, params).pipe(
      map((res) => ({ items: res.data.data, pagination: toPaginationMeta(res.data) })),
    );
  }

  getById<T>(path: string, id: string): Observable<ApiResponse<T>> {
    return this.api.get<T>(`${this.base}/${path}/${id}`);
  }

  /** Singletons (settings, resume profile). */
  getOne<T>(path: string): Observable<ApiResponse<T>> {
    return this.api.get<T>(`${this.base}/${path}`);
  }

  create<T>(path: string, body: Record<string, unknown>): Observable<ApiResponse<T>> {
    return this.api.post<T>(`${this.base}/${path}`, body);
  }

  /** PATCH: send only what changed; `null` clears a (nullable) field. */
  update<T>(path: string, id: string | null, body: Record<string, unknown>): Observable<ApiResponse<T>> {
    return this.api.patch<T>(id ? `${this.base}/${path}/${id}` : `${this.base}/${path}`, body);
  }

  remove(path: string, id: string): Observable<ApiResponse<{ _id: string }>> {
    return this.api.delete<{ _id: string }>(`${this.base}/${path}/${id}`);
  }

  /** PATCH /admin/<path>/<id>/<verb>, e.g. themes/:id/activate. */
  action<T>(path: string, id: string, verb: string, body: Record<string, unknown> = {}): Observable<ApiResponse<T>> {
    return this.api.patch<T>(`${this.base}/${path}/${id}/${verb}`, body);
  }

  /** POST /admin/<path> (non-CRUD), e.g. resume/generate. */
  post<T>(path: string, body: Record<string, unknown> = {}): Observable<ApiResponse<T>> {
    return this.api.post<T>(`${this.base}/${path}`, body);
  }

  /**
   * GET /admin/<path> as a raw Blob (no JSON envelope), e.g. resume/preview → application/pdf.
   * ApiService only speaks JSON, so this uses HttpClient with the same credentials context.
   * Error bodies arrive as Blobs too; `blobError` turns them back into { message, errors }.
   */
  getBlob(path: string): Observable<Blob> {
    return this.http.get(`${this.apiBase}${this.base}/${path}`, {
      responseType: 'blob',
      withCredentials: true,
      context: new HttpContext().set(WITH_CREDENTIALS, true),
    });
  }

  /** Parses the JSON envelope out of a failed blob request so `getError` can read it. */
  async blobError(err: unknown): Promise<unknown> {
    const body = (err as { error?: unknown } | null)?.error;
    if (!(body instanceof Blob)) return err;
    try {
      return { error: JSON.parse(await body.text()) as unknown };
    } catch {
      return err;
    }
  }

  /** Multipart upload; the server converts to WebP and returns { key, url, alt, width, height }. */
  uploadImage(file: File, folder: UploadFolder, alt?: string): Observable<UploadedImage> {
    const form = new FormData();
    form.append('folder', folder);
    if (alt) form.append('alt', alt.slice(0, 150));
    form.append('file', file);
    return this.api.postFormData<UploadedImage>(`${this.base}/uploads`, form).pipe(map((res) => res.data));
  }
}
