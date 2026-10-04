import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { BlogPost } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { SeoService } from '@shared/services/seo.service';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { BLOG_CONTENT } from '../../content/blog.content';
import { CodeBlocksDirective } from '../../core/code-blocks.directive';
import { DEMO_CONTENT, DEMO_POSTS } from '../../core/demo-content';
import { dayMonthYear } from '../../core/dates';
import { POST_COVER_SIZES } from '../../core/image-sizes';
import { siteFeature } from '../../core/store/site.feature';

type PostState =
  | { status: 'loading' }
  | { status: 'loaded'; post: BlogPost }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * /blog/:slug (brief, Parts 3/4): server-rendered post with its own SEO, og:type article, BlogPosting +
 * BreadcrumbList JSON-LD, and real 404/503 statuses.
 */
@Component({
  selector: 'app-blog-post',
  imports: [RouterLink, IconComponent, CodeBlocksDirective],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPostPage {
  readonly slug = input.required<string>();

  private readonly api = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly demo = inject(DEMO_CONTENT);

  protected readonly content = BLOG_CONTENT.post;
  protected readonly coverSizes = POST_COVER_SIZES;
  protected readonly author = inject(Store).selectSignal(siteFeature.selectSiteName);

  protected readonly state = toSignal(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.api.getPost(slug).pipe(
          map((post): PostState => ({ status: 'loaded', post })),
          catchError((err: unknown) => {
            // Development only: demo posts open their own (demo) page.
            const demo = this.demo ? DEMO_POSTS.find((item) => item.slug === slug) : undefined;
            if (demo) return of<PostState>({ status: 'loaded', post: demo });
            return of<PostState>(
              err instanceof HttpErrorResponse && err.status === 404 ? { status: 'not-found' } : { status: 'error' },
            );
          }),
          startWith<PostState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as PostState },
  );

  protected readonly post = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.post : null;
  });
  protected readonly published = computed(() => dayMonthYear(this.post()?.publishedAt));
  /** Shown only when the post was edited on a later day than it was published. */
  protected readonly updated = computed(() => {
    const updated = dayMonthYear(this.post()?.updatedAt);
    return updated && updated.iso !== this.published()?.iso ? updated : null;
  });

  constructor() {
    effect(() => {
      const state = this.state();
      const path = `/blog/${this.slug()}`;

      if (state.status === 'loaded') {
        this.applySeo(state.post, path);
      } else if (state.status === 'not-found' || state.status === 'error') {
        if (this.responseInit) this.responseInit.status = state.status === 'not-found' ? 404 : 503;
        this.seo.updateFromRouteData(
          {
            title: state.status === 'not-found' ? this.content.notFoundTitle : this.content.errorTitle,
            robots: 'noindex, follow',
          },
          path,
        );
      }
    });
  }

  private applySeo(post: BlogPost, path: string): void {
    const seo = post.seo ?? {};
    const image = seo.ogImage?.url ?? post.coverImage?.url;
    this.seo.updateFromRouteData(
      {
        title: seo.title || post.title,
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription || post.excerpt,
        metaKeywords: seo.metaKeywords || post.tags.join(', '),
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: image,
        robots: seo.robots,
      },
      path,
    );

    const url = this.seo.buildUrl(path);
    this.seo.updateSeo({
      ogType: 'article',
      jsonLd: [
        ...this.seo.siteJsonLd(),
        this.seo.buildBlogPostingJsonLd({
          headline: post.title,
          description: post.excerpt,
          url,
          image,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          keywords: post.tags,
          readingTime: post.readingTime,
        }),
        this.seo.buildBreadcrumbJsonLd([
          { name: 'Home', url: this.seo.buildUrl('/') },
          { name: 'Blog', url: this.seo.buildUrl('/blog') },
          { name: post.title, url },
        ]),
      ],
    });
  }
}
