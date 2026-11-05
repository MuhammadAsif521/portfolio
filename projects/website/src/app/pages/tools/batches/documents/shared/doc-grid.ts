import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { HEADER_HEIGHT, ROW_HEAD_WIDTH, ROW_HEIGHT, type SortDir, indexAt, prefixSums, rowWindow } from './grid-data';

/**
 * A scrollable data grid that only draws the rows and columns in view, so a hundred thousand cells (or a
 * million rows) scroll as smoothly as ten. The parent owns the data: it passes the row count, a cell reader
 * and column widths; clicking a header asks the parent to sort. Keyboard: the grid scrolls with the arrow keys.
 */
@Component({
  selector: 'app-doc-grid',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .grid {
      position: relative;
      height: min(32rem, 70vh);
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card-bg);
      font-size: var(--text-sm);
      outline: none;
    }
    .grid:focus-visible {
      box-shadow: var(--focus-ring);
      border-color: var(--primary);
    }
    .grid__stage {
      position: sticky;
      top: 0;
      left: 0;
      overflow: hidden;
    }
    .grid__head,
    .grid__row {
      position: absolute;
      left: 0;
      right: 0;
    }
    .grid__head {
      top: 0;
      z-index: 3;
      background: var(--surface-muted);
      border-bottom: 1px solid var(--border-strong);
    }
    .grid__row {
      border-bottom: 1px solid var(--border);
    }
    .grid__row:nth-child(even) {
      background: color-mix(in srgb, var(--surface-muted) 55%, transparent);
    }
    .grid__rh,
    .grid__corner {
      position: absolute;
      left: 0;
      top: 0;
      z-index: 2;
      box-sizing: border-box;
      padding: 0 0.5rem;
      border-right: 1px solid var(--border-strong);
      background: var(--surface-muted);
      color: var(--text-muted);
      font-size: var(--text-xs);
      font-variant-numeric: tabular-nums;
      text-align: right;
      line-height: 27px;
      overflow: hidden;
    }
    .grid__corner {
      z-index: 4;
    }
    .grid__c,
    .grid__h {
      position: absolute;
      top: 0;
      box-sizing: border-box;
      padding: 0 0.625rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text);
    }
    .grid__c {
      line-height: 27px;
    }
    .grid__c--num {
      font-variant-numeric: tabular-nums;
    }
    .grid__h {
      padding: 0;
      border-right: 1px solid var(--border);
    }
    .grid__sort {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      width: 100%;
      height: 100%;
      padding: 0 0.625rem;
      border: 0;
      background: transparent;
      color: var(--heading);
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    .grid__sort:hover {
      background: var(--primary-soft);
    }
    .grid__sort:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--primary);
    }
    .grid__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grid__arrow {
      flex-shrink: 0;
      color: var(--primary-ink);
    }
  `,
  template: `
    <div
      #scroller
      class="grid"
      tabindex="0"
      role="table"
      [attr.aria-label]="label()"
      [attr.aria-rowcount]="rowCount() + 1"
      [attr.aria-colcount]="columns().length"
      (scroll)="onScroll()"
    >
      <div class="grid__sizer" [style.width.px]="sizerWidth()" [style.height.px]="sizerHeight()">
        <div class="grid__stage" [style.width.px]="viewW()" [style.height.px]="viewH()">
          <div class="grid__head" role="row" [style.height.px]="headerHeight">
            <div class="grid__corner" [style.width.px]="rowHeadWidth" [style.height.px]="headerHeight"></div>
            @for (c of colList(); track c) {
              <div
                class="grid__h"
                role="columnheader"
                [attr.aria-sort]="sortCol() === c ? (sortDir() === 'asc' ? 'ascending' : 'descending') : 'none'"
                [style.left.px]="colLeft(c)"
                [style.width.px]="widths()[c]"
                [style.height.px]="headerHeight"
              >
                @if (sortable()) {
                  <button type="button" class="grid__sort" [title]="'Sort by ' + columns()[c]" (click)="sortToggle.emit(c)">
                    <span class="grid__label">{{ columns()[c] }}</span>
                    @if (sortCol() === c) {
                      <i-lucide class="grid__arrow" [name]="sortDir() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="14" aria-hidden="true" />
                    }
                  </button>
                } @else {
                  <span class="grid__sort grid__label">{{ columns()[c] }}</span>
                }
              </div>
            }
          </div>
          @for (r of rowList(); track r) {
            <div class="grid__row" role="row" [style.top.px]="rowTop(r)" [style.height.px]="rowHeight">
              <div class="grid__rh" role="rowheader" [style.width.px]="rowHeadWidth" [style.height.px]="rowHeight">{{ rowLabel()(r) }}</div>
              @for (c of colList(); track c) {
                <div class="grid__c" role="cell" [style.left.px]="colLeft(c)" [style.width.px]="widths()[c]">{{ cellAt()(r, c) }}</div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class DocGrid {
  readonly columns = input.required<readonly string[]>();
  readonly widths = input.required<readonly number[]>();
  readonly rowCount = input.required<number>();
  readonly cellAt = input.required<(row: number, col: number) => string>();
  readonly rowLabel = input<(row: number) => string | number>((row) => row + 1);
  readonly sortCol = input(-1);
  readonly sortDir = input<SortDir>('asc');
  readonly sortable = input(true);
  readonly label = input('Data table');
  /** Changes whenever the shown rows change (filter, sort, sheet): the grid scrolls back to the top. */
  readonly resetKey = input<unknown>();
  readonly sortToggle = output<number>();

  protected readonly headerHeight = HEADER_HEIGHT;
  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly rowHeadWidth = ROW_HEAD_WIDTH;

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly scrollTop = signal(0);
  private readonly scrollLeft = signal(0);
  protected readonly viewW = signal(960);
  protected readonly viewH = signal(480);
  private frame = 0;

  private readonly sums = computed(() => prefixSums(this.widths()));
  protected readonly sizerWidth = computed(() => Math.max(this.viewW(), ROW_HEAD_WIDTH + (this.sums().at(-1) ?? 0)));
  protected readonly win = computed(() => rowWindow(this.rowCount(), this.scrollTop(), this.viewH() - HEADER_HEIGHT));

  protected readonly sizerHeight = computed(() => Math.max(this.viewH(), this.win().scrollHeight));

  protected readonly rowList = computed(() => {
    const { first, last } = this.win();
    return last < first ? [] : Array.from({ length: last - first + 1 }, (_, i) => first + i);
  });

  protected readonly colList = computed(() => {
    const sums = this.sums();
    const count = this.columns().length;
    if (!count) return [];
    const left = this.scrollLeft();
    const first = Math.max(0, indexAt(sums, left) - 1);
    const last = Math.min(count - 1, indexAt(sums, left + this.viewW() - ROW_HEAD_WIDTH) + 1);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.scroller().nativeElement;
      const measure = () => {
        this.viewW.set(el.clientWidth);
        this.viewH.set(el.clientHeight);
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(this.frame);
      });
    });

    effect(() => {
      this.resetKey();
      const el = this.scroller().nativeElement;
      el.scrollTop = 0;
      this.scrollTop.set(0);
    });
  }

  protected colLeft(col: number): number {
    return ROW_HEAD_WIDTH + this.sums()[col] - this.scrollLeft();
  }

  protected rowTop(row: number): number {
    return HEADER_HEIGHT + (row - this.win().top) * ROW_HEIGHT;
  }

  protected onScroll(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const el = this.scroller().nativeElement;
      this.scrollTop.set(el.scrollTop);
      this.scrollLeft.set(el.scrollLeft);
    });
  }
}
