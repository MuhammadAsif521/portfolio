import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { merge } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolKeyValue, type ToolRow } from '../../../../../ui/tool-kit/tool-key-value';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import {
  MAX_LENGTH,
  MAX_WORDS,
  MIN_LENGTH,
  MIN_WORDS,
  activePools,
  checkOptions,
  generatePassphrase,
  generatePassword,
  passphraseEntropyBits,
  passwordEntropyBits,
  strengthLabel,
  type PassphraseOptions,
  type PasswordOptions,
  type Strength,
} from './password-logic';

const MODES: NavTab[] = [
  { label: 'Password', value: 'password' },
  { label: 'Passphrase', value: 'passphrase' },
];

const SEPARATORS = [
  { id: '-', name: 'Hyphen (-)' },
  { id: ' ', name: 'Space' },
  { id: '.', name: 'Dot (.)' },
  { id: '_', name: 'Underscore (_)' },
  { id: '', name: 'None' },
];

const STRENGTH_TEXT: Record<Strength, string> = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very strong',
};

const PROBLEM_TEXT: Record<string, string> = {
  'no-classes': 'Tick at least one character type.',
  length: `Length must be a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}.`,
  'require-each': 'The length is shorter than the number of character types you require. Make it longer or untick "Require every type".',
};

const clampInt = (text: string, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(text));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** /tools/password-generator: random passwords and passphrases from crypto.getRandomValues; nothing leaves the page. */
@Component({
  selector: 'app-password-generator',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolSelect, ToolToggle, ToolButton, ToolOutput, ToolKeyValue, ToolNote, ToolEmpty, TabsComponent],
  styleUrls: ['../../../tool-ui.scss', './password-generator.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="password-generator">
      <div class="tool-split">
        <app-tool-panel title="Settings">
          <div role="group" aria-label="Type">
            <app-custom-tabs [tabs]="modes" [activeTab]="mode()" (activeTabChange)="setMode($event)" />
          </div>

          @if (mode() === 'password') {
            <div class="tool-controls">
              <app-tool-input fieldId="pw-length" label="Length (4-128)" type="number" inputMode="numeric" [min]="4" [max]="128" [mono]="false" [control]="lengthCtl" />
              <app-tool-input fieldId="pw-count" label="How many (1-20)" type="number" inputMode="numeric" [min]="1" [max]="20" [mono]="false" [control]="countCtl" />
            </div>
            <div class="tool-controls">
              <app-tool-toggle fieldId="pw-lower" label="Lowercase a-z" [control]="lowerCtl" />
              <app-tool-toggle fieldId="pw-upper" label="Uppercase A-Z" [control]="upperCtl" />
              <app-tool-toggle fieldId="pw-digits" label="Digits 0-9" [control]="digitsCtl" />
              <app-tool-toggle fieldId="pw-symbols" label="Symbols" hint="27 symbols such as ! @ # $ %" [control]="symbolsCtl" />
            </div>
            <app-tool-toggle fieldId="pw-similar" label="Skip look-alike characters" hint="Leaves out i I l L 1 o O 0 |" [control]="similarCtl" />
            <app-tool-toggle fieldId="pw-require" label="Require every ticked type" hint="Redraws until each type appears at least once" [control]="requireCtl" />
            <app-tool-input fieldId="pw-exclude" label="Also leave out these characters" placeholder="e.g. {}[]'" [control]="excludeCtl" />
            @if (problem()) {
              <app-tool-note kind="error">{{ problem() }}</app-tool-note>
            }
          } @else {
            <div class="tool-controls">
              <app-tool-input fieldId="pp-words" label="Words (3-12)" type="number" inputMode="numeric" [min]="3" [max]="12" [mono]="false" [control]="wordsCtl" />
              <app-tool-input fieldId="pp-count" label="How many (1-20)" type="number" inputMode="numeric" [min]="1" [max]="20" [mono]="false" [control]="countCtl" />
            </div>
            <app-tool-select fieldId="pp-separator" label="Separator" [control]="separatorCtl" [options]="separators" />
            <app-tool-toggle fieldId="pp-cap" label="Capitalise each word" [control]="capitalizeCtl" />
            <app-tool-toggle fieldId="pp-number" label="Add one digit" hint="One random digit at the end of one random word" [control]="numberCtl" />
            <p class="tool-meta">Words come from the EFF Large Wordlist: {{ listSize }} words, about 12.9 bits per word. It is loaded only when you use this tab.</p>
            @if (listError()) {
              <app-tool-note kind="error">{{ listError() }}</app-tool-note>
            }
          }

          <app-tool-button kind="primary" icon="key-round" [label]="mode() === 'password' ? 'Generate password' : 'Generate passphrase'" [fill]="true" [loading]="loadingList()" [disabled]="!!problem()" (pressed)="generate()" />
        </app-tool-panel>

        <app-tool-panel title="Result">
          @if (rows().length) {
            <app-tool-output [label]="rows().length === 1 ? (mode() === 'password' ? 'Password' : 'Passphrase') : 'Generated'" [copyText]="all()" [copyLabel]="rows().length === 1 ? 'Copy' : 'Copy all'" [meta]="rows().length + ' generated here, never sent anywhere'" (copied)="trackCopy()">
              <app-tool-key-value [rows]="rows()" (copied)="trackCopy()" />
            </app-tool-output>
            <div class="strength">
              <div class="strength__head">
                <span class="strength__label">{{ strengthText() }}</span>
                <span class="strength__bits">{{ bitsText() }} bits of entropy</span>
              </div>
              <div
                class="strength__track"
                role="meter"
                aria-label="Strength by entropy"
                aria-valuemin="0"
                aria-valuemax="128"
                [attr.aria-valuenow]="bitsRounded()"
                [attr.aria-valuetext]="strengthText() + ', ' + bitsText() + ' bits'"
              >
                <span class="strength__fill" [class]="'strength__fill--' + strength()" [style.width.%]="fill()"></span>
              </div>
              <p class="strength__formula">{{ formula() }}</p>
            </div>
            <app-tool-note kind="info">
              Entropy is the size of the space the generator picks from, not a prediction of how long a break would take: that depends on the attacker's hardware and on how the site stores your password. Use a different one per account and keep them in a password manager.
            </app-tool-note>
          } @else {
            <app-tool-empty icon="key-round">Press Generate. Passwords are created in your browser with the Web Crypto random generator and are not stored.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class PasswordGeneratorTool {
  private readonly markUsed = toolUsage('password-generator');
  protected readonly trackCopy = toolCopied('password-generator');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modes = MODES;
  protected readonly separators = SEPARATORS;
  protected readonly listSize = '7,776';
  protected readonly mode = signal<'password' | 'passphrase'>('password');

  protected readonly lengthCtl = new FormControl('20', { nonNullable: true });
  protected readonly countCtl = new FormControl('1', { nonNullable: true });
  protected readonly lowerCtl = new FormControl(true, { nonNullable: true });
  protected readonly upperCtl = new FormControl(true, { nonNullable: true });
  protected readonly digitsCtl = new FormControl(true, { nonNullable: true });
  protected readonly symbolsCtl = new FormControl(true, { nonNullable: true });
  protected readonly similarCtl = new FormControl(false, { nonNullable: true });
  protected readonly requireCtl = new FormControl(true, { nonNullable: true });
  protected readonly excludeCtl = new FormControl('', { nonNullable: true });
  protected readonly wordsCtl = new FormControl('6', { nonNullable: true });
  protected readonly separatorCtl = new FormControl('-', { nonNullable: true });
  protected readonly capitalizeCtl = new FormControl(false, { nonNullable: true });
  protected readonly numberCtl = new FormControl(false, { nonNullable: true });

  private readonly length = controlSignal(this.lengthCtl);
  private readonly lower = controlSignal(this.lowerCtl);
  private readonly upper = controlSignal(this.upperCtl);
  private readonly digits = controlSignal(this.digitsCtl);
  private readonly symbols = controlSignal(this.symbolsCtl);
  private readonly similar = controlSignal(this.similarCtl);
  private readonly require = controlSignal(this.requireCtl);
  private readonly exclude = controlSignal(this.excludeCtl);
  private readonly count = controlSignal(this.countCtl);
  private readonly words = controlSignal(this.wordsCtl);
  private readonly separator = controlSignal(this.separatorCtl);
  private readonly capitalize = controlSignal(this.capitalizeCtl);
  private readonly addNumber = controlSignal(this.numberCtl);

  protected readonly passwordOptions = computed<PasswordOptions>(() => ({
    length: Number(this.length()),
    lower: this.lower(),
    upper: this.upper(),
    digits: this.digits(),
    symbols: this.symbols(),
    excludeSimilar: this.similar(),
    exclude: this.exclude(),
    requireEach: this.require(),
  }));
  private readonly passphraseOptions = computed<PassphraseOptions>(() => ({
    words: clampInt(this.words(), MIN_WORDS, MAX_WORDS, 6),
    separator: this.separator(),
    capitalize: this.capitalize(),
    addNumber: this.addNumber(),
  }));

  protected readonly problem = computed(() => {
    if (this.mode() !== 'password') return '';
    const p = checkOptions(this.passwordOptions());
    return p ? PROBLEM_TEXT[p] : '';
  });

  private readonly values = signal<string[]>([]);
  /** What the shown values were generated with (so the meter stays right when the form changes afterwards). */
  private readonly shown = signal<{ mode: 'password' | 'passphrase'; password: PasswordOptions; passphrase: PassphraseOptions } | null>(null);
  protected readonly loadingList = signal(false);
  protected readonly listError = signal('');
  private wordList: readonly string[] | null = null;

  protected readonly rows = computed<ToolRow[]>(() => this.values().map((value, i) => ({ label: `#${i + 1}`, value, copy: true })));
  protected readonly all = computed(() => this.values().join('\n'));

  private readonly bits = computed(() => {
    const s = this.shown();
    if (!s) return 0;
    return s.mode === 'password' ? passwordEntropyBits(s.password) : passphraseEntropyBits(s.passphrase, this.wordList?.length ?? 7776);
  });
  protected readonly strength = computed(() => strengthLabel(this.bits()));
  protected readonly strengthText = computed(() => STRENGTH_TEXT[this.strength()]);
  protected readonly bitsText = computed(() => this.bits().toFixed(1));
  protected readonly bitsRounded = computed(() => Math.round(this.bits()));
  protected readonly fill = computed(() => Math.min(100, (this.bits() / 128) * 100));
  protected readonly formula = computed(() => {
    const s = this.shown();
    if (!s) return '';
    if (s.mode === 'passphrase') {
      const size = this.wordList?.length ?? 7776;
      const extra = s.passphrase.addNumber ? ` + log2(10) + log2(${s.passphrase.words}) for the digit and its place` : '';
      return `entropy = words x log2(list size) = ${s.passphrase.words} x log2(${size}) = ${(s.passphrase.words * Math.log2(size)).toFixed(1)} bits${extra}`;
    }
    const pool = activePools(s.password).reduce((n, p) => n + p.length, 0);
    const plain = s.password.length * Math.log2(pool);
    const note = s.password.requireEach && activePools(s.password).length > 1 ? `; exact value ${this.bits().toFixed(1)} after removing passwords that miss a type` : '';
    return `entropy = length x log2(pool size) = ${s.password.length} x log2(${pool}) = ${plain.toFixed(1)} bits${note}`;
  });

  constructor() {
    // Once something has been generated, changing a setting regenerates so the result always matches the settings.
    merge(
      this.lengthCtl.valueChanges,
      this.countCtl.valueChanges,
      this.lowerCtl.valueChanges,
      this.upperCtl.valueChanges,
      this.digitsCtl.valueChanges,
      this.symbolsCtl.valueChanges,
      this.similarCtl.valueChanges,
      this.requireCtl.valueChanges,
      this.excludeCtl.valueChanges,
      this.wordsCtl.valueChanges,
      this.separatorCtl.valueChanges,
      this.capitalizeCtl.valueChanges,
      this.numberCtl.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.values().length) void this.generate();
      });
  }

  protected setMode(value: string): void {
    this.mode.set(value === 'passphrase' ? 'passphrase' : 'password');
    this.values.set([]);
    this.shown.set(null);
  }

  protected async generate(): Promise<void> {
    const count = clampInt(this.count(), 1, 20, 1);
    try {
      if (this.mode() === 'password') {
        const options = this.passwordOptions();
        if (checkOptions(options)) return;
        this.values.set(Array.from({ length: count }, () => generatePassword(options)));
        this.shown.set({ mode: 'password', password: options, passphrase: this.passphraseOptions() });
      } else {
        const list = await this.loadList();
        if (!list) return;
        const options = this.passphraseOptions();
        this.values.set(Array.from({ length: count }, () => generatePassphrase(options, list)));
        this.shown.set({ mode: 'passphrase', password: this.passwordOptions(), passphrase: options });
      }
      this.markUsed();
    } catch {
      this.listError.set('Could not generate. Reload the page and try again.');
    }
  }

  private async loadList(): Promise<readonly string[] | null> {
    if (this.wordList) return this.wordList;
    this.loadingList.set(true);
    this.listError.set('');
    try {
      this.wordList = (await import('./eff-wordlist')).EFF_LARGE_WORDLIST;
      return this.wordList;
    } catch {
      this.listError.set('The word list could not be loaded. Check your connection and try again.');
      return null;
    } finally {
      this.loadingList.set(false);
    }
  }
}
