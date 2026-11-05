import { describe, expect, it } from 'vitest';
import { MESSAGES, failureFor, unsupportedMessage } from './audio-extract';
import { type AudioSample, bytesSource, demuxAudio, probeMedia, readSamples, sniffContainer } from './media-probe';

// ── tiny builders ────────────────────────────────────────────────────────────

const cat = (...parts: (Uint8Array | number[])[]): Uint8Array => Uint8Array.from(parts.flatMap((p) => Array.from(p)));
const be = (n: number, len: number): number[] => Array.from({ length: len }, (_, i) => Math.floor(n / 2 ** (8 * (len - 1 - i))) & 0xff);
const text = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

const mp4Box = (type: string, ...payload: (Uint8Array | number[])[]): Uint8Array => {
  const body = cat(...payload);
  return cat(be(8 + body.length, 4), text(type), body);
};
const full = (type: string, ...payload: (Uint8Array | number[])[]) => mp4Box(type, [0, 0, 0, 0], ...payload);

const hdlr = (handler: string) => full('hdlr', be(0, 4), text(handler), new Array(13).fill(0));
const tkhd = (id: number) => full('tkhd', be(0, 4), be(0, 4), be(id, 4), new Array(68).fill(0));
const mdhd = (timescale: number) => full('mdhd', be(0, 4), be(0, 4), be(timescale, 4), be(0, 4), be(0, 4));

const ASC = [0x11, 0x90]; // AAC-LC, 48 kHz, stereo
const esds = full('esds', [0x03, 25, 0, 1, 0, 0x04, 17, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x05, 2, ...ASC, 0x06, 1, 2]);
const mp4aEntry = () => mp4Box('mp4a', new Array(6).fill(0), be(1, 2), new Array(8).fill(0), be(2, 2), be(16, 2), be(0, 4), be(48000, 2), be(0, 2), esds);

function audioTrak(mdatOffset: number, sizes: number[]) {
  const stbl = mp4Box(
    'stbl',
    full('stsd', be(1, 4), mp4aEntry()),
    full('stts', be(1, 4), be(sizes.length, 4), be(1024, 4)),
    full('stsc', be(1, 4), be(1, 4), be(sizes.length, 4), be(1, 4)), // one chunk with every sample
    full('stsz', be(0, 4), be(sizes.length, 4), ...sizes.map((s) => be(s, 4))),
    full('stco', be(1, 4), be(mdatOffset, 4)),
  );
  return mp4Box('trak', tkhd(2), mp4Box('mdia', mdhd(48000), hdlr('soun'), mp4Box('minf', stbl)));
}
const videoTrak = () => mp4Box('trak', tkhd(1), mp4Box('mdia', mdhd(30000), hdlr('vide'), mp4Box('minf', mp4Box('stbl'))));

/** ftyp + moov + mdat (a "fast start" file). Returns the bytes and the mdat payload offset. */
function buildMp4(withAudio: boolean, sizes = [4, 5, 6]) {
  const ftyp = mp4Box('ftyp', text('isom'), be(0, 4), text('isom'));
  // The audio chunk offset depends on the moov size, which depends on the offset: it is fixed-width, so two passes agree.
  const make = (offset: number) => mp4Box('moov', full('mvhd', new Array(96).fill(0)), videoTrak(), ...(withAudio ? [audioTrak(offset, sizes)] : []));
  const moovSize = make(0).length;
  const payloadOffset = ftyp.length + moovSize + 8;
  const payload = Uint8Array.from({ length: sizes.reduce((a, b) => a + b, 0) }, (_, i) => i + 1);
  return { bytes: cat(ftyp, make(payloadOffset), mp4Box('mdat', payload)), payloadOffset };
}

// EBML
const vint = (n: number): number[] => (n < 127 ? [0x80 | n] : [0x40 | (n >> 8), n & 0xff]);
const ebml = (id: number[], ...payload: (Uint8Array | number[])[]): Uint8Array => {
  const body = cat(...payload);
  return cat(id, vint(body.length), body);
};
const UNKNOWN = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
const uint = (id: number[], n: number) => ebml(id, be(n, 1));
const trackEntry = (n: number, type: number, codec: string, extra: Uint8Array[] = []) =>
  ebml([0xae], uint([0xd7], n), uint([0x83], type), ebml([0x86], text(codec)), ...extra);
const audioInfo = ebml([0xe1], ebml([0xb5], Array.from(new Uint8Array(new Float64Array([48000]).buffer)).reverse()), uint([0x9f], 2));
const simpleBlock = (track: number, rel: number, data: number[]) => ebml([0xa3], [0x80 | track], be(rel, 2), [0x80], data);

function buildWebm(withAudio: boolean) {
  const tracks = ebml(
    [0x16, 0x54, 0xae, 0x6b],
    trackEntry(1, 1, 'V_VP8'),
    ...(withAudio ? [trackEntry(2, 2, 'A_OPUS', [ebml([0x63, 0xa2], text('OpusHead'), new Array(11).fill(0)), audioInfo])] : []),
  );
  const cluster = ebml(
    [0x1f, 0x43, 0xb6, 0x75],
    uint([0xe7], 0),
    simpleBlock(1, 0, [9, 9, 9]),
    ...(withAudio ? [simpleBlock(2, 0, [1, 2, 3]), simpleBlock(2, 20, [4, 5])] : []),
  );
  const head = ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], text('webm')));
  return cat(head, [0x18, 0x53, 0x80, 0x67], UNKNOWN, ebml([0x15, 0x49, 0xa9, 0x66], ebml([0x2a, 0xd7, 0xb1], be(1_000_000, 3))), tracks, cluster);
}

const probeOf = (bytes: Uint8Array) => probeMedia(bytesSource(bytes));

// ── tests ────────────────────────────────────────────────────────────────────

describe('probeMedia: MP4', () => {
  it('reports a video with no sound track as having no audio', async () => {
    expect(await probeOf(buildMp4(false).bytes)).toEqual({ container: 'mp4', hasAudio: false, hasVideo: true });
  });

  it('finds an AAC audio track next to the video', async () => {
    const probe = await probeOf(buildMp4(true).bytes);
    expect(probe).toMatchObject({ container: 'mp4', hasAudio: true, hasVideo: true, audio: { codec: 'aac', codecId: 'mp4a', sampleRate: 48000, channels: 2 } });
  });

  it('flags a file cut off before its moov box as damaged, without claiming it has no audio', async () => {
    const { bytes } = buildMp4(true);
    const probe = await probeOf(bytes.subarray(0, 40));
    expect(probe).toMatchObject({ container: 'mp4', hasAudio: null, damaged: true });
  });

  it('finds moov after a large mdat (the layout of most phone and camera files)', async () => {
    const ftyp = mp4Box('ftyp', text('isom'), be(0, 4), text('isom'));
    const bytes = cat(ftyp, mp4Box('mdat', new Array(50_000).fill(7)), mp4Box('moov', full('mvhd', new Array(96).fill(0)), videoTrak()));
    expect(await probeOf(bytes)).toMatchObject({ hasAudio: false, hasVideo: true });
  });
});

describe('demuxAudio: MP4', () => {
  it('lists the AAC samples with offsets, sizes and times, and the decoder config', async () => {
    const { bytes, payloadOffset } = buildMp4(true, [4, 5, 6]);
    const demuxed = await demuxAudio(bytesSource(bytes));
    expect(demuxed?.config).toMatchObject({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2 });
    expect(Array.from(demuxed?.config.description ?? [])).toEqual(ASC);
    expect(demuxed?.samples.map((s) => [s.offset, s.size])).toEqual([
      [payloadOffset, 4],
      [payloadOffset + 4, 5],
      [payloadOffset + 9, 6],
    ]);
    expect(demuxed?.samples[1].timeUs).toBe(Math.round((1024 * 1e6) / 48000));
  });

  it('returns null for a file without audio', async () => {
    expect(await demuxAudio(bytesSource(buildMp4(false).bytes))).toBeNull();
  });
});

describe('probeMedia / demuxAudio: WebM', () => {
  it('reports a WebM with only a video track as having no audio', async () => {
    expect(await probeOf(buildWebm(false))).toEqual({ container: 'webm', hasAudio: false, hasVideo: true });
  });

  it('finds an Opus audio track', async () => {
    expect(await probeOf(buildWebm(true))).toMatchObject({ container: 'webm', hasAudio: true, hasVideo: true, audio: { codec: 'opus', codecId: 'A_OPUS', sampleRate: 48000, channels: 2 } });
  });

  it('lists only the audio blocks, with their times', async () => {
    const bytes = buildWebm(true);
    const demuxed = await demuxAudio(bytesSource(bytes));
    expect(demuxed?.config).toMatchObject({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2 });
    expect(demuxed?.samples.map((s) => [s.size, s.timeUs])).toEqual([
      [3, 0],
      [2, 20000],
    ]);
    const first = demuxed!.samples[0];
    expect(Array.from(bytes.subarray(first.offset, first.offset + first.size))).toEqual([1, 2, 3]);
  });

  it('does not claim "no audio" when the file is cut off before the track list ends', async () => {
    const probe = await probeOf(buildWebm(true).subarray(0, 60));
    expect(probe.hasAudio).not.toBe(false);
  });
});

describe('probeMedia: audio-only and unknown files', () => {
  it('recognises WAV, MP3, FLAC, ADTS AAC and Ogg by their first bytes', () => {
    const wav = cat(text('RIFF'), [0, 0, 0, 0], text('WAVE'), text('fmt '), [16, 0, 0, 0], [1, 0, 2, 0], [0x44, 0xac, 0, 0]);
    expect(sniffContainer(wav)).toEqual({ container: 'wav', sampleRate: 44100 });
    expect(sniffContainer(cat([0xff, 0xfb, 0x90, 0x00]))).toEqual({ container: 'mp3', sampleRate: 44100 });
    expect(sniffContainer(cat(text('ID3'), [4, 0, 0, 0, 0, 0, 0])).container).toBe('mp3');
    expect(sniffContainer(cat([0xff, 0xf1, 0x50, 0x80])).container).toBe('aac');
    expect(sniffContainer(cat(text('fLaC'), [0, 0, 0, 34, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x0a, 0xc4, 0x42, 0xf0])).container).toBe('flac');
    expect(sniffContainer(cat(text('OggS'), [0, 2, 0, 0])).container).toBe('ogg');
  });

  it('says audio-only files have audio and no video', async () => {
    const mp3 = await probeOf(cat([0xff, 0xfb, 0x90, 0x00], new Array(100).fill(0)));
    expect(mp3).toMatchObject({ container: 'mp3', hasAudio: true, hasVideo: false });
  });

  it('treats text and empty files as an unknown container', async () => {
    expect(await probeOf(Uint8Array.from(text('hello, this is not media at all')))).toEqual({ container: 'unknown', hasAudio: null, hasVideo: null });
    expect(await probeOf(new Uint8Array(0))).toEqual({ container: 'unknown', hasAudio: null, hasVideo: null });
  });

  it('never throws on garbage that starts like a container', async () => {
    const junk = cat(be(0xffffffff, 4), text('ftyp'), new Array(32).fill(0xff));
    await expect(probeOf(junk)).resolves.toMatchObject({ container: 'mp4' });
    await expect(probeOf(cat([0x1a, 0x45, 0xdf, 0xa3], new Array(32).fill(0xff)))).resolves.toMatchObject({ container: 'webm' });
  });
});

describe('readSamples', () => {
  it("returns each sample's bytes, batching nearby samples into one read and skipping those past the end", async () => {
    const data = Uint8Array.from({ length: 100 }, (_, i) => i);
    let reads = 0;
    const source = {
      size: data.length,
      read: async (a: number, b: number) => {
        reads++;
        return data.subarray(a, Math.min(b, data.length));
      },
    };
    const samples: AudioSample[] = [
      { offset: 10, size: 3, timeUs: 0 },
      { offset: 13, size: 2, timeUs: 1 },
      { offset: 50, size: 4, timeUs: 2 },
      { offset: 98, size: 10, timeUs: 3 }, // runs past the end
    ];
    const out: number[][] = [];
    for await (const { data: d } of readSamples(source, samples)) out.push(Array.from(d));
    expect(out).toEqual([[10, 11, 12], [13, 14], [50, 51, 52, 53]]);
    expect(reads).toBe(1);
  });
});

describe('failure messages', () => {
  it('tells a silent video apart from an unreadable codec and from a damaged or non-media file', () => {
    expect(failureFor({ container: 'mp4', hasAudio: null, hasVideo: null, damaged: true }).kind).toBe('damaged');
    expect(failureFor({ container: 'unknown', hasAudio: null, hasVideo: null }).kind).toBe('not-media');
    const ac3 = failureFor({ container: 'mp4', hasAudio: true, hasVideo: true, audio: { codec: 'ac3', codecId: 'ac-3' } });
    expect(ac3.kind).toBe('unsupported-codec');
    expect(ac3.message).toContain('Dolby Digital');
    expect(failureFor({ container: 'ogg', hasAudio: null, hasVideo: null }).kind).toBe('unreadable');
  });

  it('the no-audio message says so plainly and offers no retry advice', () => {
    expect(MESSAGES.noAudio).toContain('no audio track');
    expect(MESSAGES.noAudio.toLowerCase()).not.toMatch(/try again|browser|codec/);
    expect(unsupportedMessage('AAC')).not.toMatch(/codec/i);
  });
});
