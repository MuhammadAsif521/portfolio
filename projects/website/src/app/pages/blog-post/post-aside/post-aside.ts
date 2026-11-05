import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import type { BlogPost } from '@shared/interfaces/public-api.interface';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ABOUT_CONTENT } from '../../../content/about.content';
import { siteFeature } from '../../../core/store/site.feature';
import { PostCard } from '../../../ui/post-card/post-card';
import { injectLiveTools } from '../../tools/live-tools';
import { relatedTools, shareLinks } from '../post-extras';

/**
 * Everything after a post's body: share links, previous / next, the author box, related posts and related
 * tools. All server-rendered, so the internal links are in the HTML crawlers read.
 */
@Component({
  selector: 'app-post-aside',
  imports: [RouterLink, PostCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './post-aside.scss',
  templateUrl: './post-aside.html',
})
export class PostAside {
  readonly post = input.required<BlogPost>();
  /** Absolute canonical URL of the post. */
  readonly url = input.required<string>();

  private readonly store = inject(Store);
  private readonly analytics = inject(AnalyticsService);
  private readonly settings = this.store.selectSignal(siteFeature.selectSettings);
  private readonly live = injectLiveTools();

  protected readonly share = computed(() => shareLinks(this.url(), this.post().title));
  protected readonly tools = computed(() => relatedTools(this.post().tags, this.post().title, 3, this.live()));
  protected readonly related = computed(() => this.post().related ?? []);
  protected readonly copied = signal(false);

  protected readonly author = computed(() => {
    const s = this.settings();
    const profile = s?.profile;
    const role = s?.siteSlogan || profile?.headline || 'MEAN stack developer';
    return {
      name: profile?.fullName || s?.siteName || 'Muhammad Asif',
      byline: profile?.location ? `${role}, ${profile.location}` : role,
      github: profile?.github ?? null,
      linkedin: profile?.linkedin ?? null,
    };
  });
  protected readonly portrait = ABOUT_CONTENT.portrait;

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      this.analytics.track('share_clicked', { method: 'copy', slug: this.post().slug });
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }

  protected shared(method: string): void {
    this.analytics.track('share_clicked', { method, slug: this.post().slug });
  }
}
