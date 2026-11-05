<<<<<<< HEAD
import { Location } from '@angular/common';
=======
>>>>>>> 34a523c (Save local portfolio work)
import { ChangeDetectionStrategy, Component, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { NOT_FOUND_CONTENT } from '../../content/not-found.content';
<<<<<<< HEAD

/**
 * Any URL no route matches. Answers with a real 404 status and noindex (redirecting unknown URLs to the
 * home page made every typo a "soft 404" duplicate of it), and offers the main sections instead.
=======
import { NOT_FOUND_PATH, injectNotFoundUrl } from '../../core/not-found-url';

/**
 * Any URL no route matches, and /404 itself. Answers with a real 404 status and noindex at the requested
 * URL (redirecting unknown URLs made every typo a "soft 404"), then shows /404 in the address bar
 * (see injectNotFoundUrl), and offers the main sections instead.
>>>>>>> 34a523c (Save local portfolio work)
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './not-found.scss',
  template: `
    <div class="missing">
<<<<<<< HEAD
      <h1 class="missing__title">{{ content.title }}</h1>
=======
      <p class="missing__code" aria-hidden="true">404</p>
      <h1 class="missing__title">{{ content.title }}</h1>
      @if (requested !== notFoundPath) {
        <p class="missing__text">Nothing lives at <code>{{ requested }}</code>.</p>
      }
>>>>>>> 34a523c (Save local portfolio work)
      <p class="missing__text">{{ content.text }}</p>
      <ul class="missing__links">
        @for (link of content.links; track link.label) {
          <li>
            <a class="missing__link" [routerLink]="link.path" [fragment]="link.fragment">{{ link.label }}</a>
          </li>
        }
      </ul>
    </div>
  `,
})
export class NotFoundPage {
  protected readonly content = NOT_FOUND_CONTENT;
<<<<<<< HEAD
=======
  protected readonly notFoundPath = NOT_FOUND_PATH;
  /** The path the visitor asked for (before the address bar shows /404). */
  protected readonly requested: string;
>>>>>>> 34a523c (Save local portfolio work)

  constructor() {
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) responseInit.status = 404;
<<<<<<< HEAD
    // The requested path as its own (noindex) canonical: never a page the visitor did not ask for.
    const path = inject(Location).path() || '/';
    inject(SeoService).updateFromRouteData({ title: NOT_FOUND_CONTENT.title, robots: 'noindex, follow' }, path);
=======
    this.requested = injectNotFoundUrl()();
    // The requested path as its own (noindex) canonical: never a page the visitor did not ask for.
    inject(SeoService).updateFromRouteData({ title: NOT_FOUND_CONTENT.title, robots: 'noindex, follow' }, this.requested);
>>>>>>> 34a523c (Save local portfolio work)
  }
}
