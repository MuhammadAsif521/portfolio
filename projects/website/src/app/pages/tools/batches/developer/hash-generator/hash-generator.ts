import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, merge, of } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import {
  MAX_HASH_BYTES,
  bytesToBase64,
  bytesToHex,
  compareDigest,
  hashAll,
  hexToBytes,
  readFileBytes,
  utf8,
  type CompareResult,
  type HashAlgo,
  type HashOutcome,
} from './hash-logic';

const SOURCES: NavTab[] = [
  { label: 'Text', value: 'text' },
  { label: 'File', value: 'file' },
];

const OUTPUT_FORMATS = [
  { id: 'hex', name: 'Hex' },
  { id: 'base64', name: 'Base64' },
];

const KEY_FORMATS = [
  { id: 'text', name: 'Text (UTF-8)' },
  { id: 'hex', name: 'Hex bytes' },
];

const HEX_LENGTH_HINT: Record<number, string> = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' };

/** /tools/hash-generator: MD5 and SHA family digests of text or a file, optional HMAC, and a compare field. */
@Component({
  selector: 'app-hash-generator',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolTextarea,
    ToolInput,
    ToolSelect,
    ToolToggle,
    ToolOutput,
    ToolKeyValue,
    ToolNote,
    ToolEmpty,
    ToolButton,
    TabsComponent,
    CustomFileInputComponent,
  ],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="hash-generator">
      <div class="tool-split">
        <app-tool-panel title="Input">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!hasInput()" (pressed)="clear()" />
          </ng-container>
          <div role="group" aria-label="What to hash">
            <app-custom-tabs [tabs]="sources" [activeTab]="source()" (activeTabChange)="setSource($event)" />
          </div>

          @if (source() === 'text') {
            <app-tool-textarea fieldId="hash-text" label="Text to hash" placeholder="Type or paste text" [control]="textCtl" [rows]="7" [wrap]="true" />
          } @else {
            <app-custom-file-input
              controlName="hash-file"
              [label$]="fileLabel"
              [multiple]="false"
              [showLabel]="false"
              [maxFileSize]="maxFileMb"
              [scanFiles]="false"
              [sanitizeNames]="false"
              placeholder="Choose a file or drag it here"
              (file)="onFile($event)"
            />
            <p class="tool-meta">The file is read in your browser and never uploaded. Up to {{ maxFileMb }} MB.</p>
            @if (fileError()) {
              <app-tool-note kind="error">{{ fileError() }}</app-tool-note>
            }
          }

          <div class="tool-controls">
            <app-tool-select fieldId="hash-format" label="Output format" [control]="formatCtl" [options]="outputFormats" />
            <app-tool-toggle fieldId="hash-upper" label="Uppercase hex" hint="Only changes hex output" [control]="upperCtl" />
          </div>

          <app-tool-toggle fieldId="hash-hmac" label="HMAC mode" hint="Keyed hash: proves who made it, not just what it contains" [control]="hmacCtl" />
          @if (hmac()) {
            <div class="tool-controls">
              <app-tool-input fieldId="hash-key" label="Secret key" placeholder="your secret" [control]="keyCtl" [invalid]="!!keyError()" />
              <app-tool-select fieldId="hash-key-format" label="Key is" [control]="keyFormatCtl" [options]="keyFormats" />
            </div>
            @if (keyError()) {
              <app-tool-note kind="error">{{ keyError() }}</app-tool-note>
            }
          }
        </app-tool-panel>

        <app-tool-panel title="Digests">
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          @if (busy(); as b) {
            <app-tool-note kind="info">Hashing {{ b.algo }}: {{ b.percent }}%</app-tool-note>
          }
          @if (rows().length) {
            <app-tool-output [label]="hmac() ? 'HMAC' : 'Hash'" [meta]="meta()" [copyText]="allText()" copyLabel="Copy all" (copied)="trackCopy()">
              <app-tool-key-value [rows]="rows()" (copied)="trackCopy()" />
            </app-tool-output>

            <app-tool-input
              fieldId="hash-expected"
              label="Compare with an expected hash"
              placeholder="Paste the hash you were given"
              hint="Hex (any case, colons allowed) or Base64"
              [control]="expectedCtl"
              [invalid]="comparison() === 'mismatch'"
            />
            @switch (comparison()) {
              @case ('mismatch') {
                <app-tool-note kind="error">
                  Does not match any of the hashes above.{{ lengthHint() }} A single changed byte, a different line ending or a different key gives a completely different hash.
                </app-tool-note>
              }
              @case ('hex') {
                <app-tool-note kind="success">Match: it equals the {{ matchedAlgo() }} value (hex).</app-tool-note>
              }
              @case ('base64') {
                <app-tool-note kind="success">Match: it equals the {{ matchedAlgo() }} value (Base64).</app-tool-note>
              }
            }

            @if (hasWeak()) {
              <app-tool-note kind="warn">
                MD5 and SHA-1 are broken for security (collisions can be made on purpose). They are fine for spotting accidental corruption. For passwords use Argon2, bcrypt or scrypt, never a plain hash.
              </app-tool-note>
            }
          } @else if (!busy()) {
            <app-tool-empty icon="hash">
              {{ source() === 'text' ? 'Type some text on the left to see its MD5, SHA-1, SHA-256, SHA-384 and SHA-512 hashes.' : 'Choose a file to see its hashes.' }}
            </app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class HashGeneratorTool {
  private readonly markUsed = toolUsage('hash-generator');
  protected readonly trackCopy = toolCopied('hash-generator');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sources = SOURCES;
  protected readonly outputFormats = OUTPUT_FORMATS;
  protected readonly keyFormats = KEY_FORMATS;
  protected readonly maxFileMb = Math.floor(MAX_HASH_BYTES / (1024 * 1024));
  protected readonly fileLabel = of('File');

  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly keyCtl = new FormControl('', { nonNullable: true });
  protected readonly keyFormatCtl = new FormControl('text', { nonNullable: true });
  protected readonly formatCtl = new FormControl('hex', { nonNullable: true });
  protected readonly upperCtl = new FormControl(false, { nonNullable: true });
  protected readonly hmacCtl = new FormControl(false, { nonNullable: true });
  protected readonly expectedCtl = new FormControl('', { nonNullable: true });

  protected readonly source = signal<'text' | 'file'>('text');
  protected readonly hmac = controlSignal(this.hmacCtl);
  private readonly text = controlSignal(this.textCtl);
  private readonly key = controlSignal(this.keyCtl);
  private readonly keyFormat = controlSignal(this.keyFormatCtl);
  private readonly format = controlSignal(this.formatCtl);
  private readonly upper = controlSignal(this.upperCtl);
  private readonly expected = controlSignal(this.expectedCtl);

  protected readonly fileError = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal<{ algo: HashAlgo; percent: number } | null>(null);
  private readonly outcomes = signal<HashOutcome[]>([]);
  private readonly file = signal<{ name: string; bytes: Uint8Array } | null>(null);
  private run = 0;
  private readRun = 0;

  protected readonly hasInput = computed(() => (this.source() === 'text' ? !!this.text() : !!this.file()));
  protected readonly keyError = computed(() => {
    if (!this.hmac() || this.keyFormat() !== 'hex' || !this.key().trim()) return '';
    return hexToBytes(this.key()) ? '' : 'The key is not valid hex. Use pairs of 0-9 and a-f, for example 0b0b0b0b.';
  });

  protected readonly rows = computed<ToolRow[]>(() =>
    this.outcomes().map((o) => ({ label: o.algo, value: this.show(o.bytes), copy: true })),
  );
  protected readonly allText = computed(() => this.rows().map((r) => `${r.label}: ${r.value}`).join('\n'));
  protected readonly meta = computed(() => {
    const f = this.file();
    return this.source() === 'file' && f ? `${f.name} · ${formatBytes(f.bytes.length)}` : this.hmac() ? 'Keyed with your secret' : '';
  });
  protected readonly hasWeak = computed(() => this.outcomes().some((o) => o.algo === 'MD5' || o.algo === 'SHA-1'));

  protected readonly comparison = computed<CompareResult>(() => {
    const expected = this.expected();
    if (!expected.trim()) return 'empty';
    let best: CompareResult = 'mismatch';
    for (const o of this.outcomes()) {
      const r = compareDigest(expected, o.bytes);
      if (r !== 'mismatch') {
        best = r;
        break;
      }
    }
    return best;
  });
  protected readonly matchedAlgo = computed(() => {
    const expected = this.expected();
    return this.outcomes().find((o) => compareDigest(expected, o.bytes) !== 'mismatch')?.algo ?? '';
  });
  protected readonly lengthHint = computed(() => {
    const hex = this.expected().replace(/[\s:]/g, '');
    const guess = /^[0-9a-f]+$/i.test(hex) ? HEX_LENGTH_HINT[hex.length] : undefined;
    return guess ? ` The length suggests ${guess}.` : '';
  });

  constructor() {
    merge(this.textCtl.valueChanges, this.keyCtl.valueChanges, this.keyFormatCtl.valueChanges, this.hmacCtl.valueChanges)
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.recompute());
  }

  protected setSource(value: string): void {
    this.source.set(value === 'file' ? 'file' : 'text');
    void this.recompute();
  }

  protected clear(): void {
    this.textCtl.setValue('');
    this.expectedCtl.setValue('');
    this.file.set(null);
    this.fileError.set('');
    void this.recompute();
  }

  protected async onFile(picked: File | null): Promise<void> {
    this.fileError.set('');
    if (!picked) {
      this.file.set(null);
      void this.recompute();
      return;
    }
    if (picked.size > MAX_HASH_BYTES) {
      this.fileError.set(`That file is larger than ${this.maxFileMb} MB. Hashing with SHA needs the whole file in memory, so use a command-line tool such as sha256sum for files this big.`);
      return;
    }
    const reading = ++this.readRun;
    try {
      this.busy.set({ algo: 'MD5', percent: 0 });
      const bytes = await readFileBytes(picked, (f) => this.busy.set({ algo: 'MD5', percent: Math.round(f * 100) }));
      if (reading !== this.readRun) return;
      this.file.set({ name: picked.name, bytes });
      await this.recompute();
    } catch {
      this.busy.set(null);
      this.fileError.set('Could not read that file. It may have been moved or is not readable.');
    }
  }

  private show(bytes: Uint8Array): string {
    return this.format() === 'base64' ? bytesToBase64(bytes) : bytesToHex(bytes, this.upper());
  }

  private async recompute(): Promise<void> {
    const run = ++this.run;
    this.error.set('');
    const data = this.source() === 'file' ? this.file()?.bytes : this.text() ? utf8(this.text()) : undefined;
    if (!data) {
      this.outcomes.set([]);
      this.busy.set(null);
      return;
    }
    let key: Uint8Array | undefined;
    if (this.hmac()) {
      key = this.keyFormat() === 'hex' ? (hexToBytes(this.key()) ?? undefined) : utf8(this.key());
      if (!key) {
        this.outcomes.set([]);
        return;
      }
    }
    try {
      const out = await hashAll({
        data,
        key,
        onProgress: (algo, fraction) => {
          if (run === this.run && data.length > 4 * 1024 * 1024) this.busy.set({ algo, percent: Math.round(fraction * 100) });
        },
      });
      if (run !== this.run) return;
      this.outcomes.set(out);
      this.markUsed();
    } catch (e) {
      if (run === this.run) {
        this.outcomes.set([]);
        this.error.set(e instanceof Error && /Web Crypto/.test(e.message) ? e.message : 'Could not compute the hashes. Try a smaller input or a different browser.');
      }
    } finally {
      if (run === this.run) this.busy.set(null);
    }
  }
}
