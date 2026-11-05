import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '@shared/services/analytics.service';
import { SeoService } from '@shared/services/seo.service';
import { HTTP_STATUSES, HTTP_STATUS_PATH, STATUS_CLASS_LABELS, statusByCode } from '@shared/tools/http-status.data';
import { TOOLS_PATH } from '@shared/tools/tools.manifest';
import { injectNotFoundUrl } from '../../../core/not-found-url';

/**
 * /tools/http-status-codes/:code: one indexable reference page per covered status code (unique meaning,
 * causes, fix, Express example and SEO impact from http-status.data.ts). Codes without an entry answer a
 * real 404 with noindex, so no thin pages are ever created.
 */
@Component({
  selector: 'app-http-status-detail',
  imports: [RouterLink],
  styleUrls: ['../tool-layout/tool-layout.scss', '../tool-ui.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="tool">
      <nav class="tool__crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a routerLink="/">Home</a></li>
          <li><a routerLink="/tools">Tools</a></li>
          <li><a routerLink="/tools/http-status-codes">HTTP Status Codes</a></li>
          <li aria-current="page">{{ status()?.code ?? code() }}</li>
        </ol>
      </nav>

      @if (status(); as s) {
        <header>
          <p class="tool__privacy">{{ classLabel() }}</p>
          <h1 class="tool__title">HTTP {{ s.code }} {{ s.name }}</h1>
          <p class="tool__lead">{{ s.summary }}</p>
        </header>

        <section class="tool__section">
          <h2 class="tool__h2">What {{ s.code }} {{ s.name }} means</h2>
          <p class="tool__p">{{ s.meaning }}</p>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">Common causes</h2>
          <ul class="tool__p">
            @for (cause of s.causes; track cause) {
              <li>{{ cause }}</li>
            }
          </ul>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">How to fix or use it</h2>
          <p class="tool__p">{{ s.fix }}</p>
          <h3 class="tool-label">Express (Node.js) example</h3>
          <pre class="tool__example"><code>{{ s.express }}</code></pre>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">SEO impact</h2>
          <p class="tool__p">{{ s.seo }}</p>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">Other {{ classLabel() }} codes</h2>
          <ul class="tool__related">
            @for (other of siblings(); track other.code) {
              <li><a [routerLink]="['/tools/http-status-codes', other.code]">{{ other.code }} {{ other.name }}</a></li>
            }
            <li><a routerLink="/tools/http-status-codes">All status codes</a></li>
          </ul>
        </section>

        <aside class="tool__cta">
          <h2 class="tool__h2">Status codes wrong in your app?</h2>
          <p>I build Angular SSR and Node.js apps that send the right code for every case, so caches and Google behave.</p>
          <a routerLink="/" fragment="contact" (click)="ctaClicked()">Hire me</a>
        </aside>
      } @else {
        <header>
          <h1 class="tool__title">No page for status code {{ code() }}</h1>
          <p class="tool__lead">This reference covers the codes you meet most in real apps.</p>
        </header>
        <p class="tool__p"><a routerLink="/tools/http-status-codes">See all covered HTTP status codes</a></p>
      }
    </article>
  `,
})
export class HttpStatusDetailPage {
  readonly code = input.required<string>();

  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  /** Shows /404 in the address bar (the response itself stays a 404 at this URL). */
  private readonly showNotFoundUrl = injectNotFoundUrl();

  protected readonly status = computed(() => (/^\d{3}$/.test(this.code()) ? statusByCode(Number(this.code())) : undefined));
  protected readonly classLabel = computed(() => {
    const s = this.status();
    return s ? STATUS_CLASS_LABELS[s.kind] : '';
  });
  protected readonly siblings = computed(() => {
    const s = this.status();
    return s ? HTTP_STATUSES.filter((o) => o.kind === s.kind && o.code !== s.code) : [];
  });

  constructor() {
    effect(() => {
      const s = this.status();
      const path = `${HTTP_STATUS_PATH}/${this.code()}`;
      if (!s) {
        if (this.responseInit) this.responseInit.status = 404;
        this.showNotFoundUrl();
        this.seo.updateFromRouteData({ title: 'Status code not found', robots: 'noindex, follow' }, path);
        return;
      }
      const description = s.summary.length > 155 ? `${s.summary.slice(0, 152).trimEnd()}...` : s.summary;
      this.seo.updateFromRouteData(
        {
          title: `HTTP ${s.code} ${s.name}`,
          metaTitle: `HTTP ${s.code} ${s.name}: Meaning and Fix | Asif Dev`,
          metaDescription: description,
          metaKeywords: `http ${s.code}, ${s.code} ${s.name.toLowerCase()}, status code ${s.code}`,
        },
        path,
      );
      const url = this.seo.buildUrl(path);
      this.seo.updateSeo({
        jsonLd: [
          ...this.seo.webPageNodes({
            path,
            name: `HTTP ${s.code} ${s.name}`,
            description,
            dateModified: s.updatedAt,
            breadcrumb: [
              { name: 'Home', url: this.seo.buildUrl('/') },
              { name: 'Tools', url: this.seo.buildUrl(TOOLS_PATH) },
              { name: 'HTTP Status Codes', url: this.seo.buildUrl(HTTP_STATUS_PATH) },
              { name: `${s.code} ${s.name}`, url },
            ],
            extra: { mainEntity: { '@id': `${url}#article` } },
          }),
          {
            '@type': 'TechArticle',
            '@id': `${url}#article`,
            headline: `HTTP ${s.code} ${s.name}: meaning, causes and fix`,
            description,
            url,
            dateModified: s.updatedAt,
            proficiencyLevel: 'Beginner',
            about: { '@type': 'Thing', name: `HTTP status code ${s.code}` },
            author: { '@id': this.seo.personId },
            isPartOf: { '@id': `${this.seo.buildUrl(HTTP_STATUS_PATH)}#webpage` },
          },
        ],
      });
    });
  }

  protected ctaClicked(): void {
    this.analytics.track('cta_clicked', { location: `http-status:${this.code()}` });
  }
}
