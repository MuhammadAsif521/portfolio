import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { CONTACT_CONTENT } from '../../content/contact.content';
import { siteFeature } from '../../core/store/site.feature';
import { QuickContact } from '../../ui/quick-contact/quick-contact';
import { SocialIcon } from '../../ui/social-icon/social-icon';
import { NAV_ALL } from '../site-header/nav-links';

const SAFE_LINK = /^(https?:|mailto:)/i;

/**
 * Site footer (brief, Part 6; Figma "Lets Connect there"): dark in both modes. Contact details and
 * socials come from Site Settings, falling back to the brief's real details.
 */
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
  protected readonly links = NAV_ALL;
  protected readonly year = new Date().getFullYear();

  protected readonly siteName = this.store.selectSignal(siteFeature.selectSiteName);
  protected readonly logo = this.store.selectSignal(siteFeature.selectLogo);
  protected readonly description = this.store.selectSignal(siteFeature.selectDescription);
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
  protected readonly initials = computed(() =>
    this.siteName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join(''),
  );
}
