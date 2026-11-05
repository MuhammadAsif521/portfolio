import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { merge } from 'rxjs';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { downloadTextFile } from '../text-ui';
import { formatSize } from '../text-utils';
import { LOREM_LIMITS, generateLorem, type LoremFormat, type LoremLayout, type LoremOptions, type LoremUnit } from './lorem.logic';

const UNITS = [
  { id: 'paragraphs', name: 'Paragraphs' },
  { id: 'sentences', name: 'Sentences' },
  { id: 'words', name: 'Words' },
  { id: 'bytes', name: 'Bytes' },
];
const LAYOUTS = [
  { id: 'plain', name: 'Plain paragraphs' },
  { id: 'headings', name: 'Headings and paragraphs' },
  { id: 'list', name: 'Bulleted list' },
  { id: 'numbered', name: 'Numbered list' },
];
const FORMATS = [
  { id: 'text', name: 'Plain text' },
  { id: 'html', name: 'HTML (<p>, <h2>, <ul>)' },
  { id: 'markdown', name: 'Markdown' },
];
const EXTENSIONS: Record<LoremFormat, { ext: string; type: string }> = {
  text: { ext: 'txt', type: 'text/plain' },
  html: { ext: 'html', type: 'text/html' },
  markdown: { ext: 'md', type: 'text/markdown' },
};
const PREVIEW_CHARS = 20_000;
/** Fixed seed for the first render: the server and the browser must produce the same text. */
const INITIAL_SEED = 'asif-dev';

/** /tools/lorem-ipsum-generator: placeholder text in paragraphs, sentences, words or bytes. Live; seedable. */
@Component({
  selector: 'app-lorem-ipsum-generator',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolInput, ToolToggle, ToolButton, ToolOutput, ToolNote, ToolEmpty],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="lorem-ipsum-generator">
      <div class="tool-split">
        <app-tool-panel title="Options">
          <div class="tool-controls">
            <app-tool-input
              fieldId="lorem-count"
              label="How many"
              type="number"
              inputMode="numeric"
              [min]="1"
              [max]="limit()"
              [mono]="false"
              [hint]="'1 to ' + limit().toLocaleString('en-US')"
              [control]="countCtl"
            />
            <app-tool-select fieldId="lorem-unit" label="Unit" [control]="unitCtl" [options]="units" />
          </div>
          <div class="tool-controls">
            <app-tool-select
              fieldId="lorem-layout"
              label="Structure"
              [control]="layoutCtl"
              [options]="layouts"
              [hint]="unit() === 'paragraphs' ? '' : 'Headings and lists apply when the unit is paragraphs.'"
            />
            <app-tool-select fieldId="lorem-format" label="Format" [control]="formatCtl" [options]="formats" />
          </div>
          <app-tool-toggle fieldId="lorem-classic" label="Start with “Lorem ipsum dolor sit amet”" hint="The classic opening line" [control]="classicCtl" />
          <app-tool-input
            fieldId="lorem-seed"
            label="Seed (optional)"
            hint="The same seed and options always give the same text. Leave empty for a random text."
            placeholder="e.g. homepage-v2"
            [mono]="false"
            [control]="seedCtl"
          />
          <div class="tool-actions">
            <app-tool-button kind="primary" icon="wand-sparkles" label="Generate again" [disabled]="!!seed().trim()" (pressed)="regenerate()" />
          </div>
          <p class="tool-meta">
            The words come from Cicero's <em>De finibus bonorum et malorum</em> (45 BC), the passage the classic filler text was cut from. Nothing is uploaded.
          </p>
        </app-tool-panel>

        <app-tool-panel title="Text">
          @if (result(); as r) {
            <app-tool-output
              label="Lorem ipsum"
              copyLabel="Copy text"
              [value]="preview()"
              [copyText]="r.text"
              [meta]="r.words.toLocaleString('en-US') + ' words · ' + formatSize(r.bytes)"
              (copied)="trackCopy()"
            />
            @if (r.text.length > previewChars) {
              <app-tool-note kind="info">Showing the first {{ previewChars.toLocaleString('en-US') }} characters. Copy and download contain everything.</app-tool-note>
            }
            <div class="tool-actions">
              <app-tool-button icon="download" label="Download .{{ ext() }}" (pressed)="download()" />
            </div>
          } @else {
            <app-tool-empty icon="text-quote">Pick how much text you need. It updates as you change the options.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class LoremIpsumGeneratorTool {
  private readonly markUsed = toolUsage('lorem-ipsum-generator');
  protected readonly trackCopy = toolCopied('lorem-ipsum-generator');
  private readonly trackDownload = toolCopied('lorem-ipsum-generator', { method: 'download' });

  protected readonly units = UNITS;
  protected readonly layouts = LAYOUTS;
  protected readonly formats = FORMATS;
  protected readonly previewChars = PREVIEW_CHARS;
  protected readonly formatSize = formatSize;

  protected readonly countCtl = new FormControl('3', { nonNullable: true });
  protected readonly unitCtl = new FormControl<string>('paragraphs', { nonNullable: true });
  protected readonly layoutCtl = new FormControl<string>('plain', { nonNullable: true });
  protected readonly formatCtl = new FormControl<string>('text', { nonNullable: true });
  protected readonly classicCtl = new FormControl(true, { nonNullable: true });
  protected readonly seedCtl = new FormControl('', { nonNullable: true });

  private readonly count = controlSignal(this.countCtl);
  protected readonly unit = controlSignal(this.unitCtl);
  private readonly layout = controlSignal(this.layoutCtl);
  private readonly format = controlSignal(this.formatCtl);
  private readonly classic = controlSignal(this.classicCtl);
  protected readonly seed = controlSignal(this.seedCtl);
  private readonly randomSeed = signal(INITIAL_SEED);
  private used = false;

  protected readonly limit = computed(() => LOREM_LIMITS[this.unit() as LoremUnit]);
  protected readonly ext = computed(() => EXTENSIONS[this.format() as LoremFormat].ext);

  protected readonly result = computed(() => {
    const count = Math.floor(Number(this.count()));
    if (!Number.isFinite(count) || count < 1) return null;
    const options: LoremOptions = {
      unit: this.unit() as LoremUnit,
      count,
      startWithClassic: this.classic(),
      layout: this.layout() as LoremLayout,
      format: this.format() as LoremFormat,
      seed: this.seed().trim() || this.randomSeed(),
    };
    return generateLorem(options);
  });
  protected readonly preview = computed(() => {
    const text = this.result()?.text ?? '';
    return text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) + '\n...' : text;
  });

  protected regenerate(): void {
    this.randomSeed.set(Math.random().toString(36).slice(2));
    this.markOnce();
  }

  protected download(): void {
    const r = this.result();
    if (!r) return;
    const { ext, type } = EXTENSIONS[this.format() as LoremFormat];
    downloadTextFile(`lorem-ipsum.${ext}`, r.text, type);
    this.trackDownload();
  }

  private markOnce(): void {
    if (!this.used) {
      this.used = true;
      this.markUsed();
    }
  }

  constructor() {
    const controls: FormControl<string | boolean>[] = [this.countCtl, this.unitCtl, this.layoutCtl, this.formatCtl, this.classicCtl, this.seedCtl];
    merge(...controls.map((c) => c.valueChanges))
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.markOnce());
  }
}
