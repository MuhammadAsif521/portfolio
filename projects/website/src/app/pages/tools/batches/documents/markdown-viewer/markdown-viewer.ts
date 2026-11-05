import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolCopy } from '../../../../../ui/tool-kit/tool-copy';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { DocProse } from '../shared/doc-prose';
import { MB, baseName, downloadFile, plural, standaloneHtml } from '../shared/doc-utils';
import { MARKDOWN_SAMPLE, MD_MAX_MB, markdownStats, renderDelay, renderMarkdown } from './markdown-render';

const MAX_CHARS = MD_MAX_MB * MB;

/**
 * /tools/markdown-viewer: editor and live preview side by side. marked and DOMPurify load on first render
 * (lazy chunks); rendering is debounced, and the HTML that reaches the page has been through the shared strict
 * sanitiser (no scripts, no handlers, no remote images).
 */
@Component({
  selector: 'app-markdown-viewer',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolButton, ToolCopy, ToolNote, ToolEmpty, CustomFileInputComponent, DocProse],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .md-stats {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
  `,
  template: `
    <app-tool-layout slug="markdown-viewer">
      <div class="tool-split">
        <app-tool-panel title="Markdown">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!source()" (pressed)="clear()" />
          </ng-container>
          <app-tool-textarea
            fieldId="md-source"
            label="Markdown source"
            placeholder="# Write or paste Markdown here"
            [control]="sourceCtl"
            [rows]="20"
            [wrap]="true"
            [maxLength]="maxChars"
          />
          <p class="md-stats" aria-live="polite">{{ statsLine() }}</p>
          <app-custom-file-input
            controlName="md-file"
            [label$]="fileLabel"
            accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
            placeholder="Open a .md file, or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Files are read in your browser and never uploaded. Up to {{ maxMb }} MB.</p>
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          <div class="tool-actions">
            <app-tool-button size="small" icon="notebook-text" label="Load sample" (pressed)="loadSample()" />
          </div>
        </app-tool-panel>

        <app-tool-panel title="Preview">
          <div class="tool-actions">
            <app-tool-copy label="Copy Markdown" [text]="source()" (copied)="trackCopy()" />
            <app-tool-copy label="Copy HTML" [text]="html()" (copied)="trackCopy()" />
            <app-tool-button size="small" icon="download" label="Download .md" [disabled]="!source()" (pressed)="downloadMd()" />
            <app-tool-button size="small" icon="download" label="Download .html" [disabled]="!html()" (pressed)="downloadHtml()" />
          </div>
          @if (source().length > 200000) {
            <app-tool-note kind="info">This is a large document, so the preview updates a moment after you stop typing.</app-tool-note>
          }
          @if (removedImages()) {
            <app-tool-note kind="info">
              {{ plural(removedImages(), 'image') }} not loaded: pictures from the web are blocked so nothing is requested from other sites. Only embedded data: images are shown.
            </app-tool-note>
          }
          @if (html()) {
            <app-doc-prose [html]="html()" label="Markdown preview" />
          } @else {
            <app-tool-empty icon="notebook-text">The rendered preview appears here as you type. Tables, task lists, strikethrough and fenced code blocks are supported.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class MarkdownViewerTool {
  private readonly markUsed = toolUsage('markdown-viewer');
  protected readonly trackCopy = toolCopied('markdown-viewer');
  private readonly trackDownload = toolCopied('markdown-viewer', { method: 'download' });

  protected readonly maxMb = MD_MAX_MB;
  protected readonly maxChars = MAX_CHARS;
  protected readonly plural = plural;
  protected readonly fileLabel = of('Markdown file');
  protected readonly sourceCtl = new FormControl('', { nonNullable: true });
  protected readonly source = controlSignal(this.sourceCtl);

  protected readonly html = signal('');
  protected readonly removedImages = signal(0);
  protected readonly error = signal('');
  private fileName = 'document.md';
  private job = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** The bundled sample is not the visitor's own content, so loading it does not count as using the tool. */
  private seed = '';

  protected readonly statsLine = computed(() => {
    const s = markdownStats(this.source());
    if (!s.words && !s.characters) return 'Empty';
    return `${plural(s.words, 'word')} · ${plural(s.characters, 'character')} · ${plural(s.lines, 'line')} · about ${s.readingMinutes} min read`;
  });

  constructor() {
    this.sourceCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (v && v !== this.seed) this.markUsed();
        void this.render(v);
      }, renderDelay(v.length));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => {
      this.seed = MARKDOWN_SAMPLE;
      this.sourceCtl.setValue(MARKDOWN_SAMPLE);
      void this.render(MARKDOWN_SAMPLE);
    });
  }

  private async render(source: string): Promise<void> {
    const job = ++this.job;
    try {
      const result = await renderMarkdown(source);
      if (job !== this.job) return;
      this.html.set(result.html);
      this.removedImages.set(result.removedImages);
    } catch {
      if (job !== this.job) return;
      this.error.set('The preview could not be built. Try a smaller document.');
    }
  }

  protected clear(): void {
    this.error.set('');
    this.sourceCtl.setValue('');
  }

  protected loadSample(): void {
    this.error.set('');
    this.fileName = 'sample.md';
    this.seed = MARKDOWN_SAMPLE;
    this.sourceCtl.setValue(MARKDOWN_SAMPLE);
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.error.set('');
    if (!picked) return;
    if (picked.size > MAX_CHARS) {
      this.error.set(`That file is larger than ${MD_MAX_MB} MB. Open a smaller part of it.`);
      return;
    }
    try {
      const bytes = new Uint8Array(await picked.arrayBuffer());
      if (bytes.subarray(0, 4096).includes(0)) {
        this.error.set('This looks like a binary file, not text. Choose a .md, .markdown or .txt file.');
        return;
      }
      this.fileName = picked.name;
      this.sourceCtl.setValue(new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, ''));
    } catch {
      this.error.set('Something went wrong while reading this file. Try again, or choose a different file.');
    }
  }

  protected downloadMd(): void {
    downloadFile(`${baseName(this.fileName, 'document')}.md`, this.source(), 'text/markdown;charset=utf-8');
    this.trackDownload();
  }

  protected downloadHtml(): void {
    const name = baseName(this.fileName, 'document');
    downloadFile(`${name}.html`, standaloneHtml(name, this.html()), 'text/html;charset=utf-8');
    this.trackDownload();
  }
}
