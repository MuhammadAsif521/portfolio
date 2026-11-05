import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolTextarea } from '../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../ui/tool-kit/tool-form';
import { ToolKeyValue } from '../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { decodeJwt } from '../tool-logic';

/** The public example token from the JWT spec site (HS256, no real secret). */
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/** /tools/jwt-decoder: decode only (never verifies). Warns against pasting production secrets. */
@Component({
  selector: 'app-jwt-decoder',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty, ToolButton],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="jwt-decoder">
      <div class="tool-stack">
        <app-tool-note kind="warn">
          Decoding only: the signature is <strong>not</strong> verified. Do not paste production secrets or live
          tokens. Nothing leaves your browser.
        </app-tool-note>

        <div class="tool-split">
          <app-tool-panel title="Token">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="tokenCtl.setValue(sample)" />
              <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!token()" (pressed)="tokenCtl.setValue('')" />
            </ng-container>
            <app-tool-textarea
              fieldId="jwt-token"
              label="JSON Web Token"
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              hint="Paste the whole token. A leading Bearer prefix is ignored."
              [control]="tokenCtl"
              [rows]="12"
              [wrap]="true"
              [invalid]="result()?.ok === false"
            />
          </app-tool-panel>

          <app-tool-panel title="Decoded">
            @if (result(); as r) {
              @if (r.ok) {
                <app-tool-output label="Header" [value]="header()" (copied)="trackCopy()" />
                <app-tool-output label="Payload" copyLabel="Copy payload JSON" [value]="payload()" (copied)="trackCopy()" />
                @if (r.value.times.length) {
                  <app-tool-output label="Time claims">
                    <app-tool-key-value [rows]="times()" />
                  </app-tool-output>
                }
                @if (r.value.expired !== null) {
                  <app-tool-note [kind]="r.value.expired ? 'warn' : 'success'">
                    This token {{ r.value.expired ? 'has expired' : 'has not expired yet' }}.
                  </app-tool-note>
                }
              } @else {
                <app-tool-note kind="error">{{ r.error }}</app-tool-note>
              }
            } @else {
              <app-tool-empty icon="key-round">Paste a token on the left to read its header, payload and expiry.</app-tool-empty>
            }
          </app-tool-panel>
        </div>
      </div>
    </app-tool-layout>
  `,
})
export class JwtDecoderTool {
  private readonly markUsed = toolUsage('jwt-decoder');
  protected readonly trackCopy = toolCopied('jwt-decoder');

  protected readonly sample = SAMPLE;
  protected readonly tokenCtl = new FormControl('', { nonNullable: true });
  protected readonly token = controlSignal(this.tokenCtl);
  protected readonly result = computed(() => decodeJwt(this.token()));
  protected readonly header = computed(() => this.pretty('header'));
  protected readonly payload = computed(() => this.pretty('payload'));
  protected readonly times = computed(() => {
    const r = this.result();
    return r?.ok ? r.value.times.map((t) => ({ label: t.claim, value: t.iso })) : [];
  });

  constructor() {
    this.tokenCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.result()?.ok && this.markUsed());
  }

  private pretty(part: 'header' | 'payload'): string {
    const r = this.result();
    return r?.ok ? JSON.stringify(r.value[part], null, 2) : '';
  }
}
