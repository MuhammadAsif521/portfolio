import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { type SafeHtml, DomSanitizer } from '@angular/platform-browser';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { WORKER_THRESHOLD } from '../shared/convert-common';
import { ConvertRunner } from '../shared/convert-runner';
import { ConverterInput } from '../shared/converter-input';
import { ConverterResult } from '../shared/converter-result';
import { renameFile } from '../shared/download';
import { optionControls } from '../shared/option-controls';
import { sanitizePreview } from './markdown-preview';
import { DEFAULT_MARKDOWN, convertMarkdown } from './markdown-to-html.logic';

const SAMPLE = `# Release notes

Version **2.4** is out. See the [changelog](https://example.com/changelog) for details.

## What changed

- Faster builds (about \`30%\`)
- [x] Dark mode
- [ ] Offline support

| Feature | Status |
| ------- | ------ |
| Search  | done   |
| Export  | beta   |

> Tip: run \`npm test\` before you publish.

\`\`\`ts
const greet = (name: string) => \`Hello, \${name}\`;
\`\`\`

~~Old text~~ replaced by new text.
`;

/** /tools/markdown-to-html: marked output (copy, download) plus a DOMPurify-sanitised preview. */
@Component({
  selector: 'app-markdown-to-html',
  imports: [ToolLayout, ConverterInput, ConverterResult, ToolToggle, ToolPanel, ToolNote, ToolEmpty],
  styleUrl: '../../../tool-ui.scss',
  styles: `
    .md-preview {
      max-height: 32rem;
      overflow: auto;
      padding: 0.25rem 0.25rem 0.25rem 0;
      color: var(--text);
      font-size: var(--text-base);
      line-height: 1.65;
      overflow-wrap: anywhere;
    }
    .md-preview:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .md-preview ::ng-deep h1,
    .md-preview ::ng-deep h2,
    .md-preview ::ng-deep h3,
    .md-preview ::ng-deep h4,
    .md-preview ::ng-deep h5,
    .md-preview ::ng-deep h6 {
      margin: 1.25em 0 0.5em;
      color: var(--heading);
      line-height: 1.25;
    }
    .md-preview ::ng-deep h1 { font-size: var(--text-2xl); }
    .md-preview ::ng-deep h2 { font-size: var(--text-xl); padding-bottom: 0.25em; border-bottom: 1px solid var(--border); }
    .md-preview ::ng-deep h3 { font-size: var(--text-lg); }
    .md-preview ::ng-deep p,
    .md-preview ::ng-deep ul,
    .md-preview ::ng-deep ol,
    .md-preview ::ng-deep blockquote,
    .md-preview ::ng-deep pre,
    .md-preview ::ng-deep table { margin: 0 0 1em; }
    .md-preview ::ng-deep ul,
    .md-preview ::ng-deep ol { padding-left: 1.5rem; }
    .md-preview ::ng-deep a { color: var(--primary-ink); text-decoration: underline; }
    .md-preview ::ng-deep code { padding: 0.1em 0.35em; border-radius: 0.25rem; background: var(--primary-soft); font-family: var(--font-mono); font-size: 0.9em; }
    .md-preview ::ng-deep pre { overflow: auto; padding: 0.875rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card-bg); }
    .md-preview ::ng-deep pre code { padding: 0; background: none; }
    .md-preview ::ng-deep blockquote { padding: 0 1rem; border-left: 3px solid var(--primary-muted); color: var(--text-muted); }
    .md-preview ::ng-deep table { display: block; max-width: 100%; overflow: auto; border-collapse: collapse; }
    .md-preview ::ng-deep th,
    .md-preview ::ng-deep td { padding: 0.375rem 0.75rem; border: 1px solid var(--border); }
    .md-preview ::ng-deep th { background: var(--primary-soft); text-align: left; }
    .md-preview ::ng-deep hr { border: 0; border-top: 1px solid var(--border); }
    .md-preview ::ng-deep .md-image-blocked { color: var(--text-muted); font-style: italic; }
    .md-preview ::ng-deep .md-checkbox { margin-right: 0.25rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="markdown-to-html">
      <div class="tool-split">
        <app-converter-input
          title="Markdown"
          fieldId="m2h-input"
          label="Markdown to convert"
          placeholder="# Title&#10;&#10;Some **bold** text and a [link](https://example.com)."
          accept=".md,.markdown,.mdown,.txt,text/markdown"
          [sample]="sample"
          [(text)]="text"
          [(sourceName)]="sourceName"
        >
          <div class="tool-controls">
            <app-tool-toggle fieldId="m2h-gfm" label="GitHub Flavored Markdown" hint="Tables, task lists, strikethrough, autolinks" [control]="o.gfm" />
            <app-tool-toggle fieldId="m2h-breaks" label="Line breaks" hint="A single newline becomes a br" [control]="o.breaks" />
            <app-tool-toggle fieldId="m2h-ids" label="Heading ids" hint="Adds id attributes for #links" [control]="o.headingIds" />
            <app-tool-toggle fieldId="m2h-doc" label="Full HTML document" hint="Adds doctype, head and a small stylesheet" [control]="o.fullDocument" />
          </div>
        </app-converter-input>

        <div class="tool-stack">
          <app-tool-panel title="Preview (sanitised)">
            @if (previewHtml(); as safe) {
              <div class="md-preview" role="region" tabindex="0" aria-label="Rendered Markdown preview" [innerHTML]="safe" (click)="previewClick($event)"></div>
            } @else if (!previewNote()) {
              <app-tool-empty icon="file-text">Paste Markdown on the left, or load the sample. The rendered page appears here.</app-tool-empty>
            }
            @if (previewNote()) {
              <app-tool-note kind="info">{{ previewNote() }}</app-tool-note>
            }
            <app-tool-note kind="warn">
              The preview is cleaned with DOMPurify: scripts, event handlers, forms, styles and remote images are removed. The HTML below is
              exactly what marked produced, with nothing removed. Sanitise untrusted Markdown yourself before you publish it.
            </app-tool-note>
          </app-tool-panel>

          <app-converter-result
            label="HTML"
            tool="markdown-to-html"
            [view]="view()"
            [fileName]="fileName()"
            mime="text/html"
            emptyIcon="file-text"
            emptyText="The raw HTML appears here, ready to copy or download."
            (copied)="trackCopy()"
          />
        </div>
      </div>
    </app-tool-layout>
  `,
})
export class MarkdownToHtmlTool {
  private readonly markUsed = toolUsage('markdown-to-html');
  protected readonly trackCopy = toolCopied('markdown-to-html');
  private readonly domSanitizer = inject(DomSanitizer);

  protected readonly sample = SAMPLE;
  protected readonly text = signal('');
  protected readonly sourceName = signal('');
  private readonly options = optionControls(DEFAULT_MARKDOWN);
  protected readonly o = this.options.controls;

  private readonly runner = new ConvertRunner({
    convert: convertMarkdown,
    createWorker: () => new Worker(new URL('./markdown-to-html.worker', import.meta.url), { type: 'module' }),
  });
  protected readonly view = this.runner.state;
  protected readonly fileName = computed(() => renameFile(this.sourceName(), 'html', 'document'));

  protected readonly previewHtml = signal<SafeHtml | null>(null);
  protected readonly previewNote = signal('');
  private previewSeq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.runner.dispose());
    effect(() => {
      const text = this.text();
      const options = this.options.value();
      untracked(() => {
        if (text.trim()) this.markUsed();
        this.runner.run(text, options);
      });
    });
    effect(() => {
      const result = this.view().result;
      untracked(() => void this.renderPreview(result && result.ok ? result.output : ''));
    });
  }

  private async renderPreview(output: string): Promise<void> {
    const id = ++this.previewSeq;
    if (!output) {
      this.previewHtml.set(null);
      this.previewNote.set('');
      return;
    }
    // A full document is previewed by its body; the wrapper's head and styles are never rendered here.
    const wrapped = /<article>\n([\s\S]*)<\/article>/.exec(output);
    const body = wrapped ? wrapped[1] : output;
    if (body.length > WORKER_THRESHOLD) {
      this.previewHtml.set(null);
      this.previewNote.set('This document is too large to preview safely on the page. The HTML output is still complete: copy or download it.');
      return;
    }
    try {
      const { html, blockedImages } = await sanitizePreview(body);
      if (id !== this.previewSeq) return;
      this.previewHtml.set(this.domSanitizer.bypassSecurityTrustHtml(html));
      this.previewNote.set(blockedImages ? `${blockedImages} remote image${blockedImages === 1 ? ' was' : 's were'} not loaded in the preview and show their alt text instead. The HTML output keeps the image tags.` : '');
    } catch {
      if (id === this.previewSeq) {
        this.previewHtml.set(null);
        this.previewNote.set('The preview could not be built. The HTML output is unaffected.');
      }
    }
  }

  /** In-page #links scroll inside the preview instead of navigating the site; external links open in a new tab. */
  protected previewClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement | null)?.closest('a');
    const href = link?.getAttribute('href') ?? '';
    if (!link) return;
    if (href.startsWith('#')) {
      event.preventDefault();
      link.ownerDocument.getElementById(href.slice(1))?.scrollIntoView({ block: 'start' });
    } else if (!href) {
      event.preventDefault();
    }
  }
}
