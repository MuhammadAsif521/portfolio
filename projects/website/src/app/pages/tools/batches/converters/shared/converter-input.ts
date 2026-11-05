import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { MAX_INPUT_MB, WORKER_THRESHOLD } from './convert-common';

/** Key of the text a sibling converter hands over through the router state ("use this as input"). */
export const HANDOFF_KEY = 'converterInput';

/**
 * The input side of every text converter: a code textarea, a file drop zone, "Load sample" and "Clear".
 * Pasted or loaded text goes into `text`. A file above ~1 MB is kept out of the textarea (a multi-megabyte
 * textarea is slow to scroll and type in) and shown as a one-line summary instead; the conversion then runs
 * in a Web Worker. Options of the tool are projected into the panel body.
 */
@Component({
  selector: 'app-converter-input',
  imports: [ToolPanel, ToolTextarea, ToolButton, ToolNote, CustomFileInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../tool-ui.scss',
  template: `
    <app-tool-panel [title]="title()">
      <ng-container ngProjectAs="[panelActions]">
        @if (sample()) {
          <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="loadSample()" />
        }
        <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!text() && !bigName()" (pressed)="clear()" />
      </ng-container>

      @if (bigName(); as name) {
        <app-tool-note kind="info">
          <strong>{{ name }}</strong> ({{ bigSize() }}) is loaded. It is not shown in the editor so the page stays fast; the result appears next to it.
        </app-tool-note>
      } @else {
        <app-tool-textarea
          [fieldId]="fieldId()"
          [label]="label()"
          [placeholder]="placeholder()"
          [control]="ctl"
          [rows]="rows()"
          [invalid]="invalid()"
          [hint]="hint()"
        />
      }

      @for (key of [fileKey()]; track key) {
        <app-custom-file-input
          [controlName]="fieldId() + '-file'"
          [label$]="fileLabel"
          [accept]="accept()"
          [multiple]="false"
          [showLabel]="false"
          [maxFileSize]="maxMb"
          [scanFiles]="false"
          [sanitizeNames]="false"
          placeholder="Or choose a file, or drag it here"
          (file)="onFile($event)"
        />
      }
      <p class="tool-meta">Files are read in your browser and never uploaded. Up to {{ maxMb }} MB, UTF-8 text.</p>
      @if (fileError()) {
        <app-tool-note kind="error">{{ fileError() }}</app-tool-note>
      }
      <ng-content />
    </app-tool-panel>
  `,
})
export class ConverterInput implements OnInit {
  readonly title = input('Input');
  /** Unique on the page. */
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly hint = input('');
  readonly sample = input('');
  readonly accept = input('.txt');
  readonly rows = input(12);
  readonly invalid = input(false);

  /** The text to convert (two-way: [(text)]). */
  readonly text = model('');
  /** Name of the loaded file, used to name the download (two-way). */
  readonly sourceName = model('');

  protected readonly maxMb = MAX_INPUT_MB;
  protected readonly fileLabel = of('File');
  protected readonly ctl = new FormControl('', { nonNullable: true });
  protected readonly bigName = signal('');
  protected readonly bigSize = signal('');
  protected readonly fileError = signal('');
  protected readonly fileKey = signal(0);

  constructor() {
    this.ctl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.text.set(value));
  }

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Text handed over by a sibling tool ("Use as input in ..."). Read after the parent's bindings are set, so `text` reaches the parent. */
  ngOnInit(): void {
    if (!this.browser) return;
    const handed = (history.state as Record<string, unknown> | null)?.[HANDOFF_KEY];
    if (typeof handed === 'string' && handed) this.ctl.setValue(handed);
  }

  protected loadSample(): void {
    this.reset();
    this.ctl.setValue(this.sample());
  }

  protected clear(): void {
    this.reset();
    this.ctl.setValue('');
    this.text.set('');
  }

  private reset(): void {
    this.bigName.set('');
    this.bigSize.set('');
    this.fileError.set('');
    this.sourceName.set('');
    this.fileKey.update((k) => k + 1);
  }

  protected async onFile(picked: File | File[] | null): Promise<void> {
    const file = Array.isArray(picked) ? picked[0] : picked;
    this.fileError.set('');
    if (!file) return;
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      this.fileError.set(
        `That file is ${formatBytes(file.size)}. The limit is ${MAX_INPUT_MB} MB: a browser tab cannot hold much more as text. Use a command-line tool for bigger files.`,
      );
      return;
    }
    try {
      const content = await file.text();
      if (content.includes('\u0000')) {
        this.fileError.set('This looks like a binary file, not text. Choose a plain-text file (UTF-8).');
        return;
      }
      this.sourceName.set(file.name);
      if (content.length > WORKER_THRESHOLD) {
        this.bigName.set(file.name);
        this.bigSize.set(formatBytes(file.size));
        this.ctl.setValue('', { emitEvent: false });
        this.text.set(content);
      } else {
        this.bigName.set('');
        this.ctl.setValue(content);
      }
    } catch {
      this.fileError.set('This file could not be read. Check that it is a text file and try again.');
    }
  }
}
