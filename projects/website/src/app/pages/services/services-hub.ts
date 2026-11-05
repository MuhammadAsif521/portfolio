import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { SERVICES_HUB, SERVICES_PATH, SERVICE_PAGES } from '@shared/services-pages/services.data';

/** /services: every service page (CollectionPage + ItemList). Reuses the tools hub styles. */
@Component({
  selector: 'app-services-hub',
  imports: [RouterLink],
  styleUrl: '../tools/tools-hub/tools-hub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hub">
      <nav class="hub__crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a routerLink="/">Home</a></li>
          <li aria-current="page">Services</li>
        </ol>
      </nav>
      <header>
        <h1 class="hub__title">{{ hub.h1 }}</h1>
        <p class="hub__intro">{{ hub.intro }}</p>
      </header>
      <ul class="hub__grid">
        @for (s of services; track s.slug) {
          <li>
            <a class="hub__card" [routerLink]="['/services', s.slug]">
              <h2 class="hub__name">{{ s.name }}</h2>
              <p class="hub__text">{{ s.description }}</p>
            </a>
          </li>
        }
      </ul>
    </div>
  `,
})
export class ServicesHubPage {
  protected readonly hub = SERVICES_HUB;
  protected readonly services = SERVICE_PAGES;

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      seo.updateFromRouteData(
        { title: SERVICES_HUB.h1, metaTitle: SERVICES_HUB.title, metaDescription: SERVICES_HUB.description },
        SERVICES_PATH,
      );
      const url = seo.buildUrl(SERVICES_PATH);
      const listId = `${url}#itemlist`;
      seo.updateSeo({
        jsonLd: [
          ...seo.webPageNodes({
            type: 'CollectionPage',
            path: SERVICES_PATH,
            name: SERVICES_HUB.h1,
            description: SERVICES_HUB.description,
            dateModified: SERVICES_HUB.updatedAt,
            breadcrumb: [
              { name: 'Home', url: seo.buildUrl('/') },
              { name: 'Services', url },
            ],
            extra: { mainEntity: { '@id': listId } },
          }),
          {
            '@type': 'ItemList',
            '@id': listId,
            itemListElement: SERVICE_PAGES.map((s, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: s.name,
              url: seo.buildUrl(`${SERVICES_PATH}/${s.slug}`),
            })),
          },
        ],
      });
    });
  }
}
