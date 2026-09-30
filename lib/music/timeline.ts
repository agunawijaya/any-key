import type { Arrangement, ArrNote, Track } from "./arrange/types";
import { isBlackKey } from "./theory";

/** Notes of one track, sorted, with a quick "what is sounding now?" lookup. */
export type TrackIndex = { track: Track; notes: ArrNote[]; longest: number };

export function indexTracks(arrangement: Arrangement): TrackIndex[] {
  return arrangement.tracks.map((track) => {
    const notes = [...track.notes].sort((a, b) => a.at - b.at);
    return { track, notes, longest: notes.reduce((m, n) => Math.max(m, n.dur), 0) };
  });
}

/** First index whose note starts after `beat`. */
function upperBound(notes: ArrNote[], beat: number) {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].at <= beat) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Where to start scanning for notes still sounding at `beat` (long pieces have thousands). */
export function firstSoundingFrom(index: TrackIndex, beat: number) {
  let lo = 0;
  let hi = index.notes.length;
  const from = beat - index.longest;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (index.notes[mid].at < from) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function soundingIn(index: TrackIndex, beat: number): ArrNote[] {
  const out: ArrNote[] = [];
  const end = upperBound(index.notes, beat);
  for (let i = end - 1; i >= 0; i--) {
    const note = index.notes[i];
    if (note.at < beat - index.longest) break;
    if (note.at + note.dur > beat) out.push(note);
  }
  return out;
}

/** Notes starting within [from, to): for pulses on the stage view. */
export function startingIn(index: TrackIndex, from: number, to: number): ArrNote[] {
  const out: ArrNote[] = [];
  for (let i = upperBound(index.notes, from - 1e-6); i < index.notes.length && index.notes[i].at < to; i++) {
    if (index.notes[i].at >= from) out.push(index.notes[i]);
  }
  return out;
}

const ROLE_PRIORITY = ["melody", "counter", "arp", "chords", "pad", "bass", "perc"];

/** Which track "owns" each lit key: the tune wins over accompaniment. */
export function litKeys(indexes: TrackIndex[], beat: number, muted: Set<string>) {
  const lit = new Map<number, string>();
  const ordered = [...indexes]
    .filter((i) => !i.track.patch.drums && !muted.has(i.track.id))
    .sort((a, b) => ROLE_PRIORITY.indexOf(b.track.role) - ROLE_PRIORITY.indexOf(a.track.role));
  for (const index of ordered) {
    for (const note of soundingIn(index, beat)) lit.set(note.pitch, index.track.color);
  }
  return lit;
}

/** A keyboard range that covers every pitched note, snapped to whole octaves (C to B). */
export function keyboardRange(arrangement: Arrangement): [number, number] {
  let lo = 127;
  let hi = 0;
  for (const track of arrangement.tracks) {
    if (track.patch.drums) continue;
    for (const note of track.notes) {
      lo = Math.min(lo, note.pitch);
      hi = Math.max(hi, note.pitch);
    }
  }
  if (lo > hi) return [48, 83];
  lo = Math.max(21, lo - (lo % 12));
  hi = Math.min(108, hi + (11 - (hi % 12)));
  while (hi - lo < 35) {
    if (lo > 24) lo -= 12;
    else hi += 12;
  }
  return [lo, hi];
}

export type KeyShape = { pitch: number; x: number; w: number; black: boolean };

/** Key rectangles for a range, in units where a white key is 1 wide. */
export function keyShapes(lo: number, hi: number): { keys: KeyShape[]; width: number } {
  const keys: KeyShape[] = [];
  let white = 0;
  for (let pitch = lo; pitch <= hi; pitch++) {
    if (isBlackKey(pitch)) keys.push({ pitch, x: white - 0.3, w: 0.6, black: true });
    else {
      keys.push({ pitch, x: white, w: 1, black: false });
      white++;
    }
  }
  return { keys, width: white };
}
