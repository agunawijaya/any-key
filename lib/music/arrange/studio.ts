import type { Song } from "../score";
import { enrich, hashString, nearestWithPc, pitchClass, seeded, voice, type Chord } from "../theory";
import { ROLE_COLOR } from "./patches";
import type { ArrNote, Arrangement, Feel, Patch, Role, Track } from "./types";

/*
 * The Studio turns a score into a band arrangement. A style asks it for
 * tracks and fills them with patterns; the Studio handles the hard parts:
 * mapping the tune's meter onto the groove, chords over time, intros,
 * repeats and the final chord.
 */

export type MeterPolicy = "keep" | "four";

export type StudioOptions = {
  bpm: number;
  policy: MeterPolicy;
  swing?: number;
  introBars?: number;
  outroBars?: number;
  passes?: number;
  /** How many groove beats one score beat lasts (2 = the tune at half speed over the groove). */
  timeScale?: number;
  /** Semitones to shift each pass (a pop key change on the second pass, say). */
  passTranspose?: number[];
  enrichChords?: boolean;
  crackle?: boolean;
  gain?: number;
};

export type Section = "intro" | "leadin" | "main" | "outro";

export type Bar = { start: number; len: number; index: number; section: Section; pass: number; barInPass: number };

/** Steps per beat in every pattern string (sixteenth notes). */
const STEPS = 4;

export type FeelPatterns<T> = Partial<Record<Feel, T>>;

type Span = { at: number; dur: number; chord: Chord };

export class Studio {
  readonly song: Song;
  readonly opt: Required<Omit<StudioOptions, "passTranspose">> & { passTranspose: number[] };
  readonly rng: () => number;
  readonly feel: Feel;
  readonly barBeats: number;
  /** Length of one song bar once mapped into the groove. */
  readonly songBarLen: number;
  readonly introBeats: number;
  readonly passLen: number;
  readonly passStarts: number[];
  readonly length: number;
  readonly bars: Bar[];
  readonly spans: Span[];
  readonly tracks: Track[] = [];
  private stretch: "none" | "waltz" | "compound";

  constructor(
    song: Song,
    readonly styleId: string,
    readonly label: string,
    options: StudioOptions,
  ) {
    this.song = song;
    this.opt = {
      swing: 0.5,
      introBars: 1,
      outroBars: 1,
      passes: 1,
      enrichChords: false,
      crackle: false,
      timeScale: 1,
      gain: 1,
      ...options,
      passTranspose: options.passTranspose ?? [],
    };
    this.rng = seeded(hashString(`${song.id}/${styleId}`));

    const { top, bottom } = song.meter;
    const is34 = top === 3 && bottom === 4;
    const is68 = top === 6 && bottom === 8;
    if (this.opt.policy === "four") {
      this.feel = "four";
      this.barBeats = 4;
      this.stretch = is34 ? "waltz" : is68 ? "compound" : "none";
      // A waltz bar grows to four beats; a 6/8 bar's two dotted beats become two plain beats.
      this.songBarLen = is34 ? 4 : is68 ? 2 : song.barBeats;
    } else {
      this.feel = is34 ? "three" : is68 ? "compound" : top === 2 ? "two" : "four";
      this.barBeats = song.barBeats;
      this.stretch = "none";
      this.songBarLen = song.barBeats;
    }

    const leadIn = song.pickup > 0 && this.opt.introBars === 0 ? 1 : 0;
    this.introBeats = (this.opt.introBars + leadIn) * this.barBeats;
    this.passLen = Math.ceil((song.bars * this.songBarLen * this.opt.timeScale) / this.barBeats - 1e-6) * this.barBeats;
    this.passStarts = Array.from({ length: this.opt.passes }, (_, p) => this.introBeats + p * this.passLen);
    this.length = this.introBeats + this.opt.passes * this.passLen + this.opt.outroBars * this.barBeats;

    this.bars = [];
    for (let start = 0, index = 0; start < this.length - 1e-6; start += this.barBeats, index++) {
      let section: Section = "main";
      let pass = 0;
      if (start < this.introBeats) section = index < this.opt.introBars ? "intro" : "leadin";
      else if (start >= this.introBeats + this.opt.passes * this.passLen) section = "outro";
      else pass = Math.floor((start - this.introBeats) / this.passLen);
      const barInPass = section === "main" ? Math.round((start - this.passStarts[pass]) / this.barBeats) : -1;
      this.bars.push({ start, len: Math.min(this.barBeats, this.length - start), index, section, pass, barInPass });
    }

    this.spans = this.buildSpans();
  }

  // ---------- Time mapping ----------

  private mapLocal(local: number) {
    if (this.stretch === "waltz") return local < 1 ? local * 2 : local + 1;
    if (this.stretch === "compound") return (local * 2) / 3;
    return local;
  }

  private unmapLocal(local: number) {
    if (this.stretch === "waltz") return local < 2 ? local / 2 : local - 1;
    if (this.stretch === "compound") return (local * 3) / 2;
    return local;
  }

  /** Score beat → beat relative to the start of song bar 1 in the groove. */
  relative(songBeat: number) {
    const B = this.song.barBeats;
    const v = songBeat - this.song.pickup;
    const k = Math.floor(v / B + 1e-9);
    return (k * this.songBarLen + this.mapLocal(v - k * B)) * this.opt.timeScale;
  }

  private unrelative(scaled: number) {
    const r = scaled / this.opt.timeScale;
    const k = Math.floor(r / this.songBarLen + 1e-9);
    return this.song.pickup + k * this.song.barBeats + this.unmapLocal(r - k * this.songBarLen);
  }

  toSongBeat = (beat: number) => {
    const pickupSpan = -this.relative(0);
    for (let p = this.opt.passes - 1; p >= 0; p--) {
      const r = beat - this.passStarts[p];
      if (r >= -pickupSpan - 1e-6 && r < this.song.bars * this.songBarLen * this.opt.timeScale) {
        const s = this.unrelative(r);
        return s >= 0 && s <= this.song.length ? s : null;
      }
    }
    return null;
  };

  fromSongBeat = (songBeat: number) => this.passStarts[0] + this.relative(songBeat);

  // ---------- Chords ----------

  private buildSpans(): Span[] {
    const tonic = this.song.tonicPc;
    const spans: Span[] = [];
    const take = (chord: Chord) => (this.opt.enrichChords ? enrich(chord, tonic) : chord);
    const first = this.song.chords.find((c) => c.at >= this.song.pickup - 1e-6) ?? this.song.chords[0];
    const last = this.song.chords[this.song.chords.length - 1];

    spans.push({ at: 0, dur: this.introBeats, chord: take(first.chord) });
    this.passStarts.forEach((passStart, p) => {
      const shift = this.opt.passTranspose[p] ?? 0;
      for (const c of this.song.chords) {
        const at = passStart + this.relative(c.at);
        const end = passStart + this.relative(c.at + c.dur);
        if (end <= 0) continue;
        spans.push({ at: Math.max(0, at), dur: end - Math.max(0, at), chord: transposeChord(take(c.chord), shift) });
      }
    });
    const outroStart = this.introBeats + this.opt.passes * this.passLen;
    const lastShift = this.opt.passTranspose[this.opt.passes - 1] ?? 0;
    spans.push({ at: outroStart, dur: this.length - outroStart, chord: transposeChord(take(last.chord), lastShift) });
    spans.sort((a, b) => a.at - b.at);
    return spans;
  }

  chordAt(beat: number): Chord {
    let found = this.spans[0];
    for (const span of this.spans) {
      if (span.at <= beat + 1e-6) found = span;
      else break;
    }
    return found.chord;
  }

  /** The chord of the next bar, for walking and approach notes. */
  nextChord(beat: number) {
    return this.chordAt(Math.floor(beat / this.barBeats + 1) * this.barBeats);
  }

  // ---------- Tracks ----------

  track(id: string, role: Role, patch: Patch, settings: Partial<Omit<Track, "id" | "role" | "patch" | "notes" | "automation">> = {}) {
    const track: Track = {
      id,
      name: patch.name,
      role,
      patch,
      color: ROLE_COLOR[role],
      notes: [],
      automation: [],
      volume: 100,
      pan: 64,
      reverb: 40,
      chorus: 0,
      ...settings,
    };
    this.tracks.push(track);
    return track;
  }

  add(track: Track, at: number, dur: number, pitch: number, vel: number) {
    if (dur <= 0.001 || at >= this.length) return;
    const clampedVel = Math.max(1, Math.min(127, Math.round(vel)));
    track.notes.push({ at: Math.max(0, at), dur: Math.min(dur, this.length - at), pitch, vel: clampedVel });
  }

  barsIn(sections: Section[]) {
    return this.bars.filter((bar) => sections.includes(bar.section));
  }

  patternFor<T>(patterns: FeelPatterns<T>): T | undefined {
    return patterns[this.feel] ?? (this.feel === "two" ? patterns.four : undefined) ?? (this.feel === "compound" ? patterns.three : undefined) ?? patterns.four;
  }

  // ---------- Drums ----------

  drums(
    track: Track,
    patterns: FeelPatterns<Record<number, string>>,
    {
      sections = ["intro", "main"] as Section[],
      fill,
      fillEvery = 4,
      crash = true,
      vel = 1,
      when,
    }: {
      sections?: Section[];
      fill?: FeelPatterns<Record<number, string>>;
      fillEvery?: number;
      crash?: boolean;
      vel?: number;
      when?: (bar: Bar) => boolean;
    } = {},
  ) {
    const main = this.patternFor(patterns);
    const fillPattern = fill ? this.patternFor(fill) : undefined;
    if (!main) return;
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const position = bar.section === "main" ? bar.barInPass : bar.index;
      const isFill = fillPattern && (position + 1) % fillEvery === 0;
      const pattern = isFill ? fillPattern : main;
      for (const [note, steps] of Object.entries(pattern)) {
        this.playSteps(track, bar, steps, (step, strength) => {
          const at = bar.start + step / STEPS;
          this.add(track, at, 0.25, Number(note), strength * vel + (this.rng() - 0.5) * 8);
        });
      }
      const sectionStart = bar.section === "main" && bar.barInPass === 0;
      if (crash && (sectionStart || (bar.section === "intro" && bar.index === 0 && this.opt.introBars > 1))) {
        this.add(track, bar.start, 1, 49, 100 * vel);
      }
    }
    if (crash) {
      const outro = this.bars.find((b) => b.section === "outro");
      if (outro) {
        this.add(track, outro.start, 2, 49, 110 * vel);
        this.add(track, outro.start, 0.5, 36, 110 * vel);
      }
    }
  }

  /** Calls back for each hit in a step string: X accent, x normal, o ghost. */
  private playSteps(_track: Track, bar: Bar, steps: string, hit: (step: number, strength: number) => void) {
    const limit = Math.round(bar.len * STEPS);
    [...steps.replace(/\s/g, "")].forEach((ch, step) => {
      if (step >= limit) return;
      const strength = ch === "X" ? 118 : ch === "x" ? 96 : ch === "o" ? 58 : 0;
      if (strength) hit(step, strength);
    });
  }

  /** A fast snare roll that gets louder: the classic build-up before a drop. */
  roll(track: Track, from: number, to: number, note = 38) {
    const steps = Math.round((to - from) * STEPS);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const density = progress < 0.5 ? 1 : progress < 0.75 ? 2 : 4;
      for (let d = 0; d < density; d++) {
        this.add(track, from + (i + d / density) / STEPS, 0.1, note, 50 + progress * 70);
      }
    }
  }

  // ---------- Bass ----------

  bass(
    track: Track,
    patterns: FeelPatterns<string>,
    { center = 40, sections = ["intro", "main"] as Section[], vel = 100, when }: { center?: number; sections?: Section[]; vel?: number; when?: (bar: Bar) => boolean } = {},
  ) {
    const pattern = this.patternFor(patterns);
    if (!pattern) return;
    const cells = [...pattern.replace(/\s/g, "")];
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const limit = Math.round(bar.len * STEPS);
      for (let step = 0; step < Math.min(cells.length, limit); step++) {
        const ch = cells[step];
        if (ch === "." || ch === "-") continue;
        let length = 1;
        while (step + length < limit && cells[step + length] === "-") length++;
        const at = bar.start + step / STEPS;
        const chord = this.chordAt(at);
        const pitch = this.bassPitch(ch, chord, at, center);
        if (pitch !== null) this.add(track, at, (length / STEPS) * 0.92, pitch, (ch === ch.toLowerCase() && /[a-z]/.test(ch) ? vel * 0.7 : vel) + (this.rng() - 0.5) * 10);
      }
    }
    this.finalBass(track, center, vel);
  }

  private bassPitch(ch: string, chord: Chord, at: number, center: number): number | null {
    const root = nearestWithPc(chord.root, center);
    const third = chord.tones[1];
    const fifth = chord.tones[2] ?? pitchClass(chord.root + 7);
    switch (ch.toUpperCase()) {
      case "R":
        return root;
      case "5":
        return fitAbove(root, fifth, center);
      case "3":
        return fitAbove(root, third, center);
      case "7":
        return chord.tones[3] !== undefined ? fitAbove(root, chord.tones[3], center) : root + 12;
      case "8":
        return root + 12;
      case "L":
        return root - 12 >= 28 ? root - 12 : root;
      case "A": {
        const next = nearestWithPc(this.nextChord(at).root, center);
        return next - 1;
      }
      default:
        return null;
    }
  }

  walkingBass(track: Track, { center = 40, sections = ["intro", "main"] as Section[], vel = 96 } = {}) {
    for (const bar of this.barsIn(sections)) {
      const beats = Math.round(bar.len);
      for (let beat = 0; beat < beats; beat++) {
        const at = bar.start + beat;
        const chord = this.chordAt(at);
        const root = nearestWithPc(chord.root, center);
        let pitch: number;
        if (beat === 0) pitch = root;
        else if (beat === beats - 1) {
          const target = nearestWithPc(this.chordAt(at + 1).root, center);
          pitch = this.rng() < 0.6 ? target + (this.rng() < 0.5 ? -1 : 1) : fitAbove(root, chord.tones[2] ?? chord.root, center);
        } else {
          const tone = chord.tones[1 + ((beat + (this.rng() < 0.5 ? 0 : 1)) % Math.max(1, chord.tones.length - 1))];
          pitch = fitAbove(root, tone, center);
        }
        this.add(track, at, 0.9, pitch, vel + (beat === 0 ? 8 : 0) + (this.rng() - 0.5) * 10);
      }
    }
    this.finalBass(track, center, vel);
  }

  private finalBass(track: Track, center: number, vel: number) {
    const outro = this.bars.find((b) => b.section === "outro");
    if (!outro) return;
    this.add(track, outro.start, Math.min(outro.len * this.opt.outroBars, 4), nearestWithPc(this.chordAt(outro.start).root, center), vel);
  }

  // ---------- Chords, pads, arpeggios ----------

  comp(
    track: Track,
    patterns: FeelPatterns<string>,
    { center = 64, size = 3, sections = ["intro", "main"] as Section[], vel = 84, when }: { center?: number; size?: number; sections?: Section[]; vel?: number; when?: (bar: Bar) => boolean } = {},
  ) {
    const pattern = this.patternFor(patterns);
    if (!pattern) return;
    const cells = [...pattern.replace(/\s/g, "")];
    let previous: number[] | undefined;
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const limit = Math.round(bar.len * STEPS);
      for (let step = 0; step < Math.min(cells.length, limit); step++) {
        const ch = cells[step];
        if (ch !== "x" && ch !== "X" && ch !== "o") continue;
        let length = 1;
        while (step + length < limit && cells[step + length] === "-") length++;
        const at = bar.start + step / STEPS;
        const notes = voice(this.chordAt(at), center, previous, size);
        previous = notes;
        const strength = ch === "X" ? vel * 1.2 : ch === "o" ? vel * 0.65 : vel;
        notes.forEach((pitch, i) => this.add(track, at + i * 0.004, (length / STEPS) * 0.9, pitch, strength + (this.rng() - 0.5) * 8));
      }
    }
    this.finalChord(track, center, size, vel);
  }

  pad(track: Track, { center = 64, size = 4, sections = ["intro", "main"] as Section[], vel = 70, when }: { center?: number; size?: number; sections?: Section[]; vel?: number; when?: (bar: Bar) => boolean } = {}) {
    let previous: number[] | undefined;
    const bars = this.barsIn(sections).filter((bar) => !when || when(bar));
    const covered = (beat: number) => bars.some((bar) => beat >= bar.start - 1e-6 && beat < bar.start + bar.len - 1e-6);
    for (const span of this.spans) {
      if (!covered(span.at)) continue;
      const notes = voice(span.chord, center, previous, size);
      previous = notes;
      notes.forEach((pitch) => this.add(track, span.at, span.dur * 0.98, pitch, vel));
    }
  }

  arp(
    track: Track,
    patterns: FeelPatterns<string>,
    { center = 64, sections = ["intro", "main"] as Section[], vel = 80, when }: { center?: number; sections?: Section[]; vel?: number; when?: (bar: Bar) => boolean } = {},
  ) {
    const pattern = this.patternFor(patterns);
    if (!pattern) return;
    const cells = [...pattern.replace(/\s/g, "")];
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const limit = Math.round(bar.len * STEPS);
      for (let step = 0; step < Math.min(cells.length, limit); step++) {
        const ch = cells[step];
        if (!/[0-9]/.test(ch)) continue;
        let length = 1;
        while (step + length < limit && cells[step + length] === "-") length++;
        const at = bar.start + step / STEPS;
        const ladder = chordLadder(this.chordAt(at), center - 7);
        this.add(track, at, (length / STEPS) * 0.9, ladder[Number(ch) % ladder.length], vel + (this.rng() - 0.5) * 10);
      }
    }
  }

  private finalChord(track: Track, center: number, size: number, vel: number) {
    const outro = this.bars.find((b) => b.section === "outro");
    if (!outro) return;
    const notes = voice(this.chordAt(outro.start), center, undefined, size);
    notes.forEach((pitch) => this.add(track, outro.start, Math.min(outro.len * this.opt.outroBars, 4) * 0.95, pitch, vel));
  }

  // ---------- Melody ----------

  /** The tune in groove time, one entry per pass, ties merged. */
  melodyNotes(pass = 0): ArrNote[] {
    const shift = this.opt.passTranspose[pass] ?? 0;
    const out: ArrNote[] = [];
    let tied: ArrNote | null = null;
    for (const note of this.song.notes) {
      if (note.pitch === null) {
        tied = null;
        continue;
      }
      const at = this.passStarts[pass] + this.relative(note.at);
      const end = this.passStarts[pass] + this.relative(note.at + note.dur);
      const pitch = note.pitch + shift;
      if (tied && tied.pitch === pitch && Math.abs(tied.at + tied.dur - at) < 1e-6) {
        tied.dur = end - tied.at;
      } else {
        tied = { at, dur: end - at, pitch, vel: 100 };
        out.push(tied);
      }
      if (!note.tie) tied = null;
    }
    return out;
  }

  lead(
    track: Track,
    {
      octave = 0,
      vel = 100,
      articulation = 0.92,
      passes,
      ornament,
      tremolo,
      accentDownbeats = true,
    }: {
      octave?: number;
      vel?: number;
      articulation?: number;
      passes?: number[];
      ornament?: "suling" | "bend" | "grace";
      tremolo?: number;
      accentDownbeats?: boolean;
    } = {},
  ) {
    const which = passes ?? this.passStarts.map((_, i) => i);
    for (const pass of which) {
      const notes = this.melodyNotes(pass);
      notes.forEach((note, i) => {
        const next = notes[i + 1];
        const room = next ? Math.max(0.05, next.at - note.at) : note.dur;
        const dur = Math.min(note.dur * articulation, room);
        const pitch = note.pitch + octave * 12;
        const onBeat = Math.abs(note.at - Math.round(note.at)) < 1e-6 && Math.round(note.at) % this.barBeats === 0;
        const v = vel + (accentDownbeats && onBeat ? 8 : 0) + (this.rng() - 0.5) * 10;

        if (tremolo && note.dur >= 0.5) {
          const rate = tremolo;
          for (let t = 0; t < note.dur - 1e-6; t += rate) {
            this.add(track, note.at + t, rate * 0.85, pitch, v * (t === 0 ? 1 : 0.78));
          }
          return;
        }
        if (ornament === "suling" && note.dur >= 0.75) {
          const grace = 0.09;
          this.add(track, note.at, grace, pitch + 2, v * 0.8);
          this.add(track, note.at + grace, dur - grace, pitch, v);
          this.vibrato(track, note.at + note.dur * 0.35, note.at + dur);
          return;
        }
        if (ornament === "grace" && note.dur >= 1 && this.rng() < 0.5) {
          this.add(track, note.at - 0.06, 0.06, pitch - 1, v * 0.7);
        }
        if (ornament === "bend" && note.dur >= 1) {
          track.automation.push({ at: note.at, kind: "bend", value: -1200 });
          track.automation.push({ at: note.at + 0.12, kind: "bend", value: 0 });
        }
        this.add(track, note.at, dur, pitch, v);
      });
    }
  }

  /** Mod-wheel vibrato that blooms into a long note. */
  vibrato(track: Track, from: number, to: number) {
    track.automation.push({ at: from, kind: "cc", cc: 1, value: 20 });
    track.automation.push({ at: (from + to) / 2, kind: "cc", cc: 1, value: 70 });
    track.automation.push({ at: to, kind: "cc", cc: 1, value: 0 });
  }

  /** A second voice under the tune, a third or sixth below, using chord tones. */
  harmony(track: Track, { vel = 72, minGap = 3, maxGap = 9, sustain = false, passes }: { vel?: number; minGap?: number; maxGap?: number; sustain?: boolean; passes?: number[] } = {}) {
    const which = passes ?? this.passStarts.map((_, i) => i);
    for (const pass of which) {
      for (const note of this.melodyNotes(pass)) {
        if (note.dur < 0.45 && !sustain) continue;
        const chord = this.chordAt(note.at);
        const below = chord.tones
          .map((pc) => nearestWithPc(pc, note.pitch - 6))
          .filter((n) => note.pitch - n >= minGap && note.pitch - n <= maxGap)
          .sort((a, b) => b - a)[0];
        if (below !== undefined) this.add(track, note.at, note.dur * 0.95, below, vel + (this.rng() - 0.5) * 8);
      }
    }
  }

  // ---------- Effects ----------

  /** Ducks a track on every beat, like a compressor keyed from the kick. */
  sidechain(track: Track, { depth = 70, sections = ["intro", "main"] as Section[] } = {}) {
    for (const bar of this.barsIn(sections)) {
      for (let beat = 0; beat < bar.len; beat++) {
        const at = bar.start + beat;
        track.automation.push({ at, kind: "cc", cc: 11, value: 127 - depth });
        track.automation.push({ at: at + 0.18, kind: "cc", cc: 11, value: 127 - depth / 2 });
        track.automation.push({ at: at + 0.4, kind: "cc", cc: 11, value: 127 });
      }
    }
  }

  // ---------- Output ----------

  finish(): Arrangement {
    const swing = this.opt.swing;
    const swingTime = (t: number) => {
      if (swing === 0.5) return t;
      const beat = Math.floor(t + 1e-9);
      const frac = t - beat;
      return beat + (frac <= 0.5 ? (frac / 0.5) * swing : swing + ((frac - 0.5) / 0.5) * (1 - swing));
    };
    for (const track of this.tracks) {
      if (swing !== 0.5) {
        track.notes = track.notes.map((n) => {
          const at = swingTime(n.at);
          return { ...n, at, dur: Math.max(0.03, swingTime(n.at + n.dur) - at) };
        });
        track.automation = track.automation.map((a) => ({ ...a, at: swingTime(a.at) }));
      }
      track.notes.sort((a, b) => a.at - b.at || a.pitch - b.pitch);
      track.automation.sort((a, b) => a.at - b.at);
      removeOverlaps(track.notes);
    }
    const meter =
      this.feel === "four"
        ? { top: 4, bottom: 4 as const }
        : this.feel === "two"
          ? { top: 2, bottom: 4 as const }
          : this.feel === "three"
            ? { top: 3, bottom: 4 as const }
            : { top: 6, bottom: 8 as const };
    return {
      songId: this.song.id,
      styleId: this.styleId,
      label: this.label,
      bpm: this.opt.bpm,
      meter,
      barBeats: this.barBeats,
      feel: this.feel,
      length: this.length,
      swing,
      tracks: this.tracks.filter((t) => t.notes.length > 0),
      passes: this.passStarts.map((at) => ({ at, length: this.passLen })),
      toSongBeat: this.toSongBeat,
      fromSongBeat: this.fromSongBeat,
      crackle: this.opt.crackle,
      gain: this.opt.gain,
    };
  }
}

function fitAbove(root: number, pc: number, center: number) {
  let n = root + ((pc - pitchClass(root) + 12) % 12);
  if (n > center + 9) n -= 12;
  return n;
}

function transposeChord(chord: Chord, shift: number): Chord {
  if (!shift) return chord;
  return { ...chord, root: pitchClass(chord.root + shift), tones: chord.tones.map((t) => pitchClass(t + shift)) };
}

/** Chord tones stacked upward for two octaves from `from`. */
function chordLadder(chord: Chord, from: number) {
  const ladder: number[] = [];
  let n = nearestWithPc(chord.root, from);
  if (n < from) n += 12;
  const tones = chord.tones.slice(0, 3);
  for (let octave = 0; octave < 3; octave++) {
    for (const pc of tones) {
      const pitch = n - pitchClass(n) + pc + octave * 12 + (pc < pitchClass(n) ? 12 : 0);
      ladder.push(pitch);
    }
  }
  return ladder.sort((a, b) => a - b);
}

/** A MIDI channel can't sound the same key twice at once: trim the earlier note. */
function removeOverlaps(notes: ArrNote[]) {
  const lastByPitch = new Map<number, ArrNote>();
  for (const note of notes) {
    const previous = lastByPitch.get(note.pitch);
    if (previous && previous.at + previous.dur > note.at - 0.01) {
      previous.dur = Math.max(0.02, note.at - previous.at - 0.01);
    }
    lastByPitch.set(note.pitch, note);
  }
}
