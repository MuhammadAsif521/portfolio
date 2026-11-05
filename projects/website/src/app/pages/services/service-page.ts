import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  imports: [RouterLink],
  styleUrl: '../tools/tool-layout/tool-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="tool">
      <nav class="tool__crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a routerLink="/">Home</a></li>
          <li><a routerLink="/services">Services</a></li>
          <li aria-current="page">{{ service()?.name ?? 'Not found' }}</li>
        </ol>
      </nav>

      @if (service(); as s) {
        <header>
          <h1 class="tool__title">{{ s.h1 }}</h1>
          @for (text of s.intro; track $index) {
            <p class="tool__lead">{{ text }}</p>
          }
          <p class="tool__section"><a class="tool__button" routerLink="/" fragment="contact" (click)="cta('top')">Discuss your project</a></p>
        </header>

        <section class="tool__section">
          <h2 class="tool__h2">What's included</h2>
          <ul class="tool__p">
            @for (item of s.included; track item) {
              <li>{{ item }}</li>
            }
          </ul>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">How we'll work</h2>
          <ol class="tool__p">
            @for (p of s.process; track p.step) {
              <li><strong>{{ p.step }}.</strong> {{ p.detail }}</li>
            }
          </ol>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">Tech I use</h2>
          <p class="tool__p">{{ s.tech.join(' · ') }}</p>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">Case studies</h2>
          <ul class="tool__related tool__related--wide">
            @for (c of s.caseStudies; track c.slug) {
              <li>
                <a [routerLink]="['/projects', c.slug]">{{ c.title }}</a>
                <p class="tool__p">{{ c.why }}</p>
              </li>
            }
          </ul>
        </section>

        <section class="tool__section tool__faq">
          <h2 class="tool__h2">Frequently asked questions</h2>
          @for (item of s.faq; track item.q) {
            <details>
              <summary>{{ item.q }}</summary>
              <p>{{ item.a }}</p>
            </details>
          }
        </section>

        @if (tools().length) {
          <section class="tool__section">
            <h2 class="tool__h2">Free tools I built</h2>
            <ul class="tool__related">
              @for (t of tools(); track t.slug) {
                <li><a [routerLink]="['/tools', t.slug]">{{ t.name }}</a></li>
              }
            </ul>
          </section>
        }

        <section class="tool__section">
          <h2 class="tool__h2">Other services</h2>
          <ul class="tool__related">
            @for (o of others(); track o.slug) {
              <li><a [routerLink]="['/services', o.slug]">{{ o.name }}</a></li>
            }
          </ul>
        </section>

        <aside class="tool__cta">
          <h2 class="tool__h2">Have a project in mind?</h2>
          <p>Send a short brief and I usually reply within a day.</p>
          <a routerLink="/" fragment="contact" (click)="cta('bottom')">Contact me</a>
        </aside>
      } @else {
        <header>
          <h1 class="tool__title">Service not found</h1>
          <p class="tool__lead">This service page does not exist.</p>
        </header>
        <p class="tool__p"><a routerLink="/services">See all services</a></p>
      }
    </article>
  `,
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
