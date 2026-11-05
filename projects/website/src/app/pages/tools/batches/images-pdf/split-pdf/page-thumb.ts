import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, signal } from '@angular/core';

/**
 * One page tile of the split tool: a number and a lazily rendered preview. The preview is requested only when
 * the tile scrolls into view (IntersectionObserver), so a long PDF does not render every page up front.
 * Selectable tiles are checkbox buttons; others are plain figures.
 */
@Component({
  selector: 'app-page-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; min-width: 0; }
    .tile { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 3 / 4; padding: 0; overflow: hidden; border: 2px solid var(--border); border-radius: var(--radius-md); background: var(--card-bg); color: var(--heading); font: inherit; }
    button.tile { cursor: pointer; }
    button.tile:hover { border-color: var(--primary-muted); }
    button.tile:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .tile--on { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft); }
    img { display: block; width: 100%; height: 100%; object-fit: contain; background: #fff; }
    .ph { color: var(--text-muted); font-size: var(--text-xs); }
    .num { position: absolute; right: 0.25rem; bottom: 0.25rem; min-width: 1.5rem; padding: 0.0625rem 0.375rem; border-radius: var(--radius-pill); background: color-mix(in srgb, var(--heading) 82%, transparent); color: var(--card-bg); font-size: var(--text-xs); font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
    .tick { position: absolute; left: 0.25rem; top: 0.25rem; display: grid; place-items: center; width: 1.25rem; height: 1.25rem; border-radius: 0.25rem; background: var(--primary); color: var(--on-primary); font-size: 0.75rem; line-height: 1; }
  `,
  template: `
    @if (selectable()) {
      <button type="button" class="tile" [class.tile--on]="selected()" role="checkbox" [attr.aria-checked]="selected()" [attr.aria-label]="'Page ' + page()" (click)="toggle.emit(page())">
        @if (url()) { <img [src]="url()" alt="" /> } @else { <span class="ph">{{ failed() ? 'No preview' : '…' }}</span> }
        @if (selected()) { <span class="tick" aria-hidden="true">✓</span> }
        <span class="num" aria-hidden="true">{{ page() }}</span>
      </button>
    } @else {
      <div class="tile" role="img" [attr.aria-label]="'Page ' + page()">
        @if (url()) { <img [src]="url()" alt="" /> } @else { <span class="ph">{{ failed() ? 'No preview' : '…' }}</span> }
        <span class="num" aria-hidden="true">{{ page() }}</span>
      </div>
    }
  `,
})
export class PageThumb {
  readonly page = input.required<number>();
  readonly selected = input(false);
  readonly selectable = input(false);
  /** Resolves to an object URL for the page preview (owned and revoked by the caller). */
  readonly loader = input.required<(page: number) => Promise<string>>();
  readonly toggle = output<number>();

  protected readonly url = signal('');
  protected readonly failed = signal(false);
  private requested = false;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        void this.load();
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect();
            void this.load();
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private async load(): Promise<void> {
    if (this.requested) return;
    this.requested = true;
    try {
      this.url.set(await this.loader()(this.page()));
    } catch {
      this.failed.set(true);
    }
  }
}
