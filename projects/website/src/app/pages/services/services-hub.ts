import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { SERVICES_HUB, SERVICES_PATH, SERVICE_PAGES } from '@shared/services-pages/services.data';
import { SERVICES_CONTENT } from '../../content/services.content';
import { ServiceCard } from '../../ui/service-card/service-card';

/** /services: every service as the home page's service card, linking to its page (CollectionPage + ItemList JSON-LD). */
@Component({
  selector: 'app-services-hub',
  imports: [RouterLink, ServiceCard],
  styleUrl: './services-hub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hub">
      <nav class="hub__crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a routerLink="/">Home</a></li>
          <li aria-current="page">Services</li>
        </ol>
      </nav>

      <header class="hub__head">
        <h1 class="hub__title">{{ hub.h1 }}</h1>
        <p class="hub__intro">{{ hub.intro }}</p>
      </header>

      <div class="hub__panel">
        <ul class="hub__grid">
          @for (item of services; track item.page) {
            <li><app-service-card [item]="item" [headingLevel]="2" /></li>
          }
        </ul>
      </div>

      <aside class="hub__help" aria-labelledby="hub-help-title">
        <div>
          <h2 id="hub-help-title" class="hub__help-title">Not sure which service fits?</h2>
          <p class="hub__help-text">Describe your project in a few lines and I will tell you what it needs and what to build first.</p>
        </div>
        <div class="hub__help-actions">
          <a class="hub__button" routerLink="/" fragment="contact">Discuss your project</a>
          <a class="hub__link" routerLink="/faq">Read the FAQ</a>
        </div>
      </aside>
    </div>
  `,
})
export class ServicesHubPage {
  protected readonly hub = SERVICES_HUB;
  protected readonly services = SERVICES_CONTENT.items;

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
