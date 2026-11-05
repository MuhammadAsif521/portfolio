import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolCopy } from '../../../ui/tool-kit/tool-copy';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolTextarea, ToolToggle } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { decodeBase64, encodeBase64, encodeBytes, formatBytes } from '../tool-logic-2';

const MAX_FILE_MB = 10;
const MODES: NavTab[] = [
  { label: 'Encode', value: 'encode', icon: 'binary' },
  { label: 'Decode', value: 'decode', icon: 'file-code' },
];

interface Base64File {
  rows: ToolRow[];
  b64: string;
  dataUrl: string;
}

/** /tools/base64-encoder: UTF-8 safe text encode/decode, Base64url, and file → Base64 / data URL. */
@Component({
  selector: 'app-base64-encoder',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolTextarea,
    ToolToggle,
    ToolOutput,
    ToolKeyValue,
    ToolCopy,
    ToolNote,
    ToolEmpty,
    ToolButton,
    TabsComponent,
    CustomFileInputComponent,
  ],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="base64-encoder">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Text">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!input()" (pressed)="inputCtl.setValue('')" />
            </ng-container>
            <div role="group" aria-label="Mode">
              <app-custom-tabs [tabs]="modes" [activeTab]="mode()" (activeTabChange)="setMode($event)" />
            </div>
            <app-tool-textarea
              fieldId="b64-input"
              [label]="mode() === 'encode' ? 'Text to encode' : 'Base64 to decode'"
              [placeholder]="mode() === 'encode' ? 'Hello, world' : 'SGVsbG8sIHdvcmxk'"
              [control]="inputCtl"
              [rows]="9"
              [wrap]="true"
              [invalid]="mode() === 'decode' && decoded()?.ok === false"
            />
            @if (mode() === 'encode') {
              <app-tool-toggle fieldId="b64-urlsafe" label="URL-safe (Base64url)" hint="Uses - and _ and drops the = padding" [control]="urlSafeCtl" />
            }
          </app-tool-panel>

          <app-tool-panel title="Result">
            @if (mode() === 'encode') {
              @if (input()) {
                <app-tool-output label="Base64" copyLabel="Copy Base64" [value]="encoded()" (copied)="trackCopy()" />
              } @else {
                <app-tool-empty icon="binary">Type or paste text on the left to encode it. UTF-8 and emoji are handled.</app-tool-empty>
              }
            } @else {
              @if (decoded(); as d) {
                @if (d.ok) {
                  <app-tool-output label="Decoded text" copyLabel="Copy text" [value]="d.text" (copied)="trackCopy()" />
                } @else {
                  <app-tool-note kind="error">{{ d.error }}</app-tool-note>
                }
              } @else {
                <app-tool-empty icon="binary">Paste Base64 on the left to decode it. Base64url input works too.</app-tool-empty>
              }
            }
          </app-tool-panel>
        </div>

        <app-tool-panel title="Or encode a file">
          <app-custom-file-input
            controlName="b64-file"
            [label$]="fileLabel"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxFileMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            placeholder="Choose a file or drag it here"
            (file)="onFile($event)"
          />
          <p class="tool-meta">Files are read in your browser and never uploaded.</p>
          @if (fileError()) {
            <app-tool-note kind="error">{{ fileError() }}</app-tool-note>
          }
          @if (file(); as f) {
            <app-tool-output label="File as Base64" [meta]="f.b64.length + ' characters'">
              <app-tool-key-value [rows]="f.rows" />
              <div class="tool-actions tool-actions--top">
                <app-tool-copy label="Copy Base64" [dark]="true" [text]="f.b64" (copied)="trackCopy()" />
                <app-tool-copy label="Copy data: URL" [dark]="true" [text]="f.dataUrl" (copied)="trackCopy()" />
              </div>
            </app-tool-output>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class Base64EncoderTool {
  private readonly markUsed = toolUsage('base64-encoder');
  protected readonly trackCopy = toolCopied('base64-encoder');

  protected readonly modes = MODES;
  protected readonly maxFileMb = MAX_FILE_MB;
  protected readonly fileLabel = of('File');
  protected readonly mode = signal<'encode' | 'decode'>('encode');
  protected readonly inputCtl = new FormControl('', { nonNullable: true });
  protected readonly urlSafeCtl = new FormControl(false, { nonNullable: true });
  protected readonly input = controlSignal(this.inputCtl);
  private readonly urlSafe = controlSignal(this.urlSafeCtl);
  protected readonly encoded = computed(() => encodeBase64(this.input(), this.urlSafe()));
  protected readonly decoded = computed(() => decodeBase64(this.input()));
  protected readonly file = signal<Base64File | null>(null);
  protected readonly fileError = signal('');

  constructor() {
    this.inputCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => v && this.markUsed());
  }

  protected setMode(value: string): void {
    this.mode.set(value === 'decode' ? 'decode' : 'encode');
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.fileError.set('');
    if (!picked) {
      this.file.set(null);
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      this.file.set(null);
      this.fileError.set('That file is larger than 10 MB. Base64 would make it about 33% bigger again.');
      return;
    }
    const bytes = new Uint8Array(await picked.arrayBuffer());
    const b64 = encodeBytes(bytes, this.urlSafe());
    const type = picked.type || 'application/octet-stream';
    this.file.set({
      b64,
      dataUrl: `data:${type};base64,${encodeBytes(bytes)}`,
      rows: [
        { label: 'Name', value: picked.name },
        { label: 'Size', value: formatBytes(picked.size) },
        { label: 'Type', value: picked.type || 'unknown type' },
        { label: 'Base64 size', value: formatBytes(b64.length) },
      ],
    });
    this.markUsed();
  }
}
