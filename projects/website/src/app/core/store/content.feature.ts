import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createActionGroup, createFeature, createReducer, createSelector, emptyProps, on, props } from '@ngrx/store';
import type { PaginatedResponse } from '@shared/interfaces/auth.interface';
import type {
  BlogListQuery,
  BlogPost,
  BlogPostCard,
  Experience,
  Project,
  ProjectCard,
  ProjectListQuery,
  Testimonial,
} from '@shared/interfaces/public-api.interface';
import type { LoadStatus } from './site.feature';

/*
 * Content cache (projects, posts, testimonials, experience).
 *
 * Components only dispatch `Load …` actions and read selectors; content.effects.ts decides whether a
 * request is needed (missing, stale after CONTENT_TTL_MS, or failed) and dedupes concurrent loads.
 * Reducer rules shared by every slot:
 *  - `Load …` turns an idle/failed slot into 'loading' but leaves loaded data (and a known 404) in place,
 *    so a background refresh never blanks the page (stale-while-revalidate).
 *  - The last error message is kept while a retry is loading (the error box stays, showing "Retrying…").
 *  - Success/failure stamp `loadedAt`; only loaded data and 404s count as cached.
 */

// ── Slots ───────────────────────────────────────────────────────────────────

export interface LoadMeta {
  status: LoadStatus;
  /** Message of the last failed load (kept while a retry is in flight). */
  error: string | null;
  /** Epoch ms of the last answer from the API (success or 404). */
  loadedAt: number | null;
}

/** One list request (query) → the slugs it returned, in order, plus its pagination. */
export interface ListSlot extends LoadMeta {
  slugs: string[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

/** A full document (case study / post) by slug. */
export interface DetailSlot<T> extends LoadMeta {
  slug: string;
  doc: T | null;
  /** The API answered 404: the slug is unknown or unpublished. Cached like a success. */
  notFound: boolean;
}

export interface CollectionSlot<T> extends LoadMeta {
  items: T[] | null;
}

export interface ContentState {
  /** Every project card any list returned, by slug (also the instant preview for the detail page). */
  projectCards: EntityState<ProjectCard>;
  postCards: EntityState<BlogPostCard>;
  /** Keyed by listKey(query), e.g. "limit=12" (home) or "limit=9&page=2&tag=angular" (/blog). */
  projectLists: Record<string, ListSlot>;
  postLists: Record<string, ListSlot>;
  /** Full documents incl. content and SEO, by slug. */
  projects: EntityState<DetailSlot<Project>>;
  posts: EntityState<DetailSlot<BlogPost>>;
  testimonials: CollectionSlot<Testimonial>;
  experience: CollectionSlot<Experience>;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export const ContentActions = createActionGroup({
  source: 'Content',
  events: {
    'Load Project List': props<{ query: ProjectListQuery }>(),
    'Load Project List Success': props<{ key: string; result: PaginatedResponse<ProjectCard>; loadedAt: number }>(),
    'Load Project List Failure': props<{ key: string; error: string }>(),

    'Load Post List': props<{ query: BlogListQuery }>(),
    'Load Post List Success': props<{ key: string; result: PaginatedResponse<BlogPostCard>; loadedAt: number }>(),
    'Load Post List Failure': props<{ key: string; error: string }>(),

    'Load Project': props<{ slug: string }>(),
    'Load Project Success': props<{ slug: string; project: Project; loadedAt: number }>(),
    'Load Project Failure': props<{ slug: string; error: string; notFound: boolean; loadedAt: number }>(),

    'Load Post': props<{ slug: string }>(),
    'Load Post Success': props<{ slug: string; post: BlogPost; loadedAt: number }>(),
    'Load Post Failure': props<{ slug: string; error: string; notFound: boolean; loadedAt: number }>(),

    'Load Testimonials': emptyProps(),
    'Load Testimonials Success': props<{ items: Testimonial[]; loadedAt: number }>(),
    'Load Testimonials Failure': props<{ error: string }>(),

    'Load Experience': emptyProps(),
    'Load Experience Success': props<{ items: Experience[]; loadedAt: number }>(),
    'Load Experience Failure': props<{ error: string }>(),
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Stable cache key for a list query: params sorted, empty values dropped, arrays joined.
 * `{ limit: 9, page: 1 }` and `{ page: 1, limit: 9, tag: [] }` share one entry.
 */
export function listKey(query: object): string {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length))
    .map(([name, value]) => `${name}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .sort()
    .join('&');
}

/** Whether a slot holds an answer younger than `ttl` (a small clock skew between server and browser is tolerated). */
export function isFresh(slot: (LoadMeta & { notFound?: boolean }) | undefined, now: number, ttl: number): boolean {
  if (!slot || slot.loadedAt === null) return false;
  if (slot.status !== 'loaded' && !slot.notFound) return false;
  const age = now - slot.loadedAt;
  return age < ttl && age > -ttl;
}

const idleMeta: LoadMeta = { status: 'idle', error: null, loadedAt: null };
const emptyList: ListSlot = { ...idleMeta, slugs: [], total: 0, page: 1, pages: 0, limit: 0 };
const emptyCollection = { ...idleMeta, items: null };

/** `Load …`: idle/failed → loading; loaded data and known 404s stay visible while they refresh. */
function beginLoad<T extends LoadMeta & { notFound?: boolean }>(slot: T): T {
  if (slot.status === 'loaded' || slot.notFound || slot.status === 'loading') return slot;
  return { ...slot, status: 'loading' };
}

const projectCardAdapter = createEntityAdapter<ProjectCard>({ selectId: (card) => card.slug });
const postCardAdapter = createEntityAdapter<BlogPostCard>({ selectId: (card) => card.slug });
const projectAdapter = createEntityAdapter<DetailSlot<Project>>({ selectId: (slot) => slot.slug });
const postAdapter = createEntityAdapter<DetailSlot<BlogPost>>({ selectId: (slot) => slot.slug });

function detailOf<T>(state: EntityState<DetailSlot<T>>, slug: string): DetailSlot<T> {
  return state.entities[slug] ?? { ...idleMeta, slug, doc: null, notFound: false };
}

export const initialContentState: ContentState = {
  projectCards: projectCardAdapter.getInitialState(),
  postCards: postCardAdapter.getInitialState(),
  projectLists: {},
  postLists: {},
  projects: projectAdapter.getInitialState(),
  posts: postAdapter.getInitialState(),
  testimonials: emptyCollection,
  experience: emptyCollection,
};

function listLoaded<T>(result: PaginatedResponse<T>, slug: (item: T) => string, loadedAt: number): ListSlot {
  return {
    status: 'loaded',
    error: null,
    loadedAt,
    slugs: result.data.map(slug),
    total: result.total,
    page: result.page,
    pages: result.pages,
    limit: result.limit,
  };
}

/** A failure keeps whatever was there before (stale data beats an error box). */
function listFailed(slot: ListSlot | undefined, error: string): ListSlot {
  const previous = slot ?? emptyList;
  return previous.loadedAt !== null && previous.status === 'loaded'
    ? { ...previous, error }
    : { ...previous, status: 'error', error };
}

function collectionFailed<T>(slot: CollectionSlot<T>, error: string): CollectionSlot<T> {
  return slot.items !== null && slot.status === 'loaded' ? { ...slot, error } : { ...slot, status: 'error', error };
}

function detailFailed<T>(
  slot: DetailSlot<T>,
  { error, notFound, loadedAt }: { error: string; notFound: boolean; loadedAt: number },
): DetailSlot<T> {
  if (notFound) return { ...slot, status: 'error', error, notFound: true, doc: null, loadedAt };
  // A transient failure while refreshing a loaded document keeps the document.
  return slot.doc ? { ...slot, error } : { ...slot, status: 'error', error, notFound: false };
}

// ── Views (what components render) ──────────────────────────────────────────

export interface ListView<T> {
  status: LoadStatus;
  error: string | null;
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface DetailView<T, C> {
  status: LoadStatus;
  error: string | null;
  notFound: boolean;
  /** The full document, once loaded. */
  doc: T | null;
  /** The list card for this slug, if a list already loaded it: rendered while `doc` loads. */
  preview: C | null;
}

function listView<T>(slot: ListSlot | undefined, cards: EntityState<T>): ListView<T> {
  const list = slot ?? emptyList;
  return {
    status: list.status,
    error: list.error,
    items: list.slugs.map((slug) => cards.entities[slug]).filter((card): card is T => !!card),
    total: list.total,
    page: list.page,
    pages: list.pages,
  };
}

function detailView<T, C>(slot: DetailSlot<T>, cards: EntityState<C>): DetailView<T, C> {
  return {
    status: slot.status,
    error: slot.error,
    notFound: slot.notFound,
    doc: slot.doc,
    preview: cards.entities[slot.slug] ?? null,
  };
}

// ── Feature ─────────────────────────────────────────────────────────────────

export const contentFeature = createFeature({
  name: 'content',
  reducer: createReducer(
    initialContentState,

    on(ContentActions.loadProjectList, (state, { query }): ContentState => {
      const key = listKey(query);
      return { ...state, projectLists: { ...state.projectLists, [key]: beginLoad(state.projectLists[key] ?? emptyList) } };
    }),
    on(ContentActions.loadProjectListSuccess, (state, { key, result, loadedAt }): ContentState => ({
      ...state,
      projectCards: projectCardAdapter.upsertMany(result.data, state.projectCards),
      projectLists: { ...state.projectLists, [key]: listLoaded(result, (card) => card.slug, loadedAt) },
    })),
    on(ContentActions.loadProjectListFailure, (state, { key, error }): ContentState => ({
      ...state,
      projectLists: { ...state.projectLists, [key]: listFailed(state.projectLists[key], error) },
    })),

    on(ContentActions.loadPostList, (state, { query }): ContentState => {
      const key = listKey(query);
      return { ...state, postLists: { ...state.postLists, [key]: beginLoad(state.postLists[key] ?? emptyList) } };
    }),
    on(ContentActions.loadPostListSuccess, (state, { key, result, loadedAt }): ContentState => ({
      ...state,
      postCards: postCardAdapter.upsertMany(result.data, state.postCards),
      postLists: { ...state.postLists, [key]: listLoaded(result, (card) => card.slug, loadedAt) },
    })),
    on(ContentActions.loadPostListFailure, (state, { key, error }): ContentState => ({
      ...state,
      postLists: { ...state.postLists, [key]: listFailed(state.postLists[key], error) },
    })),

    on(ContentActions.loadProject, (state, { slug }): ContentState => ({
      ...state,
      projects: projectAdapter.upsertOne(beginLoad(detailOf(state.projects, slug)), state.projects),
    })),
    on(ContentActions.loadProjectSuccess, (state, { slug, project, loadedAt }): ContentState => ({
      ...state,
      projects: projectAdapter.upsertOne(
        { slug, doc: project, status: 'loaded', error: null, notFound: false, loadedAt },
        state.projects,
      ),
    })),
    on(ContentActions.loadProjectFailure, (state, failure): ContentState => ({
      ...state,
      projects: projectAdapter.upsertOne(detailFailed(detailOf(state.projects, failure.slug), failure), state.projects),
    })),

    on(ContentActions.loadPost, (state, { slug }): ContentState => ({
      ...state,
      posts: postAdapter.upsertOne(beginLoad(detailOf(state.posts, slug)), state.posts),
    })),
    on(ContentActions.loadPostSuccess, (state, { slug, post, loadedAt }): ContentState => ({
      ...state,
      posts: postAdapter.upsertOne({ slug, doc: post, status: 'loaded', error: null, notFound: false, loadedAt }, state.posts),
    })),
    on(ContentActions.loadPostFailure, (state, failure): ContentState => ({
      ...state,
      posts: postAdapter.upsertOne(detailFailed(detailOf(state.posts, failure.slug), failure), state.posts),
    })),

    on(ContentActions.loadTestimonials, (state): ContentState => ({ ...state, testimonials: beginLoad(state.testimonials) })),
    on(ContentActions.loadTestimonialsSuccess, (state, { items, loadedAt }): ContentState => ({
      ...state,
      testimonials: { status: 'loaded', error: null, loadedAt, items },
    })),
    on(ContentActions.loadTestimonialsFailure, (state, { error }): ContentState => ({
      ...state,
      testimonials: collectionFailed(state.testimonials, error),
    })),

    on(ContentActions.loadExperience, (state): ContentState => ({ ...state, experience: beginLoad(state.experience) })),
    on(ContentActions.loadExperienceSuccess, (state, { items, loadedAt }): ContentState => ({
      ...state,
      experience: { status: 'loaded', error: null, loadedAt, items },
    })),
    on(ContentActions.loadExperienceFailure, (state, { error }): ContentState => ({
      ...state,
      experience: collectionFailed(state.experience, error),
    })),
  ),
  extraSelectors: ({ selectProjectCards, selectPostCards, selectProjectLists, selectPostLists, selectProjects, selectPosts }) => ({
    /** `(query) => ListView`: lets a component look up the list for a query held in a signal. */
    selectProjectListFor: createSelector(
      selectProjectLists,
      selectProjectCards,
      (lists, cards) => (query: ProjectListQuery) => listView(lists[listKey(query)], cards),
    ),
    selectPostListFor: createSelector(
      selectPostLists,
      selectPostCards,
      (lists, cards) => (query: BlogListQuery) => listView(lists[listKey(query)], cards),
    ),
    /** `(slug) => DetailView`: the full case study, or the list card as a preview while it loads. */
    selectProjectFor: createSelector(
      selectProjects,
      selectProjectCards,
      (projects, cards) => (slug: string) => detailView(detailOf(projects, slug), cards),
    ),
    selectPostFor: createSelector(
      selectPosts,
      selectPostCards,
      (posts, cards) => (slug: string) => detailView(detailOf(posts, slug), cards),
    ),
  }),
});

/** Slot lookups used by the effects' freshness checks. */
export const contentSlots = {
  projectList: (state: ContentState, key: string) => state.projectLists[key],
  postList: (state: ContentState, key: string) => state.postLists[key],
  project: (state: ContentState, slug: string) => state.projects.entities[slug],
  post: (state: ContentState, slug: string) => state.posts.entities[slug],
};

/**
 * The state as it should travel to the browser (TransferState): requests still in flight when the
 * server serialised become 'idle', so the browser simply loads them again.
 */
export function transferableContent(state: ContentState): ContentState {
  const settle = <T extends LoadMeta>(slot: T): T => (slot.status === 'loading' ? { ...slot, status: 'idle' } : slot);
  const settleAll = <T extends LoadMeta>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).map(([key, slot]) => [key, settle(slot)]));
  const settleEntities = <T extends LoadMeta>(entities: EntityState<T>): EntityState<T> => ({
    ...entities,
    entities: settleAll(entities.entities as Record<string, T>),
  });
  return {
    ...state,
    projectLists: settleAll(state.projectLists),
    postLists: settleAll(state.postLists),
    projects: settleEntities(state.projects),
    posts: settleEntities(state.posts),
    testimonials: settle(state.testimonials),
    experience: settle(state.experience),
  };
}
