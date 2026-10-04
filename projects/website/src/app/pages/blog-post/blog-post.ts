import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { BlogPost } from '@shared/interfaces/public-api.interface';
import { SeoService, countWords } from '@shared/services/seo.service';
import { BLOG_CONTENT } from '../../content/blog.content';
import { CodeBlocksDirective } from '../../core/code-blocks.directive';
import { dayMonthYear } from '../../core/dates';
import { POST_COVER_SIZES } from '../../core/image-sizes';
import { ContentActions, contentFeature } from '../../core/store/content.feature';
import { siteFeature } from '../../core/store/site.feature';
import { LoadError } from '../../ui/load-error/load-error';

/**
 * /blog/:slug (brief, Parts 3/4): server-rendered post with its own SEO, og:type article, BlogPosting +
 * BreadcrumbList JSON-LD, and real 404/503 statuses.
 */
@Component({
  selector: 'app-blog-post',
  imports: [RouterLink, IconComponent, CodeBlocksDirective, LoadError],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPostPage {
  readonly slug = input.required<string>();

  private readonly store = inject(Store);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly content = BLOG_CONTENT.post;
  protected readonly coverSizes = POST_COVER_SIZES;
  protected readonly author = this.store.selectSignal(siteFeature.selectSiteName);

  /** This slug from the content cache: the full post, or its list card as a preview while it loads. */
  private readonly postFor = this.store.selectSignal(contentFeature.selectPostFor);
  protected readonly view = computed(() => this.postFor()(this.slug()));

  protected readonly post = computed(() => this.view().doc);
  protected readonly notFound = computed(() => this.view().notFound && !this.view().doc);
  /** What the header renders: the full post, else its card (title, excerpt, cover) from a list. */
  protected readonly head = computed(() => (this.notFound() ? null : (this.view().doc ?? this.view().preview)));
  /** The post failed to load (not a 404): error box with "Try again", kept while retrying. */
  protected readonly failed = computed(() => !this.view().doc && !this.notFound() && this.view().error !== null);
  protected readonly retrying = computed(() => this.view().status === 'loading');

  protected readonly published = computed(() => dayMonthYear(this.head()?.publishedAt));
  /** Shown only when the post was edited on a later day than it was published. */
  protected readonly updated = computed(() => {
    const updated = dayMonthYear(this.head()?.updatedAt);
    return updated && updated.iso !== this.published()?.iso ? updated : null;
  });

  constructor() {
    // Load-if-needed for the current slug. During SSR the render waits for it (pendingUntilEvent in the effect).
    effect(() => this.load());

    effect(() => {
      const path = `/blog/${this.slug()}`;
      const post = this.post();

      if (post) {
        this.applySeo(post, path);
      } else if (this.notFound() || this.failed()) {
        if (this.responseInit) this.responseInit.status = this.notFound() ? 404 : 503;
        this.seo.updateFromRouteData(
          {
            title: this.notFound() ? this.content.notFoundTitle : this.content.errorTitle,
            robots: 'noindex, follow',
          },
          path,
        );
      }
    });
  }

  protected load(): void {
    this.store.dispatch(ContentActions.loadPost({ slug: this.slug() }));
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
        ...this.seo.webPageNodes({
          path,
          name: post.title,
          description: post.excerpt,
          image,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          breadcrumb: [
            { name: 'Home', url: this.seo.buildUrl('/') },
            { name: 'Blog', url: this.seo.buildUrl('/blog') },
            { name: post.title, url },
          ],
          extra: { mainEntity: { '@id': `${url}#article` } },
        }),
        this.seo.buildBlogPostingJsonLd({
          headline: post.title,
          description: post.excerpt,
          url,
          image,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          keywords: post.tags,
          readingTime: post.readingTime,
          wordCount: countWords(post.content),
        }),
      ],
    });
  }
}
