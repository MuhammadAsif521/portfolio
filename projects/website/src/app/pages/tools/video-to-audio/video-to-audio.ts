import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { AnalyticsService } from '@shared/services/analytics.service';
import { ToolLayout } from '../tool-layout/tool-layout';
import { encodeWav, formatBytes } from '../tool-logic-2';

/** Decoding holds every sample in memory; beyond this the tab may run out of memory on phones. */
const MAX_FILE = 1024 * 1024 * 1024;
const RATES = [48000, 44100, 22050, 16000] as const;

/**
 * /tools/video-to-audio: decodes the file's audio track with the Web Audio API, optionally downmixes and
 * resamples it (OfflineAudioContext), and writes a 16-bit PCM WAV. Everything stays in the browser.
 */
@Component({
  selector: 'app-video-to-audio',
  imports: [ToolLayout],
  styleUrl: '../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="video-to-audio">
      <div class="tool-field">
        <label class="tool-label" for="video">Video or audio file</label>
        <input id="video" type="file" class="tool-input" accept="video/*,audio/*,.mkv,.mov" (change)="onFile($event)" />
      </div>
      <div class="tool-row">
        <div class="tool-field">
          <label class="tool-label" for="channels">Channels</label>
          <select id="channels" class="tool-select" (change)="mono.set($any($event.target).value === 'mono')">
            <option value="stereo">Keep original (stereo)</option>
            <option value="mono">Mono (half the size)</option>
          </select>
        </div>
        <div class="tool-field">
          <label class="tool-label" for="rate">Sample rate</label>
          <select id="rate" class="tool-select" (change)="rate.set(+$any($event.target).value)">
            <option value="0">Keep original</option>
            @for (r of rates; track r) {
              <option [value]="r">{{ r / 1000 }} kHz</option>
            }
          </select>
        </div>
        <button type="button" class="tool-btn" [disabled]="!file() || busy()" (click)="convert()">
          {{ busy() ? 'Converting…' : 'Extract audio' }}
        </button>
      </div>

      @if (file(); as f) {
        <p class="tool-status">{{ f.name }} · {{ size(f.size) }}</p>
      }
      <p class="tool-status" role="status" aria-live="polite">{{ status() }}</p>
      @if (error()) {
        <p class="tool-error" role="alert">{{ error() }}</p>
      }
      @if (download(); as d) {
        <audio class="tool-audio" controls [src]="d.url"></audio>
        <p><a class="tool-btn" [href]="d.url" [attr.download]="d.name" (click)="downloaded()">Download {{ d.name }} ({{ d.size }})</a></p>
      }
    </app-tool-layout>
  `,
})
export class VideoToAudioTool {
  private readonly analytics = inject(AnalyticsService);

  protected readonly rates = RATES;
  protected readonly file = signal<File | null>(null);
  protected readonly mono = signal(false);
  protected readonly rate = signal(0);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');
  protected readonly download = signal<{ url: string; name: string; size: string } | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected size(bytes: number): string {
    return formatBytes(bytes);
  }

  protected onFile(event: Event): void {
    const picked = (event.target as HTMLInputElement).files?.[0] ?? null;
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
    this.busy.set(true);
    this.error.set('');
    this.revoke();
    this.analytics.track('tool_used', { tool: 'video-to-audio' });
    let context: AudioContext | null = null;
    try {
      this.status.set('Reading the file…');
      const data = await file.arrayBuffer();
      this.status.set('Decoding the audio track…');
      context = new AudioContext();
      const decoded = await context.decodeAudioData(data);
      const channels = this.mono() ? 1 : Math.min(decoded.numberOfChannels, 2);
      const rate = this.rate() || decoded.sampleRate;

      let rendered: AudioBuffer = decoded;
      if (channels !== decoded.numberOfChannels || rate !== decoded.sampleRate) {
        this.status.set('Mixing and resampling…');
        const offline = new OfflineAudioContext(channels, Math.ceil(decoded.duration * rate), rate);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start();
        rendered = await offline.startRendering();
      }

      this.status.set('Writing WAV…');
      const planar = Array.from({ length: rendered.numberOfChannels }, (_, c) => rendered.getChannelData(c));
      const wav = encodeWav(planar, rendered.sampleRate);
      const name = `${file.name.replace(/\.[^.]+$/, '') || 'audio'}.wav`;
      this.download.set({ url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })), name, size: formatBytes(wav.byteLength) });
      const minutes = (rendered.duration / 60).toFixed(1);
      this.status.set(`Done: ${minutes} min, ${rendered.numberOfChannels === 1 ? 'mono' : 'stereo'}, ${rendered.sampleRate / 1000} kHz, 16-bit.`);
    } catch {
      this.status.set('');
      this.error.set('Could not decode the audio in this file. Your browser may not support its codec, or the file has no audio track.');
    } finally {
      await context?.close().catch(() => undefined);
      this.busy.set(false);
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
