import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { SERVICE_PAGES } from '@shared/services-pages/services.data';
import { injectLiveTools } from '../tools/live-tools';
import { FAQ_CONTENT, type FaqItem } from '../../content/faq.content';

const PATH = '/faq';
const TITLE = 'FAQ: Hiring a MEAN Stack Developer | Asif Dev';
const DESCRIPTION =
  'Answers on hiring a MEAN stack developer: Angular SSR, Node.js APIs, Stripe stores, admin dashboards, Ionic apps, cost and process, and each service.';

/**
 * /faq: every question in one place. The general questions are answered here in full and marked up as
 * FAQPage. Service and tool questions are listed as links to the page that answers them, so each answer
 * (and its FAQ markup) lives on exactly one URL.
 */
@Component({
  selector: 'app-faq-page',
  imports: [RouterLink],
  templateUrl: './faq-page.html',
  styleUrl: './faq-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqPage {
  protected readonly general: readonly FaqItem[] = FAQ_CONTENT.items;
  protected readonly services = SERVICE_PAGES;
  protected readonly tools = injectLiveTools();

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      seo.updateFromRouteData({ title: 'FAQ', metaTitle: TITLE, metaDescription: DESCRIPTION }, PATH);
      const url = seo.buildUrl(PATH);
      seo.updateSeo({
        jsonLd: [
          ...seo.webPageNodes({
            type: 'FAQPage',
            path: PATH,
            name: 'Frequently asked questions',
            description: DESCRIPTION,
            breadcrumb: [
              { name: 'Home', url: seo.buildUrl('/') },
              { name: 'FAQ', url },
            ],
            extra: {
              mainEntity: FAQ_CONTENT.items.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer.map((part) => part.text).join('').trim() },
              })),
            },
          }),
        ],
      });
    });
  }
}
