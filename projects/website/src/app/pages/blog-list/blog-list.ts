import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { PaginatedResponse } from '@shared/interfaces/auth.interface';
import type { BlogPostCard } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { SeoService } from '@shared/services/seo.service';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { BLOG_CONTENT } from '../../content/blog.content';
import { DEMO_CONTENT, DEMO_POSTS } from '../../core/demo-content';
import { PostCard } from '../../ui/post-card/post-card';

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; result: PaginatedResponse<BlogPostCard> }
  | { status: 'error' };

/** "2" → 2; anything else (missing, "0", "abc", "-3") → 1. */
export function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Tags are stored lowercase (backend Zod); blank means "no filter". */
export function tagFilter(value: string | undefined): string | null {
  const tag = value?.trim().toLowerCase();
  return tag ? tag.slice(0, 30) : null;
}

/**
 * /blog (brief, Part 4): paginated post list with crawlable ?page= links and an optional ?tag= filter.
 * Filtered views are noindex (they duplicate the main list); a page past the end answers 404.
 */
@Component({
  selector: 'app-blog-list',
  imports: [RouterLink, IconComponent, PostCard],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogListPage {
  /** Query params, bound by withComponentInputBinding(). */
  readonly page = input<string>();
  readonly tag = input<string>();

  private readonly api = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly demo = inject(DEMO_CONTENT);

  protected readonly content = BLOG_CONTENT.list;
  protected readonly currentPage = computed(() => pageNumber(this.page()));
  protected readonly currentTag = computed(() => tagFilter(this.tag()));
  private readonly query = computed(() => ({ page: this.currentPage(), tag: this.currentTag() }));

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap(({ page, tag }) =>
        this.api.listPosts({ page, limit: BLOG_CONTENT.list.pageSize, ...(tag ? { tag: [tag] } : {}) }).pipe(
          map((result): ListState =>
            result.data.length || page > 1 || !this.demo
              ? { status: 'loaded', result }
              : { status: 'loaded', result: this.demoPage(tag) },
          ),
          catchError(() =>
            of<ListState>(this.demo && page === 1 ? { status: 'loaded', result: this.demoPage(tag) } : { status: 'error' }),
          ),
          startWith<ListState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as ListState },
  );

  protected readonly result = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.result : null;
  });

  /** Past the last page (only possible with a hand-typed or stale ?page=). */
  protected readonly outOfRange = computed(() => {
    const result = this.result();
    return !!result && result.data.length === 0 && this.currentPage() > 1;
  });

  protected readonly pages = computed(() => {
    const total = this.result()?.pages ?? 0;
    return Array.from({ length: total }, (_, index) => index + 1);
  });

  constructor() {
    effect(() => {
      const state = this.state();
      if (state.status === 'loading') return;
      const page = this.currentPage();
      const tag = this.currentTag();

      if (this.responseInit && state.status === 'error') this.responseInit.status = 503;
      if (this.responseInit && this.outOfRange()) this.responseInit.status = 404;

      const base = this.seo.buildUrl('/blog');
      this.seo.updateFromRouteData(
        {
          title: tag ? `${this.content.title}: ${tag}` : page > 1 ? `${this.content.title}, page ${page}` : this.content.title,
          metaDescription: this.content.intro,
          ogUrl: page > 1 && !tag ? `${base}?page=${page}` : base,
          robots: tag || state.status === 'error' || this.outOfRange() ? 'noindex, follow' : 'index, follow',
        },
        '/blog',
      );
      // Paginated pages are canonical to themselves; filtered views point at the main list.
      this.seo.updateSeo({
        canonical: page > 1 && !tag ? `${base}?page=${page}` : base,
        jsonLd: [
          ...this.seo.siteJsonLd(),
          this.seo.buildBreadcrumbJsonLd([
            { name: 'Home', url: this.seo.buildUrl('/') },
            { name: this.content.title, url: base },
          ]),
        ],
      });
    });
  }

  /** Development only: the demo posts as a one-page result (optionally filtered by tag). */
  private demoPage(tag: string | null): PaginatedResponse<BlogPostCard> {
    const data = DEMO_POSTS.filter((post) => !tag || post.tags.includes(tag));
    return { data, total: data.length, limit: BLOG_CONTENT.list.pageSize, page: 1, pages: data.length ? 1 : 0 };
  }

  /** Query params for a page link; page 1 and "no tag" are omitted so URLs stay canonical. */
  protected params(page: number): Record<string, string | number | null> {
    return { page: page > 1 ? page : null, tag: this.currentTag() };
  }
}
