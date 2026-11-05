import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { LIMITS, isPdf, safeFileName } from '../shared/files';
import { IpReorder } from '../shared/ip-reorder';
import { parsePageRanges } from '../shared/page-ranges';
import { PdfLibError, type MergeSource, mergePdfs, pageCountOf } from '../shared/pdf-ops';
import { downloadBlob } from '../shared/zip';

interface Item {
  id: number;
  file: File;
  name: string;
  size: string;
  status: 'checking' | 'ok' | 'error';
  pages: number;
  error: string;
  range: FormControl<string>;
}

/**
 * /tools/merge-pdf: joins PDFs with pdf-lib in the order of the list. Reorder by dragging or with the move
 * buttons, optionally limit each file to a page range, and see the total page count. Encrypted, damaged or
 * non-PDF files are flagged on their own row and skipped. Only one source document is open at a time.
 */
@Component({
  selector: 'app-merge-pdf',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolButton, ToolNote, ToolEmpty, CustomFileInputComponent, IpReorder],
  styleUrls: ['../../../tool-ui.scss', './merge-pdf.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="merge-pdf">
      <div class="tool-split">
        <app-tool-panel title="PDF files">
          @for (key of [inputKey()]; track key) {
            <app-custom-file-input
              controlName="merge-pdf-files"
              [label$]="fileLabel"
              accept="application/pdf,.pdf"
              placeholder="Add PDFs, or drag them here"
              [multiple]="true"
              [showLabel]="false"
              [maxFileSize]="maxFileMb"
              [scanFiles]="false"
              [sanitizeNames]="false"
              (file)="onFiles($event)"
            />
          }
          @for (note of notices(); track note) {
            <app-tool-note kind="warn">{{ note }}</app-tool-note>
          }
          @if (items().length) {
            <app-ip-reorder [items]="items()" label="PDF files, in merge order" (reorder)="reorder($event)" (remove)="remove($event)">
              <ng-template #row let-item>
                <div class="mrow" [class.mrow--error]="item.status === 'error'">
                  <span class="mrow__name" [title]="item.name">{{ item.name }}</span>
                  @if (item.status === 'checking') {
                    <span class="mrow__meta">Checking…</span>
                  } @else if (item.status === 'error') {
                    <span class="mrow__error" role="alert">{{ item.error }} This file will be skipped.</span>
                  } @else {
                    <span class="mrow__meta">{{ item.pages }} {{ item.pages === 1 ? 'page' : 'pages' }} · {{ item.size }}</span>
                    <app-tool-input
                      [fieldId]="'merge-pdf-range-' + item.id"
                      label="Pages to include (optional)"
                      [control]="item.range"
                      [mono]="false"
                      placeholder="All pages"
                      [invalid]="!!rangeInfo(item).error"
                    />
                    @if (rangeInfo(item).error) {
                      <span class="mrow__error" role="alert">{{ rangeInfo(item).error }}</span>
                    }
                  }
                </div>
              </ng-template>
            </app-ip-reorder>
            <div class="tool-actions">
              <app-tool-button size="small" label="Clear all" (pressed)="clear()" />
            </div>
          }
        </app-tool-panel>

        <app-tool-panel title="Merged PDF">
          @if (!items().length) {
            <app-tool-empty icon="file-stack">Add two or more PDFs, drag them into the order you want, then merge. Each file can contribute all of its pages or just a range such as 1-3,7.</app-tool-empty>
          } @else {
            <p class="tool-meta" role="status">{{ summary() }}</p>
            <app-tool-input fieldId="merge-pdf-name" label="File name" [control]="nameCtl" [mono]="false" hint="The .pdf extension is added for you." />
            <app-tool-note kind="info">
              Pages are copied as they are. Bookmarks, form fields and the original document title and author are not carried into the merged file.
            </app-tool-note>
            @if (error()) {
              <app-tool-note kind="error">{{ error() }}</app-tool-note>
            }
            <app-tool-button kind="primary" icon="file-stack" [label]="'Merge ' + usable().length + (usable().length === 1 ? ' file' : ' files')" [fill]="true" [loading]="busy()" [disabled]="!canMerge()" (pressed)="merge()" />
            @if (busy()) {
              <p class="tool-meta" role="status">{{ progress() }}</p>
            }
            @if (result(); as r) {
              <app-tool-note kind="success">Created {{ r.name }}: {{ r.pages }} {{ r.pages === 1 ? 'page' : 'pages' }}, {{ r.size }}.</app-tool-note>
              <app-tool-button kind="primary" icon="download" [label]="'Download ' + r.name" [fill]="true" (pressed)="download()" />
            }
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class MergePdfTool {
  private readonly markUsed = toolUsage('merge-pdf');
  private readonly trackDownload = toolCopied('merge-pdf', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxFileMb = LIMITS.pdfFileBytes / (1024 * 1024);
  protected readonly fileLabel = of('PDFs to merge');
  protected readonly nameCtl = new FormControl<string>('merged', { nonNullable: true });
  private readonly fileName = controlSignal(this.nameCtl);

  protected readonly items = signal<Item[]>([]);
  protected readonly notices = signal<string[]>([]);
  protected readonly inputKey = signal(0);
  protected readonly busy = signal(false);
  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly result = signal<{ blob: Blob; name: string; pages: number; size: string } | null>(null);
  /** Bumped whenever any page-range text changes, so range-dependent values recompute. */
  private readonly rangeTick = signal(0);
  private nextId = 1;

  protected readonly usable = computed(() => this.items().filter((i) => i.status === 'ok' && !this.rangeInfo(i).error));
  protected readonly totalPages = computed(() => this.usable().reduce((sum, i) => sum + this.rangeInfo(i).count, 0));
  protected readonly canMerge = computed(() => this.usable().length >= 1 && !this.busy() && !this.items().some((i) => i.status === 'checking'));
  protected readonly summary = computed(() => {
    const items = this.items();
    const skipped = items.filter((i) => i.status === 'error').length;
    const invalid = items.filter((i) => i.status === 'ok' && this.rangeInfo(i).error).length;
    const parts = [`${this.usable().length} of ${items.length} files ready`, `${this.totalPages()} pages in total`];
    if (skipped) parts.push(`${skipped} will be skipped`);
    if (invalid) parts.push(`${invalid} with an invalid page range`);
    return parts.join(' · ');
  });

  constructor() {
    // Changed order, ranges or name make the earlier merged file stale.
    effect(() => {
      this.items();
      this.rangeTick();
      this.fileName();
      untracked(() => this.result.set(null));
    });
  }

  /** Pages chosen for a row: how many, which, or what is wrong with the text. Reads the range tick, so it is reactive. */
  protected rangeInfo(item: Item): { count: number; pages: number[] | null; error: string } {
    this.rangeTick();
    if (item.status !== 'ok') return { count: 0, pages: null, error: '' };
    const text = item.range.value.trim();
    if (!text) return { count: item.pages, pages: null, error: '' };
    const parsed = parsePageRanges(text, item.pages);
    return parsed.ok ? { count: parsed.pages.length, pages: parsed.pages, error: '' } : { count: 0, pages: null, error: parsed.error };
  }

  protected async onFiles(files: File[] | File | null): Promise<void> {
    // The shared input would keep its own list; the order list below is the one that matters, so the input is
    // remounted empty after each pick and acts as a plain drop zone.
    setTimeout(() => this.inputKey.update((k) => k + 1));
    if (!files) return;
    const picked = Array.isArray(files) ? files : [files];
    const notices: string[] = [];
    const added: Item[] = [];
    let total = this.items().reduce((sum, i) => sum + i.file.size, 0);
    for (const file of picked) {
      if (this.items().length + added.length >= LIMITS.pdfFiles) {
        notices.push(`Up to ${LIMITS.pdfFiles} PDFs can be merged at once. The rest were left out.`);
        break;
      }
      if (total + file.size > LIMITS.pdfTotalBytes) {
        notices.push(`${file.name} would take the total over ${LIMITS.pdfTotalBytes / 1024 / 1024} MB, so it was left out. Merge in two steps instead.`);
        continue;
      }
      total += file.size;
      const range = new FormControl<string>('', { nonNullable: true });
      range.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.rangeTick.update((n) => n + 1));
      added.push({ id: this.nextId++, file, name: file.name, size: formatBytes(file.size), status: 'checking', pages: 0, error: '', range });
    }
    this.notices.set(notices);
    this.error.set('');
    this.items.update((list) => [...list, ...added]);
    for (const item of added) await this.check(item);
  }

  private async check(item: Item): Promise<void> {
    const set = (patch: Partial<Item>) => this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    try {
      if (item.file.size === 0) throw new PdfLibError('invalid', 'This file is empty.');
      const head = new Uint8Array(await item.file.slice(0, 1100).arrayBuffer());
      if (!isPdf(head)) throw new PdfLibError('invalid', 'This is not a PDF file.');
      const pages = await pageCountOf(new Uint8Array(await item.file.arrayBuffer()));
      set({ status: 'ok', pages });
    } catch (error) {
      set({ status: 'error', error: error instanceof PdfLibError ? error.message : 'This file could not be read as a PDF.' });
    }
  }

  protected reorder(ids: number[]): void {
    const byId = new Map(this.items().map((i) => [i.id, i]));
    this.items.set(ids.map((id) => byId.get(id)).filter((i): i is Item => !!i));
  }

  protected remove(id: number): void {
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  protected clear(): void {
    this.items.set([]);
    this.notices.set([]);
  }

  protected async merge(): Promise<void> {
    const usable = this.usable();
    if (!usable.length || this.busy()) return;
    this.markUsed();
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    const sources: MergeSource[] = usable.map((i) => ({ name: i.name, pages: this.rangeInfo(i).pages, read: async () => new Uint8Array(await i.file.arrayBuffer()) }));
    try {
      const { bytes, pages } = await mergePdfs(sources, (done, total, name) => this.progress.set(done >= total ? 'Saving the merged PDF…' : `Merging file ${done + 1} of ${total}: ${name}`));
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      this.result.set({ blob, name: `${safeFileName(this.fileName().replace(/\.pdf$/i, ''), 'merged')}.pdf`, pages, size: formatBytes(blob.size) });
    } catch (error) {
      this.error.set(
        error instanceof PdfLibError
          ? error.message
          : error instanceof Error && error.name === 'RangeError'
            ? 'Your browser ran out of memory. Merge fewer or smaller files at a time.'
            : 'The PDFs could not be merged. A file may be damaged. Remove the last file you added and try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected download(): void {
    const r = this.result();
    if (!r) return;
    downloadBlob(r.blob, r.name);
    this.trackDownload();
  }
}
