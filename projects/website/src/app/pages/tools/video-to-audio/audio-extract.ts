/**
 * Browser-side audio extraction for /tools/video-to-audio. Three ways to get PCM out of a file, tried in order:
 *  1. decodeAudioData on the whole file (fast, what the browser plays with);
 *  2. WebCodecs AudioDecoder on audio samples demuxed by media-probe (works when 1 refuses a file whose codec
 *     the browser can decode);
 *  3. real-time capture: play the file silently and record what comes out (slow, labelled as such).
 * A probe of the container runs first, so a video with no audio track is reported as exactly that. Everything
 * stays on the device.
 */
import { MAX_WAV_BYTES, encodeWavBlob } from '../tool-logic-2';
import { type AudioCodec, type MediaProbe, audioCodecLabel, blobSource, demuxAudio, probeMedia, readSamples } from './media-probe';

export type FailureKind = 'no-audio' | 'unsupported-codec' | 'damaged' | 'not-media' | 'too-long' | 'cancelled' | 'unreadable';

export class ExtractError extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind, message: string) {
    super(message);
    this.name = 'ExtractError';
    this.kind = kind;
  }
}

/** What to show for each failure. No codec jargon beyond a plain format name. */
export const MESSAGES = {
  noAudio: 'This video has no audio track, so there is no sound to extract. Clips from stock-footage sites and many screen recordings are silent. Choose a file that has sound.',
  damaged: 'This file looks damaged or cut short, so its audio cannot be read. If you downloaded or exported it, try that again to get a complete copy.',
  notMedia: 'This does not look like a video or audio file this tool can read, or it is damaged. Choose an MP4, MOV, WebM, MKV, M4A, MP3, WAV, OGG or FLAC file.',
  unreadable: 'No readable audio was found in this file. It may have no sound, or its sound may be stored in a format this browser cannot read. Try a different browser, or save the video as MP4 from your editor or phone and choose it again.',
  tooLong: 'This recording is too long to turn into a WAV in the browser. Trim the video to a shorter section first.',
} as const;

export const unsupportedMessage = (format: string): string =>
  `This file has sound, but it is stored as ${format}, which this browser cannot read. Try another browser (Safari and Edge read more formats), or save the video as MP4 from your editor or phone and choose it again.`;

export type Method = 'browser' | 'webcodecs' | 'realtime';

export interface Extracted {
  buffer: AudioBuffer;
  method: Method;
}

export interface Hooks {
  status(message: string): void;
  signal?: AbortSignal;
}

/** Longest real-time capture we will start: the user has to wait the whole length of the clip. */
export const REALTIME_MAX_SECONDS = 20 * 60;
/** Decoded samples held in memory (all channels): about 50 minutes of 48 kHz stereo as 32-bit floats. */
const MAX_SAMPLES = 300_000_000;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExtractError('cancelled', 'Cancelled.');
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function extractAudio(file: Blob, hooks: Hooks): Promise<Extracted> {
  const source = blobSource(file);
  hooks.status('Checking the file…');
  let probe: MediaProbe;
  try {
    probe = await probeMedia(source);
  } catch {
    probe = { container: 'unknown', hasAudio: null, hasVideo: null };
  }
  throwIfAborted(hooks.signal);
  if (probe.hasAudio === false) throw new ExtractError('no-audio', MESSAGES.noAudio);

  hooks.status('Reading the file…');
  try {
    const buffer = await decodeWithBrowser(file, probe, hooks);
    return { buffer, method: 'browser' };
  } catch (error) {
    if (error instanceof ExtractError) throw error;
  }
  throwIfAborted(hooks.signal);

  if (probe.hasAudio) {
    hooks.status('The quick decoder could not read this file. Trying another method…');
    const viaCodecs = await decodeWithWebCodecs(file, hooks).catch((e) => {
      if (e instanceof ExtractError) throw e;
      return null;
    });
    if (viaCodecs) return { buffer: viaCodecs, method: 'webcodecs' };
    throwIfAborted(hooks.signal);

    if (canPlayAudio(probe)) {
      const live = await captureRealTime(file, hooks);
      return { buffer: live, method: 'realtime' };
    }
  }
  throw failureFor(probe);
}

/** The message that fits what we know about a file nothing could decode. */
export function failureFor(probe: MediaProbe): ExtractError {
  if (probe.damaged) return new ExtractError('damaged', MESSAGES.damaged);
  if (probe.container === 'unknown') return new ExtractError('not-media', MESSAGES.notMedia);
  if (probe.hasAudio && probe.audio && probe.audio.codec !== 'other') return new ExtractError('unsupported-codec', unsupportedMessage(audioCodecLabel(probe.audio.codec)));
  if (probe.hasAudio && probe.audio) return new ExtractError('unsupported-codec', unsupportedMessage('a format that is not widely supported'));
  return new ExtractError('unreadable', MESSAGES.unreadable);
}

// ── 1. decodeAudioData ───────────────────────────────────────────────────────

async function decodeWithBrowser(file: Blob, probe: MediaProbe, hooks: Hooks): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  throwIfAborted(hooks.signal);
  hooks.status('Decoding the audio track…');
  // decodeAudioData resamples to the rate of the context that decodes, so decode at the file's own rate to keep it.
  const rate = clamp(probe.audio?.sampleRate ?? probe.sampleRate ?? 48000, 8000, 96000);
  const context = new OfflineAudioContext(2, 1, rate);
  const decoded = await context.decodeAudioData(data);
  if (!decoded.length) throw new Error('empty');
  return decoded;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ── 2. WebCodecs ─────────────────────────────────────────────────────────────

interface AudioDataLike {
  numberOfFrames: number;
  numberOfChannels: number;
  sampleRate: number;
  copyTo(destination: Float32Array, options: { planeIndex: number; format: string }): void;
  close(): void;
}
interface AudioDecoderLike {
  decodeQueueSize: number;
  configure(config: object): void;
  decode(chunk: unknown): void;
  flush(): Promise<void>;
  close(): void;
}
interface WebCodecsApi {
  AudioDecoder: (new (init: { output: (data: AudioDataLike) => void; error: (e: Error) => void }) => AudioDecoderLike) & {
    isConfigSupported(config: object): Promise<{ supported?: boolean }>;
  };
  EncodedAudioChunk: new (init: { type: 'key'; timestamp: number; duration?: number; data: Uint8Array }) => unknown;
}

const webCodecs = (): WebCodecsApi | null => {
  const g = globalThis as unknown as Partial<WebCodecsApi>;
  return g.AudioDecoder && g.EncodedAudioChunk ? (g as WebCodecsApi) : null;
};

async function decodeWithWebCodecs(file: Blob, hooks: Hooks): Promise<AudioBuffer | null> {
  const api = webCodecs();
  if (!api) return null;
  const source = blobSource(file);
  const demuxed = await demuxAudio(source);
  if (!demuxed) return null;
  const config = { ...demuxed.config, description: demuxed.config.description };
  if (!(await api.AudioDecoder.isConfigSupported(config).catch(() => ({ supported: false }))).supported) return null;

  const planes: Float32Array[][] = [];
  let channels = 0;
  let rate = 0;
  let total = 0;
  let failure: Error | null = null;
  const decoder = new api.AudioDecoder({
    output: (data) => {
      try {
        if (!channels) {
          channels = data.numberOfChannels;
          rate = data.sampleRate;
        }
        const chunk: Float32Array[] = [];
        for (let c = 0; c < channels; c++) {
          const plane = new Float32Array(data.numberOfFrames);
          data.copyTo(plane, { planeIndex: Math.min(c, data.numberOfChannels - 1), format: 'f32-planar' });
          chunk.push(plane);
        }
        planes.push(chunk);
        total += data.numberOfFrames;
      } finally {
        data.close();
      }
    },
    error: (e) => (failure = e),
  });
  try {
    decoder.configure(config);
    const all = demuxed.samples.length;
    let n = 0;
    for await (const { sample, data } of readSamples(source, demuxed.samples)) {
      if (failure) break;
      throwIfAborted(hooks.signal);
      if (total * Math.max(channels, 1) > MAX_SAMPLES) throw new ExtractError('too-long', MESSAGES.tooLong);
      decoder.decode(new api.EncodedAudioChunk({ type: 'key', timestamp: sample.timeUs, duration: sample.durationUs, data }));
      // Backpressure and a chance for the page to paint.
      if (++n % 64 === 0 || decoder.decodeQueueSize > 200) {
        while (decoder.decodeQueueSize > 100 && !failure) await tick();
        await tick();
        hooks.status(`Decoding the audio in compatibility mode… ${Math.round((n / all) * 100)}%`);
      }
    }
    if (!failure) await decoder.flush();
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    failure = failure ?? (error as Error);
  } finally {
    try {
      decoder.close();
    } catch {
      /* already closed after an error */
    }
  }
  // A decoder error halfway through still leaves usable audio only if most of the file made it.
  if (failure && total < rate * 0.5) return null;
  if (!total || !channels) return null;
  return toAudioBuffer(planes, channels, rate, total);
}

function toAudioBuffer(planes: Float32Array[][], channels: number, rate: number, frames: number): AudioBuffer {
  const buffer = new AudioBuffer({ length: frames, numberOfChannels: channels, sampleRate: rate });
  for (let c = 0; c < channels; c++) {
    const target = buffer.getChannelData(c);
    let at = 0;
    for (const chunk of planes) {
      target.set(chunk[c], at);
      at += chunk[c].length;
    }
  }
  return buffer;
}

// ── 3. Real-time capture ─────────────────────────────────────────────────────

/** MIME type with codec for asking the browser whether it can play this track (MP4 and WebM only). */
function mimeFor(probe: MediaProbe): string | null {
  const kind = probe.container === 'webm' ? 'webm' : probe.container === 'mp4' ? 'mp4' : null;
  if (!kind || !probe.audio) return null;
  const codecs: Partial<Record<AudioCodec, string>> = { aac: 'mp4a.40.2', mp3: 'mp3', opus: 'opus', vorbis: 'vorbis', flac: 'flac', alac: 'alac', ac3: 'ac-3', eac3: 'ec-3' };
  const codec = codecs[probe.audio.codec];
  return codec ? `audio/${kind}; codecs="${codec}"` : null;
}

/** False when we know this browser cannot play the audio, so a real-time capture would only record silence. */
function canPlayAudio(probe: MediaProbe): boolean {
  if (typeof document === 'undefined' || typeof AudioContext === 'undefined') return false;
  const mime = mimeFor(probe);
  if (!mime) return true; // unknown codec string: let the attempt decide
  return document.createElement('video').canPlayType(mime) !== '';
}

const WORKLET = `registerProcessor('vta-tap', class extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const copy = input.map((c) => c.slice());
      this.port.postMessage(copy, copy.map((c) => c.buffer));
    }
    return true;
  }
});`;

interface MediaElementProbe extends HTMLVideoElement {
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  audioTracks?: { length: number };
}

/** Plays the file silently and records the samples as they play. Takes as long as the clip. */
async function captureRealTime(file: Blob, hooks: Hooks): Promise<AudioBuffer> {
  const url = URL.createObjectURL(file);
  const el = document.createElement('video') as MediaElementProbe;
  el.preload = 'auto';
  el.playsInline = true;
  el.src = url;
  let context: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error('metadata'));
      setTimeout(() => reject(new Error('metadata timeout')), 20000);
    });
    // Files written by MediaRecorder have no stored length (Infinity): then we just play until the end.
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    if (duration > REALTIME_MAX_SECONDS) throw new ExtractError('too-long', `${MESSAGES.tooLong} (Real-time capture would take ${Math.round(duration / 60)} minutes.)`);

    context = new AudioContext();
    const chunks: Float32Array[][] = [];
    const tap = await createTap(context, chunks);
    const silent = context.createGain();
    silent.gain.value = 0;
    context.createMediaElementSource(el).connect(tap);
    tap.connect(silent);
    silent.connect(context.destination);
    await context.resume();

    const progress = (at: number) =>
      `Real-time capture: ${Math.floor(at)} s${duration ? ` of ${Math.round(duration)} s` : ''}. This method plays the file silently and takes as long as the clip.`;
    hooks.status(progress(0));
    await new Promise<void>((resolve, reject) => {
      let lastTime = -1;
      let stalled = 0;
      timer = setInterval(() => {
        if (hooks.signal?.aborted) return reject(new ExtractError('cancelled', 'Cancelled.'));
        if (el.currentTime > REALTIME_MAX_SECONDS) return reject(new ExtractError('too-long', MESSAGES.tooLong));
        hooks.status(progress(el.currentTime));
        stalled = el.currentTime === lastTime && !el.ended ? stalled + 1 : 0;
        lastTime = el.currentTime;
        if (stalled >= 10) reject(new Error('stalled'));
      }, 1000);
      el.onended = () => resolve();
      el.onerror = () => reject(new Error('playback'));
      el.play().catch(reject);
    });
    // Give the last audio blocks a moment to arrive from the audio thread.
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (el.mozHasAudio === false || el.webkitAudioDecodedByteCount === 0 || (el.audioTracks && el.audioTracks.length === 0)) {
      throw new Error('browser decoded no audio');
    }
    const channels = Math.max(1, ...chunks.map((c) => c.length));
    const frames = chunks.reduce((n, c) => n + (c[0]?.length ?? 0), 0);
    if (!frames) throw new Error('nothing captured');
    const planes = chunks.map((c) => Array.from({ length: channels }, (_, i) => c[Math.min(i, c.length - 1)]));
    return toAudioBuffer(planes, channels, context.sampleRate, frames);
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    throw new ExtractError('unreadable', MESSAGES.unreadable);
  } finally {
    clearInterval(timer);
    el.pause();
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
    await context?.close().catch(() => undefined);
  }
}

/** A node that hands every block of audio passing through it to `chunks` (AudioWorklet, else ScriptProcessor). */
async function createTap(context: AudioContext, chunks: Float32Array[][]): Promise<AudioNode> {
  if (context.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
    const moduleUrl = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    try {
      await context.audioWorklet.addModule(moduleUrl);
      const node = new AudioWorkletNode(context, 'vta-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (e: MessageEvent<Float32Array[]>) => chunks.push(e.data);
      return node;
    } catch {
      /* worklets blocked (CSP, old browser): use the script processor below */
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  }
  const node = context.createScriptProcessor(4096, 2, 2);
  node.onaudioprocess = (e) => chunks.push(Array.from({ length: e.inputBuffer.numberOfChannels }, (_, c) => e.inputBuffer.getChannelData(c).slice()));
  return node;
}

// ── Mix, resample, write ─────────────────────────────────────────────────────

export interface RenderOptions {
  mono: boolean;
  /** 0 keeps the decoded rate. */
  rate: number;
}

function target(decoded: AudioBuffer, options: RenderOptions) {
  return { channels: options.mono ? 1 : Math.min(decoded.numberOfChannels, 2), rate: options.rate || decoded.sampleRate };
}

/** True when the channel or sample-rate choice changes the decoded audio. */
export function needsRender(decoded: AudioBuffer, options: RenderOptions): boolean {
  const t = target(decoded, options);
  return t.channels !== decoded.numberOfChannels || t.rate !== decoded.sampleRate;
}

/** Applies the channel and sample-rate choices (OfflineAudioContext does both in one pass). */
export async function renderAudio(decoded: AudioBuffer, options: RenderOptions): Promise<AudioBuffer> {
  if (!needsRender(decoded, options)) return decoded;
  const { channels, rate } = target(decoded, options);
  const offline = new OfflineAudioContext(channels, Math.ceil(decoded.duration * rate), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

export async function toWav(buffer: AudioBuffer, hooks: Hooks): Promise<Blob> {
  if (buffer.length * buffer.numberOfChannels * 2 > MAX_WAV_BYTES) throw new ExtractError('too-long', MESSAGES.tooLong);
  const planar = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  return encodeWavBlob(planar, buffer.sampleRate, tick, (done) => hooks.status(`Writing WAV… ${Math.round(done * 100)}%`));
}
