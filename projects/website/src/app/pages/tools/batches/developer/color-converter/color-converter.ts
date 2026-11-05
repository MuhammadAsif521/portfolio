import { afterNextRender, ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomReactiveColorfieldComponent } from '@shared/components/reactive-form-components/custom-reactive-colorfield/custom-colorfield.component';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import {
  compositeOver,
  contrastRatio,
  cssVariables,
  formatColor,
  nearestNamed,
  parseColor,
  shades,
  tints,
  toHex,
  wcagLevels,
  type Rgba,
} from './color-logic';

/** /tools/color-converter: HEX, RGB, HSL, HSV, CMYK and OKLCH conversion, WCAG contrast and a tint/shade palette. */
@Component({
  selector: 'app-color-converter',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty, ToolButton, CustomReactiveColorfieldComponent],
  styleUrls: ['../../../tool-ui.scss', './color-converter.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="color-converter">
      <div class="tool-stack">
        <div class="tool-split">
          <app-tool-panel title="Colour">
            <div class="cc-pair">
              <app-tool-input
                fieldId="cc-base"
                label="Colour in any CSS format"
                placeholder="#1d4ed8, rgb(29 78 216), hsl(224 76% 48%), oklch(0.5 0.2 264), tomato"
                [control]="baseCtl"
                [invalid]="!!base() && !color()"
              />
              <div role="group" aria-label="Colour picker">
                <span class="cc-pick__label">Pick a colour</span>
                <app-custom-reactive-colorfield controlName="cc-base-pick" [control]="pickCtl" [label$]="pickLabel" [showLabel]="false" [showHints]="false" />
              </div>
            </div>
            @if (color(); as c) {
              <div class="cc-swatch" role="img" [attr.aria-label]="'Swatch of ' + formats()?.hex"><span [style.background]="formats()?.hex"></span></div>
            } @else if (base().trim()) {
              <app-tool-note kind="error">
                Not recognised. Try a hex code (#1d4ed8), rgb(29 78 216), hsl(224 76% 48%), hwb(), oklch(0.5 0.2 264), oklab(), hsv(224, 87%, 85%), cmyk(87%, 64%, 0%, 15%) or a CSS colour name.
              </app-tool-note>
            }
            @if (!color() && !base().trim()) {
              <app-tool-empty icon="palette">Type a colour or pick one to see it in every format.</app-tool-empty>
            }
          </app-tool-panel>

          <app-tool-panel title="Formats">
            @if (rows().length) {
              <app-tool-output label="Conversions" [copyText]="allText()" copyLabel="Copy all" (copied)="trackCopy()">
                <app-tool-key-value [rows]="rows()" (copied)="trackCopy()" />
              </app-tool-output>
              <p class="tool-meta">
                CMYK is a plain arithmetic conversion, not a print profile. OKLCH values are computed from the CSS Color 4 formulas{{ oklchSupported() === null ? '' : oklchSupported() ? '; your browser can display oklch().' : '; your browser cannot display oklch(), so use the HEX value there.' }}
              </p>
            } @else {
              <app-tool-empty icon="palette">Enter a valid colour to see HEX, RGB, HSL, HWB, HSV, CMYK, OKLCH and OKLab.</app-tool-empty>
            }
          </app-tool-panel>
        </div>

        <app-tool-panel title="Contrast checker (WCAG 2.2)">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="refresh-cw" label="Swap" (pressed)="swap()" />
          </ng-container>
          <div class="cc-pair">
            <app-tool-input fieldId="cc-fg" label="Text colour (the colour above)" [control]="baseCtl" [invalid]="!!base() && !color()" />
            <app-tool-input fieldId="cc-bg" label="Background colour" placeholder="#ffffff" [control]="bgCtl" [invalid]="!!bg() && !bgColor()" />
          </div>
          @if (contrast(); as k) {
            <div class="cc-sample" [style.background]="bgHex()" [style.color]="fgHex()">
              <p class="cc-sample__normal">Normal text sample: the quick brown fox jumps over the lazy dog.</p>
              <p class="cc-sample__large">Large text sample</p>
            </div>
            <app-tool-output label="Result" [meta]="'Ratio ' + k.ratioText + ':1'">
              <p class="cc-ratio">{{ k.ratioText }}:1</p>
              <ul class="cc-grades">
                @for (g of grades(); track g.label) {
                  <li>
                    <span>{{ g.label }}</span>
                    <span [class]="g.pass ? 'cc-pass' : 'cc-fail'">{{ g.pass ? 'Pass' : 'Fail' }}</span>
                  </li>
                }
              </ul>
            </app-tool-output>
            @if (translucent()) {
              <app-tool-note kind="info">The text colour is translucent, so it was blended over the background first, the way a browser paints it.</app-tool-note>
            }
            <p class="tool-meta">Large text means 24 px, or 18.66 px and bold, or bigger (WCAG's 18 pt and 14 pt bold). The ratio is not rounded: 4.499 does not meet 4.5.</p>
          } @else {
            <app-tool-empty icon="palette">Enter a text colour and a background colour to check the contrast ratio.</app-tool-empty>
          }
        </app-tool-panel>

        @if (palette(); as p) {
          <app-tool-panel title="Tints, shades and CSS variables">
            <div>
              <h4 class="cc-sub">Tints (mixed with white)</h4>
              <ul class="cc-palette">
                @for (s of p.tints; track s.percent) {
                  <li class="cc-chip" [style.background]="s.hex" [style.color]="textOn(s.hex)">{{ s.hex }}<small>{{ s.percent }}% white</small></li>
                }
              </ul>
              <h4 class="cc-sub">Shades (mixed with black)</h4>
              <ul class="cc-palette">
                @for (s of p.shades; track s.percent) {
                  <li class="cc-chip" [style.background]="s.hex" [style.color]="textOn(s.hex)">{{ s.hex }}<small>{{ s.percent }}% black</small></li>
                }
              </ul>
            </div>
            <app-tool-output label="CSS custom properties" copyLabel="Copy CSS" [value]="p.css" (copied)="trackCopy()" />
          </app-tool-panel>
        }
      </div>
    </app-tool-layout>
  `,
})
export class ColorConverterTool {
  private readonly markUsed = toolUsage('color-converter');
  protected readonly trackCopy = toolCopied('color-converter');

  protected readonly pickLabel = of('Colour picker');
  protected readonly baseCtl = new FormControl('#1d4ed8', { nonNullable: true });
  protected readonly pickCtl = new FormControl('#1d4ed8', { nonNullable: true });
  protected readonly bgCtl = new FormControl('#ffffff', { nonNullable: true });
  protected readonly base = controlSignal(this.baseCtl);
  protected readonly bg = controlSignal(this.bgCtl);
  protected readonly oklchSupported = signal<boolean | null>(null);

  protected readonly color = computed<Rgba | null>(() => parseColor(this.base()));
  protected readonly bgColor = computed<Rgba | null>(() => parseColor(this.bg()));
  protected readonly formats = computed(() => {
    const c = this.color();
    return c ? formatColor(c) : null;
  });

  protected readonly rows = computed<ToolRow[]>(() => {
    const c = this.color();
    const f = this.formats();
    if (!c || !f) return [];
    const near = nearestNamed(c);
    return [
      { label: 'HEX', value: f.hex, copy: true },
      { label: 'RGB', value: f.rgb, copy: true },
      { label: 'HSL', value: f.hsl, copy: true },
      { label: 'HWB', value: f.hwb, copy: true },
      { label: 'HSV', value: f.hsv, copy: true },
      { label: 'CMYK', value: f.cmyk, copy: true },
      { label: 'OKLCH', value: f.oklch, copy: true },
      { label: 'OKLab', value: f.oklab, copy: true },
      { label: 'CSS name', value: f.name ?? `${near.name} is the nearest (${near.hex})`, copy: !!f.name },
    ];
  });
  protected readonly allText = computed(() => this.rows().map((r) => `${r.label}: ${r.value}`).join('\n'));

  // Contrast
  protected readonly translucent = computed(() => (this.color()?.a ?? 1) < 1);
  private readonly solidFg = computed(() => {
    const fg = this.color();
    const bg = this.bgColor();
    return fg && bg ? compositeOver(fg, { ...bg, a: 1 }) : null;
  });
  protected readonly fgHex = computed(() => {
    const c = this.solidFg();
    return c ? toHex(c, false) : '';
  });
  protected readonly bgHex = computed(() => {
    const c = this.bgColor();
    return c ? toHex(compositeOver(c, { r: 255, g: 255, b: 255, a: 1 }), false) : '';
  });
  protected readonly contrast = computed(() => {
    const fg = this.solidFg();
    const bg = this.bgColor();
    if (!fg || !bg) return null;
    const ratio = contrastRatio(fg, compositeOver(bg, { r: 255, g: 255, b: 255, a: 1 }));
    return { ratio, ratioText: (Math.floor(ratio * 100) / 100).toFixed(2), levels: wcagLevels(ratio) };
  });
  protected readonly grades = computed(() => {
    const k = this.contrast();
    if (!k) return [];
    const l = k.levels;
    return [
      { label: 'AA, normal text (4.5:1)', pass: l.aaNormal },
      { label: 'AA, large text (3:1)', pass: l.aaLarge },
      { label: 'AAA, normal text (7:1)', pass: l.aaaNormal },
      { label: 'AAA, large text (4.5:1)', pass: l.aaaLarge },
      { label: 'UI components (3:1)', pass: l.nonText },
    ];
  });

  protected readonly palette = computed(() => {
    const c = this.color();
    if (!c) return null;
    const solid = { ...c, a: 1 };
    const t = tints(solid, 9);
    const s = shades(solid, 9);
    return { tints: t, shades: s, css: cssVariables('color', c, t, s) };
  });

  constructor() {
    afterNextRender(() => {
      this.oklchSupported.set(typeof CSS !== 'undefined' && CSS.supports('color', 'oklch(0.5 0.2 264)'));
    });
    this.baseCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const c = parseColor(v);
      if (c) {
        const hex = toHex(c, false);
        if (hex !== this.pickCtl.value) this.pickCtl.setValue(hex, { emitEvent: false });
        this.markUsed();
      }
    });
    this.pickCtl.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      if (parseColor(v)) this.baseCtl.setValue(v);
    });
  }

  protected swap(): void {
    const fg = this.baseCtl.value;
    this.baseCtl.setValue(this.bgCtl.value);
    this.bgCtl.setValue(fg);
  }

  /** Black or white, whichever reads better on this background. */
  protected textOn(hex: string): string {
    const c = parseColor(hex);
    if (!c) return '#000000';
    return contrastRatio(c, { r: 0, g: 0, b: 0 }) >= contrastRatio(c, { r: 255, g: 255, b: 255 }) ? '#000000' : '#ffffff';
  }
}
