import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { merge } from 'rxjs';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolChoice, ToolInput, ToolTextarea } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { MAX_MATCHES, highlightSegments, type RegexResult } from '../tool-logic-2';

const TIMEOUT_MS = 1000;
const FLAGS = ['g', 'i', 'm', 's', 'u', 'y', 'd'] as const;
const FLAG_OPTIONS = [
  { id: 'g', name: 'g global' },
  { id: 'i', name: 'i ignore case' },
  { id: 'm', name: 'm multiline' },
  { id: 's', name: 's dotAll' },
  { id: 'u', name: 'u unicode' },
  { id: 'y', name: 'y sticky' },
  { id: 'd', name: 'd indices' },
];

/**
 * The worker mirrors runRegex() in tool-logic-2.ts (which the unit tests cover). It runs in a Blob
 * worker so a catastrophically backtracking pattern can be terminated without freezing the page.
 */
const WORKER_SOURCE = `
self.onmessage = (e) => {
  const { pattern, flags, text, replacement, max } = e.data;
  try {
    const re = new RegExp(pattern, flags);
    const matches = [];
    let truncated = false;
    const toMatch = (m) => ({
      index: m.index,
      text: m[0],
      groups: [
        ...m.slice(1).map((value, i) => ({ name: String(i + 1), value })),
        ...Object.entries(m.groups || {}).map(([name, value]) => ({ name, value })),
      ],
    });
    if (re.global || re.sticky) {
      let m;
      while ((m = re.exec(text))) {
        matches.push(toMatch(m));
        if (m[0] === '') re.lastIndex++;
        if (matches.length >= max) { truncated = true; break; }
        if (!re.global) break;
      }
    } else {
      const m = re.exec(text);
      if (m) matches.push(toMatch(m));
    }
    const replaced = replacement === null ? null : text.replace(new RegExp(pattern, flags), replacement);
    self.postMessage({ ok: true, result: { matches, replaced, truncated } });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};`;


@Component({
  selector: 'app-regex-tester',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolTextarea, ToolChoice, ToolOutput, ToolNote, ToolEmpty],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="regex-tester">
      <div class="tool-split">
        <app-tool-panel title="Pattern and text">
          <app-tool-input
            fieldId="regex-pattern"
            label="Pattern"
            placeholder="(?<user>[\\w.]+)@(?<domain>[\\w.]+)"
            [control]="patternCtl"
            [invalid]="!!error()"
          />
          <app-tool-choice fieldId="regex-flags" label="Flags" kind="checkbox" [control]="flagsCtl" [options]="flagOptions" />
          <app-tool-textarea fieldId="regex-text" label="Test text" placeholder="Write or paste the text to search" [control]="textCtl" [rows]="8" [wrap]="true" />
          <app-tool-input
            fieldId="regex-replace"
            label="Replace with (optional)"
            hint="Supports $1 and $<name>"
            [control]="replaceCtl"
          />
        </app-tool-panel>

        <app-tool-panel title="Matches">
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          } @else if (result(); as r) {
            <app-tool-output
              label="Highlighted text"
              [copyText]="''"
              [meta]="r.matches.length + (r.matches.length === 1 ? ' match' : ' matches') + (r.truncated ? ' (stopped at ' + max + ')' : '')"
            >
              <pre class="tool-code">@for (seg of segments(); track $index) {@if (seg.match) {<mark class="tool-mark">{{ seg.text }}</mark>} @else {<span>{{ seg.text }}</span>}}</pre>
            </app-tool-output>
            @if (r.matches.length) {
              <app-tool-output label="Match details" [copyText]="''">
                <div class="tool-table-wrap">
                  <table class="tool-table">
                    <caption class="sr-only">Every match with its index and capture groups</caption>
                    <thead><tr><th scope="col">#</th><th scope="col">Index</th><th scope="col">Match</th><th scope="col">Groups</th></tr></thead>
                    <tbody>
                      @for (m of r.matches.slice(0, 200); track $index) {
                        <tr>
                          <td>{{ $index + 1 }}</td>
                          <td>{{ m.index }}</td>
                          <td><code>{{ m.text }}</code></td>
                          <td>
                            @for (g of m.groups; track g.name) {
                              <span class="tool-tag">{{ g.name }}: {{ g.value ?? 'undefined' }}</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </app-tool-output>
            }
            @if (r.replaced !== null) {
              <app-tool-output label="After replace" copyLabel="Copy result" [value]="r.replaced" (copied)="trackCopy()" />
            }
          } @else {
            <app-tool-empty icon="regex">Enter a pattern to see every match highlighted, with its capture groups.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class RegexTesterTool {
  private readonly markUsed = toolUsage('regex-tester');
  protected readonly trackCopy = toolCopied('regex-tester');
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  protected readonly flagOptions = FLAG_OPTIONS;
  protected readonly max = MAX_MATCHES;
  protected readonly patternCtl = new FormControl('', { nonNullable: true });
  protected readonly flagsCtl = new FormControl<string[]>(['g'], { nonNullable: true });
  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly replaceCtl = new FormControl('', { nonNullable: true });

  private readonly pattern = controlSignal(this.patternCtl);
  private readonly flagList = controlSignal(this.flagsCtl);
  private readonly text = controlSignal(this.textCtl);
  private readonly replacement = controlSignal(this.replaceCtl);
  /** Flags in canonical order, whatever order they were ticked in. */
  private readonly flags = computed(() => FLAGS.filter((f) => this.flagList().includes(f)).join(''));

  protected readonly result = signal<RegexResult | null>(null);
  protected readonly error = signal('');
  protected readonly segments = computed(() => highlightSegments(this.text(), this.result()?.matches ?? []));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    merge(this.patternCtl.valueChanges, this.flagsCtl.valueChanges, this.textCtl.valueChanges, this.replaceCtl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.run());
  }

  private stop(): void {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
  }

  private run(): void {
    this.stop();
    const pattern = this.pattern();
    if (!pattern) {
      this.result.set(null);
      this.error.set('');
      return;
    }
    this.markUsed();
    const id = ++this.seq;
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    this.worker = worker;
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: RegexResult; error?: string }>) => {
      if (id !== this.seq) return;
      this.stop();
      if (e.data.ok && e.data.result) {
        this.result.set(e.data.result);
        this.error.set('');
      } else {
        this.result.set(null);
        this.error.set(e.data.error ?? 'Invalid pattern');
      }
    };
    this.timer = setTimeout(() => {
      if (id !== this.seq) return;
      this.stop();
      this.result.set(null);
      this.error.set(`Stopped after ${TIMEOUT_MS / 1000} s: this pattern backtracks catastrophically on this text (ReDoS risk).`);
    }, TIMEOUT_MS);
    worker.postMessage({
      pattern,
      flags: this.flags(),
      text: this.text(),
      replacement: this.replacement() ? this.replacement() : null,
      max: MAX_MATCHES,
    });
  }
}
