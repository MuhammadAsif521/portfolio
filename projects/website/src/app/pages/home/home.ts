import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { SeoService } from '@shared/services/seo.service';
import { HERO_CONTENT } from '../../content/hero.content';
import { siteFeature } from '../../core/store/site.feature';
import { About } from '../../sections/about/about';
import { Blog } from '../../sections/blog/blog';
import { Contact } from '../../sections/contact/contact';
import { Experience } from '../../sections/experience/experience';
import { Hero } from '../../sections/hero/hero';
import { Marquee } from '../../sections/marquee/marquee';
import { Projects } from '../../sections/projects/projects';
import { Services } from '../../sections/services/services';
import { Testimonials } from '../../sections/testimonials/testimonials';

/**
 * The single scrollable page (brief, Part 4), in page order:
 * Hero → What I Do → Experience → Why Hire Me → Projects → Testimonials → CTA → Marquee → Blog.
 */
@Component({
  selector: 'app-home',
  imports: [Hero, Services, Experience, About, Projects, Testimonials, Contact, Marquee, Blog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hero />
    <app-services />
    <app-experience />
    <app-about />
    <app-projects />
    <app-testimonials />
    <app-contact />
    <app-marquee />
    <app-blog />
  `,
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
