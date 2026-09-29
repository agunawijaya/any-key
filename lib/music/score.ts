import { parseChord, parsePitch, type Chord } from "./theory";

/*
 * A tiny text notation for melodies, so every tune reads like a lead sheet:
 *
 *   "D4e D4e | G4q. B4q r h"   pitch + duration, bars separated by |
 *
 * Durations: w=4, h=2, q=1, e=1/2, s=1/4 beats (quarter-note beats).
 * A trailing "." dots the note, a trailing "~" ties it to the next note.
 * "r" is a rest: "rq", "re.".
 */

export type Meter = { top: number; bottom: 4 | 8 };

export type ScoreNote = {
  at: number;
  dur: number;
  pitch: number | null;
  /** The pitch as written ("C#4", "Bb3"), so the sheet music spells it right. */
  name?: string;
  tie?: boolean;
};

export type ChordSpan = { at: number; dur: number; chord: Chord };

export type SongSource = {
  id: string;
  letter: string;
  title: string;
  composer: string;
  about: string;
  meter: [number, 4 | 8];
  bpm: number;
  /** Key for numbered notation ("1 = G"); minor songs use their relative major's do. */
  doName: string;
  tonic: string;
  mode: "major" | "minor" | "in";
  pickup: number;
  melody: string;
  chords: string;
  character: "march" | "waltz" | "dance" | "lyrical" | "playful" | "spooky" | "drama" | "drill";
  /** Ticks (1/18.2 s) per beat for the authentic 1981 speaker mode. */
  ticksPerBeat: number;
  color: string;
};

export type Song = Omit<SongSource, "meter" | "melody" | "chords"> & {
  meter: Meter;
  barBeats: number;
  notes: ScoreNote[];
  chords: ChordSpan[];
  length: number;
  bars: number;
  tonicPc: number;
};

const DURATIONS: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

export const barBeatsOf = ([top, bottom]: [number, 4 | 8]) => (top * 4) / bottom;

export function compileSong(source: SongSource): Song {
  const barBeats = barBeatsOf(source.meter);
  const notes: ScoreNote[] = [];
  const bars = source.melody.split("|").map((bar) => bar.trim());
  let at = 0;

  bars.forEach((bar, index) => {
    const start = at;
    for (const token of bar.split(/\s+/).filter(Boolean)) {
      const match = /^(r|[A-G][#b]?-?\d)([whqes])(\.?)(~?)$/.exec(token);
      if (!match) throw new Error(`${source.id}: bad token "${token}"`);
      const [, pitch, code, dot, tie] = match;
      const dur = DURATIONS[code] * (dot ? 1.5 : 1);
      notes.push({
        at,
        dur,
        pitch: pitch === "r" ? null : parsePitch(pitch),
        name: pitch === "r" ? undefined : pitch,
        tie: tie === "~" || undefined,
      });
      at += dur;
    }
    const expected = index === 0 && source.pickup > 0 ? source.pickup : barBeats;
    const isLast = index === bars.length - 1;
    const got = at - start;
    if (Math.abs(got - expected) > 1e-6 && !(isLast && got < expected)) {
      throw new Error(`${source.id}: bar ${index} has ${got} beats, expected ${expected}`);
    }
  });

  const length = at;
  const chordBars = source.chords.split("|").map((bar) => bar.trim());
  const chords: ChordSpan[] = [];
  let barStart = 0;
  chordBars.forEach((bar, index) => {
    const span = index === 0 && source.pickup > 0 ? source.pickup : barBeats;
    const symbols = bar.split(/\s+/).filter((s) => s && s !== "-");
    const weights = symbols.map((s) => Number(s.split(":")[1] ?? 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let offset = 0;
    symbols.forEach((symbol, i) => {
      const dur = (span * weights[i]) / total;
      chords.push({ at: barStart + offset, dur, chord: parseChord(symbol.split(":")[0]) });
      offset += dur;
    });
    barStart += span;
  });
  if (Math.abs(barStart - Math.ceil(length - source.pickup) - source.pickup) > barBeats) {
    throw new Error(`${source.id}: chord chart covers ${barStart} beats but the melody is ${length}`);
  }

  const { meter, melody: _m, chords: _c, ...rest } = source;
  void _m;
  void _c;
  return {
    ...rest,
    meter: { top: meter[0], bottom: meter[1] },
    barBeats,
    notes,
    chords,
    length,
    bars: Math.ceil((length - source.pickup) / barBeats),
    tonicPc: parsePitch(`${source.tonic}4`) % 12,
  };
}

/** The chord sounding at a given beat (the last one that started). */
export function chordAt(chords: ChordSpan[], beat: number) {
  let found = chords[0];
  for (const span of chords) {
    if (span.at <= beat + 1e-6) found = span;
    else break;
  }
  return found;
}
