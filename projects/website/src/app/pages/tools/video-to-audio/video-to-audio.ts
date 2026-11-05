import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { CustomFileInputComponent } from '@shared/components/form-components/custom-file-input/custom-file-input.component';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolButton } from '../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../ui/tool-kit/tool-empty';
import { ToolSelect } from '../../../ui/tool-kit/tool-fields';
import { controlSignal } from '../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../tool-layout/tool-layout';
import { formatBytes, formatDuration } from '../tool-logic-2';
import { ExtractError, type Method, extractAudio, needsRender, renderAudio, toWav } from './audio-extract';

/** Decoding holds every sample in memory; beyond this the tab may run out of memory on phones. */
const MAX_FILE = 1024 * 1024 * 1024;
const RATES = [48000, 44100, 22050, 16000] as const;
const CHANNEL_OPTIONS = [
  { id: 'stereo', name: 'Keep original (stereo)' },
  { id: 'mono', name: 'Mono (half the size)' },
];
const RATE_OPTIONS = [{ id: '0', name: 'Keep original' }, ...RATES.map((r) => ({ id: String(r), name: `${r / 1000} kHz` }))];

/**
 * /tools/video-to-audio: checks the file for an audio track, decodes it (Web Audio, then WebCodecs, then a
 * labelled real-time capture), optionally downmixes and resamples it, and writes a 16-bit PCM WAV.
 * Everything stays in the browser. See audio-extract.ts and media-probe.ts.
 */
@Component({
  selector: 'app-video-to-audio',
  imports: [ToolLayout, ToolPanel, ToolSelect, ToolButton, ToolOutput, ToolNote, ToolEmpty, IconComponent, CustomFileInputComponent],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="video-to-audio">
      <div class="tool-split">
        <app-tool-panel title="Source file">
          <app-custom-file-input
            controlName="video-file"
            [label$]="fileLabel"
            accept="video/*,audio/*,.mkv,.mov"
            placeholder="Choose a video or audio file, or drag it here"
            [multiple]="false"
            [showLabel]="false"
            [maxFileSize]="maxFileMb"
            [scanFiles]="false"
            [sanitizeNames]="false"
            (file)="onFile($event)"
          />
          @if (file(); as f) {
            <p class="tool-meta">{{ f.name }} · {{ size(f.size) }}</p>
          }
          <div class="tool-controls">
            <app-tool-select fieldId="video-channels" label="Channels" [control]="channelsCtl" [options]="channelOptions" />
            <app-tool-select fieldId="video-rate" label="Sample rate" [control]="rateCtl" [options]="rateOptions" />
          </div>
          <app-tool-button
            kind="primary"
            icon="audio-lines"
            [label]="'Extract audio'"
            [fill]="true"
            [loading]="busy()"
            [disabled]="!file()"
            (pressed)="convert()"
          />
        </app-tool-panel>

        <app-tool-panel title="Audio">
          @if (error()) {
            <app-tool-note [kind]="errorKind()">{{ error() }}</app-tool-note>
          }
          @if (busy() && status()) {
            <app-tool-note kind="info">{{ status() }}</app-tool-note>
          }
          @if (download(); as d) {
            <app-tool-output label="Your WAV file" [meta]="d.size" [copyText]="''">
              <audio class="tool-audio" controls [src]="d.url" [attr.aria-label]="'Preview of ' + d.name"></audio>
              <div class="tool-actions tool-actions--top">
                <a class="tool-link-button" [href]="d.url" [attr.download]="d.name" (click)="downloaded()">
                  <i-lucide name="download" [size]="18" aria-hidden="true" />
                  Download {{ d.name }}
                </a>
              </div>
            </app-tool-output>
            @if (!busy() && status()) {
              <app-tool-note kind="success">{{ status() }}</app-tool-note>
            }
          } @else if (!busy() && !error()) {
            <app-tool-empty icon="audio-lines">Choose a file and press Extract audio. The WAV appears here, ready to play and download.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class VideoToAudioTool {
  private readonly analytics = inject(AnalyticsService);

  protected readonly channelOptions = CHANNEL_OPTIONS;
  protected readonly rateOptions = RATE_OPTIONS;
  protected readonly maxFileMb = MAX_FILE / (1024 * 1024);
  protected readonly fileLabel = of('Video or audio file');
  protected readonly file = signal<File | null>(null);
  protected readonly channelsCtl = new FormControl('stereo', { nonNullable: true });
  protected readonly rateCtl = new FormControl('0', { nonNullable: true });
  private readonly mono = computed(() => this.channelsSig() === 'mono');
  private readonly rate = computed(() => Number(this.rateSig()));
  private readonly channelsSig = controlSignal(this.channelsCtl);
  private readonly rateSig = controlSignal(this.rateCtl);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');
  /** A silent video is not a malfunction: shown as a plain notice, not an error. */
  protected readonly errorKind = signal<'error' | 'warn'>('error');
  private abort: AbortController | null = null;
  protected readonly download = signal<{ url: string; name: string; size: string } | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abort?.abort();
      this.revoke();
    });
  }

  protected size(bytes: number): string {
    return formatBytes(bytes);
  }

  protected onFile(picked: File | null): void {
    this.abort?.abort();
    this.revoke();
    this.error.set('');
    this.status.set('');
    if (picked && picked.size > MAX_FILE) {
      this.file.set(null);
      this.error.set('This file is over 1 GB. Trim the video first: decoding keeps the whole track in memory.');
      return;
    }
    this.file.set(picked);
  }

  protected async convert(): Promise<void> {
    const file = this.file();
    if (!file) return;
    this.abort?.abort();
    const abort = (this.abort = new AbortController());
    this.busy.set(true);
    this.error.set('');
    this.revoke();
    this.analytics.track('tool_used', { tool: 'video-to-audio' });
    const hooks = { status: (message: string) => this.status.set(message), signal: abort.signal };
    try {
      const { buffer, method } = await extractAudio(file, hooks);
      const options = { mono: this.mono(), rate: this.rate() };
      if (needsRender(buffer, options)) this.status.set('Mixing and resampling…');
      const rendered = await renderAudio(buffer, options);
      const wav = await toWav(rendered, hooks);
      if (abort.signal.aborted) return;
      const name = `${file.name.replace(/.[^.]+$/, '') || 'audio'}.wav`;
      this.download.set({ url: URL.createObjectURL(wav), name, size: formatBytes(wav.size) });
      const how: Record<Method, string> = { browser: '', webcodecs: ' (compatibility mode)', realtime: ' (captured in real time)' };
      this.status.set(
        `Done: ${formatDuration(rendered.duration)}, ${rendered.numberOfChannels === 1 ? 'mono' : 'stereo'}, ${rendered.sampleRate / 1000} kHz, 16-bit${how[method]}.`,
      );
    } catch (error) {
      if (abort.signal.aborted) return;
      const failure = error instanceof ExtractError ? error : new ExtractError('unreadable', 'Something went wrong while reading this file. Try again, or choose a smaller file.');
      this.status.set('');
      this.errorKind.set(failure.kind === 'no-audio' ? 'warn' : 'error');
      this.error.set(failure.message);
    } finally {
      if (this.abort === abort) this.busy.set(false);
    }
  }

  protected downloaded(): void {
    this.analytics.track('result_copied', { tool: 'video-to-audio', method: 'download' });
  }

  private revoke(): void {
    const d = this.download();
    if (d) URL.revokeObjectURL(d.url);
    this.download.set(null);
  }
}
