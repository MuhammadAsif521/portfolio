import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { debouncedControlSignal, readTextFile } from '../text-ui';
import { formatSize } from '../text-utils';
import {
  LIMIT_PRESETS,
  READING_WPM,
  SPEAKING_WPM,
  analyzeText,
  analyzeTextAsync,
  formatDuration,
  limitStatus,
  smsInfo,
  topKeywords,
  type TextStats,
  type WordToken,
} from './word-counter.logic';

const MAX_FILE_MB = 5;
const SAMPLE =
  'Writing for the web rewards short, clear sentences. A good paragraph makes one point and moves on.\n\nCount your words before you publish: headlines, meta descriptions and social posts all have limits, and a counter shows how much room is left.';
const LIMIT_OPTIONS = LIMIT_PRESETS.map((p) => ({ id: p.id, name: p.name }));
const PHRASE_OPTIONS = [
  { id: '1', name: 'Single words' },
  { id: '2', name: 'Two-word phrases' },
  { id: '3', name: 'Three-word phrases' },
];

const fmt = new Intl.NumberFormat('en-US');
const n = (value: number): string => fmt.format(value);

/** /tools/word-counter: live counts, reading and speaking time, keywords and character limits. Runs as you type. */
@Component({
  selector: 'app-word-counter',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolTextarea,
    ToolInput,
    ToolSelect,
    ToolToggle,
    ToolButton,
    ToolOutput,
    ToolKeyValue,
    ToolNote,
    ToolEmpty,
    CustomFileInputComponent,
  ],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="word-counter">
      <div class="tool-split">
        <app-tool-panel title="Your text">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="file-text" label="Example" (pressed)="textCtl.setValue(sample)" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!text()" (pressed)="clear()" />
          </ng-container>
          <div
            (select)="onSelect($event)"
            (keyup)="onSelect($event)"
            (mouseup)="onSelect($event)"
            (touchend)="onSelect($event)"
            (input)="onSelect($event)"
            (focusout)="onSelect($event)"
          >
            <app-tool-textarea
              fieldId="wc-text"
              label="Text to count"
              placeholder="Type or paste your text here. Counts update as you type."
              [control]="textCtl"
              [rows]="14"
              [wrap]="true"
              [mono]="false"
            />
          </div>
          <app-custom-file-input
            controlName="wc-file"
            [label$]="fileLabel"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxFileMb"
            [accept]="'.txt,.md,.csv,.log,.json,.xml,text/plain'"
            [scanFiles]="false"
            [sanitizeNames]="false"
            placeholder="Or load a .txt, .md or .csv file"
            (file)="onFile($event)"
          />
          @if (fileError()) {
            <app-tool-note kind="error">{{ fileError() }}</app-tool-note>
          }
          <div class="tool-controls">
            <app-tool-select fieldId="wc-limit" label="Character limit" [control]="limitCtl" [options]="limitOptions" />
            @if (limitId() === 'custom') {
              <app-tool-input fieldId="wc-custom" label="Limit (characters)" type="number" inputMode="numeric" [min]="1" [mono]="false" [control]="customCtl" />
            }
          </div>
          <div class="tool-controls">
            <app-tool-select fieldId="wc-phrase" label="Keywords" [control]="phraseCtl" [options]="phraseOptions" />
            <app-tool-toggle fieldId="wc-stop" label="Skip English stop words" hint="the, and, of, is..." [control]="stopCtl" />
          </div>
          <p class="tool-meta">Nothing is uploaded. Files are read in your browser (up to {{ maxFileMb }} MB).</p>
        </app-tool-panel>

        <app-tool-panel title="Results">
          @if (result(); as r) {
            @if (busy()) {
              <app-tool-note kind="info">Counting a large text...</app-tool-note>
            }
            <app-tool-output label="Counts" copyLabel="Copy counts" [meta]="r.stats.words === 1 ? '1 word' : n(r.stats.words) + ' words'" [copyText]="summary()" (copied)="trackCopy()">
              <app-tool-key-value [rows]="rows()" />
            </app-tool-output>

            @if (selectionStats(); as s) {
              <app-tool-output label="Selected text" [copyText]="''">
                <app-tool-key-value [rows]="selectionRows()" />
              </app-tool-output>
            }

            <app-tool-output label="Reading and speaking time" [copyText]="''">
              <app-tool-key-value [rows]="timeRows()" />
              <p class="tool-sub">Estimates only: reading uses {{ readingWpm }} words per minute (average silent reading of English non-fiction by adults, Brysbaert 2019) and speaking {{ speakingWpm }} (a common pace for talks). Real speed varies a lot with the reader and the text.</p>
            </app-tool-output>

            @if (limitId() !== 'none') {
              @if (sms(); as s) {
                <app-tool-output label="SMS length" [copyText]="''">
                  <app-tool-key-value [rows]="smsRows()" />
                  <p class="tool-sub">{{ limitNote() }}</p>
                </app-tool-output>
              } @else if (limit(); as l) {
                <app-tool-note [kind]="l.over ? 'error' : 'success'">{{ l.label }}. {{ limitNote() }}</app-tool-note>
              } @else {
                <app-tool-note kind="info">Enter a limit above to see how much room is left.</app-tool-note>
              }
            }

            <app-tool-output label="Top keywords" [copyText]="keywordText()" copyLabel="Copy list" [meta]="keywords().length ? keywords().length + ' shown' : ''" (copied)="trackCopy()">
              @if (keywords().length) {
                <div class="tool-table-wrap">
                  <table class="tool-table">
                    <caption class="sr-only">Most frequent words or phrases with their counts and share of all words</caption>
                    <thead><tr><th scope="col">Keyword</th><th scope="col">Count</th><th scope="col">Share of words</th></tr></thead>
                    <tbody>
                      @for (k of keywords(); track k.phrase) {
                        <tr><td><code>{{ k.phrase }}</code></td><td>{{ k.count }}</td><td>{{ k.density.toFixed(1) }}%</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
                <p class="tool-sub">Frequency describes your text. There is no ideal percentage to aim for.</p>
              } @else {
                <p class="tool-sub">Nothing repeats enough yet{{ phraseCtl.value !== '1' ? ' (a phrase must appear twice)' : '' }}.</p>
              }
            </app-tool-output>
          } @else {
            <app-tool-empty icon="whole-word">Type or paste text on the left. Words, characters, sentences, reading time and the most used keywords appear here as you type.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class WordCounterTool {
  private readonly markUsed = toolUsage('word-counter');
  protected readonly trackCopy = toolCopied('word-counter');

  protected readonly sample = SAMPLE;
  protected readonly maxFileMb = MAX_FILE_MB;
  protected readonly readingWpm = READING_WPM;
  protected readonly speakingWpm = SPEAKING_WPM;
  protected readonly limitOptions = LIMIT_OPTIONS;
  protected readonly phraseOptions = PHRASE_OPTIONS;
  protected readonly fileLabel = of('Text file');
  protected readonly n = n;

  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly limitCtl = new FormControl('none', { nonNullable: true });
  protected readonly customCtl = new FormControl('100', { nonNullable: true });
  protected readonly phraseCtl = new FormControl('1', { nonNullable: true });
  protected readonly stopCtl = new FormControl(true, { nonNullable: true });

  protected readonly text = debouncedControlSignal(this.textCtl);
  protected readonly limitId = controlSignal(this.limitCtl);
  private readonly customText = controlSignal(this.customCtl);
  private readonly phrase = controlSignal(this.phraseCtl);
  private readonly stop = controlSignal(this.stopCtl);

  protected readonly result = signal<{ stats: TextStats; tokens: WordToken[] } | null>(null);
  protected readonly busy = signal(false);
  protected readonly fileError = signal('');
  protected readonly selection = signal('');
  private seq = 0;

  protected readonly limitNote = computed(() => LIMIT_PRESETS.find((p) => p.id === this.limitId())?.note ?? '');
  protected readonly limit = computed(() => limitStatus(this.text(), this.limitId(), Number(this.customText())));
  protected readonly sms = computed(() => (this.limitId() === 'sms' ? smsInfo(this.text()) : null));

  protected readonly keywords = computed(() => {
    const r = this.result();
    if (!r) return [];
    const size = Number(this.phrase()) as 1 | 2 | 3;
    return topKeywords(r.tokens, r.stats.words, { size, excludeStopWords: this.stop(), limit: 10 });
  });
  protected readonly keywordText = computed(() =>
    this.keywords()
      .map((k) => `${k.phrase}\t${k.count}\t${k.density.toFixed(1)}%`)
      .join('\n'),
  );

  protected readonly selectionStats = computed(() => {
    const s = this.selection();
    return s.trim() && s.length <= 300_000 ? analyzeText(s).stats : null;
  });

  protected readonly rows = computed<ToolRow[]>(() => {
    const s = this.result()?.stats;
    return s ? this.statRows(s, true) : [];
  });
  protected readonly selectionRows = computed<ToolRow[]>(() => {
    const s = this.selectionStats();
    return s ? this.statRows(s, false) : [];
  });
  protected readonly timeRows = computed<ToolRow[]>(() => {
    const s = this.result()?.stats;
    if (!s) return [];
    return [
      { label: `Reading (${READING_WPM} wpm)`, value: formatDuration(s.readingSeconds) },
      { label: `Speaking (${SPEAKING_WPM} wpm)`, value: formatDuration(s.speakingSeconds) },
    ];
  });
  protected readonly smsRows = computed<ToolRow[]>(() => {
    const s = this.sms();
    if (!s) return [];
    return [
      { label: 'Encoding', value: s.encoding },
      { label: s.encoding === 'GSM-7' ? 'Characters used' : 'Units used', value: String(s.units) },
      { label: 'Messages', value: String(s.segments) },
      { label: s.segments > 1 ? 'Left in last message' : 'Left in this message', value: String(s.remaining) },
    ];
  });
  protected readonly summary = computed(() =>
    this.rows()
      .map((r) => `${r.label}: ${r.value}`)
      .join('\n'),
  );

  constructor() {
    effect(() => {
      const text = this.text();
      untracked(() => void this.run(text));
    });
  }

  private statRows(s: TextStats, full: boolean): ToolRow[] {
    const rows: ToolRow[] = [
      { label: 'Words', value: n(s.words) },
      { label: 'Characters', value: n(s.characters) },
      { label: 'Characters without spaces', value: n(s.charactersNoSpaces) },
      { label: 'Sentences', value: n(s.sentences) },
      { label: 'Paragraphs', value: n(s.paragraphs) },
      { label: 'Lines', value: n(s.lines) },
    ];
    if (full) {
      rows.push(
        { label: 'Unique words', value: n(s.uniqueWords) },
        { label: 'Longest word', value: s.longestWord || 'none' },
        { label: 'Average word length', value: s.words ? `${s.averageWordLength} characters` : 'none' },
        { label: 'Size', value: `${formatSize(s.bytes)} as UTF-8` },
      );
    }
    return rows;
  }

  private async run(text: string): Promise<void> {
    const id = ++this.seq;
    if (!text) {
      this.result.set(null);
      this.busy.set(false);
      return;
    }
    this.markUsed();
    this.busy.set(text.length >= 60_000);
    const res = await analyzeTextAsync(text, () => id !== this.seq);
    if (res && id === this.seq) {
      this.result.set(res);
      this.busy.set(false);
    }
  }

  protected clear(): void {
    this.textCtl.setValue('');
    this.selection.set('');
  }

  protected onSelect(event: Event): void {
    const el = event.target;
    if (typeof HTMLTextAreaElement === 'undefined' || !(el instanceof HTMLTextAreaElement)) return;
    const { selectionStart: a, selectionEnd: b } = el;
    this.selection.set(a !== null && b !== null && a !== b ? el.value.slice(a, b) : '');
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.fileError.set('');
    if (!picked) return;
    const res = await readTextFile(picked, MAX_FILE_MB);
    if (res.ok) this.textCtl.setValue(res.text);
    else this.fileError.set(res.error);
  }
}
