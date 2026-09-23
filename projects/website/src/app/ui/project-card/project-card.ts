import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { ProjectCard as ProjectCardData } from '@shared/interfaces/public-api.interface';
import { PROJECTS_CONTENT } from '../../content/projects.content';

/**
 * A project teaser linking to /projects/:slug. `featured` is the large flagship layout (image beside
 * the text from lg); the default is the compact card used in the carousel.
 */
@Component({
  selector: 'app-project-card',
  imports: [RouterLink, IconComponent],
  templateUrl: './project-card.html',
  styleUrl: './project-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-featured]': 'featured()' },
})
export class ProjectCard {
  readonly project = input.required<ProjectCardData>();
  readonly featured = input(false);
  /** Heading level for the title, so the card fits the surrounding outline (h3 by default). */
  readonly headingLevel = input<2 | 3 | 4>(3);

  protected readonly label = PROJECTS_CONTENT.featuredLabel;
  protected readonly chips = computed(() => this.project().techStack.slice(0, PROJECTS_CONTENT.maxChips));
  protected readonly hiddenChips = computed(() =>
    Math.max(0, this.project().techStack.length - PROJECTS_CONTENT.maxChips),
  );
  protected readonly link = computed(() => ['/projects', this.project().slug]);
}
