import { computed, signal } from '@angular/core';
import { AbortedError, nextTask } from './async';
import { formatBytes } from '../../../tool-logic-2';
import { LIMITS, savingLabel } from './files';
import { ImageError } from './image-codec';
import type { ResultRow } from './ip-results';
import { downloadBlob, zipEntries } from './zip';

export interface BatchResult {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  /** Shown next to the row, e.g. "Kept the original: it was already smaller". */
  note?: string;
}

export interface BatchItem {
  id: number;
  file: File;
  status: 'queued' | 'working' | 'done' | 'error';
  /** Live status text while working ("Trying quality 62%"). */
  progress: string;
  error: string;
  result: BatchResult | null;
}

export type BatchProcessor = (item: BatchItem, report: (text: string) => void, signal: AbortSignal) => Promise<BatchResult>;

/**
 * State of a multi-file image run: the list of files, one status per file, totals before and after, and ZIP or
 * single-file download. Files are processed one after another, so memory stays at one image at a time.
 */
export class ImageBatch {
  readonly items = signal<BatchItem[]>([]);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly zipping = signal(false);
  private nextId = 1;
  private abort: AbortController | null = null;

  readonly doneItems = computed(() => this.items().filter((i) => i.status === 'done' && i.result));
  readonly failedCount = computed(() => this.items().filter((i) => i.status === 'error').length);
  readonly finishedCount = computed(() => this.items().filter((i) => i.status === 'done' || i.status === 'error').length);
  readonly bytesBefore = computed(() => this.doneItems().reduce((sum, i) => sum + i.file.size, 0));
  readonly bytesAfter = computed(() => this.doneItems().reduce((sum, i) => sum + (i.result?.blob.size ?? 0), 0));
  /** 0 to 100 across the whole run. */
  readonly percent = computed(() => {
    const total = this.items().length;
    return total ? Math.round((this.finishedCount() / total) * 100) : 0;
  });

  /** Receives the file input's list (or null when emptied). Existing rows and their results are kept. */
  setFiles(files: File[] | File | null): void {
    const incoming = files === null ? [] : Array.isArray(files) ? files : [files];
    const kept = this.items().filter((item) => incoming.includes(item.file));
    const known = new Set(kept.map((item) => item.file));
    let fresh = incoming.filter((file) => !known.has(file));
    this.notice.set('');
    const room = LIMITS.imageFiles - kept.length;
    if (fresh.length > room) {
      this.notice.set(`Only ${LIMITS.imageFiles} images can be processed at once. The extra ${fresh.length - Math.max(room, 0)} were left out.`);
      fresh = fresh.slice(0, Math.max(room, 0));
    }
    const added: BatchItem[] = fresh.map((file) => ({ id: this.nextId++, file, status: 'queued', progress: '', error: '', result: null }));
    // Keep the order of the file input.
    const byFile = new Map([...kept, ...added].map((item) => [item.file, item]));
    this.items.set(incoming.map((file) => byFile.get(file)).filter((item): item is BatchItem => !!item));
  }

  /** Forgets results (settings changed) but keeps the files. */
  resetResults(): void {
    this.items.update((list) => list.map((i) => ({ ...i, status: 'queued', progress: '', error: '', result: null })));
  }

  cancel(): void {
    this.abort?.abort();
  }

  async run(process: BatchProcessor): Promise<void> {
    if (this.busy() || !this.items().length) return;
    this.resetResults();
    const abort = (this.abort = new AbortController());
    this.busy.set(true);
    try {
      for (const { id } of this.items()) {
        if (abort.signal.aborted) break;
        const item = this.items().find((i) => i.id === id);
        if (!item) continue;
        this.patch(id, { status: 'working', progress: 'Reading…' });
        await nextTask();
        try {
          const result = await process(item, (text) => this.patch(id, { progress: text }), abort.signal);
          if (abort.signal.aborted) break;
          this.patch(id, { status: 'done', progress: '', result });
        } catch (error) {
          if (error instanceof AbortedError || abort.signal.aborted) break;
          this.patch(id, { status: 'error', progress: '', error: friendly(error) });
        }
        await nextTask();
      }
    } finally {
      // Anything still marked working or queued after a cancel goes back to queued.
      this.items.update((list) => list.map((i) => (i.status === 'working' ? { ...i, status: 'queued', progress: '' } : i)));
      this.busy.set(false);
    }
  }

  download(id: number): Blob | null {
    const item = this.items().find((i) => i.id === id);
    if (!item?.result) return null;
    downloadBlob(item.result.blob, item.result.name);
    return item.result.blob;
  }

  async downloadZip(zipName: string): Promise<boolean> {
    const done = this.doneItems();
    if (!done.length || this.zipping()) return false;
    this.zipping.set(true);
    try {
      const blob = await zipEntries(done.map((i) => ({ name: i.result!.name, data: i.result!.blob })));
      downloadBlob(blob, zipName);
      return true;
    } catch {
      this.notice.set('Could not build the ZIP file. Download the images one by one instead, or process fewer files.');
      return false;
    } finally {
      this.zipping.set(false);
    }
  }

  private patch(id: number, patch: Partial<BatchItem>): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
}

export function friendly(error: unknown): string {
  if (error instanceof ImageError) return error.message;
  if (error instanceof Error && error.name === 'RangeError') return 'Your browser ran out of memory for this image. Try a smaller size.';
  return 'Something went wrong with this file. It may be damaged. The other files were not affected.';
}

/** One display row per file: sizes before and after, dimensions, notes, or the error. */
export function batchRows(items: readonly BatchItem[]): ResultRow[] {
  return items.map((item) => {
    const r = item.result;
    const detail =
      item.status === 'error'
        ? item.error
        : item.status === 'working'
          ? item.progress
          : r
            ? [`${formatBytes(item.file.size)} to ${formatBytes(r.blob.size)} (${savingLabel(item.file.size, r.blob.size)})`, `${r.width} x ${r.height} px`, r.note].filter(Boolean).join(' · ')
            : `${formatBytes(item.file.size)}, waiting`;
    return { id: item.id, name: r?.name ?? item.file.name, status: item.status, detail, canDownload: !!r };
  });
}

/** "3 of 5 done · 12.4 MB to 4.1 MB (67% smaller)". */
export function batchSummary(batch: ImageBatch): string {
  const total = batch.items().length;
  if (!total) return '';
  const done = batch.doneItems().length;
  const failed = batch.failedCount();
  const head = `${done} of ${total} done${failed ? `, ${failed} failed` : ''}`;
  if (!done) return head;
  return `${head} · ${formatBytes(batch.bytesBefore())} to ${formatBytes(batch.bytesAfter())} (${savingLabel(batch.bytesBefore(), batch.bytesAfter())})`;
}
