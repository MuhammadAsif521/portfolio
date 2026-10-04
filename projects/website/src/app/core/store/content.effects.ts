import { HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, Injector, inject } from '@angular/core';
import { pendingUntilEvent } from '@angular/core/rxjs-interop';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store, type Action } from '@ngrx/store';
import type { PaginatedResponse } from '@shared/interfaces/auth.interface';
import type { BlogListQuery, BlogPostCard, ProjectCard } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { PUBLIC_SESSION_UNAVAILABLE } from '@shared/services/public-session.service';
import {
  EMPTY,
  catchError,
  exhaustMap,
  groupBy,
  map,
  mergeMap,
  of,
  take,
  type Observable,
  type OperatorFunction,
} from 'rxjs';
import { DEMO_CONTENT, DEMO_POSTS, DEMO_PROJECTS, DEMO_TESTIMONIALS } from '../demo-content';
import {
  ContentActions,
  contentFeature,
  contentSlots,
  isFresh,
  listKey,
  type ContentState,
  type LoadMeta,
} from './content.feature';

/**
 * How long loaded content is reused without asking the API again. Matches the CDN's page cache
 * (server.ts: max-age=300), so client-side navigation never shows older data than a fresh page load.
 */
export const CONTENT_TTL_MS = new InjectionToken<number>('CONTENT_TTL_MS', {
  providedIn: 'root',
  factory: () => 5 * 60_000,
});

/** Current time in ms (overridable in tests). */
export const CONTENT_CLOCK = new InjectionToken<() => number>('CONTENT_CLOCK', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});

/**
 * The message the error box shows (stored in the slot): the session problem when no public session could
 * be established (reCAPTCHA blocked, offline…), otherwise a plain hint — raw API messages are not shown.
 */
export function loadErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: string; message?: string } | null;
    if (body?.code === PUBLIC_SESSION_UNAVAILABLE && body.message) return body.message;
    if (err.status === 0) return 'Please check your connection and try again.';
  }
  return 'Something went wrong on our side. Please try again in a moment.';
}

const isNotFound = (err: unknown) => err instanceof HttpErrorResponse && err.status === 404;

/**
 * Load-if-needed for one cache slot:
 *  - per key (list query / slug), `exhaustMap` drops repeated `Load …` actions while a request is in flight;
 *  - a slot that is loaded (or a known 404) and younger than the TTL is not requested again;
 *  - anything else (idle, failed, stale) is fetched. `pendingUntilEvent` keeps the app "unstable" until the
 *    answer arrives, so SSR waits for the data before serialising the page (as HttpClient alone does today,
 *    but independent of how the request is made).
 */
function loadIfNeeded<A extends Action>(
  keyOf: (action: A) => string,
  slotOf: (state: ContentState, key: string) => (LoadMeta & { notFound?: boolean }) | undefined,
  fetch: (action: A, key: string) => Observable<Action>,
): OperatorFunction<A, Action> {
  const store = inject(Store);
  const now = inject(CONTENT_CLOCK);
  const ttl = inject(CONTENT_TTL_MS);
  const injector = inject(Injector);
  return (actions$) =>
    actions$.pipe(
      groupBy(keyOf),
      mergeMap((sameKey$) =>
        sameKey$.pipe(
          exhaustMap((action) => {
            const key = keyOf(action);
            return store.select(contentFeature.selectContentState).pipe(
              take(1),
              mergeMap((state) => (isFresh(slotOf(state, key), now(), ttl) ? EMPTY : fetch(action, key))),
              pendingUntilEvent(injector),
            );
          }),
        ),
      ),
    );
}

// ── Lists ───────────────────────────────────────────────────────────────────

/** Dev-only demo data replaces an empty or failed first page (environment.demoContent). */
function demoPage<T>(items: readonly T[], query: { page?: number; limit?: number }): PaginatedResponse<T> {
  return { data: [...items], total: items.length, limit: query.limit ?? items.length, page: 1, pages: items.length ? 1 : 0 };
}

const firstPage = (query: { page?: number }) => (query.page ?? 1) === 1;

export const loadProjectList = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService), demo = inject(DEMO_CONTENT), now = inject(CONTENT_CLOCK)) =>
    actions$.pipe(
      ofType(ContentActions.loadProjectList),
      loadIfNeeded(
        ({ query }) => listKey(query),
        contentSlots.projectList,
        ({ query }, key) =>
          api.listProjects(query).pipe(
            map((result) =>
              !result.data.length && demo && firstPage(query) ? demoPage<ProjectCard>(DEMO_PROJECTS, query) : result,
            ),
            map((result) => ContentActions.loadProjectListSuccess({ key, result, loadedAt: now() })),
            catchError((err: unknown) =>
              of(
                demo && firstPage(query)
                  ? ContentActions.loadProjectListSuccess({ key, result: demoPage<ProjectCard>(DEMO_PROJECTS, query), loadedAt: now() })
                  : ContentActions.loadProjectListFailure({ key, error: loadErrorMessage(err) }),
              ),
            ),
          ),
      ),
    ),
  { functional: true },
);

function demoPosts(query: BlogListQuery): BlogPostCard[] {
  const tag = query.tag?.[0];
  return DEMO_POSTS.filter((post) => !tag || post.tags.includes(tag));
}

export const loadPostList = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService), demo = inject(DEMO_CONTENT), now = inject(CONTENT_CLOCK)) =>
    actions$.pipe(
      ofType(ContentActions.loadPostList),
      loadIfNeeded(
        ({ query }) => listKey(query),
        contentSlots.postList,
        ({ query }, key) =>
          api.listPosts(query).pipe(
            map((result) => (!result.data.length && demo && firstPage(query) ? demoPage(demoPosts(query), query) : result)),
            map((result) => ContentActions.loadPostListSuccess({ key, result, loadedAt: now() })),
            catchError((err: unknown) =>
              of(
                demo && firstPage(query)
                  ? ContentActions.loadPostListSuccess({ key, result: demoPage(demoPosts(query), query), loadedAt: now() })
                  : ContentActions.loadPostListFailure({ key, error: loadErrorMessage(err) }),
              ),
            ),
          ),
      ),
    ),
  { functional: true },
);

// ── Details ─────────────────────────────────────────────────────────────────

export const loadProject = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService), demo = inject(DEMO_CONTENT), now = inject(CONTENT_CLOCK)) =>
    actions$.pipe(
      ofType(ContentActions.loadProject),
      loadIfNeeded(
        ({ slug }) => slug,
        contentSlots.project,
        ({ slug }) =>
          api.getProject(slug).pipe(
            map((project) => ContentActions.loadProjectSuccess({ slug, project, loadedAt: now() })),
            catchError((err: unknown) => {
              // Development only: demo projects open their own (demo) case study.
              const sample = demo ? DEMO_PROJECTS.find((item) => item.slug === slug) : undefined;
              return of(
                sample
                  ? ContentActions.loadProjectSuccess({ slug, project: sample, loadedAt: now() })
                  : ContentActions.loadProjectFailure({
                      slug,
                      error: loadErrorMessage(err),
                      notFound: isNotFound(err),
                      loadedAt: now(),
                    }),
              );
            }),
          ),
      ),
    ),
  { functional: true },
);

export const loadPost = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService), demo = inject(DEMO_CONTENT), now = inject(CONTENT_CLOCK)) =>
    actions$.pipe(
      ofType(ContentActions.loadPost),
      loadIfNeeded(
        ({ slug }) => slug,
        contentSlots.post,
        ({ slug }) =>
          api.getPost(slug).pipe(
            map((post) => ContentActions.loadPostSuccess({ slug, post, loadedAt: now() })),
            catchError((err: unknown) => {
              // Development only: demo posts open their own (demo) page.
              const sample = demo ? DEMO_POSTS.find((item) => item.slug === slug) : undefined;
              return of(
                sample
                  ? ContentActions.loadPostSuccess({ slug, post: sample, loadedAt: now() })
                  : ContentActions.loadPostFailure({
                      slug,
                      error: loadErrorMessage(err),
                      notFound: isNotFound(err),
                      loadedAt: now(),
                    }),
              );
            }),
          ),
      ),
    ),
  { functional: true },
);

// ── Collections ─────────────────────────────────────────────────────────────

export const loadTestimonials = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService), demo = inject(DEMO_CONTENT), now = inject(CONTENT_CLOCK)) =>
    actions$.pipe(
      ofType(ContentActions.loadTestimonials),
      loadIfNeeded(
        () => 'testimonials',
        (state) => state.testimonials,
        () =>
          api.getTestimonials().pipe(
            map((items) => (!items.length && demo ? [...DEMO_TESTIMONIALS] : items)),
            map((items) => ContentActions.loadTestimonialsSuccess({ items, loadedAt: now() })),
            catchError((err: unknown) =>
              of(
                demo
                  ? ContentActions.loadTestimonialsSuccess({ items: [...DEMO_TESTIMONIALS], loadedAt: now() })
                  : ContentActions.loadTestimonialsFailure({ error: loadErrorMessage(err) }),
              ),
            ),
          ),
      ),
    ),
  { functional: true },
);

export const loadExperience = createEffect(
  (actions$ = inject(Actions), api = inject(PublicApiService), now = inject(CONTENT_CLOCK)) =>
    actions$.pipe(
      ofType(ContentActions.loadExperience),
      loadIfNeeded(
        () => 'experience',
        (state) => state.experience,
        () =>
          api.getExperience().pipe(
            map((items) => ContentActions.loadExperienceSuccess({ items, loadedAt: now() })),
            catchError((err: unknown) => of(ContentActions.loadExperienceFailure({ error: loadErrorMessage(err) }))),
          ),
      ),
    ),
  { functional: true },
);

export const contentEffects = {
  loadProjectList,
  loadPostList,
  loadProject,
  loadPost,
  loadTestimonials,
  loadExperience,
};
