import { ChangeDetectionStrategy, Component, computed, effect } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { debouncedControlSignal } from '../text-ui';
import { slugifyLines, type Separator, type SlugLanguage, type SlugOptions } from './slug.logic';

const SEPARATORS = [
  { id: '-', name: 'Hyphen (-), recommended' },
  { id: '_', name: 'Underscore (_)' },
  { id: '.', name: 'Dot (.)' },
  { id: 'none', name: 'None' },
];
const LANGUAGES = [
  { id: 'auto', name: 'Automatic' },
  { id: 'de', name: 'German (ä → ae, ö → oe, ü → ue)' },
  { id: 'ru', name: 'Russian Cyrillic' },
  { id: 'uk', name: 'Ukrainian Cyrillic' },
  { id: 'sr', name: 'Serbian Cyrillic' },
];
const SAMPLE = 'Über große Brücken: 10 Tips & Tricks\nCrème brûlée à la française\nПривет, мир!\nمرحبا بالعالم\nZażółć gęślą jaźń';

/** /tools/slug-generator: text to URL slugs, one per line, transliterating accents and common scripts. */
@Component({
  selector: 'app-slug-generator',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolInput, ToolSelect, ToolToggle, ToolButton, ToolOutput, ToolNote, ToolEmpty],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="slug-generator">
      <div class="tool-split">
        <app-tool-panel title="Text">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="file-text" label="Example" (pressed)="textCtl.setValue(sample)" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!text()" (pressed)="textCtl.setValue('')" />
          </ng-container>
          <app-tool-textarea
            fieldId="slug-text"
            label="Titles or phrases, one per line"
            placeholder="How to Build a REST API with Node.js"
            [control]="textCtl"
            [rows]="9"
            [wrap]="true"
            [mono]="false"
          />
          <div class="tool-controls">
            <app-tool-select fieldId="slug-sep" label="Separator" [control]="sepCtl" [options]="separators" />
            <app-tool-input
              fieldId="slug-max"
              label="Maximum length"
              type="number"
              inputMode="numeric"
              [min]="0"
              [mono]="false"
              hint="0 means no limit. Cut at a whole word."
              [control]="maxCtl"
            />
          </div>
          <div class="tool-controls">
            <app-tool-toggle fieldId="slug-lower" label="Lower case" hint="URLs are case sensitive, so one case avoids duplicates" [control]="lowerCtl" />
            <app-tool-toggle fieldId="slug-ascii" label="Convert to ASCII" hint="Off keeps letters of every script" [control]="asciiCtl" />
            <app-tool-toggle fieldId="slug-stop" label="Remove stop words" hint="a, the, of, and..." [control]="stopCtl" />
            <app-tool-toggle fieldId="slug-amp" label="Replace & with “and”" [control]="ampCtl" />
            <app-tool-toggle fieldId="slug-unique" label="Unique suffixes" hint="Repeated lines get -2, -3..." [control]="uniqueCtl" />
          </div>
          @if (asciiCtl.value) {
            <app-tool-select fieldId="slug-lang" label="Language rules" [control]="langCtl" [options]="languages" hint="Accented Latin letters need no choice. Cyrillic is detected from its letters." />
          }
          <p class="tool-meta">Nothing is uploaded. Everything is converted in your browser.</p>
        </app-tool-panel>

        <app-tool-panel title="Slugs">
          @if (batch(); as b) {
            <app-tool-output
              [label]="count() === 1 ? 'Slug' : 'Slugs'"
              [copyLabel]="count() === 1 ? 'Copy slug' : 'Copy all'"
              [value]="output()"
              [meta]="metaLine()"
              (copied)="trackCopy()"
            />
            @if (count() === 1 && b.slugs[0]) {
              <p class="tool-meta">Example URL: <code>https://example.com/blog/{{ b.slugs[0] }}</code></p>
            }
            @if (b.dropped.length) {
              <app-tool-note kind="warn">
                {{ b.dropped.length }} {{ b.dropped.length === 1 ? 'character' : 'characters' }} ({{ droppedPreview() }}) in scripts without a mapping
                {{ b.dropped.length === 1 ? 'was' : 'were' }} left out. Switch off “Convert to ASCII” to keep them in a Unicode slug.
              </app-tool-note>
            }
            @if (hasArabicScript() && asciiCtl.value) {
              <app-tool-note kind="info">
                Arabic, Persian and Urdu are written without short vowels, so the conversion is a consonant skeleton (محمد becomes mhmd). For readable URLs, write the slug in English or keep the Unicode letters.
              </app-tool-note>
            }
            @if (emptyLines() > 0) {
              <app-tool-note kind="warn">{{ emptyLines() }} {{ emptyLines() === 1 ? 'line' : 'lines' }} had no letters or digits left and produced an empty slug.</app-tool-note>
            }
          } @else {
            <app-tool-empty icon="link">Type a title on the left. The URL slug appears here as you type; paste several lines to get one slug each.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class SlugGeneratorTool {
  private readonly markUsed = toolUsage('slug-generator');
  protected readonly trackCopy = toolCopied('slug-generator');

  protected readonly sample = SAMPLE;
  protected readonly separators = SEPARATORS;
  protected readonly languages = LANGUAGES;

  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly sepCtl = new FormControl<string>('-', { nonNullable: true });
  protected readonly maxCtl = new FormControl('0', { nonNullable: true });
  protected readonly lowerCtl = new FormControl(true, { nonNullable: true });
  protected readonly asciiCtl = new FormControl(true, { nonNullable: true });
  protected readonly stopCtl = new FormControl(false, { nonNullable: true });
  protected readonly ampCtl = new FormControl(true, { nonNullable: true });
  protected readonly uniqueCtl = new FormControl(true, { nonNullable: true });
  protected readonly langCtl = new FormControl<string>('auto', { nonNullable: true });

  protected readonly text = debouncedControlSignal(this.textCtl);
  private readonly sep = controlSignal(this.sepCtl);
  private readonly max = controlSignal(this.maxCtl);
  private readonly lower = controlSignal(this.lowerCtl);
  private readonly ascii = controlSignal(this.asciiCtl);
  private readonly stop = controlSignal(this.stopCtl);
  private readonly amp = controlSignal(this.ampCtl);
  private readonly unique = controlSignal(this.uniqueCtl);
  private readonly lang = controlSignal(this.langCtl);

  private readonly options = computed<SlugOptions>(() => {
    const max = Math.floor(Number(this.max()));
    return {
      separator: (this.sep() === 'none' ? '' : this.sep()) as Separator,
      lowercase: this.lower(),
      maxLength: Number.isFinite(max) && max > 0 ? max : 0,
      removeStopWords: this.stop(),
      transliterate: this.ascii(),
      language: this.lang() as SlugLanguage,
      ampersandToAnd: this.amp(),
      uniqueSuffix: this.unique(),
    };
  });

  protected readonly batch = computed(() => {
    const text = this.text();
    if (!text.trim()) return null;
    return slugifyLines(text, this.options());
  });
  constructor() {
    effect(() => {
      if (this.text().trim()) this.markUsed();
    });
  }

  protected readonly output = computed(() => this.batch()?.slugs.join('\n') ?? '');
  protected readonly count = computed(() => this.batch()?.slugs.length ?? 0);
  protected readonly emptyLines = computed(() => {
    const lines = this.text().split(/\r\n|\r|\n/);
    const slugs = this.batch()?.slugs ?? [];
    return lines.reduce((n, line, i) => n + (line.trim() && !slugs[i] ? 1 : 0), 0);
  });
  protected readonly hasArabicScript = computed(() => /[؀-ۿ]/.test(this.text()));
  protected readonly droppedPreview = computed(() => (this.batch()?.dropped ?? []).slice(0, 8).join(' ') + ((this.batch()?.dropped.length ?? 0) > 8 ? ' ...' : ''));
  protected readonly metaLine = computed(() => {
    const b = this.batch();
    if (!b) return '';
    const parts = [b.slugs.length === 1 ? `${b.slugs[0].length} characters` : `${b.slugs.length} lines`];
    if (b.suffixed) parts.push(`${b.suffixed} made unique`);
    return parts.join(' · ');
  });
}
