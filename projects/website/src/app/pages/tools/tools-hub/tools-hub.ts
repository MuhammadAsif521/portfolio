import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { TOOLS_HUB, TOOLS_PATH } from '@shared/tools/tools.manifest';
import { injectLiveTools } from '../live-tools';

/** /tools: the hub that lists every free tool (CollectionPage + ItemList JSON-LD). */
@Component({
  selector: 'app-tools-hub',
  imports: [RouterLink],
  templateUrl: './tools-hub.html',
  styleUrl: './tools-hub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsHubPage {
  private readonly seo = inject(SeoService);

  protected readonly hub = TOOLS_HUB;
  protected readonly tools = injectLiveTools();

  constructor() {
    effect(() => {
      this.seo.updateFromRouteData(
        { title: TOOLS_HUB.h1, metaTitle: TOOLS_HUB.title, metaDescription: TOOLS_HUB.description },
        TOOLS_PATH,
      );
      const url = this.seo.buildUrl(TOOLS_PATH);
      const listId = `${url}#itemlist`;
      this.seo.updateSeo({
        jsonLd: [
          ...this.seo.webPageNodes({
            type: 'CollectionPage',
            path: TOOLS_PATH,
            name: TOOLS_HUB.h1,
            description: TOOLS_HUB.description,
            dateModified: TOOLS_HUB.updatedAt,
            breadcrumb: [
              { name: 'Home', url: this.seo.buildUrl('/') },
              { name: 'Tools', url },
            ],
            extra: { mainEntity: { '@id': listId } },
          }),
          {
            '@type': 'ItemList',
            '@id': listId,
            itemListElement: this.tools().map((tool, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: tool.name,
              url: this.seo.buildUrl(`${TOOLS_PATH}/${tool.slug}`),
            })),
          },
        ],
      });
    });
  }
}
