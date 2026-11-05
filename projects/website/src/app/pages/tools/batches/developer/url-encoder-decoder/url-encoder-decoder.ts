import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import {
  decodeLenient,
  decodeText,
  detectDoubleEncoding,
  encodeText,
  parseUrl,
  rebuildUrl,
  type EncodeMode,
} from './url-logic';

const DIRECTIONS: NavTab[] = [
  { label: 'Encode', value: 'encode' },
  { label: 'Decode', value: 'decode' },
];

const MODES = [
  { id: 'component', name: 'Component: encodeURIComponent' },
  { id: 'uri', name: 'Whole URL: encodeURI' },
  { id: 'form', name: 'Form data: + for spaces' },
];

const MODE_HINT: Record<EncodeMode, string> = {
  component: 'Escapes everything except letters, digits and - _ . ! ~ * \' ( ). Use it for one query value, one path segment or one parameter.',
  uri: 'Keeps ; , / ? : @ & = + $ # so a complete URL stays usable. It will not protect & or = inside a value.',
  form: 'application/x-www-form-urlencoded, as HTML forms send it: spaces become +, and only letters, digits and * - . _ stay as they are.',
};

const SAMPLE_TEXT = 'name=Zoë & Co/2026 100%';
const SAMPLE_URL = 'https://user@münchen.example/search/ä%20b?q=hello+world&tag=a&tag=b%26c&page=2#results';

interface ParamRow {
  id: number;
  key: FormControl<string>;
  value: FormControl<string>;
}

let rowId = 0;

/** /tools/url-encoder-decoder: percent-encoding in three modes, a URL parser with editable query parameters. */
@Component({
  selector: 'app-url-encoder-decoder',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolInput, ToolSelect, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty, ToolButton, TabsComponent],
  styleUrls: ['../../../tool-ui.scss', './url-encoder-decoder.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="url-encoder-decoder">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Encode or decode">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="wand-sparkles" label="Example" (pressed)="textCtl.setValue(sampleText)" />
              <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!text()" (pressed)="textCtl.setValue('')" />
            </ng-container>
            <div role="group" aria-label="Direction">
              <app-custom-tabs [tabs]="directions" [activeTab]="direction()" (activeTabChange)="setDirection($event)" />
            </div>
            <app-tool-select fieldId="url-mode" label="Mode" [control]="modeCtl" [options]="modes" [hint]="modeHint()" />
            <app-tool-textarea
              fieldId="url-text"
              [label]="direction() === 'encode' ? 'Text to encode' : 'Encoded text to decode'"
              [placeholder]="direction() === 'encode' ? 'name=Zoë & Co' : 'name%3DZo%C3%AB%20%26%20Co'"
              [control]="textCtl"
              [rows]="8"
              [wrap]="true"
              [invalid]="!!decodeError()"
            />
          </app-tool-panel>

          <app-tool-panel title="Result">
            @if (decodeError(); as err) {
              <app-tool-note kind="error">{{ err }}</app-tool-note>
              @if (lenient()) {
                <app-tool-output label="Decoded as far as possible" copyLabel="Copy" [value]="lenient()" (copied)="trackCopy()" />
                <p class="tool-meta">Malformed sequences are left as they were so you can see where the text breaks.</p>
              }
            } @else if (encodeError(); as err) {
              <app-tool-note kind="error">{{ err }}</app-tool-note>
            } @else if (output(); as out) {
              <app-tool-output
                [label]="direction() === 'encode' ? 'Encoded' : 'Decoded'"
                [copyLabel]="direction() === 'encode' ? 'Copy encoded' : 'Copy decoded'"
                [meta]="out.length + ' characters'"
                [value]="out"
                (copied)="trackCopy()"
              />
            } @else {
              <app-tool-empty icon="link">Type or paste text on the left. {{ direction() === 'encode' ? 'It is escaped as you type.' : 'Percent-escapes such as %20 and %C3%A9 are turned back into characters.' }}</app-tool-empty>
            }

            @if (double().suspicious && direction() === 'decode') {
              <app-tool-note kind="warn">
                This text looks encoded {{ double().layers }} times (for example %2520 is %20 with its percent sign encoded again). One decode gives a still-encoded result.
              </app-tool-note>
              <app-tool-output label="Each decoding step" [copyText]="double().steps[double().steps.length - 1]" copyLabel="Copy fully decoded" (copied)="trackCopy()">
                <ol class="layers">
                  @for (step of double().steps; track $index) {
                    <li><span>{{ $index === 0 ? 'as pasted' : 'decode ' + $index }}</span>{{ step }}</li>
                  }
                </ol>
              </app-tool-output>
            } @else if (direction() === 'encode' && alreadyEncoded()) {
              <app-tool-note kind="warn">
                The text already contains percent-escapes such as %20. Encoding it again turns each % into %25, which is the usual cause of double-encoded URLs. Switch to Decode if it is already encoded.
              </app-tool-note>
            }
          </app-tool-panel>
        </div>

        <app-tool-panel title="Parse a URL">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Example" (pressed)="urlCtl.setValue(sampleUrl)" />
          </ng-container>
          <app-tool-input
            fieldId="url-parse"
            label="Full URL"
            placeholder="https://example.com/path?x=1#top"
            [control]="urlCtl"
            [invalid]="!!url() && !parsed().ok"
          />
          @if (parseError(); as err) {
            <app-tool-note kind="error">{{ err }}</app-tool-note>
          }
          @if (parts().length) {
            <div class="tool-split">
              <app-tool-output label="Parts" (copied)="trackCopy()">
                <app-tool-key-value [rows]="parts()" (copied)="trackCopy()" />
              </app-tool-output>
              <div class="param-list">
                <h4 class="tool-group">Query parameters</h4>
                @for (row of paramRows(); track row.id) {
                  <div class="param-row">
                    <app-tool-input [fieldId]="'url-pk-' + row.id" [label]="'Name ' + ($index + 1)" [control]="row.key" />
                    <app-tool-input [fieldId]="'url-pv-' + row.id" [label]="'Value ' + ($index + 1)" [control]="row.value" />
                    <app-tool-button size="small" icon="x" label="Remove" (pressed)="removeParam(row.id)" />
                  </div>
                } @empty {
                  <p class="tool-meta">This URL has no query parameters.</p>
                }
                <div class="tool-actions">
                  <app-tool-button size="small" icon="plus" label="Add parameter" (pressed)="addParam()" />
                </div>
                @if (rebuilt(); as built) {
                  <app-tool-output label="Rebuilt URL" copyLabel="Copy URL" [value]="built" (copied)="trackCopy()" />
                  <div class="tool-actions">
                    <app-tool-button size="small" label="Use as the URL above" [disabled]="built === normalizedHref()" (pressed)="urlCtl.setValue(built)" />
                  </div>
                  <p class="tool-meta">Edited parameters are written in form encoding, so spaces become +.</p>
                }
              </div>
            </div>
          } @else if (!parseError()) {
            <app-tool-empty icon="link">Paste a full URL to see its protocol, host, port, path, parameters and fragment, and to edit the parameters.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class UrlEncoderDecoderTool {
  private readonly markUsed = toolUsage('url-encoder-decoder');
  protected readonly trackCopy = toolCopied('url-encoder-decoder');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly directions = DIRECTIONS;
  protected readonly modes = MODES;
  protected readonly sampleText = SAMPLE_TEXT;
  protected readonly sampleUrl = SAMPLE_URL;
  protected readonly direction = signal<'encode' | 'decode'>('encode');
  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly modeCtl = new FormControl('component', { nonNullable: true });
  protected readonly urlCtl = new FormControl('', { nonNullable: true });
  protected readonly text = controlSignal(this.textCtl);
  private readonly mode = controlSignal(this.modeCtl);
  protected readonly url = controlSignal(this.urlCtl);

  protected readonly modeHint = computed(() => MODE_HINT[this.mode() as EncodeMode] ?? '');

  private readonly encoded = computed(() => (this.direction() === 'encode' && this.text() ? encodeText(this.text(), this.mode() as EncodeMode) : null));
  private readonly decoded = computed(() => (this.direction() === 'decode' && this.text() ? decodeText(this.text(), this.mode() as EncodeMode) : null));
  protected readonly encodeError = computed(() => {
    const e = this.encoded();
    return e && !e.ok ? e.error : '';
  });
  protected readonly decodeError = computed(() => {
    const d = this.decoded();
    return d && !d.ok ? d.error : '';
  });
  protected readonly lenient = computed(() => (this.decodeError() ? decodeLenient(this.text(), this.mode() as EncodeMode) : ''));
  protected readonly output = computed(() => {
    const e = this.encoded();
    if (e?.ok) return e.text;
    const d = this.decoded();
    return d?.ok ? d.text : '';
  });
  protected readonly double = computed(() => detectDoubleEncoding(this.text()));
  protected readonly alreadyEncoded = computed(() => /%[0-9a-f]{2}/i.test(this.text()));

  // URL parser
  protected readonly parsed = computed(() => parseUrl(this.url()));
  protected readonly parseError = computed(() => {
    const p = this.parsed();
    return this.url().trim() && !p.ok ? p.error : '';
  });
  protected readonly paramRows = signal<ParamRow[]>([]);
  private readonly version = signal(0);

  protected readonly parts = computed<ToolRow[]>(() => {
    const p = this.parsed();
    if (!p.ok) return [];
    const u = p.url;
    const rows: ToolRow[] = [
      { label: 'Protocol', value: u.protocol, copy: true },
      { label: 'Host', value: u.isInternational ? u.unicodeHost : u.hostname, copy: true },
    ];
    if (u.isInternational) rows.push({ label: 'Host (punycode)', value: u.hostname, copy: true });
    if (u.username) rows.push({ label: 'User', value: u.username });
    if (u.password) rows.push({ label: 'Password', value: u.password });
    rows.push(
      { label: 'Port', value: u.port || '(default)' },
      { label: 'Path', value: u.pathname, copy: true },
      { label: 'Fragment', value: u.hash || '(none)', copy: !!u.hash },
      { label: 'Origin', value: u.origin, copy: true },
    );
    return rows;
  });
  protected readonly normalizedHref = computed(() => {
    const p = this.parsed();
    return p.ok ? p.url.href : '';
  });
  protected readonly rebuilt = computed(() => {
    this.version();
    const p = this.parsed();
    if (!p.ok) return '';
    return (
      rebuildUrl(
        p.url.href,
        this.paramRows().map((r) => ({ key: r.key.value, value: r.value.value })),
      ) ?? ''
    );
  });

  constructor() {
    this.textCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => v && this.markUsed());
    this.urlCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      if (v.trim()) this.markUsed();
      this.loadParams();
    });
  }

  protected setDirection(value: string): void {
    this.direction.set(value === 'decode' ? 'decode' : 'encode');
  }

  private makeRow(key: string, value: string): ParamRow {
    const row: ParamRow = { id: ++rowId, key: new FormControl(key, { nonNullable: true }), value: new FormControl(value, { nonNullable: true }) };
    row.key.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.version.update((n) => n + 1));
    row.value.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.version.update((n) => n + 1));
    return row;
  }

  private loadParams(): void {
    const p = parseUrl(this.urlCtl.value);
    this.paramRows.set(p.ok ? p.url.params.map((q) => this.makeRow(q.key, q.value)) : []);
    this.version.update((n) => n + 1);
  }

  protected addParam(): void {
    this.paramRows.update((rows) => [...rows, this.makeRow('', '')]);
    this.version.update((n) => n + 1);
  }

  protected removeParam(id: number): void {
    this.paramRows.update((rows) => rows.filter((r) => r.id !== id));
    this.version.update((n) => n + 1);
  }
}
