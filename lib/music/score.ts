import { parseChord, parsePitch, pitchClass, type Chord } from "./theory";

/*
 * A tiny text notation for melodies, so every tune reads like a lead sheet:
 *
 *   "D4e D4e | G4q. B4q r h"   pitch + duration, bars separated by |
 *
 * Durations: w=4, h=2, q=1, e=1/2, s=1/4, t=1/8 beats (quarter-note beats).
 * A trailing "." dots the note, a trailing "~" ties it to the next note.
 * Accidentals: # and b, doubled for ## and bb.
 * "r" is a rest: "rq", "re.". "@96" sets the tempo from that point on
 * (quarter notes per minute).
 *
 * The 1981 versions are one short lead sheet each. The full versions are
 * built from named sections (with their own meter, key and tempo) played
 * in the order of a `form`, so a strain that repeats is written once, and
 * first and second endings work the way they do on paper.
 */

export type Meter = { top: number; bottom: 2 | 4 | 8 };
export type Mode = "major" | "minor" | "in";

export type KeySig = {
  /** Key for numbered notation and the key signature ("1 = G"); minor keys use their relative major's do. */
  doName: string;
  tonic: string;
  mode: Mode;
  tonicPc: number;
};

export type ScoreNote = {
  at: number;
  dur: number;
  pitch: number | null;
  /** The pitch as written ("C#4", "Bb3"), so the sheet music spells it right. */
  name?: string;
  tie?: boolean;
};

export type ChordSpan = { at: number; dur: number; chord: Chord };

/** One written bar: where it starts, how long it is, and what the page says there. */
export type Measure = {
  at: number;
  len: number;
  /** Beats in a whole bar of this meter (a pickup or a closing bar can be shorter). */
  full: number;
  meter: Meter;
  key: KeySig;
  /** Tempo at the start of the bar, in quarter notes per minute. */
  bpm: number;
  /** The printed bar number; a pickup is bar 0. */
  number: number;
};

export type Character = "march" | "waltz" | "dance" | "lyrical" | "playful" | "spooky" | "drama" | "drill";

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
  mode: Mode;
  pickup: number;
  melody: string;
  chords: string;
  character: Character;
  /** Ticks (1/18.2 s) per beat for the authentic 1981 speaker mode. */
  ticksPerBeat: number;
  color: string;
};

export type SectionSource = {
  /** Shown on the sheet music and in the numbers view. */
  name: string;
  meter?: [number, 2 | 4 | 8];
  /** "D" (major), "Dm" (minor), or a full key for scales like Sakura's. */
  key?: string | { doName: string; tonic: string; mode: Mode };
  bpm?: number;
  /** Beats before the first whole bar; they complete the previous section's last bar. */
  pickup?: number;
  melody: string;
  chords: string;
  /** First and second endings: "name:1" in the form plays the body and ending 1. */
  endings?: { melody: string; chords: string }[];
};

export type FullSource = {
  id: string;
  /** The main tempo and meter, which styles with their own groove fold the tune into. */
  bpm: number;
  meter: [number, 2 | 4 | 8];
  key: string | { doName: string; tonic: string; mode: Mode };
  about: string;
  /** Where the notes come from, for the Story and the credits. */
  source: string;
  sections: Record<string, SectionSource>;
  form: string[];
  /** The section (or first and last sections) the 1981 program played, so switching versions keeps your place. */
  excerpt: string | [string, string];
};

export type SongVersion = "short" | "full";

export type Song = Omit<SongSource, "meter" | "melody" | "chords"> & {
  version: SongVersion;
  meter: Meter;
  barBeats: number;
  notes: ScoreNote[];
  chords: ChordSpan[];
  length: number;
  bars: number;
  tonicPc: number;
  measures: Measure[];
  /** Tempo changes in score beats; the first one is at beat 0. */
  tempos: { at: number; bpm: number }[];
  /** Where each section of the form starts (its pickup included). */
  sections: { at: number; name: string }[];
  /** Full versions: the edition the notes were taken from. */
  source?: string;
  /** Full versions: where the 1981 excerpt starts and ends, in this version's beats. */
  excerptAt?: number;
  excerptEnd?: number;
};

const DURATIONS: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 0.125 };

export const barBeatsOf = ([top, bottom]: [number, number]) => (top * 4) / bottom;

const RELATIVE_MAJOR: Record<string, string> = {
  A: "C", E: "G", B: "D", "F#": "A", "C#": "E", "G#": "B", "D#": "F#",
  D: "F", G: "Bb", C: "Eb", F: "Ab", Bb: "Db", Eb: "Gb",
};

export function parseKey(key: string | { doName: string; tonic: string; mode: Mode }): KeySig {
  if (typeof key !== "string") return { ...key, tonicPc: pitchClass(parsePitch(`${key.tonic}4`)) };
  const minor = key.endsWith("m");
  const tonic = minor ? key.slice(0, -1) : key;
  const doName = minor ? RELATIVE_MAJOR[tonic] : tonic;
  if (!doName) throw new Error(`Unknown key "${key}"`);
  return { doName, tonic, mode: minor ? "minor" : "major", tonicPc: pitchClass(parsePitch(`${tonic}4`)) };
}

const splitBars = (text: string) => text.split("|").map((bar) => bar.trim());

/** Reads one bar of melody starting at `at`; returns the beat after it. */
function readBar(id: string, bar: string, at: number, notes: ScoreNote[], onTempo?: (at: number, bpm: number) => void) {
  for (const token of bar.split(/\s+/).filter(Boolean)) {
    const tempo = /^@(\d+(?:\.\d+)?)$/.exec(token);
    if (tempo) {
      if (!onTempo) throw new Error(`${id}: tempo marks belong in full versions`);
      onTempo(at, Number(tempo[1]));
      continue;
    }
    const match = /^(r|[A-G](?:##|#|bb|b)?-?\d)([whqest])(\.?)(~?)$/.exec(token);
    if (!match) throw new Error(`${id}: bad token "${token}"`);
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
  return at;
}

/** Chord symbols for one bar ("G", "Am D7", "C:3 G7" for uneven splits, "-" to hold). */
function readChords(bar: string, barStart: number, span: number, chords: ChordSpan[]) {
  const symbols = bar.split(/\s+/).filter((s) => s && s !== "-");
  const weights = symbols.map((s) => Number(s.split(":")[1] ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let offset = 0;
  symbols.forEach((symbol, i) => {
    const dur = (span * weights[i]) / total;
    chords.push({ at: barStart + offset, dur, chord: parseChord(symbol.split(":")[0]) });
    offset += dur;
  });
}

export function compileSong(source: SongSource): Song {
  const barBeats = barBeatsOf(source.meter);
  const notes: ScoreNote[] = [];
  const bars = splitBars(source.melody);
  let at = 0;

  bars.forEach((bar, index) => {
    const start = at;
    at = readBar(source.id, bar, at, notes);
    const expected = index === 0 && source.pickup > 0 ? source.pickup : barBeats;
    const isLast = index === bars.length - 1;
    const got = at - start;
    if (Math.abs(got - expected) > 1e-6 && !(isLast && got < expected)) {
      throw new Error(`${source.id}: bar ${index} has ${got} beats, expected ${expected}`);
    }
  });

  const length = at;
  const chordBars = splitBars(source.chords);
  const chords: ChordSpan[] = [];
  let barStart = 0;
  chordBars.forEach((bar, index) => {
    const span = index === 0 && source.pickup > 0 ? source.pickup : barBeats;
    readChords(bar, barStart, span, chords);
    barStart += span;
  });
  if (Math.abs(barStart - Math.ceil(length - source.pickup) - source.pickup) > barBeats) {
    throw new Error(`${source.id}: chord chart covers ${barStart} beats but the melody is ${length}`);
  }

  const meter: Meter = { top: source.meter[0], bottom: source.meter[1] };
  const key = parseKey({ doName: source.doName, tonic: source.tonic, mode: source.mode });
  const measures: Measure[] = [];
  for (let start = 0, number = source.pickup > 0 ? 0 : 1; start < length - 1e-6; number++) {
    const len = Math.min(number === 0 ? source.pickup : barBeats, length - start);
    measures.push({ at: start, len, full: barBeats, meter, key, bpm: source.bpm, number });
    start += len;
  }

  const { meter: _meter, melody: _m, chords: _c, ...rest } = source;
  void _meter;
  void _m;
  void _c;
  return {
    ...rest,
    version: "short",
    meter,
    barBeats,
    notes,
    chords,
    length,
    bars: Math.ceil((length - source.pickup) / barBeats),
    tonicPc: key.tonicPc,
    measures,
    tempos: [{ at: 0, bpm: source.bpm }],
    sections: [{ at: 0, name: source.title }],
  };
}

/** Builds the full version of a tune from its sections and form. */
export function compileFull(short: SongSource, full: FullSource): Song {
  const id = `${full.id}/full`;
  const notes: ScoreNote[] = [];
  const chords: ChordSpan[] = [];
  const measures: Measure[] = [];
  const tempos: { at: number; bpm: number }[] = [];
  const sections: { at: number; name: string }[] = [];
  let meter = full.meter;
  let key = parseKey(full.key);
  let bpm = full.bpm;
  let at = 0;
  let number = 0;
  const [excerptFirst, excerptLast] = typeof full.excerpt === "string" ? [full.excerpt, full.excerpt] : full.excerpt;
  let excerptAt: number | undefined;
  let excerptEnd: number | undefined;

  const setTempo = (beat: number, value: number) => {
    const last = tempos[tempos.length - 1];
    if (last && Math.abs(last.at - beat) < 1e-6) last.bpm = value;
    else if (!last || last.bpm !== value) tempos.push({ at: beat, bpm: value });
    bpm = value;
  };

  for (const entry of full.form) {
    const [name, ending] = entry.split(":");
    const section = full.sections[name];
    if (!section) throw new Error(`${id}: the form names a missing section "${name}"`);
    if (section.meter) meter = section.meter;
    if (section.key) key = parseKey(section.key);
    setTempo(at, section.bpm ?? bpm);
    if (name === excerptFirst && excerptAt === undefined) excerptAt = at;
    sections.push({ at, name: section.name });

    const melody = splitBars(section.melody);
    const harmony = splitBars(section.chords);
    if (ending) {
      const extra = section.endings?.[Number(ending) - 1];
      if (!extra) throw new Error(`${id}: section "${name}" has no ending ${ending}`);
      melody.push(...splitBars(extra.melody));
      harmony.push(...splitBars(extra.chords));
    }
    if (melody.length !== harmony.length) {
      throw new Error(`${id}: "${entry}" has ${melody.length} bars of melody but ${harmony.length} of chords`);
    }

    const whole = barBeatsOf(meter);
    const meterNow: Meter = { top: meter[0], bottom: meter[1] };
    melody.forEach((bar, index) => {
      const start = at;
      at = readBar(id, bar, at, notes, setTempo);
      const barBpm = [...tempos].reverse().find((t) => t.at <= start + 1e-6)?.bpm ?? bpm;
      const len = at - start;
      const isFirst = index === 0;
      const isLast = index === melody.length - 1;
      const where = `"${entry}" bar ${index + 1}`;
      if (isFirst && section.pickup) {
        if (Math.abs(len - section.pickup) > 1e-6) throw new Error(`${id}: ${where} is a ${section.pickup}-beat pickup but has ${len}`);
      } else if (isLast ? len > whole + 1e-6 || len <= 0 : Math.abs(len - whole) > 1e-6) {
        throw new Error(`${id}: ${where} has ${len} beats, expected ${whole}`);
      }
      readChords(harmony[index], start, len, chords);

      // A pickup completes the bar the previous section left open.
      const previous = measures[measures.length - 1];
      if (isFirst && section.pickup && previous && previous.len < previous.full - 1e-6) {
        if (Math.abs(previous.len + len - previous.full) > 1e-6 || previous.full !== whole) {
          throw new Error(`${id}: ${where}: a ${len}-beat pickup can't complete a ${previous.len}-beat bar`);
        }
        previous.len = previous.full;
        return;
      }
      const isPickup = measures.length === 0 && isFirst && !!section.pickup;
      measures.push({ at: start, len, full: whole, meter: meterNow, key, bpm: barBpm, number: isPickup ? 0 : ++number });
    });
    if (name === excerptLast && excerptAt !== undefined && excerptEnd === undefined) excerptEnd = at;
  }

  if (excerptAt === undefined || excerptEnd === undefined) throw new Error(`${id}: the excerpt "${full.excerpt}" is not in the form`);
  const first = measures[0];
  const pickup = first.number === 0 ? first.len : 0;
  const mainKey = parseKey(full.key);
  return {
    id: full.id,
    letter: short.letter,
    title: short.title,
    composer: short.composer,
    about: full.about,
    character: short.character,
    // The 1981 speed, carried over to this version's beats.
    ticksPerBeat: (short.ticksPerBeat * short.bpm) / full.bpm,
    color: short.color,
    version: "full",
    meter: { top: full.meter[0], bottom: full.meter[1] },
    barBeats: barBeatsOf(full.meter),
    bpm: full.bpm,
    doName: mainKey.doName,
    tonic: mainKey.tonic,
    mode: mainKey.mode,
    tonicPc: mainKey.tonicPc,
    pickup,
    notes,
    chords,
    length: at,
    bars: measures.filter((m) => m.number > 0).length,
    measures,
    tempos,
    sections,
    source: full.source,
    excerptAt,
    excerptEnd,
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

/** The written bar containing a score beat (the first bar for anything before it). */
export function measureAt(song: Song, beat: number) {
  const list = song.measures;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].at <= beat + 1e-9) lo = mid;
    else hi = mid - 1;
  }
  return list[lo];
}
