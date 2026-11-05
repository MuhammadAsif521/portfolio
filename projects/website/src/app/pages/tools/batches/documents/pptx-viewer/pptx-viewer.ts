import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolCopy } from '../../../../../ui/tool-kit/tool-copy';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { formatBytes } from '../../../tool-logic-2';
import { MB, baseName, downloadFile, plural } from '../shared/doc-utils';
import { PPTX_MAX_MB, PptxError, deckToMarkdown, deckToText, readPptx, type PptxDeck, type PptxSlide } from './pptx-read';

const PAGE = 50;

const searchText = (s: PptxSlide): string =>
  [s.title, ...s.body.map((p) => p.text), ...s.tables.flat(2), s.notes, ...s.images.map((i) => i.alt)].join('\n').toLowerCase();

/**
 * /tools/pptx-viewer: a .pptx is a ZIP of XML, so fflate (lazy chunk) unpacks only the slides, notes and
 * pictures, and the text is read from the XML. It shows content and structure, not what a slide looks like.
 */
@Component({
  selector: 'app-pptx-viewer',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolButton, ToolCopy, ToolNote, ToolEmpty, ToolKeyValue, CustomFileInputComponent],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .slides {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .slide {
      padding: 1rem 1.125rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card-bg);
    }
    .slide__head {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .slide__n {
      flex-shrink: 0;
      min-width: 2rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-pill);
      background: var(--primary-soft);
      color: var(--primary-ink);
      font-size: var(--text-xs);
      font-weight: 700;
      text-align: center;
    }
    .slide__title {
      margin: 0;
      color: var(--heading);
      font-size: var(--text-lg);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .slide__title--none {
      color: var(--text-muted);
      font-weight: 400;
      font-style: italic;
    }
    .slide__p {
      margin: 0 0 0.25rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }
    .slide__dot {
      color: var(--primary);
    }
    .slide__table {
      display: block;
      max-width: 100%;
      margin: 0.5rem 0;
      overflow-x: auto;
      border-collapse: collapse;
      font-size: var(--text-sm);
    }
    .slide__table th,
    .slide__table td {
      padding: 0.375rem 0.625rem;
      border: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    .slide__table tr:first-child td {
      background: var(--surface-muted);
      font-weight: 600;
    }
    .slide__imgs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .slide__imgs img {
      max-width: 9rem;
      max-height: 6.5rem;
      object-fit: contain;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--paper);
    }
    .slide__notes {
      margin-top: 0.625rem;
      padding: 0.5rem 0.75rem;
      border-left: 3px solid var(--primary);
      background: var(--surface-muted);
      color: var(--text-muted);
      font-size: var(--text-sm);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .slide__notes strong {
      color: var(--heading);
    }
  `,
  template: `
    <app-tool-layout slug="pptx-viewer">
      <div class="tool-split">
        <app-tool-panel title="PowerPoint file">
          <app-custom-file-input
            controlName="pptx-file"
            [label$]="fileLabel"
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            placeholder="Choose a .pptx file or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Read in your browser and never uploaded. Up to {{ maxMb }} MB; .pptx only (not .ppt).</p>
          @if (busy()) {
            <app-tool-note kind="info">Reading the presentation…</app-tool-note>
          }
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          @if (deck(); as d) {
            <app-tool-key-value [rows]="rows()" />
            <div class="tool-actions">
              <app-tool-copy label="Copy all text" [text]="text()" (copied)="trackCopy()" />
              <app-tool-button size="small" icon="download" label="Download text" (pressed)="downloadText()" />
              <app-tool-button size="small" icon="download" label="Download Markdown" (pressed)="downloadMarkdown()" />
            </div>
            @if (d.stats.skippedObjects || d.stats.skippedImages) {
              <app-tool-note kind="info">
                @if (d.stats.skippedObjects) {
                  {{ plural(d.stats.skippedObjects, 'chart or diagram', 'charts or diagrams') }} cannot be read here.
                }
                @if (d.stats.skippedImages) {
                  {{ plural(d.stats.skippedImages, 'picture') }} left out (format a browser cannot show, or too large).
                }
              </app-tool-note>
            }
          }
          <app-tool-note kind="info">
            This lists the content and structure of each slide. It is not a slide renderer: themes, layouts, shapes, charts, SmartArt, fonts, animations and transitions are not shown.
          </app-tool-note>
        </app-tool-panel>

        <app-tool-panel title="Slides">
          @if (deck(); as d) {
            <div class="tool-stack">
              <app-tool-input fieldId="pptx-filter" label="Filter slides" placeholder="Search titles, text, tables and notes" [mono]="false" [control]="queryCtl" />
              <p class="tool-meta" aria-live="polite">{{ shownLabel() }}</p>
              <ol class="slides" aria-label="Slides">
                @for (s of visible(); track s.number) {
                  <li class="slide">
                    <div class="slide__head">
                      <span class="slide__n">{{ s.number }}</span>
                      <h3 class="slide__title" [class.slide__title--none]="!s.title">{{ s.title || 'No title' }}</h3>
                    </div>
                    @for (p of s.body; track $index) {
                      <p class="slide__p" [style.margin-left.rem]="p.level * 1.25">
                        @if (p.bullet) {
                          <span class="slide__dot" aria-hidden="true">•&nbsp;</span>
                        }{{ p.text }}
                      </p>
                    }
                    @for (t of s.tables; track $index) {
                      <table class="slide__table">
                        <tbody>
                          @for (row of t; track $index) {
                            <tr>
                              @for (cell of row; track $index) {
                                <td>{{ cell }}</td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    }
                    @if (s.images.length) {
                      <div class="slide__imgs">
                        @for (img of s.images; track $index) {
                          <img [src]="img.src" [alt]="img.alt || 'Picture on slide ' + s.number" loading="lazy" />
                        }
                      </div>
                    }
                    @if (s.notes) {
                      <div class="slide__notes"><strong>Speaker notes</strong><br />{{ s.notes }}</div>
                    }
                  </li>
                }
              </ol>
              @if (hasMore()) {
                <app-tool-button label="Show more slides" (pressed)="more()" />
              }
              @if (!matches().length) {
                <app-tool-empty icon="search">No slide matches that text.</app-tool-empty>
              }
            </div>
          } @else {
            <app-tool-empty icon="presentation">Choose a .pptx file. Each slide appears with its title, text, tables, speaker notes and pictures.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class PptxViewerTool {
  private readonly markUsed = toolUsage('pptx-viewer');
  protected readonly trackCopy = toolCopied('pptx-viewer');
  private readonly trackDownload = toolCopied('pptx-viewer', { method: 'download' });

  protected readonly maxMb = PPTX_MAX_MB;
  protected readonly fileLabel = of('PowerPoint file');
  protected readonly plural = plural;
  protected readonly queryCtl = new FormControl('', { nonNullable: true });

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly deck = signal<PptxDeck | null>(null);
  private readonly query = signal('');
  private readonly limit = signal(PAGE);
  private fileName = 'presentation.pptx';
  private fileSize = 0;
  private job = 0;

  private readonly index = computed(() => (this.deck()?.slides ?? []).map((s) => ({ slide: s, text: searchText(s) })));
  protected readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.index()
      .filter((entry) => !q || entry.text.includes(q))
      .map((entry) => entry.slide);
  });
  protected readonly visible = computed(() => this.matches().slice(0, this.limit()));
  protected readonly hasMore = computed(() => this.matches().length > this.limit());
  protected readonly shownLabel = computed(() => {
    const total = this.deck()?.slides.length ?? 0;
    const found = this.matches().length;
    const shown = Math.min(found, this.limit());
    return found === total ? `Showing ${shown} of ${plural(total, 'slide')}` : `${plural(found, 'slide')} match; showing ${shown}`;
  });
  protected readonly text = computed(() => {
    const d = this.deck();
    return d ? deckToText(d) : '';
  });
  protected readonly rows = computed<ToolRow[]>(() => {
    const d = this.deck();
    if (!d) return [];
    return [
      { label: 'File', value: `${this.fileName} · ${formatBytes(this.fileSize)}` },
      { label: 'Slides', value: String(d.stats.slides) },
      { label: 'Words', value: d.stats.words.toLocaleString('en-US') },
      { label: 'Tables', value: String(d.stats.tables) },
      { label: 'Pictures', value: String(d.stats.images) },
      { label: 'Slides with notes', value: String(d.stats.notes) },
    ];
  });

  constructor() {
    this.queryCtl.valueChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((v) => {
      this.query.set(v);
      this.limit.set(PAGE);
    });
  }

  protected more(): void {
    this.limit.update((n) => n + PAGE);
  }

  protected async onFile(picked: File | null): Promise<void> {
    const job = ++this.job;
    this.busy.set(false);
    this.error.set('');
    this.deck.set(null);
    this.queryCtl.setValue('');
    this.query.set('');
    this.limit.set(PAGE);
    if (!picked) return;
    if (picked.size > PPTX_MAX_MB * MB) {
      this.error.set(`That file is larger than ${PPTX_MAX_MB} MB. Remove large media or save a smaller copy and try again.`);
      return;
    }
    this.busy.set(true);
    try {
      const buffer = await picked.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve)); // let the "Reading" note paint before the unzip
      const deck = await readPptx(buffer);
      if (job !== this.job) return;
      this.fileName = picked.name;
      this.fileSize = picked.size;
      this.deck.set(deck);
      this.markUsed();
    } catch (error) {
      if (job !== this.job) return;
      this.error.set(error instanceof PptxError ? error.message : 'Something went wrong while reading this file. Try again, or choose a different file.');
    } finally {
      if (job === this.job) this.busy.set(false);
    }
  }

  protected downloadText(): void {
    downloadFile(`${baseName(this.fileName, 'presentation')}.txt`, this.text(), 'text/plain;charset=utf-8');
    this.trackDownload();
  }

  protected downloadMarkdown(): void {
    const d = this.deck();
    if (!d) return;
    downloadFile(`${baseName(this.fileName, 'presentation')}.md`, deckToMarkdown(d), 'text/markdown;charset=utf-8');
    this.trackDownload();
  }
}
