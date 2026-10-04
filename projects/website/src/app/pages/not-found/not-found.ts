import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { NOT_FOUND_CONTENT } from '../../content/not-found.content';

/**
 * Any URL no route matches. Answers with a real 404 status and noindex (redirecting unknown URLs to the
 * home page made every typo a "soft 404" duplicate of it), and offers the main sections instead.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './not-found.scss',
  template: `
    <div class="missing">
      <h1 class="missing__title">{{ content.title }}</h1>
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

  constructor() {
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) responseInit.status = 404;
    // The requested path as its own (noindex) canonical: never a page the visitor did not ask for.
    const path = inject(Location).path() || '/';
    inject(SeoService).updateFromRouteData({ title: NOT_FOUND_CONTENT.title, robots: 'noindex, follow' }, path);
  }
}
