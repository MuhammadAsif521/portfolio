import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import type { ProjectCard } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { provideTestStore } from '../../testing/store.testing';
import { DEMO_CONTENT } from '../demo-content';
import { CONTENT_CLOCK, CONTENT_TTL_MS, loadErrorMessage } from './content.effects';
import { ContentActions, contentFeature, initialContentState, listKey, type ContentState } from './content.feature';
import { CONTENT_STATE_KEY } from './content.state';

const TTL = 300_000;
const card = (slug: string): ProjectCard => ({
  _id: slug,
  slug,
  title: `Project ${slug}`,
  summary: '',
  techStack: [],
  featured: false,
  order: 0,
  status: 'published',
  seo: {},
});
const page = <T>(data: T[]) => ({ data, total: data.length, limit: 12, page: 1, pages: 1 });

function withState(state: ContentState): TransferState {
  const transfer = new TransferState();
  transfer.set(CONTENT_STATE_KEY, state);
  return transfer;
}

function setup(api: Record<string, unknown>, options: { demo?: boolean; platform?: string; transferred?: ContentState } = {}) {
  let now = 1_000_000;
  TestBed.configureTestingModule({
    providers: [
      provideTestStore(),
      { provide: PublicApiService, useValue: api },
      { provide: DEMO_CONTENT, useValue: options.demo ?? false },
      { provide: CONTENT_CLOCK, useValue: () => now },
      { provide: CONTENT_TTL_MS, useValue: TTL },
      ...(options.platform ? [{ provide: PLATFORM_ID, useValue: options.platform }] : []),
      // What the browser finds in the page: the server's serialised content state.
      ...(options.transferred
        ? [{ provide: TransferState, useFactory: () => withState(options.transferred!) }]
        : []),
    ],
  });
  const store = TestBed.inject(Store);
  return {
    store,
    advance: (ms: number) => (now += ms),
    state: () => {
      let snapshot = initialContentState;
      store.select(contentFeature.selectContentState).subscribe((value) => (snapshot = value)).unsubscribe();
      return snapshot;
    },
  };
}

describe('content effects: load-if-needed', () => {
  const query = { limit: 12 };

  it('cache hit: a second Load within the TTL makes no request', () => {
    const listProjects = vi.fn(() => of(page([card('a')])));
    const { store, state } = setup({ listProjects });

    store.dispatch(ContentActions.loadProjectList({ query }));
    store.dispatch(ContentActions.loadProjectList({ query }));
    store.dispatch(ContentActions.loadProjectList({ query: { limit: 12, page: undefined } })); // same key

    expect(listProjects).toHaveBeenCalledTimes(1);
    expect(state().projectLists[listKey(query)]?.status).toBe('loaded');
  });

  it('dedupes concurrent loads of the same key; different keys load independently', () => {
    const answer = new Subject<ReturnType<typeof page<ProjectCard>>>();
    const listProjects = vi.fn((q: { limit: number }) => (q.limit === 12 ? answer : of(page([card('b')]))));
    const { store, state } = setup({ listProjects });

    for (let i = 0; i < 3; i++) store.dispatch(ContentActions.loadProjectList({ query }));
    store.dispatch(ContentActions.loadProjectList({ query: { limit: 3 } }));
    expect(listProjects).toHaveBeenCalledTimes(2);

    answer.next(page([card('a')]));
    answer.complete();
    expect(state().projectLists[listKey(query)]?.status).toBe('loaded');
  });

  it('TTL expiry: refetches after CONTENT_TTL_MS, keeping the old data visible meanwhile', () => {
    const answer = new Subject<ReturnType<typeof page<ProjectCard>>>();
    const listProjects = vi.fn().mockReturnValueOnce(of(page([card('a')]))).mockReturnValueOnce(answer);
    const { store, state, advance } = setup({ listProjects });

    store.dispatch(ContentActions.loadProjectList({ query }));
    advance(TTL - 1);
    store.dispatch(ContentActions.loadProjectList({ query }));
    expect(listProjects).toHaveBeenCalledTimes(1);

    advance(2);
    store.dispatch(ContentActions.loadProjectList({ query }));
    expect(listProjects).toHaveBeenCalledTimes(2);
    expect(contentFeature.selectProjectListFor({ content: state() })(query).items.map((p) => p.slug)).toEqual(['a']);

    answer.next(page([card('a'), card('new')]));
    answer.complete();
    expect(contentFeature.selectProjectListFor({ content: state() })(query).items.map((p) => p.slug)).toEqual(['a', 'new']);
  });

  it('error then retry: a failed load is not cached and the next Load fetches again', () => {
    const getProject = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Database down' } })))
      .mockReturnValueOnce(of({ ...card('a'), content: '<p>ok</p>', gallery: [] }));
    const { store, state } = setup({ getProject });

    store.dispatch(ContentActions.loadProject({ slug: 'a' }));
    expect(state().projects.entities['a']).toMatchObject({
      status: 'error',
      error: 'Something went wrong on our side. Please try again in a moment.', // raw API messages are not shown
      notFound: false,
    });

    store.dispatch(ContentActions.loadProject({ slug: 'a' }));
    expect(getProject).toHaveBeenCalledTimes(2);
    expect(state().projects.entities['a']).toMatchObject({ status: 'loaded', error: null });
  });

  it('a 404 is cached like a success (no refetch within the TTL)', () => {
    const getPost = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    const { store, state, advance } = setup({ getPost });

    store.dispatch(ContentActions.loadPost({ slug: 'gone' }));
    store.dispatch(ContentActions.loadPost({ slug: 'gone' }));
    expect(getPost).toHaveBeenCalledTimes(1);
    expect(state().posts.entities['gone']?.notFound).toBe(true);

    advance(TTL);
    store.dispatch(ContentActions.loadPost({ slug: 'gone' }));
    expect(getPost).toHaveBeenCalledTimes(2);
  });

  it('collections: testimonials and experience load once', () => {
    const getTestimonials = vi.fn(() => of([]));
    const getExperience = vi.fn(() => of([]));
    const { store } = setup({ getTestimonials, getExperience });
    for (let i = 0; i < 2; i++) {
      store.dispatch(ContentActions.loadTestimonials());
      store.dispatch(ContentActions.loadExperience());
    }
    expect(getTestimonials).toHaveBeenCalledTimes(1);
    expect(getExperience).toHaveBeenCalledTimes(1);
  });

  it('development demo content replaces an empty or failed first page (never in production)', () => {
    const { store, state } = setup({ listPosts: () => throwError(() => new Error('down')) }, { demo: true });
    store.dispatch(ContentActions.loadPostList({ query: { limit: 3 } }));
    expect(contentFeature.selectPostListFor({ content: state() })({ limit: 3 }).items.length).toBe(3);
  });

  it('keeps SSR waiting: the app is not stable while a load is in flight', async () => {
    const answer = new Subject<ReturnType<typeof page<ProjectCard>>>();
    const { store } = setup({ listProjects: () => answer });
    const appRef = TestBed.inject(ApplicationRef);
    let stable = false;
    store.dispatch(ContentActions.loadProjectList({ query }));
    void appRef.whenStable().then(() => (stable = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stable).toBe(false);

    answer.next(page([card('a')]));
    answer.complete();
    await appRef.whenStable();
  });
});

describe('load error messages', () => {
  it('shows the session problem as is, a connection hint for network errors, a generic line otherwise', () => {
    const session = new HttpErrorResponse({ status: 0, error: { code: 'PUBLIC_SESSION_UNAVAILABLE', message: 'Could not verify this browser.' } });
    expect(loadErrorMessage(session)).toBe('Could not verify this browser.');
    expect(loadErrorMessage(new HttpErrorResponse({ status: 0 }))).toMatch(/connection/);
    expect(loadErrorMessage(new HttpErrorResponse({ status: 500, error: { message: 'E11000 duplicate key' } }))).not.toMatch(/E11000/);
  });
});

describe('content state transfer (hydration)', () => {
  it('the browser store starts from the server state, so hydration makes no content requests', () => {
    const listProjects = vi.fn(() => of(page([card('fresh')])));
    const transferred: ContentState = {
      ...initialContentState,
      projectCards: { ids: ['a'], entities: { a: card('a') } },
      projectLists: {
        [listKey({ limit: 12 })]: { status: 'loaded', error: null, loadedAt: 1_000_000 - 60_000, slugs: ['a'], total: 1, page: 1, pages: 1, limit: 12 },
      },
    };
    const { store, state } = setup({ listProjects }, { platform: 'browser', transferred });

    store.dispatch(ContentActions.loadProjectList({ query: { limit: 12 } }));
    expect(listProjects).not.toHaveBeenCalled();
    expect(contentFeature.selectProjectListFor({ content: state() })({ limit: 12 }).items.map((p) => p.slug)).toEqual(['a']);
  });

  it('the server ignores any incoming state and serialises its own when the page is rendered', () => {
    const { store } = setup({ getExperience: () => of([]) }, { platform: 'server' });
    store.dispatch(ContentActions.loadExperience());
    const json = JSON.parse(TestBed.inject(TransferState).toJson()) as Record<string, ContentState>;
    expect(json[CONTENT_STATE_KEY as unknown as string]?.experience.status).toBe('loaded');
  });
});
