import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { debouncedControlSignal } from '../text-ui';
import { yieldToBrowser } from '../text-utils';
import {
  buildUnifiedPatch,
  collapseUnchanged,
  computeDiff,
  isSkip,
  limitSegments,
  sideBySideRows,
  sideSegments,
  type DiffFn,
  type DiffMode,
  type DiffOptions,
  type DiffResult,
  type LineOp,
  type SideRow,
} from './text-diff.logic';

const MODES = [
  { id: 'lines', name: 'Lines' },
  { id: 'words', name: 'Words' },
  { id: 'chars', name: 'Characters' },
];
const VIEWS = [
  { id: 'side', name: 'Side by side' },
  { id: 'unified', name: 'Unified (one column)' },
];
const SAMPLE_A = 'Dear team,\n\nThe release is planned for Friday.\nPlease review the changelog before then.\nThanks,\nAsif';
const SAMPLE_B = 'Dear team,\n\nThe release is planned for Monday.\nPlease review the changelog and the migration notes before then.\nThanks,\nAsif\n\nP.S. Tests are green.';
const CONTEXT = 3;
const MAX_ROWS = 2500;
const MAX_SEGMENTS = 4000;

/** /tools/text-diff-checker: compares two texts by line, word or character, live, with a copyable unified patch. */
@Component({
  selector: 'app-text-diff-checker',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolSelect, ToolToggle, ToolButton, ToolOutput, ToolNote, ToolEmpty],
  styleUrl: '../../../tool-ui.scss',
  styles: `
    .dx-wrap {
      overflow-x: auto;
    }
    .dx {
      width: 100%;
      min-width: 36rem;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.55;
    }
    .dx td {
      padding: 0 0.5rem;
      vertical-align: top;
    }
    .dx-no {
      width: 3rem;
      color: var(--band-dark-muted);
      text-align: right;
      user-select: none;
      font-variant-numeric: tabular-nums;
    }
    .dx-mark {
      width: 1.5rem;
      text-align: center;
      font-weight: 700;
      user-select: none;
    }
    .dx-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--band-dark-text);
    }
    .dx-add {
      background: color-mix(in srgb, var(--success) 20%, transparent);
    }
    .dx-del {
      background: color-mix(in srgb, var(--error) 24%, transparent);
    }
    .dx-empty {
      background: color-mix(in srgb, #fff 4%, transparent);
    }
    .dx-skip td {
      padding: 0.25rem 0.5rem;
      color: var(--band-dark-muted);
      font-style: italic;
      text-align: center;
      background: color-mix(in srgb, #fff 5%, transparent);
    }
    /* Not colour only: removed text is struck through and added text underlined, besides the +/- markers. */
    del.dx-d {
      background: color-mix(in srgb, var(--error) 38%, transparent);
      text-decoration: line-through;
      text-decoration-thickness: 1px;
    }
    ins.dx-i {
      background: color-mix(in srgb, var(--success) 34%, transparent);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .dx-cols {
      display: grid;
      gap: 0.75rem;
    }
    @media (min-width: 48rem) {
      .dx-cols {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .dx-colhead {
      margin: 0 0 0.375rem;
      color: var(--band-dark-muted);
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .dx-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      margin: 0 0 0.75rem;
      color: var(--band-dark-muted);
      font-size: var(--text-xs);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="text-diff-checker">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Original">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="file-text" label="Example" (pressed)="loadSample()" />
              <app-tool-button size="small" icon="git-compare" label="Swap" [disabled]="!hasText()" (pressed)="swap()" />
              <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!hasText()" (pressed)="clear()" />
            </ng-container>
            <app-tool-textarea fieldId="diff-a" label="Original text" placeholder="Paste the original text" [control]="aCtl" [rows]="11" [wrap]="true" [mono]="false" />
          </app-tool-panel>
          <app-tool-panel title="Modified">
            <app-tool-textarea fieldId="diff-b" label="Modified text" placeholder="Paste the changed text" [control]="bCtl" [rows]="11" [wrap]="true" [mono]="false" />
          </app-tool-panel>
        </div>

        <app-tool-panel title="Compare">
          <div class="tool-controls">
            <app-tool-select fieldId="diff-mode" label="Compare by" [control]="modeCtl" [options]="modes" />
            <app-tool-select fieldId="diff-view" label="View" [control]="viewCtl" [options]="views" />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="diff-ws" label="Ignore whitespace" hint="Extra spaces, tabs and line breaks do not count" [control]="wsCtl" />
            <app-tool-toggle fieldId="diff-case" label="Ignore case" hint="Hello and hello are equal" [control]="caseCtl" />
            @if (mode() === 'lines') {
              <app-tool-toggle fieldId="diff-all" label="Show unchanged lines" hint="Otherwise long unchanged stretches are folded" [control]="allCtl" />
            }
          </div>

          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          @if (busy()) {
            <app-tool-note kind="info">Comparing...</app-tool-note>
          }

          @if (result(); as r) {
            @if (r.identical) {
              <app-tool-note kind="success">The two texts are identical{{ wsCtl.value || caseCtl.value ? ' with the current options' : '' }}.</app-tool-note>
            } @else {
              <app-tool-output
                label="Differences"
                copyLabel="Copy unified patch"
                [copyText]="patch()"
                [meta]="summary()"
                (copied)="trackCopy()"
              >
                <p class="dx-legend" aria-label="Legend">
                  <span><strong aria-hidden="true">+</strong> added</span>
                  <span><strong aria-hidden="true">-</strong> removed</span>
                  <span>Removed text is struck through, added text is underlined.</span>
                </p>
                @if (r.approximate) {
                  <app-tool-note kind="warn">
                    These texts are very different or very large, so some blocks are shown as fully replaced instead of compared inside.
                  </app-tool-note>
                }
                @if (mode() === 'lines') {
                  @if (view() === 'side') {
                    <div class="dx-wrap">
                      <table class="dx">
                        <caption class="sr-only">Side by side comparison. Each row shows the original line on the left and the modified line on the right.</caption>
                        <thead class="sr-only">
                          <tr><th>Original line</th><th>Marker</th><th>Original text</th><th>Modified line</th><th>Marker</th><th>Modified text</th></tr>
                        </thead>
                        <tbody>
                          @for (row of sideRows(); track $index) {
                            @if (isSkipRow(row)) {
                              <tr class="dx-skip"><td colspan="6">{{ row.skip }} unchanged {{ row.skip === 1 ? 'line' : 'lines' }} hidden</td></tr>
                            } @else {
                              <tr>
                                @if (row.left; as c) {
                                  <td class="dx-no" [class.dx-del]="c.type === 'del'">{{ c.no }}</td>
                                  <td class="dx-mark" [class.dx-del]="c.type === 'del'"><span aria-hidden="true">{{ c.type === 'del' ? '-' : '' }}</span>@if (c.type === 'del') {<span class="sr-only">Removed</span>}</td>
                                  <td class="dx-text" [class.dx-del]="c.type === 'del'">@if (c.segs) {@for (s of c.segs; track $index) {@if (s.type === 'del') {<del class="dx-d">{{ s.text }}</del>} @else {<span>{{ s.text }}</span>}}} @else {<span>{{ c.text }}</span>}</td>
                                } @else {
                                  <td class="dx-no dx-empty"></td><td class="dx-mark dx-empty"></td><td class="dx-text dx-empty"></td>
                                }
                                @if (row.right; as c) {
                                  <td class="dx-no" [class.dx-add]="c.type === 'add'">{{ c.no }}</td>
                                  <td class="dx-mark" [class.dx-add]="c.type === 'add'"><span aria-hidden="true">{{ c.type === 'add' ? '+' : '' }}</span>@if (c.type === 'add') {<span class="sr-only">Added</span>}</td>
                                  <td class="dx-text" [class.dx-add]="c.type === 'add'">@if (c.segs) {@for (s of c.segs; track $index) {@if (s.type === 'add') {<ins class="dx-i">{{ s.text }}</ins>} @else {<span>{{ s.text }}</span>}}} @else {<span>{{ c.text }}</span>}</td>
                                } @else {
                                  <td class="dx-no dx-empty"></td><td class="dx-mark dx-empty"></td><td class="dx-text dx-empty"></td>
                                }
                              </tr>
                            }
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="dx-wrap">
                      <table class="dx">
                        <caption class="sr-only">Unified comparison. Lines starting with a minus were removed, lines starting with a plus were added.</caption>
                        <thead class="sr-only">
                          <tr><th>Original line</th><th>Modified line</th><th>Marker</th><th>Text</th></tr>
                        </thead>
                        <tbody>
                          @for (row of unifiedRows(); track $index) {
                            @if (isSkipRow(row)) {
                              <tr class="dx-skip"><td colspan="4">{{ row.skip }} unchanged {{ row.skip === 1 ? 'line' : 'lines' }} hidden</td></tr>
                            } @else {
                              <tr [class.dx-add]="row.type === 'add'" [class.dx-del]="row.type === 'del'">
                                <td class="dx-no">{{ row.oldNo }}</td>
                                <td class="dx-no">{{ row.newNo }}</td>
                                <td class="dx-mark"><span aria-hidden="true">{{ row.type === 'add' ? '+' : row.type === 'del' ? '-' : '' }}</span>@if (row.type !== 'eq') {<span class="sr-only">{{ row.type === 'add' ? 'Added' : 'Removed' }}</span>}</td>
                                <td class="dx-text">{{ row.text }}</td>
                              </tr>
                            }
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  @if (rowsHidden() > 0) {
                    <app-tool-note kind="info">Showing the first {{ maxRows }} rows. The copied patch contains every change.</app-tool-note>
                  }
                } @else if (r.segments) {
                  @if (view() === 'side') {
                    <div class="dx-cols">
                      <div>
                        <p class="dx-colhead">Original</p>
                        <pre class="tool-code">@for (s of left().segs; track $index) {@if (s.type === 'del') {<del class="dx-d"><span class="sr-only">[removed: </span>{{ s.text }}<span class="sr-only">]</span></del>} @else {<span>{{ s.text }}</span>}}</pre>
                      </div>
                      <div>
                        <p class="dx-colhead">Modified</p>
                        <pre class="tool-code">@for (s of right().segs; track $index) {@if (s.type === 'add') {<ins class="dx-i"><span class="sr-only">[added: </span>{{ s.text }}<span class="sr-only">]</span></ins>} @else {<span>{{ s.text }}</span>}}</pre>
                      </div>
                    </div>
                  } @else {
                    <pre class="tool-code">@for (s of inline().segs; track $index) {@if (s.type === 'del') {<del class="dx-d"><span class="sr-only">[removed: </span>{{ s.text }}<span class="sr-only">]</span></del>} @else if (s.type === 'add') {<ins class="dx-i"><span class="sr-only">[added: </span>{{ s.text }}<span class="sr-only">]</span></ins>} @else {<span>{{ s.text }}</span>}}</pre>
                  }
                  @if (hiddenSegments() > 0) {
                    <app-tool-note kind="info">Showing the first {{ maxSegments }} changed or unchanged parts ({{ hiddenSegments() }} more not drawn). Switch to line mode for the full patch.</app-tool-note>
                  }
                }
              </app-tool-output>
            }
          } @else if (!busy() && !error()) {
            <app-tool-empty icon="diff">Paste text in both boxes. The differences appear here as you type, with +/- markers as well as colour.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class TextDiffCheckerTool {
  private readonly markUsed = toolUsage('text-diff-checker');
  protected readonly trackCopy = toolCopied('text-diff-checker');

  protected readonly modes = MODES;
  protected readonly views = VIEWS;
  protected readonly maxRows = MAX_ROWS;
  protected readonly maxSegments = MAX_SEGMENTS;
  protected readonly isSkipRow = isSkip;

  protected readonly aCtl = new FormControl('', { nonNullable: true });
  protected readonly bCtl = new FormControl('', { nonNullable: true });
  protected readonly modeCtl = new FormControl<string>('lines', { nonNullable: true });
  protected readonly viewCtl = new FormControl<string>('side', { nonNullable: true });
  protected readonly wsCtl = new FormControl(false, { nonNullable: true });
  protected readonly caseCtl = new FormControl(false, { nonNullable: true });
  protected readonly allCtl = new FormControl(false, { nonNullable: true });

  private readonly a = debouncedControlSignal(this.aCtl);
  private readonly b = debouncedControlSignal(this.bCtl);
  protected readonly mode = controlSignal(this.modeCtl);
  protected readonly view = controlSignal(this.viewCtl);
  private readonly ws = controlSignal(this.wsCtl);
  private readonly ic = controlSignal(this.caseCtl);
  private readonly showAll = controlSignal(this.allCtl);

  protected readonly result = signal<DiffResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly diffFn = signal<DiffFn | null>(null);
  private seq = 0;

  protected readonly hasText = computed(() => !!(this.a() || this.b()));
  private readonly options = computed<DiffOptions>(() => ({
    mode: this.mode() as DiffMode,
    ignoreWhitespace: this.ws(),
    ignoreCase: this.ic(),
    budgetMs: this.a().length + this.b().length > 400_000 ? 1500 : 2500,
  }));

  protected readonly summary = computed(() => {
    const s = this.result()?.stats;
    if (!s) return '';
    return `+${s.added.toLocaleString('en-US')} added, -${s.removed.toLocaleString('en-US')} removed (${s.unit})`;
  });
  protected readonly patch = computed(() => {
    const r = this.result();
    return r ? buildUnifiedPatch(r.ops) : '';
  });

  private readonly allSideRows = computed<SideRow[]>(() => {
    const r = this.result();
    if (!r || r.mode !== 'lines') return [];
    return sideBySideRows(this.diffFn(), r.ops, this.options());
  });
  private readonly sideCollapsed = computed(() =>
    collapseUnchanged(this.allSideRows(), (row) => row.left?.type !== 'eq' || row.right?.type !== 'eq', this.showAll() ? Infinity : CONTEXT),
  );
  protected readonly sideRows = computed(() => this.sideCollapsed().slice(0, MAX_ROWS));
  private readonly unifiedCollapsed = computed(() =>
    collapseUnchanged<LineOp>(this.result()?.ops ?? [], (op) => op.type !== 'eq', this.showAll() ? Infinity : CONTEXT),
  );
  protected readonly unifiedRows = computed(() => this.unifiedCollapsed().slice(0, MAX_ROWS));
  protected readonly rowsHidden = computed(() =>
    Math.max(0, (this.view() === 'side' ? this.sideCollapsed().length : this.unifiedCollapsed().length) - MAX_ROWS),
  );

  private readonly sides = computed(() => sideSegments(this.result()?.segments ?? []));
  protected readonly left = computed(() => limitSegments(this.sides().left, MAX_SEGMENTS));
  protected readonly right = computed(() => limitSegments(this.sides().right, MAX_SEGMENTS));
  protected readonly inline = computed(() => limitSegments(this.result()?.segments ?? [], MAX_SEGMENTS));
  protected readonly hiddenSegments = computed(() =>
    this.view() === 'side' ? Math.max(this.left().hidden, this.right().hidden) : this.inline().hidden,
  );

  constructor() {
    effect(() => {
      const a = this.a();
      const b = this.b();
      const options = this.options();
      untracked(() => void this.run(a, b, options));
    });
  }

  protected loadSample(): void {
    this.aCtl.setValue(SAMPLE_A);
    this.bCtl.setValue(SAMPLE_B);
  }

  protected swap(): void {
    const a = this.aCtl.value;
    this.aCtl.setValue(this.bCtl.value);
    this.bCtl.setValue(a);
  }

  protected clear(): void {
    this.aCtl.setValue('');
    this.bCtl.setValue('');
  }

  private async run(a: string, b: string, options: DiffOptions): Promise<void> {
    const id = ++this.seq;
    this.error.set('');
    if (!a && !b) {
      this.result.set(null);
      this.busy.set(false);
      return;
    }
    this.markUsed();
    this.busy.set(true);
    try {
      let fn = this.diffFn();
      if (!fn) {
        // jsdiff is loaded on first use so it lands in its own lazy chunk.
        fn = (await import('diff')).diffArrays as DiffFn;
        this.diffFn.set(fn);
      }
      await yieldToBrowser();
      if (id !== this.seq) return;
      const result = computeDiff(fn, a, b, options);
      if (id !== this.seq) return;
      this.result.set(result);
    } catch {
      if (id === this.seq) {
        this.result.set(null);
        this.error.set('These texts could not be compared. Try line mode, or compare smaller parts.');
      }
    } finally {
      if (id === this.seq) this.busy.set(false);
    }
  }
}
