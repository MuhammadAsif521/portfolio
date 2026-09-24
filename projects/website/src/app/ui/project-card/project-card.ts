import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { ProjectCard as ProjectCardData } from '@shared/interfaces/public-api.interface';

/**
 * Portfolio slide (Figma: 633×371 image card, big white title bottom-left, outlined orange arrow ring
 * top-right). Hover/focus (recording): a frosted panel with the title and summary fades in and the ring
 * fills orange. The whole card is one link to /projects/:slug.
 */
@Component({
  selector: 'app-project-card',
  imports: [RouterLink, IconComponent],
  templateUrl: './project-card.html',
  styleUrl: './project-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCard {
  readonly project = input.required<ProjectCardData>();
  /** Heading level for the title, so the card fits the surrounding outline (h3 by default). */
  readonly headingLevel = input<2 | 3 | 4>(3);
  /** The first slide loads eagerly (it is in the first viewport of the section). */
  readonly eager = input(false);

  protected readonly link = computed(() => ['/projects', this.project().slug]);
}
