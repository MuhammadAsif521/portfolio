import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@shared/services/seo.service';
import { SERVICE_PAGES } from '@shared/services-pages/services.data';
import { injectLiveTools } from '../tools/live-tools';
import { FAQ_CONTENT, type FaqItem } from '../../content/faq.content';

const PATH = '/faq';
const TITLE = 'FAQ: Hiring a MEAN Stack Developer | Asif Dev';
const DESCRIPTION =
  'Answers about hiring me: services, tech stack, availability, time zone, pricing and process, plus questions on each service and free tool.';

/**
 * /faq: every question in one place. The general questions are answered here in full and marked up as
 * FAQPage. Service and tool questions are listed as links to the page that answers them, so each answer
 * (and its FAQ markup) lives on exactly one URL.
 */
@Component({
  selector: 'app-faq-page',
  imports: [RouterLink],
  styleUrl: '../tools/tool-layout/tool-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="tool">
      <nav class="tool__crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a routerLink="/">Home</a></li>
          <li aria-current="page">FAQ</li>
        </ol>
      </nav>

      <header>
        <h1 class="tool__title">Frequently asked questions</h1>
        <p class="tool__lead">
          What clients ask before hiring me, and what developers ask about the services and free tools on this site.
        </p>
      </header>

      <section class="tool__section">
        <h2 class="tool__h2">Hiring and working together</h2>
        @for (item of general; track item.question) {
          <h3 class="tool__h3">{{ item.question }}</h3>
          <p class="tool__p">
            @for (part of item.answer; track $index) {
              @if (part.link; as link) {<a [routerLink]="link" [fragment]="part.fragment">{{ part.text }}</a>} @else {<ng-container>{{ part.text }}</ng-container>}
            }
          </p>
        }
      </section>

      <section class="tool__section">
        <h2 class="tool__h2">Questions about each service</h2>
        @for (s of services; track s.slug) {
          <h3 class="tool__h3"><a [routerLink]="['/services', s.slug]">{{ s.name }}</a></h3>
          <ul class="tool__p">
            @for (f of s.faq; track f.q) {
              <li><a [routerLink]="['/services', s.slug]">{{ f.q }}</a></li>
            }
          </ul>
        }
      </section>

      <section class="tool__section">
        <h2 class="tool__h2">Questions about the free tools</h2>
        @for (t of tools(); track t.slug) {
          <h3 class="tool__h3"><a [routerLink]="['/tools', t.slug]">{{ t.name }}</a></h3>
          <ul class="tool__p">
            @for (f of t.faq; track f.q) {
              <li><a [routerLink]="['/tools', t.slug]">{{ f.q }}</a></li>
            }
          </ul>
        }
      </section>

      <aside class="tool__cta">
        <h2 class="tool__h2">Question not answered here?</h2>
        <p>Ask me directly. I usually reply within a day.</p>
        <a routerLink="/" fragment="contact">Contact me</a>
      </aside>
    </article>
  `,
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
