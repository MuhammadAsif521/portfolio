import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { Project } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { SeoService } from '@shared/services/seo.service';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PROJECTS_CONTENT } from '../../content/projects.content';

type ProjectState =
  | { status: 'loading' }
  | { status: 'loaded'; project: Project }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * /projects/:slug case study (brief, Parts 4/5). Rendered on the server with the project's own SEO,
 * CreativeWork + BreadcrumbList JSON-LD, and a real 404 status for unknown or unpublished slugs.
 */
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, IconComponent],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailPage {
  /** Bound from the route by withComponentInputBinding(). */
  readonly slug = input.required<string>();

  private readonly api = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  protected readonly content = PROJECTS_CONTENT.detail;

  protected readonly state = toSignal(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.api.getProject(slug).pipe(
          map((project): ProjectState => ({ status: 'loaded', project })),
          catchError((err: unknown) =>
            of<ProjectState>(
              err instanceof HttpErrorResponse && err.status === 404 ? { status: 'not-found' } : { status: 'error' },
            ),
          ),
          startWith<ProjectState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as ProjectState },
  );

  protected readonly project = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.project : null;
  });

  constructor() {
    effect(() => {
      const state = this.state();
      const path = `/projects/${this.slug()}`;

      if (state.status === 'loaded') {
        this.applySeo(state.project, path);
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
        ...this.seo.siteJsonLd(),
        this.seo.buildCreativeWorkJsonLd({
          name: project.title,
          description: project.summary,
          url,
          image,
          datePublished: project.publishedAt,
          dateModified: project.updatedAt,
          keywords: project.techStack,
        }),
        // No /projects index page exists (the list lives at /#projects), so the trail is Home → project.
        this.seo.buildBreadcrumbJsonLd([
          { name: 'Home', url: this.seo.buildUrl('/') },
          { name: project.title, url },
        ]),
      ],
    });
  }
}
