import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { of } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolCopy } from '../../../../../ui/tool-kit/tool-copy';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { formatBytes } from '../../../tool-logic-2';
import { DocProse } from '../shared/doc-prose';
import { MB, baseName, downloadFile, plural, standaloneHtml } from '../shared/doc-utils';
import { DOCX_MAX_MB, DocxError, convertDocx, type DocxResult } from './docx-convert';

const VIEWS: NavTab[] = [
  { label: 'Document', value: 'document', icon: 'file-text' },
  { label: 'Text only', value: 'text', icon: 'list' },
];

/**
 * /tools/docx-viewer: converts a .docx with mammoth (lazy chunk), sanitises the HTML with DOMPurify and shows
 * it as a document or as plain text. Honest about what is not reproduced: this is content, not Word's layout.
 */
@Component({
  selector: 'app-docx-viewer',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolOutput,
    ToolKeyValue,
    ToolCopy,
    ToolNote,
    ToolEmpty,
    ToolButton,
    TabsComponent,
    CustomFileInputComponent,
    DocProse,
  ],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .doc-notes {
      margin-top: 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card-bg);
      font-size: var(--text-sm);
    }
    .doc-notes summary {
      padding: 0.625rem 0.875rem;
      color: var(--heading);
      font-weight: 600;
      cursor: pointer;
    }
    .doc-notes ul {
      margin: 0;
      padding: 0 0.875rem 0.75rem 2rem;
      color: var(--text-muted);
      list-style: disc;
    }
  `,
  template: `
    <app-tool-layout slug="docx-viewer">
      <div class="tool-stack">
        <app-tool-panel title="Word document">
          <app-custom-file-input
            controlName="docx-file"
            [label$]="fileLabel"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            placeholder="Choose a .docx file or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Read in your browser and never uploaded. Up to {{ maxMb }} MB; .docx only (not .doc).</p>
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
        </app-tool-panel>

        <app-tool-panel title="Preview">
          @if (busy()) {
            <app-tool-empty icon="file-text">Reading the document…</app-tool-empty>
          } @else if (result(); as r) {
            <div class="tool-stack">
              <div role="group" aria-label="View">
                <app-custom-tabs [tabs]="views" [activeTab]="view()" (activeTabChange)="setView($event)" />
              </div>
              <div class="tool-actions">
                <app-tool-copy label="Copy text" [text]="r.text" (copied)="trackCopy()" />
                <app-tool-button size="small" icon="download" label="Download HTML" (pressed)="downloadHtml(r)" />
                <app-tool-button size="small" icon="download" label="Download text" (pressed)="downloadText(r)" />
              </div>
              <app-tool-note kind="info">
                This shows the content of the document, not Word's exact layout: fonts, page size, headers and footers, comments, tracked changes, columns and text boxes are not reproduced.
              </app-tool-note>
              @if (view() === 'document') {
                <app-doc-prose [html]="r.html" label="Document preview" />
              } @else {
                <app-tool-output label="Plain text" [meta]="summary()" [value]="r.text" [copyText]="''" />
              }
              <app-tool-key-value [rows]="rows()" />
              @if (r.warnings.length) {
                <details class="doc-notes">
                  <summary>Conversion notes ({{ r.warnings.length }})</summary>
                  <ul>
                    @for (w of r.warnings; track w) {
                      <li>{{ w }}</li>
                    }
                  </ul>
                </details>
              }
            </div>
          } @else {
            <app-tool-empty icon="file-text">Choose a .docx file to read it here. Headings, lists, tables and pictures are kept; the text view is ready to copy.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class DocxViewerTool {
  private readonly markUsed = toolUsage('docx-viewer');
  protected readonly trackCopy = toolCopied('docx-viewer');
  private readonly trackDownload = toolCopied('docx-viewer', { method: 'download' });

  protected readonly views = VIEWS;
  protected readonly maxMb = DOCX_MAX_MB;
  protected readonly fileLabel = of('Word document');
  protected readonly view = signal<'document' | 'text'>('document');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<DocxResult | null>(null);
  private fileName = 'document.docx';
  private fileSize = 0;
  private job = 0;

  protected readonly summary = computed(() => {
    const r = this.result();
    return r ? plural(r.stats.words, 'word') : '';
  });

  protected readonly rows = computed<ToolRow[]>(() => {
    const r = this.result();
    if (!r) return [];
    const s = r.stats;
    return [
      { label: 'File', value: `${this.fileName} · ${formatBytes(this.fileSize)}` },
      { label: 'Words', value: s.words.toLocaleString('en-US') },
      { label: 'Characters', value: `${s.characters.toLocaleString('en-US')} (without spaces)` },
      { label: 'Headings', value: String(s.headings) },
      { label: 'Tables', value: String(s.tables) },
      {
        label: 'Images',
        value: s.skippedImages ? `${s.images} shown, ${s.skippedImages} in formats a browser cannot show` : String(s.images),
      },
    ];
  });

  protected setView(value: string): void {
    this.view.set(value === 'text' ? 'text' : 'document');
  }

  protected async onFile(picked: File | null): Promise<void> {
    const job = ++this.job;
    this.busy.set(false);
    this.error.set('');
    this.result.set(null);
    if (!picked) return;
    if (picked.size > DOCX_MAX_MB * MB) {
      this.error.set(`That file is larger than ${DOCX_MAX_MB} MB. Save a smaller copy (compress or remove pictures) and try again.`);
      return;
    }
    this.busy.set(true);
    try {
      const buffer = await picked.arrayBuffer();
      const converted = await convertDocx(buffer);
      if (job !== this.job) return;
      this.fileName = picked.name;
      this.fileSize = picked.size;
      this.result.set(converted);
      this.markUsed();
    } catch (error) {
      if (job !== this.job) return;
      this.error.set(error instanceof DocxError ? error.message : 'Something went wrong while reading this file. Try again, or choose a different file.');
    } finally {
      if (job === this.job) this.busy.set(false);
    }
  }

  protected downloadHtml(r: DocxResult): void {
    const name = baseName(this.fileName);
    downloadFile(`${name}.html`, standaloneHtml(name, r.html), 'text/html;charset=utf-8');
    this.trackDownload();
  }

  protected downloadText(r: DocxResult): void {
    downloadFile(`${baseName(this.fileName)}.txt`, r.text, 'text/plain;charset=utf-8');
    this.trackDownload();
  }
}
