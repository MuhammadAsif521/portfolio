import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { Project } from '@shared/interfaces/public-api.interface';
import { SeoService } from '@shared/services/seo.service';
import { PROJECTS_CONTENT } from '../../content/projects.content';
import { CodeBlocksDirective } from '../../core/code-blocks.directive';
import { dayMonthYear } from '../../core/dates';
import { PROJECT_COVER_SIZES } from '../../core/image-sizes';
import { ContentActions, contentFeature } from '../../core/store/content.feature';
import { LoadError } from '../../ui/load-error/load-error';

/**
 * /projects/:slug case study (brief, Parts 4/5). Rendered on the server with the project's own SEO,
 * CreativeWork + BreadcrumbList JSON-LD, and a real 404 status for unknown or unpublished slugs.
 */
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, IconComponent, CodeBlocksDirective, LoadError],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailPage {
  /** Bound from the route by withComponentInputBinding(). */
  readonly slug = input.required<string>();

  private readonly store = inject(Store);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly content = PROJECTS_CONTENT.detail;
  protected readonly coverSizes = PROJECT_COVER_SIZES;

  /** This slug from the content cache: the full case study, or its list card as a preview while it loads. */
  private readonly projectFor = this.store.selectSignal(contentFeature.selectProjectFor);
  protected readonly view = computed(() => this.projectFor()(this.slug()));

  protected readonly project = computed(() => this.view().doc);
  protected readonly notFound = computed(() => this.view().notFound && !this.view().doc);
  /** What the header renders: the full document, else the card (title, summary, cover) from the home list. */
  protected readonly head = computed(() => (this.notFound() ? null : (this.view().doc ?? this.view().preview)));
  /** The full document failed to load (not a 404): error box with "Try again", kept while retrying. */
  protected readonly failed = computed(() => !this.view().doc && !this.notFound() && this.view().error !== null);
  protected readonly retrying = computed(() => this.view().status === 'loading');
  /** When the case study was last edited (shown as "Last updated"; a freshness signal for readers and crawlers). */
  protected readonly updated = computed(() => dayMonthYear(this.head()?.updatedAt ?? this.head()?.publishedAt));

  constructor() {
    // Load-if-needed for the current slug. During SSR the render waits for it (pendingUntilEvent in the effect).
    effect(() => this.load());

    effect(() => {
      const path = `/projects/${this.slug()}`;
      const project = this.project();

      if (project) {
        this.applySeo(project, path);
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
    this.store.dispatch(ContentActions.loadProject({ slug: this.slug() }));
  }

  private applySeo(project: Project, path: string): void {
    const seo = project.seo ?? {};
    const image = seo.ogImage?.url ?? project.coverImage?.url;
    this.seo.updateFromRouteData(
      {
        title: seo.title || project.title,
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription || project.summary,
        metaKeywords: seo.metaKeywords || project.techStack.join(', '),
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: image,
        robots: seo.robots,
      },
      path,
    );

    const url = this.seo.buildUrl(path);
    this.seo.updateSeo({
      jsonLd: [
        ...this.seo.webPageNodes({
          path,
          name: project.title,
          description: project.summary,
          image,
          datePublished: project.publishedAt,
          dateModified: project.updatedAt,
          // No /projects index page exists (the list lives at /#projects), so the trail is Home → project.
          breadcrumb: [
            { name: 'Home', url: this.seo.buildUrl('/') },
            { name: project.title, url },
          ],
          extra: { mainEntity: { '@id': `${url}#work` } },
        }),
        this.seo.buildCreativeWorkJsonLd({
          name: project.title,
          description: project.summary,
          url,
          image,
          datePublished: project.publishedAt,
          dateModified: project.updatedAt,
          keywords: project.techStack,
          repoUrl: project.repoUrl,
        }),
      ],
    });
  }
}
