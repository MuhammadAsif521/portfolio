import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

const THUMB_WIDTH = 96;

/**
 * One page thumbnail. It draws itself only while it is scrolled into view and frees its canvas again when it
 * leaves, so a long PDF never holds hundreds of bitmaps.
 */
@Component({
  selector: 'app-pdf-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .thumb {
      display: grid;
      justify-items: center;
      gap: 0.25rem;
      width: 100%;
      padding: 0.375rem;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      font: inherit;
      font-size: var(--text-xs);
      cursor: pointer;
    }
    .thumb:hover {
      background: var(--primary-soft);
    }
    .thumb:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .thumb--on {
      border-color: var(--primary);
      background: var(--primary-soft);
      color: var(--heading);
      font-weight: 600;
    }
    .thumb__frame {
      display: block;
      min-height: 7rem;
      width: 6rem;
      background: var(--paper);
      box-shadow: 0 0 0 1px var(--border);
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
    }
  `,
  template: `
    <button type="button" class="thumb" [class.thumb--on]="active()" [attr.aria-current]="active() ? 'page' : null" [attr.aria-label]="'Go to page ' + page()" (click)="pick.emit(page())">
      <span class="thumb__frame"><canvas #canvas width="0" height="0" aria-hidden="true"></canvas></span>
      <span>{{ page() }}</span>
    </button>
  `,
})
export class PdfThumb {
  readonly doc = input.required<PDFDocumentProxy>();
  readonly page = input.required<number>();
  readonly active = input(false);
  readonly pick = output<number>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private task: RenderTask | null = null;
  private drawn = false;
  private seq = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((e) => e.isIntersecting);
          if (visible && !this.drawn) void this.draw();
          else if (!visible && this.drawn) this.clear();
        },
        { rootMargin: '200px 0px' },
      );
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        this.task?.cancel();
      });
    });
  }

  private async draw(): Promise<void> {
    this.drawn = true;
    const seq = ++this.seq;
    try {
      const page = await this.doc().getPage(this.page());
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
      if (seq !== this.seq) return;
      const canvas = this.canvas().nativeElement;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      this.task = page.render({ canvas, viewport });
      await this.task.promise;
      page.cleanup();
    } catch {
      // Cancelled by scrolling away, or a page that cannot be drawn: the frame simply stays blank.
    }
  }

  private clear(): void {
    this.seq++;
    this.task?.cancel();
    const canvas = this.canvas().nativeElement;
    canvas.width = 0;
    canvas.height = 0;
    this.drawn = false;
  }
}
