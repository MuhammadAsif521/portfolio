import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { SeoService } from '@shared/services/seo.service';
import { HERO_CONTENT } from '../../content/hero.content';
import { siteFeature } from '../../core/store/site.feature';
import { Hero } from '../../sections/hero/hero';
import { About } from '../../sections/about/about';
import { Experience } from '../../sections/experience/experience';
import { Services } from '../../sections/services/services';

/**
 * The single scrollable page (brief, Part 4). Sections are added here in build order:
 * Hero → What I Do → Experience → Why Hire Me → Projects → Testimonials → CTA → Blog.
 */
@Component({
  selector: 'app-home',
  imports: [Hero, Services, Experience, About],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-hero /><app-services /><app-experience /><app-about />`,
})
export class HomePage {
  private readonly seo = inject(SeoService);
  private readonly settings = inject(Store).selectSignal(siteFeature.selectSettings);

  constructor() {
    // Runs during SSR (settings are loaded before render), so crawlers get the final tags.
    effect(() => {
      const settings = this.settings();
      const name = settings?.siteName ?? 'Muhammad Asif';
      const role = settings?.siteSlogan ?? HERO_CONTENT.roles[0];
      this.seo.updateFromRouteData(
        {
          title: `${name} — ${role}`,
          metaTitle: settings?.metaTitle,
          metaDescription: settings?.metaDescription ?? settings?.description ?? HERO_CONTENT.tagline,
          metaKeywords: settings?.metaKeywords,
          ogImage: settings?.ogImage?.url,
        },
        '/',
      );
      this.seo.updateSeo({ jsonLd: [...this.seo.siteJsonLd(), this.seo.profilePageJsonLd('/')] });
    });
  }
}
