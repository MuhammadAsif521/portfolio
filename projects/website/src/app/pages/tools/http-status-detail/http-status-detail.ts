import { ChangeDetectionStrategy, Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { AnalyticsService } from '@shared/services/analytics.service';
import { SeoService } from '@shared/services/seo.service';
import { HTTP_STATUSES, HTTP_STATUS_PATH, STATUS_CLASS_LABELS, statusByCode } from '@shared/tools/http-status.data';
import { TOOLS_PATH } from '@shared/tools/tools.manifest';
import { injectNotFoundUrl } from '../../../core/not-found-url';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';

/**
 * /tools/http-status-codes/:code: one indexable reference page per covered status code (unique meaning,
 * causes, fix, Express example and SEO impact from http-status.data.ts). Codes without an entry answer a
 * real 404 with noindex, so no thin pages are ever created.
 */
@Component({
  selector: 'app-http-status-detail',
  imports: [RouterLink, IconComponent, ToolOutput],
  styleUrl: '../tool-layout/tool-layout.scss',
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
        <header class="tool__hero">
          <span class="tool__icon" aria-hidden="true"><i-lucide name="globe" [size]="28" /></span>
          <div class="tool__intro">
            <h1 class="tool__title">HTTP {{ s.code }} {{ s.name }}</h1>
            <p class="tool__lead">{{ s.summary }}</p>
            <div class="tool__facts">
              <span class="tool__chip">{{ classLabel() }}</span>
            </div>
          </div>
        </header>

        <section class="tool__section">
          <h2 class="tool__h2">What {{ s.code }} {{ s.name }} means</h2>
          <div class="tool__prose"><p class="tool__p">{{ s.meaning }}</p></div>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">Common causes</h2>
          <div class="tool__prose">
            <ul class="tool__p">
              @for (cause of s.causes; track cause) {
                <li>{{ cause }}</li>
              }
            </ul>
          </div>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">How to fix or use it</h2>
          <div class="tool__prose">
            <p class="tool__p">{{ s.fix }}</p>
            <app-tool-output label="Express (Node.js) example" [value]="s.express" />
          </div>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">SEO impact</h2>
          <div class="tool__prose"><p class="tool__p">{{ s.seo }}</p></div>
        </section>

        <section class="tool__section">
          <h2 class="tool__h2">Other {{ classLabel() }} codes</h2>
          <ul class="tool__related">
            @for (other of siblings(); track other.code) {
              <li>
                <a [routerLink]="['/tools/http-status-codes', other.code]">
                  <span class="tool__related-icon" aria-hidden="true"><i-lucide name="globe" [size]="18" /></span>
                  <span class="tool__related-name">{{ other.code }} {{ other.name }}</span>
                  <span class="tool__related-text">{{ other.summary }}</span>
                </a>
              </li>
            }
            <li>
              <a routerLink="/tools/http-status-codes">
                <span class="tool__related-icon" aria-hidden="true"><i-lucide name="arrow-right" [size]="18" /></span>
                <span class="tool__related-name">All status codes</span>
                <span class="tool__related-text">Search and filter the full reference.</span>
              </a>
            </li>
          </ul>
        </section>

        <aside class="tool__cta" aria-labelledby="status-cta-title">
          <div>
            <h2 class="tool__cta-title" id="status-cta-title">Status codes wrong in your app?</h2>
            <p>I build Angular SSR and Node.js apps that send the right code for every case, so caches and Google behave.</p>
          </div>
          <a class="tool__cta-link" routerLink="/" fragment="contact" (click)="ctaClicked()">
            Hire me
            <i-lucide name="arrow-right" [size]="18" aria-hidden="true" />
          </a>
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
