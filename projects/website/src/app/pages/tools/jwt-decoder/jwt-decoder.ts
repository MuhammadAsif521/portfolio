import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { decodeJwt } from '../tool-logic';

/** /tools/jwt-decoder: decode only (never verifies). Warns against pasting production secrets. */
@Component({
  selector: 'app-jwt-decoder',
  imports: [ToolLayout, JsonPipe],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="jwt-decoder">
      <p class="tool-warn">
        Decoding only: the signature is <strong>not</strong> verified. Do not paste production secrets or live
        tokens. Nothing leaves your browser.
      </p>
      <div class="tool-field">
        <label class="tool-label" for="jwt">JSON Web Token</label>
        <textarea id="jwt" class="tool-textarea" spellcheck="false" autocomplete="off"
          placeholder="eyJhbGciOiJIUzI1NiIs..." (input)="onInput($event)"></textarea>
      </div>

      @if (result(); as r) {
        @if (r.ok) {
          <div class="tool-grid">
            <div>
              <h3 class="tool-label">Header</h3>
              <pre class="tool-output">{{ r.value.header | json }}</pre>
            </div>
            <div>
              <h3 class="tool-label">Payload</h3>
              <pre class="tool-output">{{ r.value.payload | json }}</pre>
            </div>
          </div>
          @if (r.value.times.length) {
            <ul class="tool-status">
              @for (t of r.value.times; track t.claim) {
                <li><strong>{{ t.claim }}</strong>: {{ t.iso }}</li>
              }
            </ul>
          }
          @if (r.value.expired !== null) {
            <p class="tool-status" role="status">
              This token {{ r.value.expired ? 'has expired' : 'has not expired yet' }}.
            </p>
          }
          <button type="button" class="tool-btn" (click)="copy(r.value.payload)">Copy payload JSON</button>
        } @else {
          <p class="tool-error" role="alert">{{ r.error }}</p>
        }
      }
      <p class="tool-status" aria-live="polite">{{ status() }}</p>
    </app-tool-layout>
  `,
})
export class JwtDecoderTool {
  private readonly analytics = inject(AnalyticsService);
  private used = false;

  protected readonly token = signal('');
  protected readonly result = computed(() => decodeJwt(this.token()));
  protected readonly status = signal('');

  protected onInput(event: Event): void {
    this.token.set((event.target as HTMLTextAreaElement).value);
    if (!this.used && this.result()?.ok) {
      this.used = true;
      this.analytics.track('tool_used', { tool: 'jwt-decoder' });
    }
  }

  protected async copy(payload: unknown): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.status.set('Copied.');
      this.analytics.track('result_copied', { tool: 'jwt-decoder' });
    } catch {
      this.status.set('Copy failed. Select the text and copy it manually.');
    }
  }
}
