import { DOCUMENT, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, SecurityContext, computed, effect, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { environment } from '@shared/environment/environment';
import { SeoService } from '@shared/services/seo.service';
import { dayMonthYear } from '../../core/dates';
import { siteFeature } from '../../core/store/site.feature';
import { withHeadingIds } from './legal-html';
import {
  LEGAL_DEFAULTS_UPDATED,
  LEGAL_FALLBACKS,
  LEGAL_ORDER,
  LEGAL_PAGES,
  LEGAL_UI,
  type LegalContext,
  type LegalKind,
} from './legal.content';

/** True when admin HTML has visible text (an editor's empty "<p><br></p>" doesn't count). */
export function hasText(html: string | undefined | null): html is string {
  return !!html && html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|\s/g, '').length > 0;
}

/**
 * /privacy-policy, /terms-and-conditions and /cookie-policy (one component, `kind` from route data).
 *
 * Renders the admin's HTML from Site Settings when present, else the built-in default from ./defaults.
 * Both go through Angular's HTML sanitiser (admin HTML is also sanitised by portfolio-node on save, like
 * blog posts); only then are slug ids added to the <h2>s for the table of contents, which is why the
 * result is marked trusted (the sanitiser itself would strip those ids).
 */
@Component({
  selector: 'app-legal-page',
  imports: [RouterLink, IconComponent],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPage {
  readonly kind = input.required<LegalKind>();

  private readonly store = inject(Store);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly seo = inject(SeoService);
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);

  private readonly settings = this.store.selectSignal(siteFeature.selectSettings);
  protected readonly siteName = this.store.selectSignal(siteFeature.selectSiteName);
  protected readonly ui = LEGAL_UI;

  protected readonly page = computed(() => LEGAL_PAGES[this.kind()] ?? LEGAL_PAGES.privacy);
  protected readonly related = computed(() =>
    LEGAL_ORDER.filter((kind) => kind !== this.page().kind).map((kind) => LEGAL_PAGES[kind]),
  );

  protected readonly email = computed(() => this.settings()?.contactEmail || LEGAL_FALLBACKS.email);

  private readonly custom = computed(() => {
    const html = this.settings()?.[this.page().settingsKey];
    return hasText(html) ? html : null;
  });

  private readonly context = computed<LegalContext>(() => {
    const settings = this.settings();
    return {
      siteName: this.siteName(),
      email: this.email(),
      country: settings?.country?.trim() || LEGAL_FALLBACKS.country,
      siteUrl: (settings?.domain || environment.siteUrl).replace(/\/+$/, ''),
    };
  });

  private readonly rendered = computed(() => {
    const raw = this.custom() ?? this.page().defaultHtml(this.context());
    const clean = this.sanitizer.sanitize(SecurityContext.HTML, raw) ?? '';
    const { html, toc } = withHeadingIds(clean);
    return { html: this.sanitizer.bypassSecurityTrustHtml(html), toc };
  });
  protected readonly html = computed(() => this.rendered().html);
  protected readonly toc = computed(() => this.rendered().toc);

  /** Admin-edited policy: when Site Settings last changed. Built-in default: when the template changed. */
  protected readonly updated = computed(() =>
    dayMonthYear(this.custom() ? this.settings()?.updatedAt : undefined) ?? dayMonthYear(LEGAL_DEFAULTS_UPDATED),
  );

  constructor() {
    effect(() => {
      const page = this.page();
      this.seo.updateFromRouteData(
        { title: page.title, metaDescription: page.metaDescription, robots: 'index, follow' },
        page.path,
      );
      // updateSeo only touches the fields it is given, so this just adds the breadcrumb to the JSON-LD.
      this.seo.updateSeo({
        jsonLd: [
          ...this.seo.siteJsonLd(),
          this.seo.buildBreadcrumbJsonLd([
            { name: LEGAL_UI.breadcrumbHome, url: this.seo.buildUrl('/') },
            { name: page.title, url: this.seo.buildUrl(page.path) },
          ]),
        ],
      });
    });
  }

  /**
   * TOC links are real `path#id` hrefs (they work before hydration). Once hydrated, scroll with
   * scrollIntoView so the headings' scroll-margin clears the sticky header, and move focus there.
   */
  protected jump(event: MouseEvent, id: string): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = this.document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    this.location.replaceState(`${this.page().path}#${id}`);
  }
}
