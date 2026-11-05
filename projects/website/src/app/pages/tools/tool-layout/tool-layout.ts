import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { AnalyticsService } from '@shared/services/analytics.service';
import { SeoService } from '@shared/services/seo.service';
import { TOOLS_PATH, toolBySlug, type ToolMeta } from '@shared/tools/tools.manifest';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { injectLiveTools } from '../live-tools';
import { CATEGORY_LABELS, toolPresentation } from '../tool-meta';

/**
 * Shared frame of every /tools/<slug> page: breadcrumbs, H1, the tool itself (projected), a worked example,
 * the explanation, FAQ, related tools and a CTA. Title, description and JSON-LD come from the tools manifest,
 * through the existing SeoService, so each page is server-rendered with its own SEO.
 */
@Component({
  selector: 'app-tool-layout',
  imports: [RouterLink, IconComponent, ToolOutput],
  templateUrl: './tool-layout.html',
  styleUrl: './tool-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolLayout {
  readonly slug = input.required<string>();

  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly live = injectLiveTools();

  protected readonly tool = computed<ToolMeta>(() => {
    const tool = toolBySlug(this.slug());
    if (!tool) throw new Error(`Unknown tool: ${this.slug()}`);
    return tool;
  });
  protected readonly look = computed(() => toolPresentation(this.slug()));
  protected readonly categoryLabel = computed(() => CATEGORY_LABELS[this.tool().category]);
  protected readonly presentation = toolPresentation;
  protected readonly related = computed(() => this.live().filter((t) => this.tool().related.includes(t.slug)));

  constructor() {
    effect(() => {
      const tool = this.tool();
      const path = `${TOOLS_PATH}/${tool.slug}`;
      this.seo.updateFromRouteData(
        { title: tool.name, metaTitle: tool.title, metaDescription: tool.description, metaKeywords: tool.keyword },
        path,
      );

      const url = this.seo.buildUrl(path);
      this.seo.updateSeo({
        jsonLd: [
          ...this.seo.webPageNodes({
            path,
            name: tool.h1,
            description: tool.description,
            dateModified: tool.updatedAt,
            breadcrumb: [
              { name: 'Home', url: this.seo.buildUrl('/') },
              { name: 'Tools', url: this.seo.buildUrl(TOOLS_PATH) },
              { name: tool.name, url },
            ],
            extra: { mainEntity: { '@id': `${url}#app` } },
          }),
          {
            '@type': 'WebApplication',
            '@id': `${url}#app`,
            name: tool.name,
            url,
            description: tool.description,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Any',
            browserRequirements: 'Requires JavaScript',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: { '@id': this.seo.personId },
          },
          {
            '@type': 'FAQPage',
            '@id': `${url}#faq`,
            mainEntity: tool.faq.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ],
      });
    });
  }

  protected ctaClicked(): void {
    this.analytics.track('cta_clicked', { location: `tool:${this.slug()}` });
  }
}
