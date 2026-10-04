import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { BLOG_CONTENT } from '../../content/blog.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ContentActions, contentFeature } from '../../core/store/content.feature';
import { LoadError } from '../../ui/load-error/load-error';
import { PostCard } from '../../ui/post-card/post-card';

const HOME_QUERY = { limit: BLOG_CONTENT.home.limit };

/**
 * "From my blog" (brief, Part 6): the latest three posts, loaded during SSR. Until one is published,
 * the planned topics are listed as clearly marked "Coming soon" items (not links, not fake posts).
 */
@Component({
  selector: 'app-blog',
  imports: [RouterLink, PostCard, LoadError],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blog {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);

  protected readonly content = BLOG_CONTENT.home;

  private readonly listFor = this.store.selectSignal(contentFeature.selectPostListFor);
  protected readonly list = computed(() => this.listFor()(HOME_QUERY));

  protected readonly items = computed(() => this.list().items);
  /** The load failed and nothing is cached: an error box with "Try again" (kept while retrying). */
  protected readonly failed = computed(() => !this.items().length && this.list().error !== null && this.list().status !== 'loaded');
  protected readonly retrying = computed(() => this.list().status === 'loading');
  /** Loaded, and nothing is published yet. */
  protected readonly showUpcoming = computed(() => this.list().status === 'loaded' && !this.items().length);

  constructor() {
    this.load();
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }

  protected load(): void {
    this.store.dispatch(ContentActions.loadPostList({ query: HOME_QUERY }));
  }
}
