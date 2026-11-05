import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, of } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { CustomReactiveColorfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-colorfield/custom-colorfield.component';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { downloadBlob, downloadText } from '../dev-utils';
import {
  MIN_QUIET_ZONE,
  QR_MAX_BYTES,
  checkQrColors,
  emailPayload,
  geoPayload,
  isEmail,
  smsPayload,
  utf8Length,
  vcardPayload,
  wifiPayload,
  type QrKind,
  type WifiSecurity,
} from './qr-logic';

const KINDS: NavTab[] = [
  { label: 'Text or URL', value: 'text' },
  { label: 'WiFi', value: 'wifi' },
  { label: 'Contact', value: 'vcard' },
  { label: 'Email', value: 'email' },
  { label: 'SMS', value: 'sms' },
  { label: 'Location', value: 'geo' },
];

const LEVELS = [
  { id: 'L', name: 'L: about 7% recoverable' },
  { id: 'M', name: 'M: about 15% recoverable' },
  { id: 'Q', name: 'Q: about 25% recoverable' },
  { id: 'H', name: 'H: about 30% recoverable' },
];

const SECURITY = [
  { id: 'WPA', name: 'WPA / WPA2 / WPA3' },
  { id: 'WEP', name: 'WEP (old)' },
  { id: 'nopass', name: 'No password' },
];

type Level = 'L' | 'M' | 'Q' | 'H';

interface Rendered {
  png: string;
  svg: string;
  version: number;
  modules: number;
  bytes: number;
}

interface RenderRequest {
  payload: string;
  level: Level;
  size: number;
  margin: number;
  fg: string;
  bg: string;
}

const clampInt = (text: string, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(text));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** /tools/qr-code-generator: QR codes for text, WiFi, contacts, email, SMS and locations, as PNG or SVG. */
@Component({
  selector: 'app-qr-code-generator',
  imports: [
    ToolLayout,
    ToolPanel,
    ToolInput,
    ToolTextarea,
    ToolSelect,
    ToolToggle,
    ToolButton,
    ToolOutput,
    ToolNote,
    ToolEmpty,
    TabsComponent,
    CustomReactiveColorfieldComponent,
  ],
  styleUrls: ['../../../tool-ui.scss', './qr-code-generator.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="qr-code-generator">
      <div class="tool-split">
        <app-tool-panel title="Content">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Example" (pressed)="loadExample()" />
          </ng-container>
          <div role="group" aria-label="What the code contains">
            <app-custom-tabs [tabs]="kinds" [activeTab]="kind()" (activeTabChange)="setKind($event)" />
          </div>

          @switch (kind()) {
            @case ('text') {
              <app-tool-textarea fieldId="qr-text" label="Text or URL" placeholder="https://example.com" [control]="textCtl" [rows]="4" [wrap]="true" />
            }
            @case ('wifi') {
              <app-tool-input fieldId="qr-ssid" label="Network name (SSID)" [control]="ssidCtl" [mono]="false" />
              <div class="tool-controls">
                <app-tool-select fieldId="qr-security" label="Security" [control]="securityCtl" [options]="security" />
                @if (securityValue() !== 'nopass') {
                  <app-tool-input fieldId="qr-wifi-password" label="Password" [control]="wifiPasswordCtl" />
                }
              </div>
              <app-tool-toggle fieldId="qr-hidden" label="Hidden network" hint="Tick if the network does not broadcast its name" [control]="hiddenCtl" />
            }
            @case ('vcard') {
              <div class="tool-controls">
                <app-tool-input fieldId="qr-first" label="First name" [control]="firstCtl" [mono]="false" />
                <app-tool-input fieldId="qr-last" label="Last name" [control]="lastCtl" [mono]="false" />
              </div>
              <div class="tool-controls">
                <app-tool-input fieldId="qr-org" label="Company" [control]="orgCtl" [mono]="false" />
                <app-tool-input fieldId="qr-title" label="Job title" [control]="jobCtl" [mono]="false" />
              </div>
              <div class="tool-controls">
                <app-tool-input fieldId="qr-phone" label="Phone" type="tel" placeholder="+92 300 1234567" [control]="phoneCtl" />
                <app-tool-input fieldId="qr-email" label="Email" type="email" [control]="emailCtl" />
              </div>
              <app-tool-input fieldId="qr-url" label="Website" placeholder="https://example.com" [control]="urlCtl" />
              <app-tool-input fieldId="qr-address" label="Address" [control]="addressCtl" [mono]="false" />
            }
            @case ('email') {
              <app-tool-input fieldId="qr-mail-to" label="To" type="email" placeholder="hello@example.com" [control]="mailToCtl" [invalid]="!!mailTo() && !mailValid()" />
              <app-tool-input fieldId="qr-mail-subject" label="Subject (optional)" [control]="mailSubjectCtl" [mono]="false" />
              <app-tool-textarea fieldId="qr-mail-body" label="Message (optional)" [control]="mailBodyCtl" [rows]="3" [wrap]="true" [mono]="false" />
            }
            @case ('sms') {
              <app-tool-input fieldId="qr-sms-phone" label="Phone number" type="tel" placeholder="+15105550101" [control]="smsPhoneCtl" />
              <app-tool-textarea fieldId="qr-sms-text" label="Message (optional)" [control]="smsTextCtl" [rows]="3" [wrap]="true" [mono]="false" />
            }
            @case ('geo') {
              <div class="tool-controls">
                <app-tool-input fieldId="qr-lat" label="Latitude (-90 to 90)" placeholder="48.8584" inputMode="decimal" [control]="latCtl" [invalid]="!!lat() && !geoValid()" />
                <app-tool-input fieldId="qr-lng" label="Longitude (-180 to 180)" placeholder="2.2945" inputMode="decimal" [control]="lngCtl" [invalid]="!!lng() && !geoValid()" />
              </div>
            }
          }

          <div class="tool-controls">
            <app-tool-select fieldId="qr-level" label="Error correction" [control]="levelCtl" [options]="levels" hint="Higher survives more damage but makes a denser code" />
            <app-tool-input fieldId="qr-size" label="Size in pixels (128-1024)" type="number" inputMode="numeric" [min]="128" [max]="1024" [mono]="false" [control]="sizeCtl" />
            <app-tool-input fieldId="qr-margin" label="Quiet zone (0-10 modules)" type="number" inputMode="numeric" [min]="0" [max]="10" [mono]="false" [control]="marginCtl" hint="The empty border scanners need. 4 is the standard" />
          </div>

          <div class="qr-colors">
            <div role="group" aria-label="Code colour">
              <span class="qr-color__label">Code colour</span>
              <app-custom-reactive-colorfield controlName="qr-fg" [control]="fgCtl" [label$]="fgLabel" [showLabel]="false" [showHints]="false" />
            </div>
            <div role="group" aria-label="Background colour">
              <span class="qr-color__label">Background colour</span>
              <app-custom-reactive-colorfield controlName="qr-bg" [control]="bgCtl" [label$]="bgLabel" [showLabel]="false" [showHints]="false" />
            </div>
          </div>
          @for (w of colorWarnings(); track w) {
            <app-tool-note kind="warn">{{ w }}</app-tool-note>
          }
          @if (marginValue() < minQuiet) {
            <app-tool-note kind="warn">A quiet zone under {{ minQuiet }} modules breaks the QR standard. Many scanners will fail when the code sits on a busy background.</app-tool-note>
          }
        </app-tool-panel>

        <app-tool-panel title="QR code">
          @if (error()) {
            <app-tool-note kind="error">{{ error() }}</app-tool-note>
          }
          @if (rendered(); as r) {
            <app-tool-output label="Preview" [meta]="'Version ' + r.version + ' · ' + r.modules + ' x ' + r.modules + ' modules'" [copyText]="payload() ?? ''" copyLabel="Copy content" (copied)="trackCopy()">
              <div class="qr-stage">
                <img class="qr-stage__img" [src]="r.png" [alt]="'QR code containing: ' + altText()" width="352" height="352" />
              </div>
              <dl class="qr-facts">
                <div><dt>Data</dt><dd>{{ r.bytes }} bytes</dd></div>
                <div><dt>Error correction</dt><dd>{{ levelValue() }}</dd></div>
                <div><dt>Export size</dt><dd>{{ sizeValue() }} px</dd></div>
              </dl>
              <div class="tool-actions tool-actions--top">
                <app-tool-button size="small" icon="download" label="Download PNG" (pressed)="downloadPng()" />
                <app-tool-button size="small" icon="download" label="Download SVG" (pressed)="downloadSvg()" />
                @if (canCopyImage()) {
                  <app-tool-button size="small" icon="copy" [label]="imageCopied() ? 'Image copied' : 'Copy image'" (pressed)="copyImage()" />
                }
              </div>
            </app-tool-output>
            @if (copyError()) {
              <app-tool-note kind="error">{{ copyError() }}</app-tool-note>
            }
            <app-tool-note kind="info">
              Test the printed or on-screen code with a real phone before you publish it. Keep a clear border, use dark modules on a light background, and avoid making it smaller than about 2 cm on paper.
            </app-tool-note>
          } @else if (!error()) {
            <app-tool-empty icon="qr-code">{{ emptyHint() }}</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class QrCodeGeneratorTool {
  private readonly markUsed = toolUsage('qr-code-generator');
  protected readonly trackCopy = toolCopied('qr-code-generator');
  private readonly trackDownload = toolCopied('qr-code-generator', { method: 'download' });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly kinds = KINDS;
  protected readonly levels = LEVELS;
  protected readonly security = SECURITY;
  protected readonly minQuiet = MIN_QUIET_ZONE;
  protected readonly fgLabel = of('Code colour');
  protected readonly bgLabel = of('Background colour');
  protected readonly kind = signal<QrKind>('text');

  protected readonly textCtl = new FormControl('', { nonNullable: true });
  protected readonly ssidCtl = new FormControl('', { nonNullable: true });
  protected readonly securityCtl = new FormControl('WPA', { nonNullable: true });
  protected readonly wifiPasswordCtl = new FormControl('', { nonNullable: true });
  protected readonly hiddenCtl = new FormControl(false, { nonNullable: true });
  protected readonly firstCtl = new FormControl('', { nonNullable: true });
  protected readonly lastCtl = new FormControl('', { nonNullable: true });
  protected readonly orgCtl = new FormControl('', { nonNullable: true });
  protected readonly jobCtl = new FormControl('', { nonNullable: true });
  protected readonly phoneCtl = new FormControl('', { nonNullable: true });
  protected readonly emailCtl = new FormControl('', { nonNullable: true });
  protected readonly urlCtl = new FormControl('', { nonNullable: true });
  protected readonly addressCtl = new FormControl('', { nonNullable: true });
  protected readonly mailToCtl = new FormControl('', { nonNullable: true });
  protected readonly mailSubjectCtl = new FormControl('', { nonNullable: true });
  protected readonly mailBodyCtl = new FormControl('', { nonNullable: true });
  protected readonly smsPhoneCtl = new FormControl('', { nonNullable: true });
  protected readonly smsTextCtl = new FormControl('', { nonNullable: true });
  protected readonly latCtl = new FormControl('', { nonNullable: true });
  protected readonly lngCtl = new FormControl('', { nonNullable: true });
  protected readonly levelCtl = new FormControl('M', { nonNullable: true });
  protected readonly sizeCtl = new FormControl('512', { nonNullable: true });
  protected readonly marginCtl = new FormControl('4', { nonNullable: true });
  protected readonly fgCtl = new FormControl('#000000', { nonNullable: true });
  protected readonly bgCtl = new FormControl('#ffffff', { nonNullable: true });

  private readonly text = controlSignal(this.textCtl);
  private readonly ssid = controlSignal(this.ssidCtl);
  protected readonly securityValue = controlSignal(this.securityCtl);
  private readonly wifiPassword = controlSignal(this.wifiPasswordCtl);
  private readonly hidden = controlSignal(this.hiddenCtl);
  private readonly first = controlSignal(this.firstCtl);
  private readonly last = controlSignal(this.lastCtl);
  private readonly org = controlSignal(this.orgCtl);
  private readonly job = controlSignal(this.jobCtl);
  private readonly phone = controlSignal(this.phoneCtl);
  private readonly email = controlSignal(this.emailCtl);
  private readonly url = controlSignal(this.urlCtl);
  private readonly address = controlSignal(this.addressCtl);
  protected readonly mailTo = controlSignal(this.mailToCtl);
  private readonly mailSubject = controlSignal(this.mailSubjectCtl);
  private readonly mailBody = controlSignal(this.mailBodyCtl);
  private readonly smsPhone = controlSignal(this.smsPhoneCtl);
  private readonly smsText = controlSignal(this.smsTextCtl);
  protected readonly lat = controlSignal(this.latCtl);
  protected readonly lng = controlSignal(this.lngCtl);
  private readonly level = controlSignal(this.levelCtl);
  private readonly size = controlSignal(this.sizeCtl);
  private readonly margin = controlSignal(this.marginCtl);
  private readonly fg = controlSignal(this.fgCtl);
  private readonly bg = controlSignal(this.bgCtl);

  protected readonly levelValue = computed(() => this.level());
  protected readonly sizeValue = computed(() => clampInt(this.size(), 128, 1024, 512));
  protected readonly marginValue = computed(() => clampInt(this.margin(), 0, 10, 4));
  protected readonly mailValid = computed(() => isEmail(this.mailTo()));
  protected readonly geoValid = computed(() => geoPayload(this.lat(), this.lng()) !== null);
  protected readonly colorWarnings = computed(() => checkQrColors(this.fg(), this.bg()).warnings);

  /** The text that goes into the code, or null while the form is empty or invalid. */
  protected readonly payload = computed<string | null>(() => {
    switch (this.kind()) {
      case 'text':
        return this.text().trim() ? this.text() : null;
      case 'wifi':
        return this.ssid().trim()
          ? wifiPayload({ ssid: this.ssid(), password: this.wifiPassword(), security: this.securityValue() as WifiSecurity, hidden: this.hidden() })
          : null;
      case 'vcard':
        return this.first().trim() || this.last().trim() || this.org().trim()
          ? vcardPayload({
              firstName: this.first(),
              lastName: this.last(),
              organization: this.org(),
              title: this.job(),
              phone: this.phone(),
              email: this.email(),
              url: this.url(),
              address: this.address(),
            })
          : null;
      case 'email':
        return this.mailValid() ? emailPayload(this.mailTo(), this.mailSubject(), this.mailBody()) : null;
      case 'sms':
        return this.smsPhone().trim() ? smsPayload(this.smsPhone(), this.smsText()) : null;
      case 'geo':
        return geoPayload(this.lat(), this.lng());
    }
  });

  protected readonly altText = computed(() => {
    const p = this.payload() ?? '';
    return p.length > 80 ? `${p.slice(0, 80)}…` : p.replace(/\r?\n/g, ' ');
  });
  protected readonly emptyHint = computed(() => {
    const hints: Record<QrKind, string> = {
      text: 'Type a URL or any text on the left and the code appears here.',
      wifi: 'Enter the network name (and password) to make a code phones can scan to join.',
      vcard: 'Enter a name to make a contact card code.',
      email: 'Enter an email address to make a code that opens a new message.',
      sms: 'Enter a phone number to make a code that opens a text message.',
      geo: 'Enter a latitude and longitude to make a code that opens a map.',
    };
    return hints[this.kind()];
  });

  protected readonly rendered = signal<Rendered | null>(null);
  protected readonly error = signal('');
  protected readonly canCopyImage = signal(false);
  protected readonly imageCopied = signal(false);
  protected readonly copyError = signal('');
  private job$ = 0;
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly request = computed<RenderRequest | null>(() => {
    const payload = this.payload();
    if (!payload) return null;
    return { payload, level: this.level() as Level, size: this.sizeValue(), margin: this.marginValue(), fg: this.fg(), bg: this.bg() };
  });

  constructor() {
    afterNextRender(() => this.canCopyImage.set(typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write));
    toObservable(this.request)
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe((req) => void this.render(req));
    this.destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
  }

  protected setKind(value: string): void {
    this.kind.set((KINDS.some((k) => k.value === value) ? value : 'text') as QrKind);
  }

  protected loadExample(): void {
    switch (this.kind()) {
      case 'text':
        this.textCtl.setValue('https://example.com/');
        break;
      case 'wifi':
        this.ssidCtl.setValue('HomeNet');
        this.wifiPasswordCtl.setValue('correct-horse-battery');
        break;
      case 'vcard':
        this.firstCtl.setValue('Asif');
        this.lastCtl.setValue('Khan');
        this.orgCtl.setValue('Asif Dev');
        this.emailCtl.setValue('hello@example.com');
        break;
      case 'email':
        this.mailToCtl.setValue('hello@example.com');
        this.mailSubjectCtl.setValue('Hello there');
        break;
      case 'sms':
        this.smsPhoneCtl.setValue('+15105550101');
        this.smsTextCtl.setValue('Hello!');
        break;
      case 'geo':
        this.latCtl.setValue('48.8584');
        this.lngCtl.setValue('2.2945');
        break;
    }
  }

  private async render(req: RenderRequest | null): Promise<void> {
    const job = ++this.job$;
    this.copyError.set('');
    if (!req) {
      this.rendered.set(null);
      this.error.set('');
      return;
    }
    if (!isPlatformBrowser(this.platformId)) return;
    const level = req.level;
    if (utf8Length(req.payload) > QR_MAX_BYTES[level]) {
      this.rendered.set(null);
      this.error.set(`This is ${utf8Length(req.payload)} bytes, more than a QR code can hold at level ${level} (about ${QR_MAX_BYTES[level]}). Shorten it or choose a lower error-correction level.`);
      return;
    }
    try {
      const QRCode = (await import('qrcode')).default;
      const colors = { dark: req.fg, light: req.bg };
      const created = QRCode.create(req.payload, { errorCorrectionLevel: level });
      const options = { errorCorrectionLevel: level, margin: req.margin, width: req.size, color: colors } as const;
      const [png, svg] = await Promise.all([QRCode.toDataURL(req.payload, options), QRCode.toString(req.payload, { ...options, type: 'svg' })]);
      if (job !== this.job$) return;
      this.error.set('');
      this.rendered.set({ png, svg, version: created.version, modules: created.modules.size, bytes: utf8Length(req.payload) });
      this.markUsed();
    } catch {
      if (job !== this.job$) return;
      this.rendered.set(null);
      this.error.set('This content does not fit in a QR code at the chosen error-correction level. Shorten it or lower the level.');
    }
  }

  protected downloadPng(): void {
    const r = this.rendered();
    if (!r) return;
    downloadBlob('qr-code.png', dataUrlToBlob(r.png));
    this.trackDownload();
  }

  protected downloadSvg(): void {
    const r = this.rendered();
    if (!r) return;
    downloadText('qr-code.svg', r.svg, 'image/svg+xml');
    this.trackDownload();
  }

  protected async copyImage(): Promise<void> {
    const r = this.rendered();
    if (!r) return;
    this.copyError.set('');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': dataUrlToBlob(r.png) })]);
      this.imageCopied.set(true);
      this.trackCopy();
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.imageCopied.set(false), 2200);
    } catch {
      this.copyError.set('Your browser blocked copying the image. Use Download PNG instead.');
    }
  }
}
