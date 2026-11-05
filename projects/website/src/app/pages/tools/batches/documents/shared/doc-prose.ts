import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { CodeBlocksDirective } from '../../../../../core/code-blocks.directive';

/**
 * Shows already sanitised HTML (see doc-sanitize.ts) with the site's article typography (the global
 * `.prose` class) and the code-block card with a copy button. Angular's own HTML sanitiser still runs
 * on the binding, as a second line of defence.
 */
@Component({
  selector: 'app-doc-prose',
  imports: [CodeBlocksDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .doc-prose {
      max-height: var(--doc-prose-max, 40rem);
      overflow: auto;
      padding: clamp(1rem, 0.6rem + 1.6vw, 1.75rem);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card-bg);
      font-size: var(--text-base);
    }
    .doc-prose:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
      border-color: var(--primary);
    }
    .doc-prose h1 {
      margin: 1.6em 0 0.6em;
      color: var(--heading);
      font-size: var(--text-4xl, 2.25rem);
      font-weight: 700;
      line-height: var(--leading-tight);
    }
    .doc-prose h5,
    .doc-prose h6 {
      margin: 1.6em 0 0.5em;
      color: var(--heading);
      font-size: var(--text-base);
      font-weight: 600;
    }
    .doc-prose h2 {
      font-size: var(--text-2xl);
    }
    .doc-prose h3 {
      font-size: var(--text-xl);
    }
    .doc-prose h4 {
      font-size: var(--text-lg);
    }
    .doc-prose > :first-child {
      margin-top: 0;
    }
    .doc-prose img {
      display: block;
      margin: 1em 0;
      border-radius: var(--radius-sm);
    }
    .doc-prose th {
      background: var(--surface-muted);
      font-weight: 600;
    }
    .doc-prose del {
      color: var(--text-muted);
    }
    .doc-prose-empty {
      color: var(--text-muted);
    }
  `,
  template: `
    <div class="prose doc-prose" role="region" tabindex="0" [attr.aria-label]="label()" [innerHTML]="html()" [appCodeBlocks]="html()"></div>
  `,
})
export class DocProse {
  readonly html = input.required<string>();
  readonly label = input('Document preview');
}
