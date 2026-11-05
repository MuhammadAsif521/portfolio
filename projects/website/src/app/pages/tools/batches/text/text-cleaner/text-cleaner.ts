import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolSelect, ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { debouncedControlSignal, downloadTextFile, readTextFile } from '../text-ui';
import { yieldToBrowser } from '../text-utils';
import { CleanerStep } from './cleaner-step';
import { STEP_DEFS, STEP_TYPES, defaultParams, runPipeline, type PipelineResult, type Step, type StepParams, type StepType } from './text-cleaner.logic';

const MAX_FILE_MB = 20;
const PREVIEW_CHARS = 100_000;
const STEP_OPTIONS = STEP_TYPES.map((t) => ({ id: t, name: STEP_DEFS[t].label }));
const SAMPLE = 'banana\n  Apple \n\ncherry\napple\nBanana\n  cherry\n10 items\n9 items';

interface Recipe {
  label: string;
  steps: [StepType, StepParams?][];
}
const RECIPES: Recipe[] = [
  { label: 'Clean up a list', steps: [['trim'], ['remove-empty'], ['dedupe', { ignoreCase: true }], ['sort']] },
  { label: 'Sort A to Z', steps: [['sort']] },
  { label: 'Remove duplicates', steps: [['dedupe']] },
  { label: 'Emails from text', steps: [['extract', { kind: 'emails' }], ['dedupe', { ignoreCase: true }], ['sort']] },
  { label: 'Comma list to lines', steps: [['split'], ['sort']] },
  { label: 'Lines to comma list', steps: [['trim'], ['remove-empty'], ['join', { separator: ', ' }]] },
];

/** /tools/text-cleaner: an ordered pipeline of line operations (sort, dedupe, trim, split, join, extract...). */
@Component({
  selector: 'app-text-cleaner',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolSelect, ToolButton, ToolOutput, ToolNote, ToolEmpty, CleanerStep, CustomFileInputComponent],
  styleUrl: '../../../tool-ui.scss',
  styles: `
    .tc-steps {
      display: grid;
      gap: 0.625rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="text-cleaner">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Your text">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="file-text" label="Example" (pressed)="textCtl.setValue(sample)" />
              <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!text()" (pressed)="textCtl.setValue('')" />
            </ng-container>
            <app-tool-textarea
              fieldId="tc-text"
              label="One item per line"
              placeholder="Paste a list, a log, a column from a spreadsheet..."
              [control]="textCtl"
              [rows]="14"
              [mono]="true"
            />
            <app-custom-file-input
              controlName="tc-file"
              [label$]="fileLabel"
              [multiple]="false"
              [showLabel]="false"
              [maxFileSize]="maxFileMb"
              [accept]="'.txt,.csv,.log,.md,.json,.tsv,text/plain'"
              [scanFiles]="false"
              [sanitizeNames]="false"
              placeholder="Or load a text file"
              (file)="onFile($event)"
            />
            @if (fileError()) {
              <app-tool-note kind="error">{{ fileError() }}</app-tool-note>
            }
            <p class="tool-meta">Nothing is uploaded. Files are read in your browser (up to {{ maxFileMb }} MB).</p>
          </app-tool-panel>

          <app-tool-panel title="Result">
            @if (busy()) {
              <app-tool-note kind="info">Working...</app-tool-note>
            }
            @if (result(); as r) {
              <app-tool-output
                label="Cleaned text"
                copyLabel="Copy result"
                [value]="preview()"
                [copyText]="r.text"
                [meta]="metaLine()"
                (copied)="trackCopy()"
              />
              @if (r.text.length > previewChars) {
                <app-tool-note kind="info">Showing the first {{ previewChars.toLocaleString('en-US') }} characters. Copy and download contain everything.</app-tool-note>
              }
              @if (!r.text && r.inputLines > 0) {
                <app-tool-note kind="info">The steps removed every line.</app-tool-note>
              }
              <div class="tool-actions">
                <app-tool-button icon="download" label="Download .txt" [disabled]="!r.text" (pressed)="download()" />
                @if (hasRandom()) {
                  <app-tool-button icon="shuffle" label="Shuffle again" (pressed)="reshuffle()" />
                }
              </div>
              @if (r.trace.length) {
                <app-tool-output label="What each step did" [copyText]="''">
                  <ol class="tool-list">
                    @for (t of r.trace; track t.id; let i = $index) {
                      <li>
                        {{ i + 1 }}. {{ label(t.type) }}: {{ t.before.toLocaleString('en-US') }} → {{ t.after.toLocaleString('en-US') }}
                        {{ t.after < t.before ? '(' + (t.before - t.after).toLocaleString('en-US') + ' fewer)' : t.after > t.before ? '(' + (t.after - t.before).toLocaleString('en-US') + ' more)' : '' }}
                      </li>
                    }
                  </ol>
                </app-tool-output>
              }
            } @else if (!busy()) {
              <app-tool-empty icon="list-ordered">Paste text on the left. The pipeline below runs on it as you type and the cleaned lines appear here.</app-tool-empty>
            }
          </app-tool-panel>
        </div>

        <app-tool-panel title="Pipeline">
          <div class="tool-presets" role="group" aria-label="Ready-made pipelines">
            @for (r of recipes; track r.label) {
              <app-tool-button size="small" [label]="r.label" (pressed)="useRecipe(r)" />
            }
          </div>
          @if (steps().length) {
            <ol class="tc-steps" aria-label="Steps, run from top to bottom">
              @for (s of steps(); track s.id; let i = $index) {
                <li>
                  <app-cleaner-step
                    [step]="s"
                    [index]="i"
                    [count]="steps().length"
                    (changed)="update(s.id, $event)"
                    (up)="move(i, -1)"
                    (down)="move(i, 1)"
                    (remove)="removeStep(s.id)"
                  />
                </li>
              }
            </ol>
          } @else {
            <app-tool-empty icon="list-ordered">No steps yet. Pick a ready-made pipeline or add a step below. Steps run from top to bottom.</app-tool-empty>
          }
          <app-tool-select fieldId="tc-add" label="Add a step" placeholder="Choose a step to add..." [control]="addCtl" [options]="stepOptions" />
          <p class="tool-meta">
            Extraction uses simple patterns: emails need a name, an @ and a domain with a dot; links start with http, https or www; numbers use ASCII digits. They find the usual cases, not every valid address.
          </p>
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class TextCleanerTool {
  private readonly markUsed = toolUsage('text-cleaner');
  protected readonly trackCopy = toolCopied('text-cleaner');
  private readonly trackDownload = toolCopied('text-cleaner', { method: 'download' });

  protected readonly sample = SAMPLE;
  protected readonly maxFileMb = MAX_FILE_MB;
  protected readonly previewChars = PREVIEW_CHARS;
  protected readonly stepOptions = STEP_OPTIONS;
  protected readonly recipes = RECIPES;
  protected readonly fileLabel = of('Text file');

  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly addCtl = new FormControl('', { nonNullable: true });
  protected readonly text = debouncedControlSignal(this.textCtl);

  protected readonly steps = signal<Step[]>([]);
  protected readonly result = signal<PipelineResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly fileError = signal('');
  private readonly shuffleCount = signal(0);
  private nextId = 1;
  private seq = 0;

  protected readonly preview = computed(() => {
    const t = this.result()?.text ?? '';
    return t.length > PREVIEW_CHARS ? t.slice(0, PREVIEW_CHARS) + '\n...' : t;
  });
  protected readonly hasRandom = computed(() => this.steps().some((s) => s.type === 'sort' && s.params['order'] === 'random'));
  protected readonly metaLine = computed(() => {
    const r = this.result();
    if (!r) return '';
    return `${r.lines.length.toLocaleString('en-US')} ${r.lines.length === 1 ? 'line' : 'lines'} from ${r.inputLines.toLocaleString('en-US')}`;
  });

  constructor() {
    // Start with the common "clean up a list" pipeline.
    this.setSteps(RECIPES[0]);
    this.addCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      if (!type) return;
      this.steps.update((s) => [...s, this.makeStep(type as StepType)]);
      this.addCtl.setValue('', { emitEvent: false });
    });
    effect(() => {
      const text = this.text();
      const steps = this.steps();
      this.shuffleCount();
      untracked(() => void this.run(text, steps));
    });
  }

  protected label(type: StepType): string {
    return STEP_DEFS[type].label;
  }

  private makeStep(type: StepType, params: StepParams = {}): Step {
    return { id: this.nextId++, type, params: { ...defaultParams(type), ...params } };
  }

  private setSteps(recipe: Recipe): void {
    this.steps.set(recipe.steps.map(([type, params]) => this.makeStep(type, params)));
  }

  protected useRecipe(recipe: Recipe): void {
    this.setSteps(recipe);
  }

  protected update(id: number, params: StepParams): void {
    this.steps.update((list) => list.map((s) => (s.id === id ? { ...s, params } : s)));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.steps.update((list) => {
      const next = list.slice();
      const to = index + delta;
      if (to < 0 || to >= next.length) return list;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  protected removeStep(id: number): void {
    this.steps.update((list) => list.filter((s) => s.id !== id));
  }

  protected reshuffle(): void {
    this.shuffleCount.update((n) => n + 1);
  }

  protected download(): void {
    const r = this.result();
    if (!r?.text) return;
    downloadTextFile('cleaned.txt', r.text);
    this.trackDownload();
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.fileError.set('');
    if (!picked) return;
    const res = await readTextFile(picked, MAX_FILE_MB);
    if (res.ok) this.textCtl.setValue(res.text);
    else this.fileError.set(res.error);
  }

  private async run(text: string, steps: Step[]): Promise<void> {
    const id = ++this.seq;
    if (!text) {
      this.result.set(null);
      this.busy.set(false);
      return;
    }
    this.markUsed();
    const big = text.length > 100_000;
    if (big) {
      this.busy.set(true);
      await yieldToBrowser();
      if (id !== this.seq) return;
    }
    try {
      this.result.set(runPipeline(text, steps));
    } finally {
      if (id === this.seq) this.busy.set(false);
    }
  }
}
