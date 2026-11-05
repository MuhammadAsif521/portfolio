import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { downloadText } from '../dev-utils';
import {
  CRAWLERS,
  ROBOTS_PRESETS,
  buildRobots,
  evaluateRobots,
  lintGroups,
  parseRobots,
  parseRuleLines,
  ruleLines,
  type RobotsGroup,
  type RobotsIssue,
  type RobotsVerdict,
} from './robots-logic';

interface GroupModel {
  id: number;
  agents: FormControl<string>;
  rules: FormControl<string>;
  delay: FormControl<string>;
  pick: FormControl<string>;
}

let groupId = 0;

const CRAWLER_OPTIONS = [{ id: '', name: 'Add a known crawler...' }, ...CRAWLERS.map((c) => ({ id: c.token, name: `${c.token} (${c.vendor})` }))];
const TEST_AGENTS = [{ id: '*', name: '* (any other crawler)' }, ...CRAWLERS.map((c) => ({ id: c.token, name: c.token }))];

const KIND_LABEL: Record<string, string> = {
  search: 'Search',
  'ai-training': 'AI training',
  'ai-search': 'AI search',
  'ai-user': 'AI, on user request',
  other: 'Other',
};

const SAMPLE_PATHS = 'https://example.com/admin/login';

/** /tools/robots-txt-generator: builds robots.txt from groups and presets, lints it and tests URLs with Google's matching rules. */
@Component({
  selector: 'app-robots-txt-generator',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolTextarea, ToolSelect, ToolOutput, ToolNote, ToolEmpty, ToolButton],
  styleUrls: ['../../../tool-ui.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="robots-txt-generator">
      <div class="tool-stack">
        <div class="tool-split">
          <div class="tool-stack">
            <app-tool-panel title="Start from a preset">
              <div class="tool-presets" role="group" aria-label="Presets">
                @for (p of presets; track p.id) {
                  <button type="button" class="tool-chip-button" [title]="p.description" (click)="applyPreset(p.id)">{{ p.name }}</button>
                }
              </div>
              @if (presetNote()) {
                <p class="tool-meta">{{ presetNote() }}</p>
              }
            </app-tool-panel>

            @for (g of groups(); track g.id; let i = $index) {
              <app-tool-panel [title]="'Group ' + (i + 1)">
                <ng-container ngProjectAs="[panelActions]">
                  <app-tool-button size="small" icon="x" label="Remove group" (pressed)="removeGroup(g.id)" />
                </ng-container>
                <app-tool-textarea [fieldId]="'rb-agents-' + g.id" label="User-agents (one per line)" placeholder="*" [control]="g.agents" [rows]="2" />
                <app-tool-select [fieldId]="'rb-pick-' + g.id" label="Add a crawler to this group" [control]="g.pick" [options]="crawlerOptions" hint="Pick one and press Add" />
                <div class="tool-actions">
                  <app-tool-button size="small" icon="plus" label="Add crawler" [disabled]="!g.pick.value" (pressed)="addCrawler(g)" />
                </div>
                <app-tool-textarea [fieldId]="'rb-rules-' + g.id" label="Rules (Allow: or Disallow: per line)" placeholder="Disallow: /admin/" [control]="g.rules" [rows]="5" />
                <app-tool-input [fieldId]="'rb-delay-' + g.id" label="Crawl-delay in seconds (optional)" inputMode="numeric" hint="Google ignores Crawl-delay. Some other crawlers read it." [control]="g.delay" />
              </app-tool-panel>
            }
            <div class="tool-actions">
              <app-tool-button icon="plus" label="Add group" (pressed)="addGroup()" />
            </div>

            <app-tool-panel title="Sitemaps">
              <app-tool-textarea fieldId="rb-sitemaps" label="Sitemap URLs (one per line)" placeholder="https://example.com/sitemap.xml" hint="Full URLs. They apply to the whole file, not to one group" [control]="sitemapsCtl" [rows]="3" />
            </app-tool-panel>

            <app-tool-panel title="Import an existing file">
              <app-tool-textarea fieldId="rb-import" label="Paste a robots.txt" [control]="importCtl" [rows]="5" />
              <div class="tool-actions">
                <app-tool-button size="small" icon="upload" label="Load into the builder" [disabled]="!importCtl.value.trim()" (pressed)="importText()" />
              </div>
            </app-tool-panel>
          </div>

          <div class="tool-stack">
            <app-tool-panel title="robots.txt">
              @if (output()) {
                <app-tool-output label="robots.txt" [meta]="meta()" [value]="output()" copyLabel="Copy file" (copied)="trackCopy()" />
                <div class="tool-actions">
                  <app-tool-button size="small" icon="download" label="Download robots.txt" (pressed)="download()" />
                </div>
              } @else {
                <app-tool-empty icon="bot">Pick a preset or add a group with at least one user-agent. Save the file as robots.txt at the root of your domain.</app-tool-empty>
              }
              @for (issue of issues(); track $index) {
                <app-tool-note [kind]="issue.level === 'error' ? 'error' : issue.level === 'warning' ? 'warn' : 'info'">{{ issue.line ? 'Line ' + issue.line + ': ' : '' }}{{ issue.message }}</app-tool-note>
              }
              <app-tool-note kind="info">
                robots.txt asks well-behaved crawlers not to fetch URLs. It is not access control, and a blocked URL can still appear in search results if other sites link to it. To keep a page out of results, let it be crawled and use a noindex robots meta tag or header.
              </app-tool-note>
            </app-tool-panel>

            <app-tool-panel title="Test a URL against these rules">
              <app-tool-input fieldId="rb-test-url" label="URL or path" [placeholder]="samplePath" [control]="testUrlCtl" [invalid]="!!testError()" />
              <app-tool-select fieldId="rb-test-agent" label="Crawler" [control]="testAgentCtl" [options]="testAgents" />
              @if (testError()) {
                <app-tool-note kind="error">{{ testError() }}</app-tool-note>
              } @else if (verdict(); as v) {
                <app-tool-note [kind]="v.allowed ? 'success' : 'error'">
                  <strong>{{ v.allowed ? 'Allowed' : 'Blocked' }}</strong> for {{ testAgentCtl.value }}: {{ v.reason }}
                </app-tool-note>
                @if (v.matched.length > 1) {
                  <p class="tool-meta">Also matching: {{ otherMatches(v) }}</p>
                }
                <p class="tool-meta">Tested path: {{ v.path }}{{ v.group ? ' · rules from the group for ' + v.group : '' }}</p>
              } @else {
                <app-tool-empty icon="file-search">Enter a URL to see whether the crawler may fetch it, and which rule decides.</app-tool-empty>
              }
              <p class="tool-meta">Matching follows Google's documented rules: the longest matching path wins, and Allow wins a tie. Other crawlers may differ in edge cases.</p>
            </app-tool-panel>
          </div>
        </div>

        <app-tool-panel title="Crawler names">
          <app-tool-output label="User-agent tokens used in the presets">
            <div class="tool-table-wrap">
              <table class="tool-table">
                <thead>
                  <tr><th scope="col">Token</th><th scope="col">Vendor</th><th scope="col">Type</th><th scope="col">What blocking it does</th></tr>
                </thead>
                <tbody>
                  @for (c of crawlers; track c.token) {
                    <tr><td><code>{{ c.token }}</code></td><td>{{ c.vendor }}</td><td>{{ kindLabel(c.kind) }}</td><td>{{ c.note }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </app-tool-output>
          <p class="tool-meta">Names checked against Google, OpenAI, Anthropic, Perplexity and Apple documentation. Vendors add and rename crawlers, so check their pages before relying on a list.</p>
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class RobotsTxtGeneratorTool {
  private readonly markUsed = toolUsage('robots-txt-generator');
  protected readonly trackCopy = toolCopied('robots-txt-generator');
  private readonly trackDownload = toolCopied('robots-txt-generator', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly presets = ROBOTS_PRESETS;
  protected readonly crawlers = CRAWLERS;
  protected readonly crawlerOptions = CRAWLER_OPTIONS;
  protected readonly testAgents = TEST_AGENTS;
  protected readonly samplePath = SAMPLE_PATHS;

  protected readonly groups = signal<GroupModel[]>([]);
  protected readonly presetNote = signal('');
  protected readonly sitemapsCtl = new FormControl('', { nonNullable: true });
  protected readonly importCtl = new FormControl('', { nonNullable: true });
  protected readonly testUrlCtl = new FormControl('', { nonNullable: true });
  protected readonly testAgentCtl = new FormControl('Googlebot', { nonNullable: true });
  private readonly tick = signal(0);
  private readonly testUrl = controlSignal(this.testUrlCtl);
  private readonly testAgent = controlSignal(this.testAgentCtl);

  private readonly model = computed<{ groups: RobotsGroup[]; sitemaps: string[] }>(() => {
    this.tick();
    return {
      groups: this.groups().map((g) => ({
        agents: g.agents.value.split(/\r?\n|,/).map((a) => a.trim()).filter(Boolean),
        rules: parseRuleLines(g.rules.value),
        crawlDelay: g.delay.value.trim() || undefined,
      })),
      sitemaps: this.sitemapsCtl.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    };
  });

  protected readonly output = computed(() => {
    const m = this.model();
    return buildRobots(m.groups, m.sitemaps);
  });
  private readonly parsed = computed(() => parseRobots(this.output()));
  protected readonly meta = computed(() => `${this.output().split('\n').filter(Boolean).length} lines · ${this.parsed().bytes} bytes`);
  protected readonly issues = computed<RobotsIssue[]>(() => {
    if (!this.output()) return [];
    const seen = new Set<string>();
    return [...this.parsed().issues.filter((i) => i.level !== 'info' || i.message.includes('Crawl-delay')), ...lintGroups(this.model().groups)].filter((i) => {
      const key = `${i.level}:${i.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  private readonly result = computed(() => {
    const url = this.testUrl().trim();
    if (!url || !this.output()) return null;
    return evaluateRobots(this.parsed(), this.testAgent(), url);
  });
  protected readonly testError = computed(() => {
    const r = this.result();
    return r && 'error' in r ? r.error : '';
  });
  protected readonly verdict = computed<RobotsVerdict | null>(() => {
    const r = this.result();
    return r && !('error' in r) ? r : null;
  });

  constructor() {
    this.sitemapsCtl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.bump());
    this.addGroup();
  }

  private bump(): void {
    this.tick.update((n) => n + 1);
    this.markUsed();
  }

  private makeGroup(agents: string, rules: string, delay = ''): GroupModel {
    const g: GroupModel = {
      id: ++groupId,
      agents: new FormControl(agents, { nonNullable: true }),
      rules: new FormControl(rules, { nonNullable: true }),
      delay: new FormControl(delay, { nonNullable: true }),
      pick: new FormControl('', { nonNullable: true }),
    };
    for (const ctl of [g.agents, g.rules, g.delay]) ctl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.bump());
    return g;
  }

  protected addGroup(): void {
    this.groups.update((gs) => [...gs, this.makeGroup(gs.length ? '' : '*', gs.length ? '' : 'Disallow: /admin/')]);
    this.tick.update((n) => n + 1);
  }

  protected removeGroup(id: number): void {
    this.groups.update((gs) => gs.filter((g) => g.id !== id));
    this.bump();
  }

  protected addCrawler(g: GroupModel): void {
    const token = g.pick.value;
    if (!token) return;
    const current = g.agents.value.split(/\r?\n/).map((a) => a.trim()).filter(Boolean);
    if (!current.some((a) => a.toLowerCase() === token.toLowerCase())) g.agents.setValue([...current, token].join('\n'));
    g.pick.setValue('');
  }

  protected applyPreset(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.groups.set(preset.groups.map((g) => this.makeGroup(g.agents.join('\n'), ruleLines(g.rules), g.crawlDelay ?? '')));
    this.presetNote.set(preset.description);
    this.bump();
  }

  protected importText(): void {
    const parsed = parseRobots(this.importCtl.value);
    this.groups.set(parsed.groups.map((g) => this.makeGroup(g.agents.join('\n'), ruleLines(g.rules), g.crawlDelay ?? '')));
    this.sitemapsCtl.setValue(parsed.sitemaps.join('\n'));
    this.presetNote.set(parsed.groups.length ? `Loaded ${parsed.groups.length} ${parsed.groups.length === 1 ? 'group' : 'groups'} from your file.` : 'No user-agent groups were found in that text.');
    this.bump();
  }

  protected download(): void {
    downloadText('robots.txt', this.output(), 'text/plain');
    this.trackDownload();
  }

  protected kindLabel(kind: string): string {
    return KIND_LABEL[kind] ?? kind;
  }

  protected otherMatches(v: RobotsVerdict): string {
    return v.matched
      .filter((r) => r !== v.rule)
      .map((r) => `${r.type === 'allow' ? 'Allow' : 'Disallow'}: ${r.path}`)
      .join(', ');
  }
}
