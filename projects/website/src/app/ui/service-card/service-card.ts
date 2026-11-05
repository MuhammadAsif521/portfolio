import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import type { ServiceItem } from '../../content/services.content';

/**
 * One service as a glass card on the dark textured band: title, icon, summary and capability chips,
 * with a navy icon badge in the notch. The whole card is one link to /services/<slug> (the title anchor is
 * stretched over it), so there are no nested interactive elements. Used by the home section and /services.
 */
@Component({
  selector: 'app-service-card',
  imports: [RouterLink, IconComponent],
  templateUrl: './service-card.html',
  styleUrl: './service-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCard {
  readonly item = input.required<ServiceItem>();
  /** Heading level of the title: 3 under a section heading, 2 on the hub under the page h1. */
  readonly headingLevel = input<2 | 3>(3);
}
