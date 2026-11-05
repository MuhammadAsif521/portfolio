import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolSelect, ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { debouncedControlSignal } from '../text-ui';
import { yieldToBrowser } from '../text-utils';
import { CASE_LOCALES, CASE_META, convertCase, type CaseOptions, type CaseVariant, type TitleStyle } from './case-converter.logic';

const SAMPLE = 'the quick brown fox: a guide to HTTPServer2 and user_id naming in JavaScript\nit’s a well-known trick, isn’t it?';
const TITLE_STYLES = [
  { id: 'chicago', name: 'Chicago (all prepositions lower case)' },
  { id: 'ap-apa', name: 'AP / APA (words of 4+ letters capitalised)' },
];
/** Output panels show at most this many characters; the copy button always copies the full result. */
const PREVIEW_CHARS = 4000;

/** /tools/case-converter: every case style at once, live, with a copy button per style. */
@Component({
  selector: 'app-case-converter',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolSelect, ToolButton, ToolOutput, ToolNote, ToolEmpty],
  styleUrl: '../../../tool-ui.scss',
  styles: `
    .cc-grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="case-converter">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Your text">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="file-text" label="Example" (pressed)="textCtl.setValue(sample)" />
              <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!text()" (pressed)="textCtl.setValue('')" />
            </ng-container>
            <app-tool-textarea
              fieldId="cc-text"
              label="Text or identifier to convert"
              placeholder="Type or paste text, or an identifier such as fooBar, foo_bar or HTTPServer2"
              [control]="textCtl"
              [rows]="10"
              [wrap]="true"
              [mono]="false"
            />
            <div class="tool-controls">
              <app-tool-select fieldId="cc-style" label="Title Case style" [control]="styleCtl" [options]="titleStyles" />
              <app-tool-select fieldId="cc-locale" label="Language rules" [control]="localeCtl" [options]="locales" />
            </div>
            <p class="tool-meta">
              Line breaks are kept. Code styles convert each line into its own identifier. Nothing is uploaded.
            </p>
          </app-tool-panel>

          <app-tool-panel title="Text styles">
            @if (text()) {
              @for (v of textVariants(); track v.id) {
                <app-tool-output
                  [label]="v.label"
                  [value]="preview(v.value)"
                  [copyText]="v.value"
                  [copyLabel]="'Copy ' + v.label"
                  [meta]="v.value.length > previewChars ? 'preview of ' + v.value.length + ' characters' : ''"
                  (copied)="trackCopy()"
                />
              }
              @if (pending()) {
                <app-tool-note kind="info">Converting a large text...</app-tool-note>
              }
            } @else {
              <app-tool-empty icon="case-sensitive">Type or paste text on the left. Every case style appears here at once, each with its own copy button.</app-tool-empty>
            }
          </app-tool-panel>
        </div>

        @if (text()) {
          <app-tool-panel title="Code styles">
            <div class="cc-grid">
              @for (v of codeVariants(); track v.id) {
                <app-tool-output
                  [label]="v.label"
                  [value]="preview(v.value)"
                  [copyText]="v.value"
                  [copyLabel]="'Copy ' + v.label"
                  [meta]="v.value.length > previewChars ? 'preview' : ''"
                  (copied)="trackCopy()"
                />
              }
            </div>
          </app-tool-panel>
        }
      </div>
    </app-tool-layout>
  `,
})
export class CaseConverterTool {
  private readonly markUsed = toolUsage('case-converter');
  protected readonly trackCopy = toolCopied('case-converter');

  protected readonly sample = SAMPLE;
  protected readonly titleStyles = TITLE_STYLES;
  protected readonly locales = CASE_LOCALES;
  protected readonly previewChars = PREVIEW_CHARS;

  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly styleCtl = new FormControl<string>('chicago', { nonNullable: true });
  protected readonly localeCtl = new FormControl<string>('en', { nonNullable: true });

  protected readonly text = debouncedControlSignal(this.textCtl);
  private readonly style = controlSignal(this.styleCtl);
  private readonly locale = controlSignal(this.localeCtl);

  protected readonly variants = signal<CaseVariant[]>([]);
  protected readonly pending = signal(false);
  protected readonly textVariants = computed(() => this.variants().filter((v) => v.group === 'text'));
  protected readonly codeVariants = computed(() => this.variants().filter((v) => v.group === 'code'));
  private seq = 0;

  constructor() {
    effect(() => {
      const options: CaseOptions = { locale: this.locale(), titleStyle: this.style() as TitleStyle };
      const text = this.text();
      untracked(() => void this.run(text, options));
    });
  }

  protected preview(value: string): string {
    return value.length > PREVIEW_CHARS ? value.slice(0, PREVIEW_CHARS) + '\n...' : value;
  }

  /** Converts one style at a time and yields between them, so a multi-megabyte paste never blocks typing. */
  private async run(text: string, options: CaseOptions): Promise<void> {
    const id = ++this.seq;
    if (!text) {
      this.variants.set([]);
      this.pending.set(false);
      return;
    }
    this.markUsed();
    const big = text.length > 30_000;
    const done: CaseVariant[] = [];
    this.pending.set(big);
    for (const meta of CASE_META) {
      if (id !== this.seq) return;
      done.push({ ...meta, value: convertCase(text, meta.id, options) });
      if (big) {
        this.variants.set([...done]);
        await yieldToBrowser();
      }
    }
    if (id !== this.seq) return;
    this.variants.set(done);
    this.pending.set(false);
  }
}
