import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { AnalyticsService } from '@shared/services/analytics.service';
import { SeoService } from '@shared/services/seo.service';
import { SERVICES_PATH, SERVICE_PAGES, serviceBySlug } from '@shared/services-pages/services.data';
import { injectLiveTools } from '../tools/live-tools';
import { injectNotFoundUrl } from '../../core/not-found-url';

/**
 * /services/:slug: one commercial landing page per service (copy in services.data.ts), with Service +
 * FAQPage + BreadcrumbList JSON-LD and links to the case studies that prove it. Unknown slugs: real 404.
 */
@Component({
  selector: 'app-service-page',
  imports: [RouterLink, IconComponent],
  templateUrl: './service-page.html',
  styleUrl: './service-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicePageComponent {
  readonly slug = input.required<string>();

  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly live = injectLiveTools();
  /** Shows /404 in the address bar (the response itself stays a 404 at this URL). */
  private readonly showNotFoundUrl = injectNotFoundUrl();

  protected readonly service = computed(() => serviceBySlug(this.slug()));
  protected readonly tools = computed(() => this.live().filter((t) => this.service()?.tools.includes(t.slug)));
  protected readonly others = computed(() => SERVICE_PAGES.filter((s) => s.slug !== this.slug()));

  constructor() {
    effect(() => {
      const s = this.service();
      const path = `${SERVICES_PATH}/${this.slug()}`;
      if (!s) {
        if (this.responseInit) this.responseInit.status = 404;
        this.showNotFoundUrl();
        this.seo.updateFromRouteData({ title: 'Service not found', robots: 'noindex, follow' }, path);
        return;
      }
      this.seo.updateFromRouteData(
        { title: s.name, metaTitle: s.title, metaDescription: s.description, metaKeywords: s.keyword },
        path,
      );
      const url = this.seo.buildUrl(path);
      this.seo.updateSeo({
        jsonLd: [
          ...this.seo.webPageNodes({
            path,
            name: s.h1,
            description: s.description,
            dateModified: s.updatedAt,
            breadcrumb: [
              { name: 'Home', url: this.seo.buildUrl('/') },
              { name: 'Services', url: this.seo.buildUrl(SERVICES_PATH) },
              { name: s.name, url },
            ],
            extra: { mainEntity: { '@id': `${url}#service` } },
          }),
          {
            '@type': 'Service',
            '@id': `${url}#service`,
            name: s.name,
            serviceType: s.name,
            description: s.description,
            url,
            provider: { '@id': this.seo.personId },
            areaServed: 'Worldwide',
            availableChannel: { '@type': 'ServiceChannel', serviceUrl: this.seo.buildUrl('/#contact') },
          },
          {
            '@type': 'FAQPage',
            '@id': `${url}#faq`,
            mainEntity: s.faq.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ],
      });
    });
  }

  protected cta(location: string): void {
    this.analytics.track('cta_clicked', { location: `service:${this.slug()}:${location}` });
  }
}
