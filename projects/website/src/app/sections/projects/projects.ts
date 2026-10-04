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
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { PROJECTS_CONTENT } from '../../content/projects.content';
import { disposeWith, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { ContentActions, contentFeature } from '../../core/store/content.feature';
import { Carousel } from '../../ui/carousel/carousel';
import { LoadError } from '../../ui/load-error/load-error';
import { ProjectCard } from '../../ui/project-card/project-card';

/** The home page's project query (featured first, then the admin's order — sorted by the backend). */
const HOME_QUERY = { limit: PROJECTS_CONTENT.homeLimit };

@Component({
  selector: 'app-projects',
  imports: [RouterLink, IconComponent, ScrollSpyDirective, Carousel, ProjectCard, LoadError],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);

  protected readonly content = PROJECTS_CONTENT;

  private readonly listFor = this.store.selectSignal(contentFeature.selectProjectListFor);
  protected readonly list = computed(() => this.listFor()(HOME_QUERY));

  protected readonly projects = computed(() => this.list().items);
  /** Nothing to show yet (first load); cached projects render immediately on later visits. */
  protected readonly loading = computed(() => !this.projects().length && (this.list().status === 'idle' || this.list().status === 'loading'));
  /** The last load failed and there is nothing cached: show the error box (it stays while retrying). */
  protected readonly failed = computed(() => !this.projects().length && this.list().error !== null && this.list().status !== 'loaded');
  protected readonly retrying = computed(() => this.list().status === 'loading');

  protected readonly active = signal(0);
  protected readonly current = computed(() => this.projects()[this.active()] ?? this.projects()[0] ?? null);
  protected readonly chips = computed(() => (this.current()?.techStack ?? []).slice(0, PROJECTS_CONTENT.maxChips));

  constructor() {
    this.load();
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });
  }

  /** Load-if-needed: the effect skips the request while the cached list is fresh. */
  protected load(): void {
    this.store.dispatch(ContentActions.loadProjectList({ query: HOME_QUERY }));
  }
}
