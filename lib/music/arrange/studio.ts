import { measureAt, type Measure, type Meter, type Song } from "../score";
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
  /**
   * How many times the tune plays. A full-length piece is never repeated:
   * it is split into this many parts instead, at section boundaries, so a
   * style's "second pass" (a drop, a key change) still arrives halfway.
   */
  passes?: number;
  /** How many groove beats one score beat lasts (2 = the tune at half speed over the groove). */
  timeScale?: number;
  /** Semitones to shift each pass (a pop key change on the second pass, say). */
  passTranspose?: number[];
  enrichChords?: boolean;
  crackle?: boolean;
  gain?: number;
  /** Follow the score's tempo changes (an introduction slower than the waltz, say). */
  followTempo?: boolean;
  /** In four: squeeze a waltz bar into two beats of triplets instead of stretching its first beat. */
  tripletWaltz?: boolean;
};

export type Section = "intro" | "leadin" | "main" | "outro";

export type Bar = { start: number; len: number; index: number; section: Section; pass: number; barInPass: number; feel: Feel };

/** Steps per beat in every pattern string (sixteenth notes). */
const STEPS = 4;

export type FeelPatterns<T> = Partial<Record<Feel, T>>;

type Span = { at: number; dur: number; chord: Chord };

/** How a score bar sits in the groove: a waltz bar can grow to four beats, a 6/8 bar can become two. */
type Stretch = "none" | "waltz" | "compound" | "half";

type MeterPlan = { stretch: Stretch; feel: Feel; songBarLen: number; unit: number };

function planMeter({ top, bottom }: Meter, policy: MeterPolicy, tripletWaltz = false): MeterPlan {
  const is34 = top === 3 && bottom === 4;
  const is68 = top === 6 && bottom === 8;
  const full = (top * 4) / bottom;
  if (policy === "four" && is34 && tripletWaltz) return { stretch: "compound", feel: "four", songBarLen: 2, unit: 4 };
  // Cut time counts in half notes: each half note is one beat of the groove.
  if (top === 2 && bottom === 2) return { stretch: "half", feel: policy === "four" ? "four" : "two", songBarLen: 2, unit: policy === "four" ? 4 : 2 };
  if (policy === "four") {
    // A waltz bar grows to four beats; a 6/8 bar's two dotted beats become two plain beats.
    return { stretch: is34 ? "waltz" : is68 ? "compound" : "none", feel: "four", songBarLen: is34 ? 4 : is68 ? 2 : full, unit: 4 };
  }
  return { stretch: "none", feel: is34 ? "three" : is68 ? "compound" : top === 2 ? "two" : "four", songBarLen: full, unit: full };
}

function mapLocal(stretch: Stretch, local: number) {
  if (stretch === "waltz") return local < 1 ? local * 2 : local + 1;
  if (stretch === "compound") return (local * 2) / 3;
  if (stretch === "half") return local / 2;
  return local;
}

function unmapLocal(stretch: Stretch, local: number) {
  if (stretch === "waltz") return local < 2 ? local / 2 : local - 1;
  if (stretch === "compound") return (local * 3) / 2;
  if (stretch === "half") return local * 2;
  return local;
}

/** A score bar placed in the groove, before time scaling: `base` is where it starts. */
type Placed = { m: Measure; plan: MeterPlan; base: number; span: number };

/** One stretch of groove: a pass of the tune, or a part of a long piece. */
type Part = { start: number; len: number; offset: number; from: number; to: number };

type Tile = { start: number; len: number; feel: Feel };

export class Studio {
  readonly song: Song;
  readonly opt: Required<Omit<StudioOptions, "passTranspose">> & { passTranspose: number[] };
  readonly rng: () => number;
  readonly feel: Feel;
  readonly barBeats: number;
  readonly introBeats: number;
  readonly passStarts: number[];
  readonly length: number;
  readonly bars: Bar[];
  readonly spans: Span[];
  readonly tracks: Track[] = [];
  private readonly placed: Placed[] = [];
  private pickupPlaced: Placed | null = null;
  private readonly parts: Part[];
  /** The tune's groove length, padded to whole bars. */
  private readonly songSpan: number;
  private readonly split: boolean;
  private readonly barStarts: Set<number>;

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
      followTempo: false,
      tripletWaltz: false,
      ...options,
      passTranspose: options.passTranspose ?? [],
    };
    this.rng = seeded(hashString(`${song.id}/${styleId}`));
    const ts = this.opt.timeScale;
    const main = planMeter(song.meter, this.opt.policy, this.opt.tripletWaltz);
    this.feel = main.feel;
    this.barBeats = main.unit;

    // Place every written bar in the groove. A pickup hangs off the front, before beat 0.
    let base = 0;
    song.measures.forEach((m, i) => {
      const plan = planMeter(m.meter, this.opt.policy, this.opt.tripletWaltz);
      if (m.number === 0) {
        this.pickupPlaced = { m, plan, base: -plan.songBarLen, span: plan.songBarLen };
        return;
      }
      // The closing bar keeps its whole length, so the ending chord has room.
      const span = i === song.measures.length - 1 ? plan.songBarLen : mapLocal(plan.stretch, m.len);
      this.placed.push({ m, plan, base, span });
      base += span;
    });

    // Groove bars for the tune: whole bars of each stretch's unit; the very end is padded.
    const tiles: Tile[] = [];
    let runStart = 0;
    for (let i = 1; i <= this.placed.length; i++) {
      const p = this.placed[i];
      const prev = this.placed[i - 1];
      if (p && p.plan.unit === prev.plan.unit && p.plan.feel === prev.plan.feel) continue;
      const end = (p ? p.base : base) * ts;
      const unit = prev.plan.unit;
      const until = p ? end : runStart + Math.ceil((end - runStart) / unit - 1e-6) * unit;
      for (let t = runStart; t < until - 1e-6; t += unit) tiles.push({ start: t, len: Math.min(unit, until - t), feel: prev.plan.feel });
      runStart = until;
    }
    this.songSpan = runStart;

    const first = this.pickupPlaced ?? this.placed[0];
    const last = this.placed[this.placed.length - 1] ?? first;
    const leadIn = song.pickup > 0 && this.opt.introBars === 0 ? 1 : 0;
    this.introBeats = (this.opt.introBars + leadIn) * first.plan.unit;
    this.split = song.version === "full" && this.opt.passes > 1;
    this.parts = this.split
      ? this.splitParts(tiles)
      : Array.from({ length: this.opt.passes }, (_, p) => {
          const offset = this.introBeats + p * this.songSpan;
          return { start: offset, len: this.songSpan, offset, from: -Infinity, to: Infinity };
        });
    this.passStarts = this.parts.map((part) => part.start);
    const tuneEnd = this.introBeats + (this.split ? 1 : this.opt.passes) * this.songSpan;
    this.length = tuneEnd + this.opt.outroBars * last.plan.unit;

    this.bars = [];
    const perPart = new Map<number, number>();
    const push = (start: number, len: number, section: Section, feel: Feel) => {
      let pass = 0;
      let barInPass = -1;
      if (section === "main") {
        pass = this.partIndexAt(start);
        barInPass = perPart.get(pass) ?? 0;
        perPart.set(pass, barInPass + 1);
      }
      this.bars.push({ start, len: Math.min(len, this.length - start), index: this.bars.length, section, pass, barInPass, feel });
    };
    for (let i = 0; i < this.opt.introBars + leadIn; i++) push(i * first.plan.unit, first.plan.unit, i < this.opt.introBars ? "intro" : "leadin", first.plan.feel);
    for (let c = 0; c < (this.split ? 1 : this.opt.passes); c++) {
      for (const tile of tiles) push(this.introBeats + c * this.songSpan + tile.start, tile.len, "main", tile.feel);
    }
    for (let i = 0; i < this.opt.outroBars; i++) push(tuneEnd + i * last.plan.unit, last.plan.unit, "outro", last.plan.feel);
    this.barStarts = new Set(this.bars.map((b) => b.start));

    this.spans = this.buildSpans();
  }

  /** Splits a long piece into parts at the section starts nearest to equal shares. */
  private splitParts(tiles: Tile[]): Part[] {
    const count = this.opt.passes;
    const boundaries = this.song.sections
      .map((s) => tiles.find((t) => t.start >= this.relative(s.at) - 1e-6)?.start)
      .filter((g): g is number => g !== undefined && g > 0 && g < this.songSpan);
    const cuts: number[] = [0];
    for (let p = 1; p < count; p++) {
      const target = (this.songSpan * p) / count;
      const best = boundaries.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), boundaries[0] ?? target);
      cuts.push(Math.max(best, cuts[cuts.length - 1]));
    }
    cuts.push(this.songSpan);
    return Array.from({ length: count }, (_, p) => ({
      start: this.introBeats + cuts[p],
      len: cuts[p + 1] - cuts[p],
      offset: this.introBeats,
      from: p === 0 ? -Infinity : this.unrelative(cuts[p]),
      to: p === count - 1 ? Infinity : this.unrelative(cuts[p + 1]),
    }));
  }

  private partIndexAt(beat: number) {
    for (let p = this.parts.length - 1; p >= 0; p--) if (beat >= this.parts[p].start - 1e-6) return p;
    return 0;
  }

  // ---------- Time mapping ----------

  private placedAt(songBeat: number): Placed {
    const list = this.placed;
    const pickup = this.pickupPlaced;
    if (pickup && (songBeat < pickup.m.at + pickup.m.len - 1e-9 || !list.length)) return pickup;
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (list[mid].m.at <= songBeat + 1e-9) lo = mid;
      else hi = mid - 1;
    }
    return list[lo];
  }

  /** Score beat → beat relative to the start of the first whole bar, in the groove. */
  relative(songBeat: number) {
    const p = this.placedAt(songBeat);
    const local = p === this.pickupPlaced ? p.m.full - p.m.len + (songBeat - p.m.at) : songBeat - p.m.at;
    return (p.base + mapLocal(p.plan.stretch, local)) * this.opt.timeScale;
  }

  private unrelative(scaled: number) {
    const r = scaled / this.opt.timeScale;
    const list = this.placed;
    const pickup = this.pickupPlaced;
    if (pickup && (r < 0 || !list.length)) {
      return pickup.m.at + unmapLocal(pickup.plan.stretch, r + pickup.plan.songBarLen) - (pickup.m.full - pickup.m.len);
    }
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (list[mid].base <= r + 1e-9) lo = mid;
      else hi = mid - 1;
    }
    const p = list[lo];
    return p.m.at + unmapLocal(p.plan.stretch, r - p.base);
  }

  /** Where the written music ends in the groove (its closing bar at full length). */
  private placedEnd() {
    const last = this.placed[this.placed.length - 1];
    return last ? (last.base + last.span) * this.opt.timeScale : 0;
  }

  toSongBeat = (beat: number) => {
    const pickupSpan = -this.relative(0);
    for (let p = this.parts.length - 1; p >= 0; p--) {
      const part = this.parts[p];
      const r = beat - part.offset;
      const lo = p === 0 || !this.split ? -pickupSpan : part.start - part.offset;
      const hi = this.split && p < this.parts.length - 1 ? part.start + part.len - part.offset : this.placedEnd();
      if (r >= lo - 1e-6 && r < hi) {
        const s = this.unrelative(r);
        return s >= 0 && s <= this.song.length ? s : null;
      }
    }
    return null;
  };

  fromSongBeat = (songBeat: number) => this.passStarts[0] + this.relative(songBeat);

  /** The groove's tempo over time: the style's own, or the score's changes when the style follows them. */
  private tempoMap(bpm: number) {
    const song = this.song;
    // Styles that keep the score's meter give its tempo in quarter notes; cut time then counts halves.
    const halved = (meter: Meter) => this.opt.policy === "keep" && planMeter(meter, this.opt.policy).stretch === "half";
    const steady = song.tempos.length < 2 && song.measures.every((m) => halved(m.meter) === halved(song.meter));
    if (!this.opt.followTempo || steady) return [{ at: 0, bpm }];
    const factor = bpm / (song.bpm * (halved(song.meter) ? 0.5 : 1));
    const grooveBpm = (songBeat: number) => {
      const p = this.placedAt(songBeat);
      const tempo = [...song.tempos].reverse().find((t) => t.at <= songBeat + 1e-6)?.bpm ?? song.bpm;
      return tempo * factor * (halved(p.m.meter) ? 0.5 : 1);
    };
    const points = [...new Set([...song.tempos.map((t) => t.at), ...song.measures.map((m) => m.at)])].sort((a, b) => a - b);
    const events = [{ at: 0, bpm: grooveBpm(0) }];
    for (const part of this.parts) {
      for (const at of points) {
        if (at < part.from - 1e-6 || at >= part.to - 1e-6) continue;
        events.push({ at: Math.max(0, part.offset + this.relative(at)), bpm: grooveBpm(at) });
      }
    }
    events.sort((a, b) => a.at - b.at);
    const out: { at: number; bpm: number }[] = [];
    for (const e of events) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(prev.at - e.at) < 1e-6) prev.bpm = e.bpm;
      else if (!prev || Math.abs(prev.bpm - e.bpm) > 1e-6) out.push({ ...e });
    }
    return out;
  }

  // ---------- Chords ----------

  private buildSpans(): Span[] {
    const song = this.song;
    const spans: Span[] = [];
    // Jazz colour depends on the key at that moment: the tonic gets a major seventh.
    const take = (chord: Chord, at: number) => (this.opt.enrichChords ? enrich(chord, measureAt(song, at).key.tonicPc) : chord);
    const first = song.chords.find((c) => c.at >= song.pickup - 1e-6) ?? song.chords[0];
    const last = song.chords[song.chords.length - 1];

    spans.push({ at: 0, dur: this.introBeats, chord: take(first.chord, first.at) });
    this.parts.forEach((part, p) => {
      const shift = this.opt.passTranspose[p] ?? 0;
      for (const c of song.chords) {
        const from = Math.max(c.at, part.from);
        const to = Math.min(c.at + c.dur, part.to);
        if (to <= from + 1e-9) continue;
        const at = part.offset + this.relative(from);
        const end = part.offset + this.relative(to);
        if (end <= 0) continue;
        spans.push({ at: Math.max(0, at), dur: end - Math.max(0, at), chord: transposeChord(take(c.chord, c.at), shift) });
      }
    });
    const outroStart = this.introBeats + (this.split ? 1 : this.opt.passes) * this.songSpan;
    const lastShift = this.opt.passTranspose[this.parts.length - 1] ?? 0;
    spans.push({ at: outroStart, dur: this.length - outroStart, chord: transposeChord(take(last.chord, last.at), lastShift) });
    spans.sort((a, b) => a.at - b.at);
    return spans;
  }

  chordAt(beat: number): Chord {
    const spans = this.spans;
    let lo = 0;
    let hi = spans.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (spans[mid].at <= beat + 1e-6) lo = mid;
      else hi = mid - 1;
    }
    return spans[lo].chord;
  }

  /** The groove bar a beat falls in. */
  barAt(beat: number): Bar {
    const bars = this.bars;
    let lo = 0;
    let hi = bars.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (bars[mid].start <= beat + 1e-9) lo = mid;
      else hi = mid - 1;
    }
    return bars[lo];
  }

  /** The chord of the next bar, for walking and approach notes. */
  nextChord(beat: number) {
    const bar = this.barAt(beat);
    return this.chordAt(bar.start + bar.len);
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

  patternFor<T>(patterns: FeelPatterns<T>, feel: Feel = this.feel): T | undefined {
    return patterns[feel] ?? (feel === "two" ? patterns.four : undefined) ?? (feel === "compound" ? patterns.three : undefined) ?? patterns.four;
  }

  /** A bar's pattern as single-character cells (empty when the bar's feel has none). */
  private cellsFor(patterns: FeelPatterns<string>, bar: Bar) {
    return [...(this.patternFor(patterns, bar.feel) ?? "").replace(/\s/g, "")];
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
    if (!this.patternFor(patterns)) return;
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const main = this.patternFor(patterns, bar.feel);
      if (!main) continue;
      const fillPattern = fill ? this.patternFor(fill, bar.feel) : undefined;
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
    if (!this.patternFor(patterns)) return;
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const cells = this.cellsFor(patterns, bar);
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
    if (!this.patternFor(patterns)) return;
    let previous: number[] | undefined;
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const cells = this.cellsFor(patterns, bar);
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
    if (!this.patternFor(patterns)) return;
    for (const bar of this.barsIn(sections)) {
      if (when && !when(bar)) continue;
      const cells = this.cellsFor(patterns, bar);
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
    const part = this.parts[pass];
    const shift = this.opt.passTranspose[pass] ?? 0;
    const out: ArrNote[] = [];
    let tied: ArrNote | null = null;
    for (const note of this.song.notes) {
      if (note.pitch === null || note.at < part.from - 1e-6 || note.at >= part.to - 1e-6) {
        tied = null;
        continue;
      }
      const at = part.offset + this.relative(note.at);
      const end = part.offset + this.relative(note.at + note.dur);
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
        const onBeat = Math.abs(note.at - Math.round(note.at)) < 1e-6 && this.barStarts.has(Math.round(note.at));
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
    // Cut time counts half notes, so the groove's beat is twice as long as the score's.
    const bpm = this.opt.bpm * (this.opt.policy === "keep" && planMeter(this.song.meter, this.opt.policy).stretch === "half" ? 0.5 : 1);
    return {
      songId: this.song.id,
      version: this.song.version,
      styleId: this.styleId,
      label: this.label,
      bpm,
      meter,
      barBeats: this.barBeats,
      feel: this.feel,
      length: this.length,
      swing,
      tracks: this.tracks.filter((t) => t.notes.length > 0),
      passes: this.parts.map((part) => ({ at: part.start, length: part.len })),
      grid: this.bars.map((bar) => ({ at: bar.start, len: bar.len })),
      tempos: this.tempoMap(bpm),
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
