import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { ProjectCard as ProjectCardData } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { catchError, map, of } from 'rxjs';
import { PROJECTS_CONTENT } from '../../content/projects.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { Carousel } from '../../ui/carousel/carousel';
import { ProjectCard } from '../../ui/project-card/project-card';

/**
 * "Projects" (brief, Part 6): the featured flagship as a large card, the rest in a swipeable carousel.
 * Loaded during SSR (featured first, then the admin's order); an empty state stands in until projects
 * are published, so the #projects anchor always has somewhere to land.
 */
@Component({
  selector: 'app-projects',
  imports: [RouterLink, ScrollSpyDirective, Carousel, ProjectCard],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = PROJECTS_CONTENT;

  /** null while loading; [] when there are none or the API is unreachable. */
  private readonly items = toSignal(
    inject(PublicApiService)
      .listProjects({ limit: PROJECTS_CONTENT.homeLimit })
      .pipe(
        map((page) => page.data),
        catchError(() => of([] as ProjectCardData[])),
      ),
    { initialValue: null },
  );

  protected readonly loading = computed(() => this.items() === null);
  protected readonly featured = computed(() => {
    const items = this.items() ?? [];
    return items.find((project) => project.featured) ?? items[0] ?? null;
  });
  protected readonly others = computed(() => (this.items() ?? []).filter((project) => project !== this.featured()));

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
