import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, TemplateRef, contentChild, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';

export interface ReorderRow {
  id: number;
  /** Name used in the buttons' accessible labels. */
  name: string;
}

/**
 * A list the user can reorder by dragging the grip or with the up/down buttons, and remove rows from. The look of a
 * row's content is a template projected by the tool: `<ng-template #row let-item let-index="index">`.
 * It emits the new order of ids; the tool owns the data.
 */
@Component({
  selector: 'app-ip-reorder',
  imports: [NgTemplateOutlet, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; min-width: 0; }
    .list { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; max-height: 34rem; overflow: auto; }
    .row { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; padding: 0.5rem 0.5rem 0.5rem 0.375rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card-bg); }
    .row--over { border-color: var(--primary); background: var(--primary-soft); }
    .row--drag { opacity: 0.55; }
    .grip { display: grid; place-items: center; width: 1.75rem; height: 2rem; color: var(--text-muted); cursor: grab; touch-action: none; }
    .num { min-width: 1.25rem; color: var(--text-muted); font-size: var(--text-xs); font-variant-numeric: tabular-nums; text-align: right; }
    .body { min-width: 0; }
    .actions { display: flex; gap: 0.125rem; }
    .btn { display: grid; place-items: center; width: 2rem; height: 2rem; border: 0; border-radius: var(--radius-sm, 0.375rem); background: transparent; color: var(--heading); cursor: pointer; }
    .btn:hover:not(:disabled) { background: var(--primary-soft); }
    .btn:disabled { opacity: 0.35; cursor: default; }
    .btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
  template: `
    <ol class="list" [attr.aria-label]="label()">
      @for (item of items(); track item.id; let i = $index; let first = $first; let last = $last) {
        <li
          class="row"
          [attr.data-id]="item.id"
          [class.row--over]="overId() === item.id && dragId() !== item.id"
          [class.row--drag]="dragId() === item.id"
          (dragover)="over($event, item.id)"
          (drop)="drop($event, item.id)"
        >
          <span
            class="grip"
            draggable="true"
            aria-hidden="true"
            title="Drag to reorder"
            (dragstart)="start($event, item.id)"
            (dragend)="end()"
          >
            <i-lucide name="grip-vertical" [size]="18" />
          </span>
          <span class="num" aria-hidden="true">{{ i + 1 }}</span>
          <div class="body">
            <ng-container [ngTemplateOutlet]="rowTemplate()" [ngTemplateOutletContext]="{ $implicit: item, index: i }" />
          </div>
          <div class="actions">
            <button type="button" class="btn" data-act="up" [disabled]="first" [attr.aria-label]="'Move ' + item.name + ' up'" (click)="move(item.id, i, -1)">
              <i-lucide name="arrow-up" [size]="16" aria-hidden="true" />
            </button>
            <button type="button" class="btn" data-act="down" [disabled]="last" [attr.aria-label]="'Move ' + item.name + ' down'" (click)="move(item.id, i, 1)">
              <i-lucide name="arrow-down" [size]="16" aria-hidden="true" />
            </button>
            <button type="button" class="btn" data-act="remove" [attr.aria-label]="'Remove ' + item.name" (click)="remove.emit(item.id)">
              <i-lucide name="x" [size]="16" aria-hidden="true" />
            </button>
          </div>
        </li>
      }
    </ol>
    <span class="sr" aria-live="polite">{{ announcement() }}</span>
  `,
})
export class IpReorder {
  readonly items = input.required<readonly ReorderRow[]>();
  readonly label = input('Files, in output order');
  readonly reorder = output<number[]>();
  readonly remove = output<number>();
  protected readonly rowTemplate = contentChild.required<TemplateRef<unknown>>('row');
  protected readonly dragId = signal<number | null>(null);
  protected readonly overId = signal<number | null>(null);
  protected readonly announcement = signal('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected move(id: number, index: number, delta: -1 | 1): void {
    const ids = this.items().map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.reorder.emit(ids);
    const name = this.items()[index].name;
    this.announcement.set(`${name} moved to position ${target + 1} of ${ids.length}.`);
    setTimeout(() => {
      const button = this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-id="${id}"] [data-act="${delta < 0 ? 'up' : 'down'}"]`);
      (button && !button.disabled ? button : this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-id="${id}"] [data-act="${delta < 0 ? 'down' : 'up'}"]`))?.focus();
    });
  }

  protected start(event: DragEvent, id: number): void {
    this.dragId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(id));
      const row = (event.target as HTMLElement).closest('li');
      if (row) event.dataTransfer.setDragImage(row, 16, 16);
    }
  }

  protected over(event: DragEvent, id: number): void {
    if (this.dragId() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.overId.set(id);
  }

  protected drop(event: DragEvent, targetId: number): void {
    event.preventDefault();
    const from = this.dragId();
    this.end();
    if (from === null || from === targetId) return;
    const ids = this.items().map((i) => i.id);
    const fromIndex = ids.indexOf(from);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    ids.splice(toIndex, 0, ids.splice(fromIndex, 1)[0]);
    this.reorder.emit(ids);
    this.announcement.set(`Moved to position ${toIndex + 1} of ${ids.length}.`);
  }

  protected end(): void {
    this.dragId.set(null);
    this.overId.set(null);
  }
}
