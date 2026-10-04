import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTestStore } from './testing/store.testing';
import { PublicApiService } from '@shared/services/public-api.service';
import { DEMO_CONTENT } from './core/demo-content';
import { Store } from '@ngrx/store';
import { Subject, of, throwError } from 'rxjs';
import { ContentActions } from './core/store/content.feature';
import { vi } from 'vitest';
import { BLOG_CONTENT } from './content/blog.content';
import { dayMonthYear } from './core/dates';
import { POST_COVER_SIZES } from './core/image-sizes';
import { BlogListPage, pageNumber, tagFilter } from './pages/blog-list/blog-list';
import { BlogPostPage } from './pages/blog-post/blog-post';
import { Blog } from './sections/blog/blog';

function setup(api: Record<string, unknown>, responseInit?: ResponseInit, demo = false) {
  // Reduced motion: keeps GSAP from lazy-loading while the test environment tears down.
  window.matchMedia = ((query: string) =>
    ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestStore({ site: { settings: { siteName: 'Muhammad Asif' }, status: 'loaded', error: null } }),
      { provide: PublicApiService, useValue: api },
      // Demo content is dev-only UI review data; these tests cover real API behaviour.
      { provide: DEMO_CONTENT, useValue: demo },
      ...(responseInit ? [{ provide: RESPONSE_INIT, useValue: responseInit }] : []),
    ],
  });
}

const card = (slug: string, overrides: Record<string, unknown> = {}) => ({
  _id: slug,
  slug,
  title: `Post ${slug}`,
  excerpt: `Excerpt of ${slug}`,
  tags: ['angular', 'ssr'],
  status: 'published',
  publishedAt: '2026-09-01T10:00:00.000Z',
  readingTime: 6,
  seo: {},
  ...overrides,
});
const page = (data: unknown[], extra: Record<string, number> = {}) => ({
  data,
  total: data.length,
  limit: 9,
  page: 1,
  pages: data.length ? 1 : 0,
  ...extra,
});

function jsonLd(): Record<string, any>[] {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((node) => {
    const parsed = JSON.parse(node.textContent ?? '[]');
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

describe('date and query helpers', () => {
  it('formats dates in UTC', () => {
    expect(dayMonthYear('2026-09-01T23:30:00.000Z')).toEqual({ label: 'Sep 1, 2026', iso: '2026-09-01' });
    expect(dayMonthYear('nope')).toBeNull();
  });

  it('reads ?page and ?tag defensively', () => {
    expect([pageNumber('2'), pageNumber(undefined), pageNumber('0'), pageNumber('abc'), pageNumber('1.5')]).toEqual([
      2, 1, 1, 1, 1,
    ]);
    expect([tagFilter(' Angular '), tagFilter(''), tagFilter(undefined)]).toEqual(['angular', null, null]);
  });
});

describe('Blog section (home)', () => {
  async function render(listPosts: () => unknown) {
    setup({ listPosts });
    const fixture = TestBed.createComponent(Blog);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the latest posts as linked cards with author and date', async () => {
    const listPosts = vi.fn(() => of(page([card('one'), card('two')])));
    const el = await render(listPosts);
    expect(listPosts).toHaveBeenCalledWith({ limit: BLOG_CONTENT.home.limit });
    const cards = el.querySelectorAll('app-post-card');
    expect(cards.length).toBe(2);
    expect(cards[0]?.querySelector('h3 a')?.getAttribute('href')).toBe('/blog/one');
    // Figma meta: orange-dot author and date (reading time is on the post page only).
    expect(Array.from(cards[0]!.querySelectorAll('.post-card__dot')).map((node) => node.textContent?.trim())).toEqual([
      'Muhammad Asif',
      'Sep 1, 2026',
    ]);
    expect(cards[0]?.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-01');
    expect(el.querySelector('.blog__all')?.getAttribute('href')).toBe('/blog');
  });

  it('shows the demo posts as real-looking cards in development when none are published', async () => {
    setup({ listPosts: () => of(page([])) }, undefined, true);
    const fixture = TestBed.createComponent(Blog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-post-card').length).toBe(3);
    expect(el.querySelector('app-post-card h3 a')?.getAttribute('href')).toBe('/blog/building-a-multi-tenant-backend');
  });

  it('lists the planned topics as "Coming soon" (not links) until a post is published', async () => {
    const el = await render(() => of(page([])));
    const upcoming = el.querySelectorAll('.blog__upcoming');
    expect(Array.from(upcoming).map((item) => item.querySelector('.blog__upcoming-title')?.textContent)).toEqual([
      ...BLOG_CONTENT.home.upcoming,
    ]);
    expect(el.querySelector('.blog__grid a')).toBeNull();
    expect(el.querySelector('.blog__all')).toBeNull();
  });

  it('shows "Try again" instead of the upcoming topics when the API fails', async () => {
    const listPosts = vi.fn().mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValueOnce(of(page([card('one')])));
    setup({ listPosts });
    const fixture = TestBed.createComponent(Blog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.blog__upcoming')).toBeNull();
    el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-post-card').length).toBe(1);
  });
});

describe('Blog list page', () => {
  async function render(listPosts: ReturnType<typeof vi.fn>, params: { page?: string; tag?: string } = {}) {
    const responseInit: ResponseInit = {};
    setup({ listPosts }, responseInit);
    const fixture = TestBed.createComponent(BlogListPage);
    if (params.page) fixture.componentRef.setInput('page', params.page);
    if (params.tag) fixture.componentRef.setInput('tag', params.tag);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, responseInit };
  }

  it('requests the page and renders crawlable pagination links', async () => {
    const listPosts = vi.fn(() => of(page([card('a'), card('b')], { total: 20, page: 2, pages: 3 })));
    const { el } = await render(listPosts, { page: '2' });
    expect(listPosts).toHaveBeenCalledWith({ page: 2, limit: BLOG_CONTENT.list.pageSize });
    expect(el.querySelector('h1')?.textContent).toBe('Blog');
    expect(el.querySelectorAll('app-post-card h2').length).toBe(2);

    const links = Array.from(el.querySelectorAll('.blog-list__page')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/blog', '/blog?page=2', '/blog?page=3']);
    expect(el.querySelector('[aria-current="page"].blog-list__page')?.textContent).toBe('2');
    expect(el.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe('/blog');
    expect(el.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/blog?page=3');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/blog\?page=2$/);
    expect(TestBed.inject(Title).getTitle()).toContain('Blog, page 2');
  });

  it('filters by tag, keeps the tag in page links, and is noindex', async () => {
    const listPosts = vi.fn(() => of(page([card('a')], { total: 12, pages: 2 })));
    const { el } = await render(listPosts, { tag: 'Angular' });
    expect(listPosts).toHaveBeenCalledWith({ page: 1, limit: BLOG_CONTENT.list.pageSize, tag: ['angular'] });
    expect(el.querySelector('.blog-list__tag')?.textContent).toBe('angular');
    expect(el.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/blog?page=2&tag=angular');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/blog$/);
  });

  it('answers 404 past the last page and 503 when the API fails', async () => {
    const past = await render(vi.fn(() => of(page([], { total: 3, page: 5, pages: 1 }))), { page: '5' });
    expect(past.responseInit.status).toBe(404);
    expect(past.el.querySelector('.blog-list__empty p')?.textContent).toBe(BLOG_CONTENT.list.emptyPage);

    TestBed.resetTestingModule();
    const down = await render(vi.fn(() => throwError(() => new Error('down'))));
    expect(down.responseInit.status).toBe(503);
    expect(down.el.querySelector('app-load-error')?.textContent).toContain(BLOG_CONTENT.list.errorTitle);
  });

  it('"Try again" reloads a failed page; visited pages come back from the cache', async () => {
    const listPosts = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of(page([card('a')])));
    setup({ listPosts }, {});
    const fixture = TestBed.createComponent(BlogListPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-post-card').length).toBe(1);
    fixture.destroy();

    const again = TestBed.createComponent(BlogListPage);
    await again.whenStable();
    expect((again.nativeElement as HTMLElement).querySelectorAll('app-post-card').length).toBe(1);
    expect(listPosts).toHaveBeenCalledTimes(2);
  });
});

describe('Blog post page', () => {
  const post = {
    ...card('ssr-lessons', { tags: ['angular', 'ngrx'], updatedAt: '2026-09-10T00:00:00.000Z' }),
    content: '<h2>Why SSR</h2><p>Faster first paint.</p><img src=x onerror="alert(1)">',
    coverImage: { key: 'blog/2026/09/c.webp', url: 'https://cdn.test/c.webp', alt: 'Cover' },
  };

  async function render(getPost: () => unknown) {
    const responseInit: ResponseInit = {};
    setup({ getPost }, responseInit);
    const fixture = TestBed.createComponent(BlogPostPage);
    fixture.componentRef.setInput('slug', 'ssr-lessons');
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, responseInit };
  }

  it('renders the post with tag links, dates, sanitized content and a CTA', async () => {
    const { el, responseInit } = await render(() => of(post));
    expect(el.querySelector('h1')?.textContent).toBe('Post ssr-lessons');
    expect(Array.from(el.querySelectorAll('.post__tag')).map((a) => a.getAttribute('href'))).toEqual([
      '/blog?tag=angular',
      '/blog?tag=ngrx',
    ]);
    expect(el.querySelector('.post__meta')?.textContent?.replace(/\s*·\s*/g, ' · ').trim()).toBe(
      'Muhammad Asif · Sep 1, 2026 · 6 min read · Updated Sep 10, 2026',
    );
    expect(el.querySelector('.post__content h2')?.textContent).toBe('Why SSR');
    expect(el.querySelector('.post__content img')?.getAttribute('onerror')).toBeNull();
    expect(el.querySelector('.post__cta a')?.getAttribute('href')).toBe('/#contact');
    expect(responseInit.status).toBeUndefined();
  });

  it('serves the cover (the LCP image) eagerly at high priority, responsive when the API sends a srcset', async () => {
    const srcset = 'https://cdn.test/c-w480.webp 480w, https://cdn.test/c-w960.webp 960w, https://cdn.test/c.webp 1600w';
    const { el } = await render(() =>
      of({ ...post, coverImage: { ...post.coverImage, width: 1600, height: 900, variants: [480, 960], srcset } }),
    );
    const cover = el.querySelector<HTMLImageElement>('img.post__cover')!;
    expect(cover.getAttribute('srcset')).toBe(srcset);
    expect(cover.getAttribute('sizes')).toBe(POST_COVER_SIZES);
    expect(cover.getAttribute('src')).toBe('https://cdn.test/c.webp');
    expect(cover.getAttribute('fetchpriority')).toBe('high');
    expect(cover.getAttribute('loading')).toBeNull();
    expect([cover.getAttribute('width'), cover.getAttribute('height')]).toEqual(['1600', '900']);
  });

  it('falls back to the plain cover src for images stored before variants existed', async () => {
    const { el } = await render(() => of(post));
    const cover = el.querySelector<HTMLImageElement>('img.post__cover')!;
    expect(cover.getAttribute('src')).toBe('https://cdn.test/c.webp');
    expect(cover.hasAttribute('srcset')).toBe(false);
    expect(cover.hasAttribute('sizes')).toBe(false);
    expect([cover.getAttribute('width'), cover.getAttribute('height')]).toEqual(['1600', '900']);
  });

  it('emits og:type article, BlogPosting and a Home › Blog › post breadcrumb', async () => {
    await render(() => of(post));
    expect(TestBed.inject(Meta).getTag('property="og:type"')?.content).toBe('article');
    const posting = jsonLd().find((schema) => schema['@type'] === 'BlogPosting');
    expect(posting).toMatchObject({
      headline: 'Post ssr-lessons',
      description: 'Excerpt of ssr-lessons',
      image: ['https://cdn.test/c.webp'],
      datePublished: '2026-09-01T10:00:00.000Z',
      dateModified: '2026-09-10T00:00:00.000Z',
      keywords: 'angular, ngrx',
      timeRequired: 'PT6M',
    });
    expect(posting?.['author']['@id']).toMatch(/#person$/);
    const crumbs = jsonLd().find((schema) => schema['@type'] === 'BreadcrumbList');
    expect(crumbs?.['itemListElement'].map((item: { name: string }) => item.name)).toEqual([
      'Home',
      'Blog',
      'Post ssr-lessons',
    ]);
  });

  it('renders the card from a list at once while the full post loads', async () => {
    const full = new Subject<typeof post>();
    setup({ getPost: () => full }, {});
    TestBed.inject(Store).dispatch(
      ContentActions.loadPostListSuccess({ key: 'limit=3', result: page([card('ssr-lessons')]) as never, loadedAt: Date.now() }),
    );
    const fixture = TestBed.createComponent(BlogPostPage);
    fixture.componentRef.setInput('slug', 'ssr-lessons');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBe('Post ssr-lessons');
    expect(el.querySelector('.post__lead')?.textContent).toBe('Excerpt of ssr-lessons');
    expect(el.querySelector('.post__content')).toBeNull();

    full.next(post);
    full.complete();
    await fixture.whenStable();
    expect(el.querySelector('.post__content h2')?.textContent).toBe('Why SSR');
  });

  it('a failed post shows "Try again" (503) and loads on retry', async () => {
    const getPost = vi.fn().mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 }))).mockReturnValueOnce(of(post));
    const responseInit: ResponseInit = {};
    setup({ getPost }, responseInit);
    const fixture = TestBed.createComponent(BlogPostPage);
    fixture.componentRef.setInput('slug', 'ssr-lessons');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(responseInit.status).toBe(503);
    expect(el.querySelector('h1')?.textContent).toBe(BLOG_CONTENT.post.errorTitle);
    expect(el.querySelector('app-load-error a')?.getAttribute('href')).toBe('/blog');
    el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toBe('Post ssr-lessons');
  });

  it('answers unknown slugs with 404 + noindex', async () => {
    const { el, responseInit } = await render(() =>
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    );
    expect(responseInit.status).toBe(404);
    expect(el.querySelector('h1')?.textContent).toBe(BLOG_CONTENT.post.notFoundTitle);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
  });
});
