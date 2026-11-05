import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TocEntry } from '../post-extras';

/** "On this page": links to the post's h2 sections (ids are set by HeadingIdsDirective). */
@Component({
  selector: 'app-post-toc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './post-toc.scss',
  template: `
    <nav class="toc" aria-labelledby="toc-title">
      <h2 id="toc-title" class="toc__title">On this page</h2>
      <ol class="toc__list">
        @for (entry of entries(); track entry.id) {
          <li><a class="toc__link" [href]="'#' + entry.id">{{ entry.text }}</a></li>
        }
      </ol>
    </nav>
  `,
})
export class PostToc {
  readonly entries = input.required<TocEntry[]>();
}
