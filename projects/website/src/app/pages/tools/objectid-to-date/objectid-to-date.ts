import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { decodeObjectId, objectIdFromDate } from '../tool-logic';

/** /tools/objectid-to-date: ObjectId → date, and date → boundary ObjectId for `_id` range queries. */
@Component({
  selector: 'app-objectid-to-date',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="objectid-to-date">
      <div class="tool-split">
        <app-tool-panel title="ObjectId to date">
          <app-tool-input
            fieldId="oid"
            label="ObjectId (24 hex characters)"
            placeholder="507f1f77bcf86cd799439011"
            [control]="idCtl"
            [maxLength]="24"
            [invalid]="!!id().trim() && !decoded()"
          />
          @if (decoded()) {
            <app-tool-output label="Decoded" (copied)="trackCopy()">
              <app-tool-key-value [rows]="rows()" (copied)="trackCopy()" />
            </app-tool-output>
          } @else if (id().trim()) {
            <app-tool-note kind="error">An ObjectId is exactly 24 hexadecimal characters.</app-tool-note>
          } @else {
            <app-tool-empty icon="calendar-clock">Paste an ObjectId to see when it was created.</app-tool-empty>
          }
        </app-tool-panel>

        <app-tool-panel title="Date to ObjectId">
          <app-tool-input
            fieldId="oid-when"
            label="Date (ISO, Unix seconds or milliseconds)"
            placeholder="2026-01-01T00:00:00Z"
            [control]="whenCtl"
            [invalid]="!!when().trim() && !fromDate()"
          />
          @if (fromDate(); as oid) {
            <app-tool-output label="Boundary ObjectId" [value]="oid" meta="Other 8 bytes are zero" (copied)="trackCopy()" />
            <app-tool-output label="Use it as a lower bound" [value]="query()" copyLabel="Copy query" (copied)="trackCopy()" />
          } @else if (when().trim()) {
            <app-tool-note kind="error">Could not read that date. Try 2026-01-01T00:00:00Z or a Unix timestamp.</app-tool-note>
          } @else {
            <app-tool-empty icon="calendar-clock">Enter a date to get the ObjectId for _id range queries.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class ObjectIdToDateTool {
  private readonly markUsed = toolUsage('objectid-to-date');
  protected readonly trackCopy = toolCopied('objectid-to-date');

  protected readonly idCtl = new FormControl('', { nonNullable: true });
  protected readonly whenCtl = new FormControl('', { nonNullable: true });
  protected readonly id = controlSignal(this.idCtl);
  protected readonly when = controlSignal(this.whenCtl);
  protected readonly decoded = computed(() => decodeObjectId(this.id()));
  protected readonly fromDate = computed(() => objectIdFromDate(this.when()));
  protected readonly rows = computed<ToolRow[]>(() => {
    const d = this.decoded();
    return d
      ? [
          { label: 'UTC', value: d.iso, copy: true },
          { label: 'Local', value: d.local },
          { label: 'Unix seconds', value: String(d.seconds), copy: true },
          { label: 'Random (5 bytes)', value: d.random },
          { label: 'Counter (3 bytes)', value: d.counter },
        ]
      : [];
  });
  protected readonly query = computed(() => `{ _id: { $gte: ObjectId("${this.fromDate() ?? ''}") } }`);

  constructor() {
    this.idCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => v.trim() && this.markUsed());
    this.whenCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => v.trim() && this.markUsed());
  }
}
