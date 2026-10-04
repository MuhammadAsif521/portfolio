import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { BlogPostCard } from '@shared/interfaces/public-api.interface';
import { dayMonthYear } from '../../core/dates';
import { POST_CARD_SIZES } from '../../core/image-sizes';
import { siteFeature } from '../../core/store/site.feature';

/** Blog teaser (Figma: notched cover with navy arrow, tag chip, author · date, title) linking to /blog/:slug. */
@Component({
  selector: 'app-post-card',
  imports: [RouterLink, IconComponent],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  readonly post = input.required<BlogPostCard>();
  readonly headingLevel = input<2 | 3>(3);

  protected readonly author = inject(Store).selectSignal(siteFeature.selectSiteName);
  protected readonly date = computed(() => dayMonthYear(this.post().publishedAt));
  protected readonly tag = computed(() => this.post().tags[0] ?? null);
  protected readonly link = computed(() => ['/blog', this.post().slug]);
  protected readonly sizes = POST_CARD_SIZES;
}
