import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { BRAND_CONTENT } from '../../content/brand.content';
import { CONTACT_CONTENT } from '../../content/contact.content';
import { siteFeature } from '../../core/store/site.feature';
import { QuickContact } from '../../ui/quick-contact/quick-contact';
import { SocialIcon } from '../../ui/social-icon/social-icon';
import { HERO_CONTENT } from '@website/content/hero.content';
import { LEGAL_LINKS, LEGAL_ORDER } from '../../pages/legal/legal-links';

const SAFE_LINK = /^(https?:|mailto:)/i;

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, IconComponent, QuickContact, SocialIcon],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  private readonly store = inject(Store);
  private readonly settings = this.store.selectSignal(siteFeature.selectSettings);

  protected readonly content = CONTACT_CONTENT.footer; 
  protected readonly year = new Date().getFullYear();

  protected readonly siteName = this.store.selectSignal(siteFeature.selectSiteName);
  protected readonly logo = this.store.selectSignal(siteFeature.selectLogo);
  private readonly description = this.store.selectSignal(siteFeature.selectDescription);
  protected readonly tagline = computed(() => this.description() || HERO_CONTENT.tagline);

  protected readonly email = computed(() => this.settings()?.contactEmail || CONTACT_CONTENT.footer.email);
  protected readonly phone = computed(() => this.settings()?.phoneNumber ?? null);
  protected readonly telHref = computed(() => {
    const phone = this.phone();
    return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;
  });
  protected readonly location = computed(() => {
    const settings = this.settings();
    const parts = [settings?.city, settings?.country].filter(Boolean);
    return parts.length ? parts.join(', ') : CONTACT_CONTENT.footer.location;
  });
  /** Only http(s)/mailto links are rendered, whatever was typed into Site Settings. */
  protected readonly socials = computed(() =>
    (this.settings()?.socialLinks ?? []).filter((link) => link.label?.trim() && SAFE_LINK.test(link.value ?? '')),
  );
  protected readonly mark = BRAND_CONTENT.mark;
  protected readonly legalLinks = LEGAL_ORDER.map((kind) => ({
    path: LEGAL_LINKS[kind].path,
    label: LEGAL_LINKS[kind].title,
  }));
}
