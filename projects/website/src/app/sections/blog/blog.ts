import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { BlogPostCard } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { catchError, map, of } from 'rxjs';
import { BLOG_CONTENT } from '../../content/blog.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { PostCard } from '../../ui/post-card/post-card';

/**
 * "From my blog" (brief, Part 6): the latest three posts, loaded during SSR. Until one is published,
 * the planned topics are listed as clearly marked "Coming soon" items (not links, not fake posts).
 */
@Component({
  selector: 'app-blog',
  imports: [RouterLink, IconComponent, PostCard],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blog {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = BLOG_CONTENT.home;

  /** null while loading; [] when none are published or the API is unreachable. */
  private readonly posts = toSignal(
    inject(PublicApiService)
      .listPosts({ limit: BLOG_CONTENT.home.limit })
      .pipe(
        map((page) => page.data),
        catchError(() => of([] as BlogPostCard[])),
      ),
    { initialValue: null },
  );

  protected readonly items = computed(() => this.posts() ?? []);
  protected readonly showUpcoming = computed(() => this.posts()?.length === 0);

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
