import { ChangeDetectionStrategy, Component, DestroyRef, type WritableSignal, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { MAX_MATCHES, highlightSegments, type RegexResult } from '../tool-logic-2';

const TIMEOUT_MS = 1000;
const FLAGS = ['g', 'i', 'm', 's', 'u', 'y', 'd'] as const;

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
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="regex-tester">
      <div class="tool-row">
        <div class="tool-field tool-grow">
          <label class="tool-label" for="pattern">Pattern</label>
          <input id="pattern" class="tool-input" spellcheck="false" autocomplete="off" placeholder="(?<user>[\\w.]+)@(?<domain>[\\w.]+)"
            [value]="pattern()" (input)="set(pattern, $event)" />
        </div>
      </div>
      <div class="tool-row" role="group" aria-label="Flags">
        @for (f of flagList; track f) {
          <label class="tool-check"><input type="checkbox" [checked]="flags().includes(f)" (change)="toggleFlag(f)" /> {{ f }}</label>
        }
      </div>
      <div class="tool-field">
        <label class="tool-label" for="text">Test text</label>
        <textarea id="text" class="tool-textarea" spellcheck="false" [value]="text()" (input)="set(text, $event)"></textarea>
      </div>
      <div class="tool-field">
        <label class="tool-label" for="replace">Replace with (optional, supports $1 and $&lt;name&gt;)</label>
        <input id="replace" class="tool-input" spellcheck="false" autocomplete="off" [value]="replacement()" (input)="set(replacement, $event)" />
      </div>

      @if (error()) {
        <p class="tool-error" role="alert">{{ error() }}</p>
      } @else if (result(); as r) {
        <p class="tool-status" role="status">
          {{ r.matches.length }} {{ r.matches.length === 1 ? 'match' : 'matches' }}@if (r.truncated) { (stopped at {{ max }})}
        </p>
        <pre class="tool-output">@for (seg of segments(); track $index) {@if (seg.match) {<mark class="tool-mark">{{ seg.text }}</mark>} @else {<span>{{ seg.text }}</span>}}</pre>
        @if (r.matches.length) {
          <table class="tool-table">
            <thead><tr><th scope="col">#</th><th scope="col">Index</th><th scope="col">Match</th><th scope="col">Groups</th></tr></thead>
            <tbody>
              @for (m of r.matches.slice(0, 200); track $index) {
                <tr>
                  <td>{{ $index + 1 }}</td>
                  <td>{{ m.index }}</td>
                  <td><code>{{ m.text }}</code></td>
                  <td>
                    @for (g of m.groups; track g.name) {
                      <span class="tool-chip">{{ g.name }}: {{ g.value ?? 'undefined' }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (r.replaced !== null) {
          <h3 class="tool-label">After replace</h3>
          <pre class="tool-output">{{ r.replaced }}</pre>
        }
      }
    </app-tool-layout>
  `,
})
export class RegexTesterTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  protected readonly flagList = FLAGS;
  protected readonly max = MAX_MATCHES;
  protected readonly pattern = signal('');
  protected readonly flags = signal('g');
  protected readonly text = signal('');
  protected readonly replacement = signal('');
  protected readonly result = signal<RegexResult | null>(null);
  protected readonly error = signal('');
  protected readonly segments = computed(() => highlightSegments(this.text(), this.result()?.matches ?? []));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected set(target: WritableSignal<string>, event: Event): void {
    target.set((event.target as HTMLInputElement).value);
    this.run();
  }

  protected toggleFlag(flag: string): void {
    const has = this.flags().includes(flag);
    this.flags.set(has ? this.flags().replace(flag, '') : FLAGS.filter((f) => f === flag || this.flags().includes(f)).join(''));
    this.run();
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
    if (!this.used) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'regex-tester' });
    }
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
