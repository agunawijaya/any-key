import type { Arrangement, Track } from "./arrange/types";

/** Writes an arrangement as a Standard MIDI File (format 1). */

const PPQ = 480;
const DRUM_CHANNEL = 9;

type Event = { tick: number; order: number; bytes: number[] };

export function assignChannels(tracks: Track[]) {
  const channels = new Map<string, number>();
  let next = 0;
  for (const track of tracks) {
    if (track.patch.drums) {
      channels.set(track.id, DRUM_CHANNEL);
      continue;
    }
    if (next === DRUM_CHANNEL) next++;
    channels.set(track.id, Math.min(next, 15));
    next++;
  }
  return channels;
}

export function toMidi(arrangement: Arrangement): { bytes: Uint8Array; channels: Map<string, number> } {
  const channels = assignChannels(arrangement.tracks);
  const chunks: number[][] = [];

  const tempo = Math.round(60_000_000 / arrangement.bpm);
  const meta: Event[] = [
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff] },
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x58, 0x04, arrangement.meter.top, Math.log2(arrangement.meter.bottom), 24, 8],
    },
    { tick: 0, order: 0, bytes: [0xff, 0x03, ...text(`Bop Box · ${arrangement.label}`)] },
  ];
  chunks.push(trackChunk(meta, toTicks(arrangement.length)));

  for (const track of arrangement.tracks) {
    const ch = channels.get(track.id)!;
    const events: Event[] = [{ tick: 0, order: 0, bytes: [0xff, 0x03, ...text(track.name)] }];
    const setup: number[][] = [];
    if (!track.patch.drums && track.patch.bank !== undefined) setup.push([0xb0 | ch, 0, track.patch.bank]);
    setup.push([0xc0 | ch, track.patch.program]);
    setup.push([0xb0 | ch, 7, track.volume]);
    setup.push([0xb0 | ch, 10, track.pan]);
    setup.push([0xb0 | ch, 91, Math.min(127, track.reverb)]);
    setup.push([0xb0 | ch, 93, track.chorus]);
    if (track.bendRange) setup.push([0xb0 | ch, 101, 0], [0xb0 | ch, 100, 0], [0xb0 | ch, 6, track.bendRange], [0xb0 | ch, 38, 0]);
    setup.forEach((bytes, i) => events.push({ tick: 0, order: -100 + i, bytes }));

    for (const a of track.automation) {
      const tick = toTicks(a.at);
      if (a.kind === "cc") events.push({ tick, order: 2, bytes: [0xb0 | ch, a.cc, clamp(a.value)] });
      else {
        const value = Math.max(0, Math.min(16383, 8192 + Math.round(a.value)));
        events.push({ tick, order: 2, bytes: [0xe0 | ch, value & 0x7f, (value >> 7) & 0x7f] });
      }
    }
    for (const note of track.notes) {
      const on = toTicks(note.at);
      const off = Math.max(on + 1, toTicks(note.at + note.dur));
      events.push({ tick: on, order: 3, bytes: [0x90 | ch, note.pitch, clamp(note.vel)] });
      events.push({ tick: off, order: 1, bytes: [0x80 | ch, note.pitch, 0] });
    }
    chunks.push(trackChunk(events, toTicks(arrangement.length)));
  }

  const header = [...ascii("MThd"), ...u32(6), ...u16(1), ...u16(chunks.length), ...u16(PPQ)];
  const bytes = new Uint8Array([...header, ...chunks.flat()]);
  return { bytes, channels };
}

const toTicks = (beats: number) => Math.max(0, Math.round(beats * PPQ));
const clamp = (v: number) => Math.max(0, Math.min(127, Math.round(v)));

function trackChunk(events: Event[], endTick: number): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data: number[] = [];
  let last = 0;
  for (const event of events) {
    data.push(...vlq(event.tick - last), ...event.bytes);
    last = event.tick;
  }
  data.push(...vlq(Math.max(0, endTick - last)), 0xff, 0x2f, 0x00);
  return [...ascii("MTrk"), ...u32(data.length), ...data];
}

function vlq(value: number) {
  const bytes = [value & 0x7f];
  while ((value >>= 7)) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function text(s: string) {
  const bytes = [...new TextEncoder().encode(s)];
  return [...vlq(bytes.length), ...bytes];
}
