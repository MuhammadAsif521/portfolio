import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolCopy } from '../../../../../ui/tool-kit/tool-copy';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { yieldToMain } from '../dev-utils';
import { JsonEngine } from './json-engine';
import {
  toDotPath,
  toJsonPath,
  type JsonErrorInfo,
  type JsonPath,
  type JsonRow,
  type JsonSearchHit,
  type JsonSearchResult,
  type JsonStats,
  type LoadResult,
} from './json-logic';
import { ancestorPaths, flatten, pathKey, windowRange, type ChildPage, type FlatItem, type FlatNode } from './json-tree';

const ROW_HEIGHT = 28;
const VIEWPORT_HEIGHT = 448;
const PAGE = 200;
const MAX_FILE_MB = 100;
const EXPAND_BUDGET = 5000;
const HIT_PREVIEW = 40;

const SCOPES = [
  { id: 'both', name: 'Keys and values' },
  { id: 'keys', name: 'Keys only' },
  { id: 'values', name: 'Values only' },
];

const SAMPLE = JSON.stringify(
  {
    name: 'Asif Dev',
    active: true,
    score: 98.6,
    address: { city: 'Lahore', country: 'PK', geo: { lat: 31.5204, lng: 74.3587 } },
    skills: ['Angular', 'Node.js', 'MongoDB'],
    projects: [
      { id: 1, title: 'Portfolio', tags: ['ssr', 'seo'], live: true },
      { id: 2, title: 'API', tags: [], live: false, notes: null },
    ],
  },
  null,
  2,
);

const BADGE: Record<string, string> = { object: 'obj', array: 'arr', string: 'str', number: 'num', boolean: 'bool', null: 'null' };

/** /tools/json-viewer: a lazy, searchable tree for JSON of any size. The document is parsed and kept in a Web Worker. */
@Component({
  selector: 'app-json-viewer',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolTextarea,
    ToolInput,
    ToolSelect,
    ToolToggle,
    ToolButton,
    ToolCopy,
    ToolOutput,
    ToolKeyValue,
    ToolNote,
    ToolEmpty,
    CustomFileInputComponent,
  ],
  styleUrls: ['../../../tool-ui.scss', './json-viewer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="json-viewer">
      <div class="tool-stack">
        <app-tool-panel title="JSON source">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="loadSample()" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="state() === 'idle' && !source()" (pressed)="clear()" />
          </ng-container>
          <app-tool-textarea fieldId="jv-input" label="Paste JSON" placeholder='{"id": 1, "items": [1, 2, 3]}' [control]="sourceCtl" [rows]="6" [invalid]="state() === 'error'" />
          <div class="tool-actions">
            <app-tool-button kind="primary" icon="braces" label="View as tree" [loading]="state() === 'loading'" [disabled]="!source().trim()" (pressed)="viewPasted()" />
          </div>
          <app-custom-file-input
            controlName="jv-file"
            [label$]="fileLabel"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxFileMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            accept=".json,.geojson,.jsonl,application/json,text/plain"
            placeholder="Or choose a .json file (up to 100 MB)"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Files are read and parsed in your browser, in a background worker, and never uploaded.</p>
          @if (loadError(); as err) {
            <app-tool-note kind="error">
              <strong>Invalid JSON</strong> at line {{ err.line }}, column {{ err.column }}: {{ err.message }}.
            </app-tool-note>
            @if (errorSnippet()) {
              <app-tool-output label="Where it breaks" [value]="errorSnippet()" [copyText]="''" />
            }
          }
          @if (notice()) {
            <app-tool-note kind="info">{{ notice() }}</app-tool-note>
          }
        </app-tool-panel>

        @if (state() === 'ready') {
          <app-tool-panel [title]="'Tree' + (sourceName() ? ': ' + sourceName() : '')">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="chevron-down" label="Collapse all" (pressed)="collapseAll()" />
            </ng-container>

            <div class="jv-toolbar">
              <app-tool-input fieldId="jv-search" label="Search" placeholder="key or value" [control]="searchCtl" [mono]="false" />
              <app-tool-select fieldId="jv-scope" label="Search in" [control]="scopeCtl" [options]="scopes" />
              <app-tool-toggle fieldId="jv-case" label="Match case" [control]="caseCtl" />
              <app-tool-input fieldId="jv-level" label="Expand to level (1-20)" type="number" inputMode="numeric" [min]="1" [max]="20" [mono]="false" [control]="levelCtl" />
              <div class="tool-actions">
                <app-tool-button size="small" icon="chevrons-down-up" label="Expand to level" [loading]="expanding()" (pressed)="expandToLevel()" />
              </div>
            </div>

            @if (searchSummary()) {
              <p class="jv-search-info" role="status">{{ searchSummary() }}</p>
              <ul class="jv-hits" aria-label="Search results">
                @for (hit of shownHits(); track $index) {
                  <li>
                    <button type="button" class="tool-chip-button" (click)="reveal(hit.path)">{{ hitLabel(hit) }}</button>
                  </li>
                }
              </ul>
            }

            <nav aria-label="Path of the selected value">
              <ol class="jv-crumbs">
                @for (crumb of crumbs(); track $index) {
                  <li><button type="button" class="jv-crumb" (click)="reveal(crumb.path)">{{ crumb.label }}</button></li>
                }
              </ol>
            </nav>

            <div
              #viewport
              class="jv-tree"
              role="tree"
              tabindex="0"
              aria-label="JSON tree. Use the arrow keys to move, right and left to expand and collapse, Enter to select."
              [attr.aria-activedescendant]="activeId()"
              (scroll)="onScroll()"
              (keydown)="onKey($event)"
            >
              <div class="jv-rows" [style.padding-top.px]="padTop()" [style.padding-bottom.px]="padBottom()">
                @for (item of visible(); track item.id) {
                  @if (item.kind === 'node') {
                    <div
                      class="jv-row"
                      role="treeitem"
                      [id]="'jv-row-' + flatIndex(item)"
                      [attr.aria-level]="item.depth + 1"
                      [attr.aria-expanded]="item.isContainer ? item.expanded : null"
                      [attr.aria-selected]="isSelected(item)"
                      [class.jv-row--active]="flatIndex(item) === activeIndex()"
                      [class.jv-row--selected]="isSelected(item)"
                      [style.padding-left.rem]="0.5 + item.depth * 1.25"
                      (click)="onRowClick(item)"
                    >
                      @if (item.isContainer) {
                        <button type="button" class="jv-twist" tabindex="-1" [attr.aria-label]="(item.expanded ? 'Collapse ' : 'Expand ') + keyLabel(item)" (click)="onTwistClick($event, item)">{{ item.expanded ? '▾' : '▸' }}</button>
                      } @else {
                        <span class="jv-twist jv-twist--empty" aria-hidden="true">▸</span>
                      }
                      <span class="jv-key">{{ keyLabel(item) }}</span>
                      <span class="jv-colon" aria-hidden="true">:</span>
                      <span class="jv-value" [class]="'jv-value--' + item.type">{{ item.preview }}</span>
                      <span class="jv-badge">{{ badge(item.type) }}</span>
                    </div>
                  } @else {
                    <div class="jv-row" role="treeitem" [attr.aria-level]="item.depth + 1" [style.padding-left.rem]="0.5 + item.depth * 1.25 + 1.5">
                      <button type="button" class="jv-more" tabindex="-1" (click)="loadMore(item.path)">Show {{ item.remaining > pageSize ? pageSize : item.remaining }} more of {{ item.remaining }}</button>
                    </div>
                  }
                }
              </div>
            </div>
          </app-tool-panel>

          <div class="tool-split">
            <app-tool-panel title="Selected value">
              @if (selected()) {
                <div class="jv-selection">
                  <div class="jv-paths">
                    <div class="jv-path">
                      <app-tool-copy label="Copy JSONPath" [text]="jsonPath()" (copied)="trackCopy()" />
                      <code>{{ jsonPath() }}</code>
                    </div>
                    <div class="jv-path">
                      <app-tool-copy label="Copy dot path" [text]="dotPath()" (copied)="trackCopy()" />
                      <code>{{ dotPath() || '(root)' }}</code>
                    </div>
                  </div>
                  <div class="tool-actions">
                    <app-tool-button size="small" icon="copy" [label]="valueCopied() ? 'Copied' : 'Copy value as JSON'" (pressed)="copyValue()" />
                  </div>
                  @if (valueNote()) {
                    <app-tool-note kind="warn">{{ valueNote() }}</app-tool-note>
                  }
                </div>
              } @else {
                <app-tool-empty icon="braces">Click a row to see its path and copy it as JSONPath, a dot path, or the value itself.</app-tool-empty>
              }
            </app-tool-panel>

            <app-tool-panel title="Document stats">
              @if (statRows().length) {
                <app-tool-output label="Statistics" [meta]="engineNote()">
                  <app-tool-key-value [rows]="statRows()" />
                </app-tool-output>
              }
            </app-tool-panel>
          </div>
        } @else if (state() === 'loading') {
          <app-tool-note kind="info">Parsing in the background. The page stays responsive while large files load.</app-tool-note>
        } @else if (state() === 'idle') {
          <app-tool-empty icon="braces">Paste JSON or choose a file above to explore it as a collapsible tree with search and copyable paths.</app-tool-empty>
        }
      </div>
    </app-tool-layout>
  `,
})
export class JsonViewerTool {
  private readonly markUsed = toolUsage('json-viewer');
  protected readonly trackCopy = toolCopied('json-viewer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');

  protected readonly scopes = SCOPES;
  protected readonly maxFileMb = MAX_FILE_MB;
  protected readonly pageSize = PAGE;
  protected readonly fileLabel = of('JSON file');

  protected readonly sourceCtl = new FormControl('', { nonNullable: true });
  protected readonly searchCtl = new FormControl('', { nonNullable: true });
  protected readonly scopeCtl = new FormControl('both', { nonNullable: true });
  protected readonly caseCtl = new FormControl(false, { nonNullable: true });
  protected readonly levelCtl = new FormControl('2', { nonNullable: true });
  protected readonly source = controlSignal(this.sourceCtl);

  protected readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly loadError = signal<JsonErrorInfo | null>(null);
  protected readonly errorSnippet = signal('');
  protected readonly notice = signal('');
  protected readonly sourceName = signal('');
  protected readonly stats = signal<JsonStats | null>(null);
  protected readonly expanding = signal(false);
  protected readonly searchSummary = signal('');
  protected readonly hits = signal<JsonSearchHit[]>([]);
  protected readonly selected = signal<JsonPath | null>(null);
  protected readonly valueCopied = signal(false);
  protected readonly valueNote = signal('');

  private engine: JsonEngine | null = null;
  private lastText = '';
  private loadRun = 0;
  private searchRun = 0;
  private readonly rootRow = signal<JsonRow | null>(null);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  private readonly cache = new Map<string, ChildPage>();
  private readonly cacheVersion = signal(0);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly flat = computed<FlatItem[]>(() => {
    this.cacheVersion();
    const root = this.rootRow();
    return root ? flatten(root, this.expanded(), this.cache) : [];
  });
  private readonly scrollTop = signal(0);
  private readonly range = computed(() => windowRange(this.scrollTop(), ROW_HEIGHT, VIEWPORT_HEIGHT, this.flat().length));
  protected readonly visible = computed(() => this.flat().slice(this.range().start, this.range().end));
  protected readonly padTop = computed(() => this.range().start * ROW_HEIGHT);
  protected readonly padBottom = computed(() => (this.flat().length - this.range().end) * ROW_HEIGHT);
  protected readonly activeIndex = signal(0);
  protected readonly activeId = computed(() => (this.state() === 'ready' ? `jv-row-${this.activeIndex()}` : null));
  private readonly indexById = computed(() => new Map(this.flat().map((item, i) => [item.id, i] as const)));

  protected readonly shownHits = computed(() => this.hits().slice(0, 50));
  protected readonly crumbs = computed(() => {
    const path = this.selected() ?? [];
    return [{ label: '$', path: [] as JsonPath }, ...path.map((part, i) => ({ label: typeof part === 'number' ? `[${part}]` : String(part), path: path.slice(0, i + 1) }))];
  });
  protected readonly jsonPath = computed(() => toJsonPath(this.selected() ?? []));
  protected readonly dotPath = computed(() => toDotPath(this.selected() ?? []));

  protected readonly statRows = computed<ToolRow[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const n = (v: number) => v.toLocaleString('en-US');
    return [
      { label: 'Size', value: formatBytes(s.bytes) },
      { label: 'Depth', value: n(s.depth) },
      { label: 'Values', value: n(s.nodes) },
      { label: 'Object keys', value: n(s.keys) },
      { label: 'Objects', value: n(s.objects) },
      { label: 'Arrays', value: n(s.arrays) },
      { label: 'Strings', value: n(s.strings) },
      { label: 'Numbers', value: n(s.numbers) },
      { label: 'Booleans', value: n(s.booleans) },
      { label: 'Nulls', value: n(s.nulls) },
      ...(s.longestArray ? [{ label: 'Longest array', value: `${n(s.longestArray.length)} items at ${s.longestArray.path}` }] : []),
    ];
  });
  protected readonly engineNote = computed(() => (this.engine?.usingFallback ? 'Parsed on the page (no worker available)' : 'Parsed in a background worker'));

  constructor() {
    this.searchCtl.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => void this.runSearch());
    this.scopeCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => void this.runSearch());
    this.caseCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => void this.runSearch());
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.copiedTimer);
      this.engine?.dispose();
    });
  }

  // Loading ---------------------------------------------------------------------------------------------------------

  protected loadSample(): void {
    this.sourceCtl.setValue(SAMPLE);
    void this.load(SAMPLE, 'sample.json');
  }

  protected viewPasted(): void {
    void this.load(this.sourceCtl.value, '');
  }

  protected clear(): void {
    this.sourceCtl.setValue('');
    this.reset();
    this.state.set('idle');
    this.loadError.set(null);
    this.notice.set('');
    this.engine?.dispose();
    this.engine = null;
  }

  protected async onFile(picked: File | null): Promise<void> {
    if (!picked) return;
    this.notice.set('');
    if (picked.size === 0) {
      this.state.set('error');
      this.loadError.set({ offset: 0, line: 1, column: 1, message: 'The file is empty' });
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      this.notice.set(`That file is larger than ${MAX_FILE_MB} MB. Use a command-line tool such as jq for files this big.`);
      return;
    }
    try {
      const text = await picked.text();
      await this.load(text, picked.name);
      if (picked.size < 200_000) this.sourceCtl.setValue(text, { emitEvent: false });
    } catch {
      this.state.set('error');
      this.notice.set('Could not read that file.');
    }
  }

  private reset(): void {
    this.rootRow.set(null);
    this.stats.set(null);
    this.cache.clear();
    this.expanded.set(new Set());
    this.cacheVersion.update((v) => v + 1);
    this.selected.set(null);
    this.hits.set([]);
    this.searchSummary.set('');
    this.activeIndex.set(0);
    this.scrollTop.set(0);
    this.valueNote.set('');
  }

  private async load(text: string, name: string): Promise<void> {
    const run = ++this.loadRun;
    this.state.set('loading');
    this.loadError.set(null);
    this.errorSnippet.set('');
    this.notice.set('');
    this.sourceName.set(name);
    this.reset();
    await yieldToMain();
    this.engine?.dispose();
    // The literal must sit here so the Angular build recognises and bundles the worker.
    this.engine = new JsonEngine(() => new Worker(new URL('./json-viewer.worker', import.meta.url), { type: 'module' }));
    this.lastText = text;
    try {
      const result = await this.engine.request<LoadResult>({ method: 'load', text });
      if (run !== this.loadRun) return;
      if (!result.ok) {
        this.state.set('error');
        this.loadError.set(result.error);
        this.errorSnippet.set(this.snippetFor(text, result.error));
        return;
      }
      const root = await this.engine.request<JsonRow>({ method: 'rootRow' });
      if (run !== this.loadRun) return;
      this.stats.set(result.stats);
      this.rootRow.set(root);
      await this.openNode([], PAGE);
      const open = new Set<string>();
      open.add(pathKey([]));
      this.expanded.set(open);
      this.cacheVersion.update((v) => v + 1);
      this.selected.set([]);
      this.state.set('ready');
      this.markUsed();
      if (this.searchCtl.value) void this.runSearch();
    } catch {
      if (run !== this.loadRun) return;
      this.state.set('error');
      this.notice.set('The viewer could not process this file. Try a smaller one, or reload the page.');
    }
  }

  private snippetFor(text: string, err: JsonErrorInfo): string {
    const start = Math.max(0, err.offset - 60);
    const end = Math.min(text.length, err.offset + 60);
    const before = text.slice(start, err.offset).split('\n').pop() ?? '';
    const after = text.slice(err.offset, end).split('\n')[0];
    return `${start > 0 ? '…' : ''}${before}${after}${end < text.length ? '…' : ''}\n${' '.repeat((start > 0 ? 1 : 0) + before.length)}^`;
  }

  // Tree ------------------------------------------------------------------------------------------------------------

  protected keyLabel(item: FlatNode): string {
    return item.depth === 0 ? 'root' : typeof item.key === 'number' ? `[${item.key}]` : item.key;
  }

  protected badge(type: string): string {
    return BADGE[type] ?? type;
  }

  protected flatIndex(item: FlatItem): number {
    return this.indexById().get(item.id) ?? -1;
  }

  protected isSelected(item: FlatNode): boolean {
    const sel = this.selected();
    return !!sel && pathKey(sel) === item.id;
  }

  private async openNode(path: JsonPath, limit: number): Promise<ChildPage> {
    const key = pathKey(path);
    const cached = this.cache.get(key);
    if (cached && (cached.rows.length >= Math.min(limit, cached.total) || cached.rows.length === cached.total)) return cached;
    const page = await this.engine!.request<ChildPage>({ method: 'children', path, offset: 0, limit });
    this.cache.set(key, page);
    this.cacheVersion.update((v) => v + 1);
    return page;
  }

  protected async toggle(item: FlatNode): Promise<void> {
    const key = item.id;
    const next = new Set(this.expanded());
    if (next.has(key)) {
      next.delete(key);
    } else {
      await this.openNode(item.path, PAGE);
      next.add(key);
    }
    this.expanded.set(next);
  }

  protected onTwistClick(event: Event, item: FlatNode): void {
    event.stopPropagation();
    this.activeIndex.set(this.flatIndex(item));
    void this.toggle(item);
  }

  protected onRowClick(item: FlatNode): void {
    this.activeIndex.set(this.flatIndex(item));
    this.selected.set(item.path);
    this.valueNote.set('');
    this.viewport()?.nativeElement.focus({ preventScroll: true });
  }

  protected async loadMore(path: JsonPath): Promise<void> {
    const key = pathKey(path);
    const have = this.cache.get(key)?.rows.length ?? 0;
    const page = await this.engine!.request<ChildPage>({ method: 'children', path, offset: have, limit: PAGE });
    const prev = this.cache.get(key);
    if (prev) this.cache.set(key, { total: page.total, rows: [...prev.rows, ...page.rows] });
    this.cacheVersion.update((v) => v + 1);
  }

  protected collapseAll(): void {
    this.expanded.set(new Set([pathKey([])]));
    this.activeIndex.set(0);
    this.viewport()?.nativeElement.scrollTo({ top: 0 });
    this.scrollTop.set(0);
  }

  protected async expandToLevel(): Promise<void> {
    if (!this.engine || this.expanding()) return;
    const levels = Math.min(20, Math.max(1, Math.floor(Number(this.levelCtl.value)) || 1));
    this.expanding.set(true);
    try {
      const open = new Set<string>();
      let frontier: JsonPath[] = [[]];
      let budget = EXPAND_BUDGET;
      let cut = false;
      for (let depth = 0; depth < levels && frontier.length && !cut; depth++) {
        const pages = await Promise.all(frontier.map((p) => this.openNode(p, PAGE)));
        const next: JsonPath[] = [];
        for (let i = 0; i < frontier.length; i++) {
          if (budget <= 0) {
            cut = true;
            break;
          }
          open.add(pathKey(frontier[i]));
          budget -= pages[i].rows.length;
          for (const row of pages[i].rows) if (row.count > 0) next.push([...frontier[i], row.key]);
        }
        frontier = next;
      }
      this.expanded.set(open);
      this.notice.set(cut ? `Stopped after ${EXPAND_BUDGET.toLocaleString('en-US')} rows to keep the page quick. Expand the rest by hand or use a lower level.` : '');
      this.activeIndex.set(0);
      this.scrollTop.set(0);
      this.viewport()?.nativeElement.scrollTo({ top: 0 });
    } finally {
      this.expanding.set(false);
    }
  }

  protected onScroll(): void {
    this.scrollTop.set(this.viewport()?.nativeElement.scrollTop ?? 0);
  }

  protected onKey(event: KeyboardEvent): void {
    const flat = this.flat();
    if (!flat.length) return;
    const index = Math.min(this.activeIndex(), flat.length - 1);
    const item = flat[index];
    const move = (to: number) => {
      const i = Math.max(0, Math.min(flat.length - 1, to));
      this.activeIndex.set(i);
      this.scrollIntoView(i);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(index + 1);
        break;
      case 'ArrowUp':
        move(index - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(flat.length - 1);
        break;
      case 'PageDown':
        move(index + Math.floor(VIEWPORT_HEIGHT / ROW_HEIGHT));
        break;
      case 'PageUp':
        move(index - Math.floor(VIEWPORT_HEIGHT / ROW_HEIGHT));
        break;
      case 'ArrowRight':
        if (item.kind === 'node' && item.isContainer) {
          if (!item.expanded) void this.toggle(item);
          else move(index + 1);
        }
        break;
      case 'ArrowLeft':
        if (item.kind === 'node' && item.expanded) void this.toggle(item);
        else if (item.kind === 'node' && item.depth > 0) {
          const parent = this.indexById().get(pathKey(item.path.slice(0, -1)));
          if (parent !== undefined) move(parent);
        }
        break;
      case 'Enter':
      case ' ':
        if (item.kind === 'node') {
          this.selected.set(item.path);
          this.valueNote.set('');
        } else void this.loadMore(item.path);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private scrollIntoView(index: number): void {
    const el = this.viewport()?.nativeElement;
    if (!el) return;
    const top = index * ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + VIEWPORT_HEIGHT) el.scrollTop = top + ROW_HEIGHT - VIEWPORT_HEIGHT;
    this.scrollTop.set(el.scrollTop);
  }

  /** Opens every ancestor of a path, selects it and scrolls it into view. */
  protected async reveal(path: JsonPath): Promise<void> {
    if (!this.engine) return;
    const open = new Set(this.expanded());
    for (const ancestor of ancestorPaths(path)) {
      const next = path[ancestor.length];
      const key = pathKey(ancestor);
      let page = await this.openNode(ancestor, PAGE);
      if (!page.rows.some((r) => r.key === next)) {
        // The child is beyond the loaded rows: load enough rows to include it.
        const need = typeof next === 'number' ? next + PAGE : Math.min(page.total, 200_000);
        page = await this.openNode(ancestor, need);
      }
      open.add(key);
    }
    this.expanded.set(open);
    this.selected.set(path);
    this.valueNote.set('');
    const index = this.indexById().get(pathKey(path));
    if (index !== undefined) {
      this.activeIndex.set(index);
      const el = this.viewport()?.nativeElement;
      if (el) {
        const target = Math.max(0, index * ROW_HEIGHT - VIEWPORT_HEIGHT / 2);
        // Let the padding for the new row count render first: the scroll box cannot scroll past its old height.
        this.scrollTop.set(target);
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        el.scrollTop = target;
        this.scrollTop.set(el.scrollTop);
      }
    }
  }

  // Search ----------------------------------------------------------------------------------------------------------

  private async runSearch(): Promise<void> {
    const run = ++this.searchRun;
    const query = this.searchCtl.value;
    if (!this.engine || this.state() !== 'ready' || !query) {
      this.hits.set([]);
      this.searchSummary.set('');
      return;
    }
    try {
      const result = await this.engine.request<JsonSearchResult>({
        method: 'search',
        query,
        scope: this.scopeCtl.value as 'keys' | 'values' | 'both',
        caseSensitive: this.caseCtl.value,
        limit: 500,
      });
      if (run !== this.searchRun) return;
      this.hits.set(result.hits);
      const n = result.hits.length;
      this.searchSummary.set(
        n === 0
          ? 'No matches.'
          : `${n}${result.truncated ? '+' : ''} ${n === 1 ? 'match' : 'matches'}${n > 50 ? ', showing the first 50' : ''}. Click one to jump to it.`,
      );
    } catch {
      if (run === this.searchRun) this.searchSummary.set('Search failed. Try again.');
    }
  }

  protected hitLabel(hit: JsonSearchHit): string {
    const path = toDotPath(hit.path) || '(root)';
    const label = `${hit.in === 'key' ? 'key' : 'value'} ${path}`;
    return label.length > HIT_PREVIEW + 12 ? `${label.slice(0, HIT_PREVIEW + 12)}…` : label;
  }

  // Selection -------------------------------------------------------------------------------------------------------

  protected async copyValue(): Promise<void> {
    const path = this.selected();
    if (!path || !this.engine) return;
    this.valueNote.set('');
    try {
      const { text, truncated } = await this.engine.request<{ text: string; truncated: boolean }>({ method: 'stringify', path });
      await navigator.clipboard.writeText(text);
      this.valueCopied.set(true);
      this.trackCopy();
      if (truncated) this.valueNote.set('This value is very large, so only the first 2,000,000 characters were copied.');
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.valueCopied.set(false), 2200);
    } catch {
      this.valueNote.set('Copy failed. Your browser may have blocked clipboard access.');
    }
  }
}
