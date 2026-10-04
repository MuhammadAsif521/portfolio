import type { BlogPostCard, Project, ProjectCard } from '@shared/interfaces/public-api.interface';
import {
  ContentActions,
  contentFeature,
  initialContentState,
  isFresh,
  listKey,
  transferableContent,
  type ContentState,
} from './content.feature';

const reduce = (actions: Parameters<typeof contentFeature.reducer>[1][], state: ContentState = initialContentState) =>
  actions.reduce((current, action) => contentFeature.reducer(current, action), state);

const card = (slug: string): ProjectCard => ({
  _id: slug,
  slug,
  title: `Project ${slug}`,
  summary: `Summary of ${slug}`,
  techStack: ['Angular'],
  featured: false,
  order: 0,
  status: 'published',
  seo: {},
});
const page = <T>(data: T[]) => ({ data, total: data.length, limit: 12, page: 1, pages: 1 });
const root = (state: ContentState) => ({ content: state });

describe('content feature: helpers', () => {
  it('builds one cache key per distinct query (order and empty params ignored)', () => {
    expect(listKey({ page: 1, limit: 9 })).toBe(listKey({ limit: 9, page: 1, tag: [] }));
    expect(listKey({ page: 2, limit: 9, tag: ['angular'] })).toBe('limit=9&page=2&tag=angular');
    expect(listKey({ limit: 3 })).not.toBe(listKey({ limit: 9 }));
  });

  it('treats loaded data and 404s younger than the TTL as fresh, tolerating small clock skew', () => {
    const loaded = { status: 'loaded' as const, error: null, loadedAt: 1_000 };
    expect(isFresh(loaded, 1_000 + 299_000, 300_000)).toBe(true);
    expect(isFresh(loaded, 1_000 + 300_000, 300_000)).toBe(false); // expired
    expect(isFresh(loaded, 1_000 - 5_000, 300_000)).toBe(true); // browser clock slightly behind the server
    expect(isFresh(loaded, 1_000 - 400_000, 300_000)).toBe(false); // far off: refetch
    expect(isFresh({ status: 'error', error: 'x', loadedAt: 1_000, notFound: true }, 2_000, 300_000)).toBe(true);
    expect(isFresh({ status: 'error', error: 'x', loadedAt: 1_000 }, 2_000, 300_000)).toBe(false); // failures never cache
    expect(isFresh(undefined, 0, 300_000)).toBe(false);
  });
});

describe('content feature: reducer and selectors', () => {
  const query = { limit: 12 };
  const key = listKey(query);

  it('Load → loading; Success → items (via the card entities) with pagination and loadedAt', () => {
    let state = reduce([ContentActions.loadProjectList({ query })]);
    expect(contentFeature.selectProjectListFor(root(state))(query).status).toBe('loading');

    state = reduce([ContentActions.loadProjectListSuccess({ key, result: page([card('a'), card('b')]), loadedAt: 42 })], state);
    const view = contentFeature.selectProjectListFor(root(state))(query);
    expect(view.status).toBe('loaded');
    expect(view.items.map((item) => item.slug)).toEqual(['a', 'b']);
    expect(state.projectLists[key]?.loadedAt).toBe(42);
    expect(state.projectCards.ids).toEqual(['a', 'b']);
  });

  it('a refresh of loaded data keeps it visible (stale-while-revalidate), also when the refresh fails', () => {
    let state = reduce([ContentActions.loadProjectListSuccess({ key, result: page([card('a')]), loadedAt: 1 })]);
    state = reduce([ContentActions.loadProjectList({ query })], state);
    expect(contentFeature.selectProjectListFor(root(state))(query)).toMatchObject({ status: 'loaded', items: [card('a')] });

    state = reduce([ContentActions.loadProjectListFailure({ key, error: 'down' })], state);
    expect(contentFeature.selectProjectListFor(root(state))(query)).toMatchObject({ status: 'loaded', error: 'down' });
  });

  it('a failure without data is an error; the retry keeps the message while loading', () => {
    let state = reduce([ContentActions.loadPostList({ query: { limit: 3 } }), ContentActions.loadPostListFailure({ key: 'limit=3', error: 'down' })]);
    expect(contentFeature.selectPostListFor(root(state))({ limit: 3 })).toMatchObject({ status: 'error', error: 'down', items: [] });

    state = reduce([ContentActions.loadPostList({ query: { limit: 3 } })], state);
    expect(contentFeature.selectPostListFor(root(state))({ limit: 3 })).toMatchObject({ status: 'loading', error: 'down' });

    const post = { ...card('p'), excerpt: 'e', tags: [], readingTime: 3 } as unknown as BlogPostCard;
    state = reduce([ContentActions.loadPostListSuccess({ key: 'limit=3', result: page([post]), loadedAt: 5 })], state);
    expect(contentFeature.selectPostListFor(root(state))({ limit: 3 })).toMatchObject({ status: 'loaded', error: null });
  });

  it('detail: previews the list card while the full document loads, then shows the document', () => {
    let state = reduce([
      ContentActions.loadProjectListSuccess({ key, result: page([card('a')]), loadedAt: 1 }),
      ContentActions.loadProject({ slug: 'a' }),
    ]);
    let view = contentFeature.selectProjectFor(root(state))('a');
    expect(view).toMatchObject({ status: 'loading', doc: null, notFound: false });
    expect(view.preview?.title).toBe('Project a');

    const project: Project = { ...card('a'), content: '<p>Full</p>', gallery: [] };
    state = reduce([ContentActions.loadProjectSuccess({ slug: 'a', project, loadedAt: 2 })], state);
    view = contentFeature.selectProjectFor(root(state))('a');
    expect(view).toMatchObject({ status: 'loaded', doc: project });
    // Unknown slugs: idle with no preview.
    expect(contentFeature.selectProjectFor(root(state))('zzz')).toMatchObject({ status: 'idle', doc: null, preview: null });
  });

  it('detail: a 404 is remembered (with loadedAt) and is not flipped back to loading by a revisit', () => {
    let state = reduce([
      ContentActions.loadPost({ slug: 'gone' }),
      ContentActions.loadPostFailure({ slug: 'gone', error: 'Not found', notFound: true, loadedAt: 7 }),
    ]);
    expect(contentFeature.selectPostFor(root(state))('gone')).toMatchObject({ status: 'error', notFound: true });
    state = reduce([ContentActions.loadPost({ slug: 'gone' })], state);
    expect(contentFeature.selectPostFor(root(state))('gone')).toMatchObject({ status: 'error', notFound: true });
    expect(state.posts.entities['gone']?.loadedAt).toBe(7);
  });

  it('collections: testimonials and experience track status, error and loadedAt', () => {
    const state = reduce([
      ContentActions.loadTestimonials(),
      ContentActions.loadTestimonialsSuccess({ items: [], loadedAt: 3 }),
      ContentActions.loadExperience(),
      ContentActions.loadExperienceFailure({ error: 'down' }),
    ]);
    expect(state.testimonials).toEqual({ status: 'loaded', error: null, loadedAt: 3, items: [] });
    expect(state.experience).toMatchObject({ status: 'error', error: 'down', items: null });
  });

  it('transfers settled slots only: requests still in flight travel as idle', () => {
    const state = reduce([
      ContentActions.loadProjectList({ query }),
      ContentActions.loadPost({ slug: 'x' }),
      ContentActions.loadExperience(),
      ContentActions.loadTestimonialsSuccess({ items: [], loadedAt: 1 }),
    ]);
    const sent = transferableContent(state);
    expect(sent.projectLists[key]?.status).toBe('idle');
    expect(sent.posts.entities['x']?.status).toBe('idle');
    expect(sent.experience.status).toBe('idle');
    expect(sent.testimonials.status).toBe('loaded');
  });
});
