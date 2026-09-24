import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { ProjectCard as ProjectCardData } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { catchError, map, of } from 'rxjs';
import { PROJECTS_CONTENT } from '../../content/projects.content';
import { DEMO_CONTENT, DEMO_PROJECTS, orDemo } from '../../core/demo-content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { Carousel } from '../../ui/carousel/carousel';
import { ProjectCard } from '../../ui/project-card/project-card';

/**
 * "Lets have a look at my Portfolio" (brief, Part 6; Figma): projects in a two-up carousel (featured
 * first, from the API during SSR) with the active project's tech chips, title and summary below. An
 * empty state stands in until projects are published, so the #projects anchor always has a target.
 */
@Component({
  selector: 'app-projects',
  imports: [RouterLink, IconComponent, ScrollSpyDirective, Carousel, ProjectCard],
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
        orDemo<ProjectCardData>(DEMO_PROJECTS, inject(DEMO_CONTENT)),
      ),
    { initialValue: null },
  );

  protected readonly loading = computed(() => this.items() === null);
  protected readonly projects = computed(() => this.items() ?? []);
  /** Slide in view, bound two-way to the carousel. */
  protected readonly active = signal(0);
  protected readonly current = computed(() => this.projects()[this.active()] ?? this.projects()[0] ?? null);
  protected readonly chips = computed(() => (this.current()?.techStack ?? []).slice(0, PROJECTS_CONTENT.maxChips));

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }
}
