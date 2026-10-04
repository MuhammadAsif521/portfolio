import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { BlogListQuery } from '@shared/interfaces/public-api.interface';
import { SeoService } from '@shared/services/seo.service';
import { BLOG_CONTENT } from '../../content/blog.content';
import { ContentActions, contentFeature } from '../../core/store/content.feature';
import { LoadError } from '../../ui/load-error/load-error';
import { PostCard } from '../../ui/post-card/post-card';

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
 * Pages come from the NgRx content cache, so going back to a visited page renders instantly.
 */
@Component({
  selector: 'app-blog-list',
  imports: [RouterLink, IconComponent, PostCard, LoadError],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogListPage {
  /** Query params, bound by withComponentInputBinding(). */
  readonly page = input<string>();
  readonly tag = input<string>();

  private readonly store = inject(Store);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly content = BLOG_CONTENT.list;
  protected readonly currentPage = computed(() => pageNumber(this.page()));
  protected readonly currentTag = computed(() => tagFilter(this.tag()));
  private readonly query = computed((): BlogListQuery => {
    const tag = this.currentTag();
    return { page: this.currentPage(), limit: BLOG_CONTENT.list.pageSize, ...(tag ? { tag: [tag] } : {}) };
  });

  private readonly listFor = this.store.selectSignal(contentFeature.selectPostListFor);
  protected readonly list = computed(() => this.listFor()(this.query()));

  /** The loaded page (also while it refreshes in the background); null while loading or failed. */
  protected readonly result = computed(() => {
    const list = this.list();
    return list.status === 'loaded' ? list : null;
  });
  /** The load failed: error box with "Try again" (kept, as "Retrying…", while the retry runs). */
  protected readonly failed = computed(() => !this.result() && this.list().error !== null);
  protected readonly retrying = computed(() => this.list().status === 'loading');

  /** Past the last page (only possible with a hand-typed or stale ?page=). */
  protected readonly outOfRange = computed(() => {
    const result = this.result();
    return !!result && result.items.length === 0 && this.currentPage() > 1;
  });

  protected readonly pages = computed(() => {
    const total = this.result()?.pages ?? 0;
    return Array.from({ length: total }, (_, index) => index + 1);
  });

  constructor() {
    // Load-if-needed whenever ?page / ?tag change; the effect skips pages that are cached and fresh.
    effect(() => this.load());

    effect(() => {
      const failed = this.failed();
      if (!this.result() && !failed) return; // still loading
      const page = this.currentPage();
      const tag = this.currentTag();

      if (this.responseInit && failed) this.responseInit.status = 503;
      if (this.responseInit && this.outOfRange()) this.responseInit.status = 404;

      const base = this.seo.buildUrl('/blog');
      this.seo.updateFromRouteData(
        {
          title: tag ? `${this.content.title}: ${tag}` : page > 1 ? `${this.content.title}, page ${page}` : this.content.title,
          metaDescription: this.content.intro,
          ogUrl: page > 1 && !tag ? `${base}?page=${page}` : base,
          robots: tag || failed || this.outOfRange() ? 'noindex, follow' : 'index, follow',
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

  protected load(): void {
    this.store.dispatch(ContentActions.loadPostList({ query: this.query() }));
  }

  /** Query params for a page link; page 1 and "no tag" are omitted so URLs stay canonical. */
  protected params(page: number): Record<string, string | number | null> {
    return { page: page > 1 ? page : null, tag: this.currentTag() };
  }
}
