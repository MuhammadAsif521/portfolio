/**
 * Pure media-container inspection for the video-to-audio tool. No DOM, no Web Audio: it reads bytes and answers
 * "does this file have an audio track, and in what codec?" so the page can tell "this video is silent" apart
 * from "the browser cannot decode this codec". It also demuxes MP4/MOV and WebM audio into encoded samples
 * that WebCodecs can decode when decodeAudioData refuses the file.
 */

// ── Byte sources ─────────────────────────────────────────────────────────────

/** Random access to a file's bytes, without loading all of it. */
export interface ByteSource {
  readonly size: number;
  /** Bytes in [start, end), clamped to the file size. */
  read(start: number, end: number): Promise<Uint8Array>;
}

export function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (start, end) => new Uint8Array(await blob.slice(start, Math.min(end, blob.size)).arrayBuffer()),
  };
}

export function bytesSource(bytes: Uint8Array): ByteSource {
  return { size: bytes.length, read: async (start, end) => bytes.subarray(start, Math.min(end, bytes.length)) };
}

/** Small read-ahead cache so scanning thousands of tiny headers does not mean thousands of slices. */
class Reader {
  private window: Uint8Array = new Uint8Array(0);
  private from = 0;

  readonly source: ByteSource;
  private readonly refill: number;

  constructor(source: ByteSource, refill = 16 * 1024) {
    this.source = source;
    this.refill = refill;
  }

  get size(): number {
    return this.source.size;
  }

  async bytes(start: number, length: number): Promise<Uint8Array> {
    if (start >= this.source.size) return new Uint8Array(0);
    const end = Math.min(start + length, this.source.size);
    if (start < this.from || end > this.from + this.window.length) {
      this.window = await this.source.read(start, Math.min(Math.max(end, start + this.refill), this.source.size));
      this.from = start;
    }
    return this.window.subarray(start - this.from, Math.min(end - this.from, this.window.length));
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type Container = 'mp4' | 'webm' | 'ogg' | 'wav' | 'mp3' | 'flac' | 'aac' | 'unknown';

/** Normalised audio codec. 'other' covers anything not listed (the raw id is kept in `AudioTrack.codecId`). */
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'vorbis' | 'flac' | 'alac' | 'ac3' | 'eac3' | 'dts' | 'pcm' | 'amr' | 'other';

export interface AudioTrack {
  codec: AudioCodec;
  /** Raw id from the file (MP4 sample-entry fourcc or Matroska codec id). */
  codecId: string;
  sampleRate?: number;
  channels?: number;
}

export interface MediaProbe {
  container: Container;
  /** true: an audio track exists. false: the container was read completely and has none. null: could not tell. */
  hasAudio: boolean | null;
  hasVideo: boolean | null;
  audio?: AudioTrack;
  /** The file is a recognised container whose structure is broken or cut short. */
  damaged?: boolean;
  /** Sample rate read from the file header when known (WAV/FLAC/MP3), for keeping the original rate. */
  sampleRate?: number;
}

export interface AudioSample {
  offset: number;
  size: number;
  timeUs: number;
  durationUs?: number;
}

/** Everything WebCodecs needs to decode a track. */
export interface DemuxedAudio {
  config: { codec: string; sampleRate: number; numberOfChannels: number; description?: Uint8Array };
  samples: AudioSample[];
}

const FRIENDLY: Record<AudioCodec, string> = {
  aac: 'AAC',
  mp3: 'MP3',
  opus: 'Opus',
  vorbis: 'Vorbis',
  flac: 'FLAC',
  alac: 'Apple Lossless',
  ac3: 'Dolby Digital',
  eac3: 'Dolby Digital Plus',
  dts: 'DTS',
  pcm: 'uncompressed PCM',
  amr: 'AMR (phone voice)',
  other: 'an unusual audio format',
};

export const audioCodecLabel = (codec: AudioCodec): string => FRIENDLY[codec];

// ── Binary helpers ───────────────────────────────────────────────────────────

const u16 = (b: Uint8Array, o: number) => ((b[o] << 8) | b[o + 1]) >>> 0;
const u32 = (b: Uint8Array, o: number) => ((b[o] * 0x1000000) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 0x100000000 + u32(b, o + 4);
const tag = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

// ── Container sniffing ───────────────────────────────────────────────────────

const MP4_FIRST_BOXES = new Set(['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot', 'styp', 'moof']);
const SAMPLE_RATES_MP3 = [
  [11025, 12000, 8000], // MPEG 2.5
  [0, 0, 0],
  [22050, 24000, 16000], // MPEG 2
  [44100, 48000, 32000], // MPEG 1
];

/** Container from the first bytes of the file, plus the sample rate when the header holds it. */
export function sniffContainer(head: Uint8Array): { container: Container; sampleRate?: number } {
  if (head.length < 4) return { container: 'unknown' };
  if (head.length >= 8 && MP4_FIRST_BOXES.has(tag(head, 4))) return { container: 'mp4' };
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { container: 'webm' };
  const t4 = tag(head, 0);
  if (t4 === 'OggS') return { container: 'ogg' };
  if (t4 === 'fLaC') {
    // STREAMINFO: 20-bit sample rate at byte 18 of the file.
    const rate = head.length >= 21 ? (head[18] << 12) | (head[19] << 4) | (head[20] >> 4) : undefined;
    return { container: 'flac', sampleRate: rate || undefined };
  }
  if (t4 === 'RIFF' && head.length >= 28 && ascii(head, 8, 4) === 'WAVE') {
    return { container: 'wav', sampleRate: readU32LE(head, 24) || undefined };
  }
  if (t4.startsWith('ID3')) return { container: 'mp3' };
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
    const layer = (head[1] >> 1) & 3;
    if (layer === 0) return { container: 'aac' }; // ADTS
    const version = (head[1] >> 3) & 3;
    const idx = (head[2] >> 2) & 3;
    return { container: 'mp3', sampleRate: idx < 3 ? SAMPLE_RATES_MP3[version]?.[idx] || undefined : undefined };
  }
  return { container: 'unknown' };
}

function readU32LE(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

/** Probes a file: container, whether it has audio, and the audio codec. Never throws on bad input. */
export async function probeMedia(source: ByteSource): Promise<MediaProbe> {
  const head = await source.read(0, 4096);
  const { container, sampleRate } = sniffContainer(head);
  try {
    if (container === 'mp4') return (await readMp4(new Reader(source))).probe;
    if (container === 'webm') return (await readWebm(new Reader(source), false)).probe;
  } catch {
    return { container, hasAudio: null, hasVideo: null, damaged: true };
  }
  switch (container) {
    case 'wav':
      return { container, hasAudio: true, hasVideo: false, audio: { codec: 'pcm', codecId: 'wav', sampleRate }, sampleRate };
    case 'mp3':
      return { container, hasAudio: true, hasVideo: false, audio: { codec: 'mp3', codecId: 'mp3', sampleRate }, sampleRate };
    case 'flac':
      return { container, hasAudio: true, hasVideo: false, audio: { codec: 'flac', codecId: 'flac', sampleRate }, sampleRate };
    case 'aac':
      return { container, hasAudio: true, hasVideo: false, audio: { codec: 'aac', codecId: 'adts' } };
    case 'ogg':
      return { container, hasAudio: null, hasVideo: null };
    default:
      return { container: 'unknown', hasAudio: null, hasVideo: null };
  }
}

/** Encoded audio samples for WebCodecs, or null when this container/codec is not one we can demux. */
export async function demuxAudio(source: ByteSource): Promise<DemuxedAudio | null> {
  const head = await source.read(0, 4096);
  const { container } = sniffContainer(head);
  if (container === 'mp4') {
    const mp4 = await readMp4(new Reader(source));
    return mp4.track ? mp4Demux(new Reader(source), mp4.track) : null;
  }
  if (container === 'webm') {
    const web = await readWebm(new Reader(source), true);
    return web.demux;
  }
  return null;
}

/** Reads the given samples in large windows (one slice per few MB, not one per sample). */
export async function* readSamples(source: ByteSource, samples: AudioSample[]): AsyncGenerator<{ sample: AudioSample; data: Uint8Array }> {
  const MAX_WINDOW = 8 * 1024 * 1024;
  const MAX_GAP = 256 * 1024;
  let i = 0;
  while (i < samples.length) {
    const first = samples[i];
    if (first.offset + first.size > source.size) {
      i++; // beyond the end of a truncated file
      continue;
    }
    let j = i;
    let end = first.offset + first.size;
    while (j + 1 < samples.length) {
      const next = samples[j + 1];
      if (next.offset < first.offset || next.offset - end > MAX_GAP || next.offset + next.size - first.offset > MAX_WINDOW || next.offset + next.size > source.size) break;
      end = Math.max(end, next.offset + next.size);
      j++;
    }
    const bytes = await source.read(first.offset, end);
    for (let k = i; k <= j; k++) {
      const s = samples[k];
      yield { sample: s, data: bytes.subarray(s.offset - first.offset, s.offset - first.offset + s.size) };
    }
    i = j + 1;
  }
}

// ── MP4 / MOV (ISO base media file format) ───────────────────────────────────

interface Box {
  type: string;
  /** Offset of the payload (after the header) and of the box end, within the buffer being walked. */
  data: number;
  end: number;
}

function* boxes(b: Uint8Array, start: number, end: number): Generator<Box> {
  let o = start;
  while (o + 8 <= end) {
    let size = u32(b, o);
    let header = 8;
    if (size === 1) {
      if (o + 16 > end) return;
      size = u64(b, o + 8);
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header || o + size > end) {
      // A box that claims to run past the buffer: keep what is there so a cut-short file still lists its boxes.
      if (size >= header && o + header <= end) yield { type: tag(b, o + 4), data: o + header, end };
      return;
    }
    yield { type: tag(b, o + 4), data: o + header, end: o + size };
    o += size;
  }
}

const child = (b: Uint8Array, parent: Box, type: string): Box | undefined => {
  for (const box of boxes(b, parent.data, parent.end)) if (box.type === type) return box;
  return undefined;
};

interface Mp4Track {
  id: number;
  timescale: number;
  codec: AudioCodec;
  codecId: string;
  /** WebCodecs codec string, when this codec has one. */
  webCodec?: string;
  description?: Uint8Array;
  sampleRate: number;
  channels: number;
  /** Samples from the sample tables (empty for a fragmented file, whose samples are in the moof boxes). */
  samples: AudioSample[];
  fragmented: boolean;
  defaultDuration: number;
  defaultSize: number;
}

const MAX_MOOV = 256 * 1024 * 1024;
const MAX_SAMPLES = 8_000_000;

/** Reads the top-level boxes up to and including moov, then the tracks inside it. */
async function readMp4(reader: Reader): Promise<{ probe: MediaProbe; track?: Mp4Track }> {
  let pos = 0;
  let moov: Uint8Array | undefined;
  while (pos + 8 <= reader.size) {
    const head = await reader.bytes(pos, 16);
    if (head.length < 8) break;
    let size = u32(head, 0);
    const type = tag(head, 4);
    if (size === 1) size = head.length >= 16 ? u64(head, 8) : 0;
    else if (size === 0) size = reader.size - pos;
    if (size < 8) break;
    if (type === 'moov') {
      if (size > MAX_MOOV || pos + size > reader.size) break; // cut short or absurd
      moov = new Uint8Array(await reader.source.read(pos, pos + size));
      break;
    }
    pos += size;
  }
  if (!moov) return { probe: { container: 'mp4', hasAudio: null, hasVideo: null, damaged: true } };

  const root: Box = { type: 'moov', data: 8, end: moov.length };
  let hasVideo = false;
  let track: Mp4Track | undefined;
  const trex = new Map<number, { duration: number; size: number }>();
  const mvex = child(moov, root, 'mvex');
  if (mvex) {
    for (const t of boxes(moov, mvex.data, mvex.end)) {
      if (t.type === 'trex' && t.end - t.data >= 24) trex.set(u32(moov, t.data + 4), { duration: u32(moov, t.data + 12), size: u32(moov, t.data + 16) });
    }
  }
  const fragmented = !!mvex;

  for (const trak of boxes(moov, root.data, root.end)) {
    if (trak.type !== 'trak') continue;
    const mdia = child(moov, trak, 'mdia');
    const hdlr = mdia && child(moov, mdia, 'hdlr');
    if (!mdia || !hdlr) continue;
    const handler = tag(moov, hdlr.data + 8);
    if (handler === 'vide') hasVideo = true;
    if (handler !== 'soun' || track) continue;
    const tkhd = child(moov, trak, 'tkhd');
    const id = tkhd ? u32(moov, tkhd.data + (moov[tkhd.data] === 1 ? 20 : 12)) : 1;
    const mdhd = child(moov, mdia, 'mdhd');
    const timescale = mdhd ? u32(moov, mdhd.data + (moov[mdhd.data] === 1 ? 20 : 12)) : 1000;
    const stbl = (() => {
      const minf = child(moov, mdia, 'minf');
      return minf && child(moov, minf, 'stbl');
    })();
    const entry = stbl ? readSampleEntry(moov, stbl) : undefined;
    const defaults = trex.get(id);
    track = {
      id,
      timescale: timescale || 1000,
      codec: entry?.codec ?? 'other',
      codecId: entry?.codecId ?? '',
      webCodec: entry?.webCodec,
      description: entry?.description,
      sampleRate: entry?.sampleRate ?? 0,
      channels: entry?.channels ?? 0,
      samples: stbl && !fragmented ? readSampleTables(moov, stbl, timescale || 1000) : [],
      fragmented,
      defaultDuration: defaults?.duration ?? 0,
      defaultSize: defaults?.size ?? 0,
    };
  }

  const probe: MediaProbe = {
    container: 'mp4',
    hasAudio: !!track,
    hasVideo,
    ...(track ? { audio: { codec: track.codec, codecId: track.codecId, sampleRate: track.sampleRate || undefined, channels: track.channels || undefined } } : {}),
  };
  return { probe, track };
}

const AAC_OTI = new Set([0x40, 0x66, 0x67, 0x68]);

function readSampleEntry(b: Uint8Array, stbl: Box) {
  const stsd = child(b, stbl, 'stsd');
  if (!stsd || stsd.end - stsd.data < 16) return undefined;
  const entry = [...boxes(b, stsd.data + 8, stsd.end)][0];
  if (!entry) return undefined;
  const fourcc = tag(b, entry.data - 4);
  const p = entry.data; // payload of the sample entry
  const soundVersion = u16(b, p + 8);
  const channels = u16(b, p + 16);
  let sampleRate = u16(b, p + 24);
  // Children (esds, dOps, ...) start after the fixed fields, which are longer in QuickTime sound versions 1 and 2.
  const childrenAt = p + 28 + (soundVersion === 1 ? 16 : soundVersion === 2 ? 36 : 0);
  const holder: Box = { type: fourcc, data: childrenAt, end: entry.end };
  const out: { codec: AudioCodec; codecId: string; webCodec?: string; description?: Uint8Array; sampleRate: number; channels: number } = {
    codec: 'other',
    codecId: fourcc,
    sampleRate,
    channels,
  };

  switch (fourcc) {
    case 'mp4a': {
      let esds = child(b, holder, 'esds');
      if (!esds) {
        const wave = child(b, holder, 'wave'); // QuickTime wraps esds in a 'wave' box
        if (wave) esds = child(b, wave, 'esds');
      }
      const cfg = esds ? parseEsds(b, esds.data + 4, esds.end) : undefined;
      if (cfg && AAC_OTI.has(cfg.oti)) {
        out.codec = 'aac';
        if (cfg.asc && cfg.asc.length >= 2) {
          const aot = cfg.asc[0] >> 3 === 31 ? 32 + (((cfg.asc[0] & 7) << 3) | (cfg.asc[1] >> 5)) : cfg.asc[0] >> 3;
          out.webCodec = `mp4a.40.${aot}`;
          out.description = cfg.asc;
        }
      } else if (cfg && (cfg.oti === 0x69 || cfg.oti === 0x6b)) {
        out.codec = 'mp3';
        out.webCodec = 'mp3';
      } else if (cfg?.oti === 0xa5) out.codec = 'ac3';
      else if (cfg?.oti === 0xa6) out.codec = 'eac3';
      else if (!cfg) out.codec = 'aac';
      break;
    }
    case '.mp3':
      out.codec = 'mp3';
      out.webCodec = 'mp3';
      break;
    case 'Opus': {
      out.codec = 'opus';
      const dops = child(b, holder, 'dOps');
      if (dops && dops.end - dops.data >= 11) {
        // dOps → the OpusHead packet WebCodecs expects (same fields, little-endian).
        const d = b.subarray(dops.data, dops.end);
        const head = new Uint8Array(19 + (d.length > 11 ? d.length - 11 : 0));
        head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, 1, d[1]]);
        head[10] = d[3];
        head[11] = d[2]; // pre-skip LE
        head[12] = d[7];
        head[13] = d[6];
        head[14] = d[5];
        head[15] = d[4]; // input rate LE
        head[16] = d[9];
        head[17] = d[8]; // output gain LE
        head[18] = d[10];
        if (d.length > 11) head.set(d.subarray(11), 19);
        out.webCodec = 'opus';
        out.description = head;
        out.channels = d[1];
        out.sampleRate = 48000;
      }
      break;
    }
    case 'fLaC':
      out.codec = 'flac';
      break;
    case 'alac':
      out.codec = 'alac';
      break;
    case 'ac-3':
      out.codec = 'ac3';
      break;
    case 'ec-3':
      out.codec = 'eac3';
      break;
    case 'sowt':
    case 'twos':
    case 'lpcm':
    case 'in24':
    case 'in32':
    case 'fl32':
    case 'fl64':
    case 'raw ':
      out.codec = 'pcm';
      break;
    case 'samr':
    case 'sawb':
      out.codec = 'amr';
      break;
  }
  if (!sampleRate && out.sampleRate) sampleRate = out.sampleRate;
  out.sampleRate = out.sampleRate || sampleRate;
  return out;
}

/** esds payload (after version/flags) → objectTypeIndication and the AudioSpecificConfig bytes. */
function parseEsds(b: Uint8Array, start: number, end: number): { oti: number; asc?: Uint8Array } | undefined {
  let o = start;
  const readLen = (): number => {
    let len = 0;
    for (let i = 0; i < 4 && o < end; i++) {
      const byte = b[o++];
      len = (len << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) break;
    }
    return len;
  };
  if (b[o++] !== 0x03) return undefined;
  readLen();
  o += 2; // ES_ID
  const flags = b[o++];
  if (flags & 0x80) o += 2;
  if (flags & 0x40) o += 1 + b[o];
  if (flags & 0x20) o += 2;
  if (b[o++] !== 0x04) return undefined;
  readLen();
  const oti = b[o];
  o += 13; // oti, streamType, bufferSize, max/avg bitrate
  if (b[o] === 0x05) {
    o++;
    const len = readLen();
    return { oti, asc: b.slice(o, Math.min(o + len, end)) };
  }
  return { oti };
}

function readSampleTables(b: Uint8Array, stbl: Box, timescale: number): AudioSample[] {
  const stsz = child(b, stbl, 'stsz');
  const stsc = child(b, stbl, 'stsc');
  const stts = child(b, stbl, 'stts');
  const stco = child(b, stbl, 'stco');
  const co64 = child(b, stbl, 'co64');
  const chunkTable = stco ?? co64;
  if (!stsz || !stsc || !stts || !chunkTable) return [];

  const fixedSize = u32(b, stsz.data + 4);
  const count = u32(b, stsz.data + 8);
  if (count > MAX_SAMPLES) return [];
  const sizeAt = (i: number) => (fixedSize || u32(b, stsz.data + 12 + i * 4));

  const chunks = u32(b, chunkTable.data + 4);
  const offsetAt = (i: number) => (stco ? u32(b, chunkTable.data + 8 + i * 4) : u64(b, chunkTable.data + 8 + i * 8));
  const runs = u32(b, stsc.data + 4);
  const runAt = (i: number) => ({ first: u32(b, stsc.data + 8 + i * 12), perChunk: u32(b, stsc.data + 12 + i * 12) });

  // Timestamps from the time-to-sample table.
  const deltas = new Float64Array(count);
  const runsOfTime = u32(b, stts.data + 4);
  let k = 0;
  for (let e = 0; e < runsOfTime && k < count; e++) {
    const n = u32(b, stts.data + 8 + e * 8);
    const d = u32(b, stts.data + 12 + e * 8);
    for (let j = 0; j < n && k < count; j++) deltas[k++] = d;
  }

  const samples: AudioSample[] = [];
  let sample = 0;
  let time = 0;
  let run = 0;
  for (let c = 0; c < chunks && sample < count; c++) {
    while (run + 1 < runs && runAt(run + 1).first <= c + 1) run++;
    let offset = offsetAt(c);
    for (let s = 0; s < runAt(run).perChunk && sample < count; s++) {
      const size = sizeAt(sample);
      samples.push({ offset, size, timeUs: Math.round((time * 1e6) / timescale), durationUs: Math.round((deltas[sample] * 1e6) / timescale) });
      offset += size;
      time += deltas[sample];
      sample++;
    }
  }
  return samples;
}

/** Fragmented files keep their samples in moof boxes: walk them and add the audio track's runs. */
async function mp4Demux(reader: Reader, track: Mp4Track): Promise<DemuxedAudio | null> {
  if (!track.webCodec) return null;
  let samples = track.samples;
  if (track.fragmented) {
    samples = [];
    let pos = 0;
    while (pos + 8 <= reader.size && samples.length < MAX_SAMPLES) {
      const head = await reader.bytes(pos, 16);
      if (head.length < 8) break;
      let size = u32(head, 0);
      const type = tag(head, 4);
      if (size === 1) size = head.length >= 16 ? u64(head, 8) : 0;
      else if (size === 0) size = reader.size - pos;
      if (size < 8) break;
      if (type === 'moof' && size <= 64 * 1024 * 1024 && pos + size <= reader.size) {
        const moof = new Uint8Array(await reader.source.read(pos, pos + size));
        readMoof(moof, pos, track, samples);
      }
      pos += size;
    }
  }
  if (!samples.length) return null;
  return {
    config: { codec: track.webCodec, sampleRate: track.sampleRate || 48000, numberOfChannels: track.channels || 2, description: track.description },
    samples,
  };
}

function readMoof(b: Uint8Array, moofStart: number, track: Mp4Track, out: AudioSample[]): void {
  const root: Box = { type: 'moof', data: 8, end: b.length };
  for (const traf of boxes(b, root.data, root.end)) {
    if (traf.type !== 'traf') continue;
    let base = moofStart;
    let defDuration = track.defaultDuration;
    let defSize = track.defaultSize;
    let decodeTime = 0;
    let matched = false;
    let next = -1;
    for (const box of boxes(b, traf.data, traf.end)) {
      if (box.type === 'tfhd') {
        const flags = u32(b, box.data) & 0xffffff;
        if (u32(b, box.data + 4) !== track.id) break;
        matched = true;
        let o = box.data + 8;
        if (flags & 0x1) (base = u64(b, o)), (o += 8);
        if (flags & 0x2) o += 4;
        if (flags & 0x8) (defDuration = u32(b, o)), (o += 4);
        if (flags & 0x10) (defSize = u32(b, o)), (o += 4);
      } else if (box.type === 'tfdt' && matched) {
        decodeTime = b[box.data] === 1 ? u64(b, box.data + 4) : u32(b, box.data + 4);
      } else if (box.type === 'trun' && matched) {
        const flags = u32(b, box.data) & 0xffffff;
        const n = u32(b, box.data + 4);
        let o = box.data + 8;
        let offset = next;
        if (flags & 0x1) (offset = base + (u32(b, o) | 0)), (o += 4);
        else if (offset < 0) offset = base;
        if (flags & 0x4) o += 4;
        for (let i = 0; i < n && o <= box.end; i++) {
          let duration = defDuration;
          let size = defSize;
          if (flags & 0x100) (duration = u32(b, o)), (o += 4);
          if (flags & 0x200) (size = u32(b, o)), (o += 4);
          if (flags & 0x400) o += 4;
          if (flags & 0x800) o += 4;
          out.push({ offset, size, timeUs: Math.round((decodeTime * 1e6) / track.timescale), durationUs: Math.round((duration * 1e6) / track.timescale) });
          offset += size;
          decodeTime += duration;
        }
        next = offset;
      }
    }
  }
}

// ── WebM / Matroska (EBML) ───────────────────────────────────────────────────

const ID = {
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  trackNumber: 0xd7,
  trackType: 0x83,
  codecId: 0x86,
  codecPrivate: 0x63a2,
  video: 0xe0,
  audio: 0xe1,
  samplingFrequency: 0xb5,
  channels: 0x9f,
  cluster: 0x1f43b675,
  timecode: 0xe7,
  simpleBlock: 0xa3,
  blockGroup: 0xa0,
  block: 0xa1,
  blockDuration: 0x9b,
} as const;

/** Elements whose children we want to see: the scanner steps into these instead of skipping them. */
const MASTERS = new Set<number>([ID.segment, ID.info, ID.tracks, ID.trackEntry, ID.audio, ID.video, ID.cluster, ID.blockGroup]);
const SMALL = new Set<number>([ID.timecodeScale, ID.trackNumber, ID.trackType, ID.codecId, ID.codecPrivate, ID.samplingFrequency, ID.channels, ID.timecode, ID.blockDuration]);

interface WebmTrack {
  number: number;
  type: number;
  codecId: string;
  codecPrivate?: Uint8Array;
  sampleRate: number;
  channels: number;
}

const readUint = (b: Uint8Array): number => b.reduce((acc, v) => acc * 256 + v, 0);

function webmCodec(codecId: string): AudioCodec {
  if (codecId === 'A_OPUS') return 'opus';
  if (codecId === 'A_VORBIS') return 'vorbis';
  if (codecId.startsWith('A_AAC')) return 'aac';
  if (codecId === 'A_MPEG/L3' || codecId === 'A_MPEG/L2') return 'mp3';
  if (codecId === 'A_FLAC') return 'flac';
  if (codecId === 'A_AC3') return 'ac3';
  if (codecId === 'A_EAC3') return 'eac3';
  if (codecId.startsWith('A_DTS')) return 'dts';
  if (codecId.startsWith('A_PCM')) return 'pcm';
  if (codecId === 'A_ALAC') return 'alac';
  return 'other';
}

/**
 * Walks the EBML elements. With `collect` false it stops once the track list is complete (the header);
 * with `collect` true it also records every block of the first audio track.
 */
async function readWebm(reader: Reader, collect: boolean): Promise<{ probe: MediaProbe; demux: DemuxedAudio | null }> {
  const tracks: WebmTrack[] = [];
  let current: WebmTrack | undefined;
  let timecodeScale = 1_000_000;
  let clusterTime = 0;
  let tracksEnd = -1;
  let tracksDone = false;
  let audioNumber = -1;
  const samples: AudioSample[] = [];
  let pending: { offset: number; size: number; time: number } | null = null;
  let pos = 0;

  const finishTracks = () => {
    if (tracksDone) return;
    tracksDone = true;
    audioNumber = tracks.find((t) => t.type === 2)?.number ?? -1;
  };

  while (pos < reader.size) {
    const head = await reader.bytes(pos, 16);
    if (head.length < 2) break;
    const idLen = 8 - Math.floor(Math.log2(head[0] || 1));
    if (!head[0] || idLen > 4 || head.length < idLen + 1) break;
    let id = 0;
    for (let i = 0; i < idLen; i++) id = id * 256 + head[i];
    const sizeByte = head[idLen];
    if (!sizeByte) break;
    const sizeLen = 9 - (Math.floor(Math.log2(sizeByte)) + 1);
    if (head.length < idLen + sizeLen) break;
    let size = sizeByte & (0xff >> sizeLen);
    let allOnes = size === 0xff >> sizeLen;
    for (let i = 1; i < sizeLen; i++) {
      size = size * 256 + head[idLen + i];
      if (head[idLen + i] !== 0xff) allOnes = false;
    }
    const unknown = allOnes;
    const data = pos + idLen + sizeLen;

    if (tracksEnd >= 0 && pos >= tracksEnd) finishTracks();

    if (id === ID.cluster) {
      finishTracks();
      if (!collect) break;
    }

    if (MASTERS.has(id)) {
      if (id === ID.tracks && !unknown) tracksEnd = data + size;
      if (id === ID.trackEntry) {
        current = { number: 0, type: 0, codecId: '', sampleRate: 8000, channels: 1 };
        tracks.push(current);
      }
      pos = data;
      continue;
    }

    if (unknown) break;
    const dataEnd = data + size;
    if (SMALL.has(id) && size <= 65536 && dataEnd <= reader.size) {
      const body = await reader.bytes(data, size);
      switch (id) {
        case ID.timecodeScale:
          timecodeScale = readUint(body) || timecodeScale;
          break;
        case ID.trackNumber:
          if (current) current.number = readUint(body);
          break;
        case ID.trackType:
          if (current) current.type = readUint(body);
          break;
        case ID.codecId:
          if (current) current.codecId = ascii(body, 0, body.length).replace(/\0+$/, '');
          break;
        case ID.codecPrivate:
          if (current) current.codecPrivate = body.slice();
          break;
        case ID.samplingFrequency:
          if (current && (body.length === 4 || body.length === 8)) {
            const v = new DataView(body.buffer, body.byteOffset, body.length);
            current.sampleRate = Math.round(body.length === 4 ? v.getFloat32(0) : v.getFloat64(0));
          }
          break;
        case ID.channels:
          if (current) current.channels = readUint(body);
          break;
        case ID.timecode:
          clusterTime = readUint(body);
          break;
        case ID.blockDuration:
          if (pending) {
            const sample = samples[samples.length - 1];
            if (sample && sample.offset === pending.offset) sample.durationUs = Math.round((readUint(body) * timecodeScale) / 1000);
          }
          break;
      }
    } else if ((id === ID.simpleBlock || id === ID.block) && collect && audioNumber >= 0 && dataEnd <= reader.size) {
      const blockHead = await reader.bytes(data, 12);
      pending = null;
      // Track number is a vint (usually one byte), then a 16-bit time offset and a flags byte.
      const tn = blockHead[0];
      const tnLen = tn ? 9 - (Math.floor(Math.log2(tn)) + 1) : 1;
      let number = tn & (0xff >> tnLen);
      for (let i = 1; i < tnLen; i++) number = number * 256 + blockHead[i];
      const rel = (blockHead[tnLen] << 8) | blockHead[tnLen + 1];
      const flags = blockHead[tnLen + 2];
      const lacing = (flags >> 1) & 3;
      if (number === audioNumber && lacing === 0) {
        const signed = rel & 0x8000 ? rel - 0x10000 : rel;
        const offset = data + tnLen + 3;
        const time = Math.round(((clusterTime + signed) * timecodeScale) / 1000);
        samples.push({ offset, size: dataEnd - offset, timeUs: time });
        pending = { offset, size: dataEnd - offset, time };
      } else if (number === audioNumber) {
        return { probe: webmProbe(tracks, true), demux: null }; // laced audio: let the caller fall back
      }
    }
    pos = dataEnd;
  }
  if (tracksEnd >= 0 && pos >= tracksEnd) finishTracks();

  const audio = tracks.find((t) => t.type === 2);
  const probe = webmProbe(tracks, tracksDone && tracks.length > 0);
  let demux: DemuxedAudio | null = null;
  if (collect && audio && samples.length) {
    const codec = webmCodec(audio.codecId);
    let webCodec: string | undefined;
    let description: Uint8Array | undefined;
    if (codec === 'opus') webCodec = 'opus';
    else if (codec === 'mp3') webCodec = 'mp3';
    else if (codec === 'flac') webCodec = 'flac';
    else if (codec === 'aac' && audio.codecPrivate && audio.codecPrivate.length >= 2) {
      const c = audio.codecPrivate;
      const aot = c[0] >> 3 === 31 ? 32 + (((c[0] & 7) << 3) | (c[1] >> 5)) : c[0] >> 3;
      webCodec = `mp4a.40.${aot}`;
    }
    if (webCodec) {
      if (codec === 'opus' || codec === 'flac' || codec === 'aac') description = audio.codecPrivate;
      demux = { config: { codec: webCodec, sampleRate: audio.sampleRate, numberOfChannels: audio.channels, description }, samples };
    }
  }
  return { probe, demux };
}

function webmProbe(tracks: WebmTrack[], complete: boolean): MediaProbe {
  const audio = tracks.find((t) => t.type === 2);
  const hasVideo = tracks.some((t) => t.type === 1);
  if (!tracks.length || !complete) return { container: 'webm', hasAudio: audio ? true : null, hasVideo: hasVideo ? true : null, damaged: true };
  return {
    container: 'webm',
    hasAudio: !!audio,
    hasVideo,
    ...(audio ? { audio: { codec: webmCodec(audio.codecId), codecId: audio.codecId, sampleRate: audio.sampleRate, channels: audio.channels } } : {}),
  };
}

