import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { SeoService } from '@shared/services/seo.service';
import { TOOLS_HUB, TOOLS_PATH } from '@shared/tools/tools.manifest';
import { injectLiveTools } from '../live-tools';
import { CATEGORY_LABELS, toolPresentation } from '../tool-meta';

/** /tools: the hub that lists every free tool (CollectionPage + ItemList JSON-LD). */
@Component({
  selector: 'app-tools-hub',
  imports: [RouterLink, IconComponent, TabsComponent],
  templateUrl: './tools-hub.html',
  styleUrl: './tools-hub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsHubPage {
  private readonly seo = inject(SeoService);

  protected readonly hub = TOOLS_HUB;
  protected readonly tools = injectLiveTools();
  protected readonly look = toolPresentation;
  protected readonly categoryLabels = CATEGORY_LABELS;

  /** Category filter; "all" shows every tool. */
  protected readonly category = signal('all');
  protected readonly tabs = computed<NavTab[]>(() => {
    const all = this.tools();
    const counts = new Map<string, number>();
    for (const tool of all) counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    return [
      { label: 'All', value: 'all', badge: all.length },
      ...[...counts].map(([value, count]) => ({ label: CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS], value, badge: count })),
    ];
  });
  protected readonly visible = computed(() => {
    const category = this.category();
    return category === 'all' ? this.tools() : this.tools().filter((tool) => tool.category === category);
  });

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
