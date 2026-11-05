import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { decodeBase64, encodeBase64, encodeBytes, formatBytes } from '../tool-logic-2';

const MAX_FILE = 10 * 1024 * 1024;

/** /tools/base64-encoder: UTF-8 safe text encode/decode, Base64url, and file → Base64 / data URL. */
@Component({
  selector: 'app-base64-encoder',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="base64-encoder">
      <div class="tool-row" role="radiogroup" aria-label="Mode">
        <label class="tool-check"><input type="radio" name="mode" [checked]="mode() === 'encode'" (change)="mode.set('encode')" /> Encode</label>
        <label class="tool-check"><input type="radio" name="mode" [checked]="mode() === 'decode'" (change)="mode.set('decode')" /> Decode</label>
        <label class="tool-check"><input type="checkbox" [checked]="urlSafe()" (change)="urlSafe.set(!urlSafe())" /> URL-safe (Base64url)</label>
      </div>
      <div class="tool-field">
        <label class="tool-label" for="b64in">{{ mode() === 'encode' ? 'Text' : 'Base64' }}</label>
        <textarea id="b64in" class="tool-textarea" spellcheck="false" [value]="input()" (input)="onInput($event)"></textarea>
      </div>

      @if (mode() === 'encode' && input()) {
        <pre class="tool-output">{{ encoded() }}</pre>
        <button type="button" class="tool-btn" (click)="copy(encoded())">Copy Base64</button>
      } @else if (mode() === 'decode') {
        @if (decoded(); as d) {
          @if (d.ok) {
            <pre class="tool-output">{{ d.text }}</pre>
            <button type="button" class="tool-btn" (click)="copy(d.text)">Copy text</button>
          } @else {
            <p class="tool-error" role="alert">{{ d.error }}</p>
          }
        }
      }

      <div class="tool-field tool-section">
        <label class="tool-label" for="b64file">Or encode a file (max 10 MB)</label>
        <input id="b64file" type="file" class="tool-input" (change)="onFile($event)" />
      </div>
      @if (file(); as f) {
        <p class="tool-status">{{ f.name }} · {{ f.size }} · {{ f.type || 'unknown type' }} → {{ f.b64Size }}</p>
        <div class="tool-row">
          <button type="button" class="tool-btn" (click)="copy(f.b64)">Copy Base64</button>
          <button type="button" class="tool-btn" (click)="copy(f.dataUrl)">Copy data: URL</button>
        </div>
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class Base64EncoderTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly mode = signal<'encode' | 'decode'>('encode');
  protected readonly urlSafe = signal(false);
  protected readonly input = signal('');
  protected readonly encoded = computed(() => encodeBase64(this.input(), this.urlSafe()));
  protected readonly decoded = computed(() => decodeBase64(this.input()));
  protected readonly file = signal<{ name: string; size: string; type: string; b64: string; dataUrl: string; b64Size: string } | null>(null);
  protected readonly status = signal('');

  protected onInput(event: Event): void {
    this.input.set((event.target as HTMLTextAreaElement).value);
    this.markUsed();
  }

  protected async onFile(event: Event): Promise<void> {
    const picked = (event.target as HTMLInputElement).files?.[0];
    if (!picked) return;
    if (picked.size > MAX_FILE) {
      this.file.set(null);
      this.status.set('That file is larger than 10 MB. Base64 would make it about 33% bigger again.');
      return;
    }
    const bytes = new Uint8Array(await picked.arrayBuffer());
    const b64 = encodeBytes(bytes, this.urlSafe());
    this.file.set({
      name: picked.name,
      size: formatBytes(picked.size),
      type: picked.type,
      b64,
      dataUrl: `data:${picked.type || 'application/octet-stream'};base64,${encodeBytes(bytes)}`,
      b64Size: formatBytes(b64.length),
    });
    this.status.set('');
    this.markUsed();
  }

  private markUsed(): void {
    if (!this.used) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'base64-encoder' });
    }
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'base64-encoder' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
