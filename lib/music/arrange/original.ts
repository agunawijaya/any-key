import type { Song } from "../score";
import type { ComposerScore, PartSpec, ScoreData } from "../original/types";
import { Studio } from "./studio";
import type { Arrangement } from "./types";

/*
 * The "Original Score" style: the parts of a printed score, played bar for
 * bar in the order the full version's form gives (repeats, endings and all),
 * with the score's dynamics, pizzicato and arco. Nothing here is generated:
 * the Studio only supplies the bar grid and the tempo map.
 */

type PNote = { on: number; dur: number; pitches: number[]; tie: boolean };
type PMark = { on: number; word: string };
type Parsed = { lens: number[]; notes: Map<string, Map<number, PNote[]>>; marks: Map<string, Map<number, PMark[]>> };

const Q = 48;
const parsedCache = new WeakMap<ScoreData, Parsed>();

function parse(data: ScoreData): Parsed {
  const cached = parsedCache.get(data);
  if (cached) return cached;
  const lens = data.bars.split(",").map(Number);
  const notes = new Map<string, Map<number, PNote[]>>();
  const marks = new Map<string, Map<number, PMark[]>>();
  for (const [name, part] of Object.entries(data.parts)) {
    const byBar = new Map<number, PNote[]>();
    let bar = 0;
    for (const token of part.notes.split(" ").filter(Boolean)) {
      if (token[0] === "b") {
        bar = Number(token.slice(1));
        continue;
      }
      const tie = token.endsWith("~");
      const [on, dur, ...pitches] = (tie ? token.slice(0, -1) : token).split(".").map(Number);
      const list = byBar.get(bar) ?? [];
      list.push({ on: on / Q, dur: dur / Q, pitches, tie });
      byBar.set(bar, list);
    }
    notes.set(name, byBar);
    const markBars = new Map<number, PMark[]>();
    for (const token of part.marks.split(" ").filter(Boolean)) {
      if (token[0] === "b") {
        bar = Number(token.slice(1));
        continue;
      }
      const [on, word] = token.split(":");
      const list = markBars.get(bar) ?? [];
      list.push({ on: Number(on) / Q, word });
      markBars.set(bar, list);
    }
    marks.set(name, markBars);
  }
  const out = { lens, notes, marks };
  parsedCache.set(data, out);
  return out;
}

/** "5-19,21" → [5, 6, …, 19, 21] */
export function barsOf(spec: string): number[] {
  const out: number[] = [];
  for (const piece of spec.split(",")) {
    const [a, b] = piece.split("-").map(Number);
    for (let n = a; n <= (b ?? a); n++) out.push(n);
  }
  return out;
}

export type Placement = { bar: number; at: number; entry: number };

/**
 * Where every printed bar falls in the full version, entry by entry of its
 * form. `drift` lists entries whose printed bars don't fill the entry exactly.
 */
export function placements(full: Song, score: ComposerScore, data: ScoreData) {
  const { lens } = parse(data);
  const list: Placement[] = [];
  const drift: { entry: number; expected: number; actual: number }[] = [];
  if (score.form.length !== full.sections.length) {
    throw new Error(`${full.id}: the score maps ${score.form.length} form entries, the full version has ${full.sections.length}`);
  }
  score.form.forEach((spec, entry) => {
    const start = full.sections[entry].at;
    const end = full.sections[entry + 1]?.at ?? full.length;
    let at = start;
    for (const bar of barsOf(spec)) {
      list.push({ bar, at, entry });
      at += lens[bar - 1];
    }
    if (Math.abs(at - end) > 1e-6) drift.push({ entry, expected: end - start, actual: at - start });
  });
  return { list, drift };
}

const LEVEL: Record<string, number> = { ppp: 30, pp: 40, p: 52, mp: 64, mf: 76, f: 90, ff: 104, fff: 116 };
const ACCENT = new Set(["sfz", "sffz", "sf", "fz", "rfz", "rf"]);

type Timed = { at: number; dur: number; pitch: number; tie: boolean; accent: number };

/** One printed part in performance order, with velocities worked out from its marks. */
function performPart(name: string, parsed: Parsed, list: Placement[], score: ComposerScore) {
  const byBar = parsed.notes.get(name) ?? new Map<number, PNote[]>();
  const marksByBar = parsed.marks.get(name) ?? new Map<number, PMark[]>();
  const notes: Timed[] = [];
  const marks: { at: number; word: string }[] = [];
  const entryStart = new Map<number, number>();
  for (const pl of list) {
    const direction = score.directions?.[pl.entry];
    if (!entryStart.has(pl.entry)) {
      entryStart.set(pl.entry, pl.at);
      if (direction?.dynamic) marks.push({ at: pl.at - 1e-4, word: direction.dynamic });
    }
    if (direction?.tacet?.includes(name)) continue;
    for (const n of byBar.get(pl.bar) ?? []) {
      for (const pitch of n.pitches) notes.push({ at: pl.at + n.on, dur: n.dur, pitch, tie: n.tie, accent: 0 });
    }
    for (const m of marksByBar.get(pl.bar) ?? []) {
      // A direction's dynamic stands for the whole entry; the printed one is for the other time through.
      if (direction?.dynamic && LEVEL[m.word] !== undefined) continue;
      marks.push({ at: pl.at + m.on, word: m.word });
    }
  }
  notes.sort((a, b) => a.at - b.at || a.pitch - b.pitch);
  marks.sort((a, b) => a.at - b.at);

  // Dynamics as a curve: a step at each marking, a ramp for cresc. and dim.
  type Point = { at: number; level: number; ramp?: { at: number; level: number } };
  const points: Point[] = [];
  let level = LEVEL.mf;
  const accents: number[] = [];
  const pizz: { at: number; on: boolean }[] = [];
  marks.forEach((m, i) => {
    const w = m.word;
    if (LEVEL[w] !== undefined) {
      level = LEVEL[w];
      points.push({ at: m.at, level });
    } else if (w === "fp") {
      accents.push(m.at);
      level = LEVEL.p;
      points.push({ at: m.at, level });
    } else if (ACCENT.has(w)) {
      accents.push(m.at);
    } else if (w === "cresc" || w === "dim" || w === "decresc") {
      const up = w === "cresc";
      const next = marks.slice(i + 1).find((n) => LEVEL[n.word] !== undefined && n.at - m.at <= 24);
      const aims = next && (up ? LEVEL[next.word] > level : LEVEL[next.word] < level);
      const target = Math.max(LEVEL.ppp, Math.min(LEVEL.fff, aims ? LEVEL[next!.word] : level + (up ? 26 : -24)));
      points.push({ at: m.at, level, ramp: { at: aims ? next!.at : m.at + 8, level: target } });
      level = target;
    } else if (w === "pizz") pizz.push({ at: m.at, on: true });
    else if (w === "arco") pizz.push({ at: m.at, on: false });
  });
  const velocity = (t: number) => {
    let current: Point | undefined;
    for (const p of points) {
      if (p.at > t + 1e-6) break;
      current = p;
    }
    if (!current) return LEVEL.mf;
    const r = current.ramp;
    if (!r) return current.level;
    if (t >= r.at) return r.level;
    return current.level + ((r.level - current.level) * (t - current.at)) / (r.at - current.at);
  };
  for (const n of notes) if (accents.some((a) => a >= n.at - 0.5 && a <= n.at + 0.05)) n.accent = 20;
  const isPizz = (t: number) => {
    let on = false;
    for (const p of pizz) if (p.at <= t + 1e-6) on = p.on;
    return on;
  };
  return notes.map((n) => ({ ...n, vel: velocity(n.at) + n.accent, pizz: isPizz(n.at) }));
}

/** The full version played from the score, or the 1981 excerpt taken out of it. */
export function originalScore(song: Song, full: Song, score: ComposerScore, data: ScoreData): Arrangement {
  const parsed = parse(data);
  const { list } = placements(full, score, data);
  const short = song.version === "short";
  const align = short ? alignShort(song, full) : { offset: 0, shift: 0, scale: 1 };
  // Stretches of the full score behind the version being played: all of it, or the 1981 excerpt
  // bar by bar (the 1981 program sometimes shortened or repeated a bar).
  const segments = short ? excerptSegments(song, full, align) : [{ at: 0, end: song.length, fullAt: 0, scale: 1, jump: false }];
  const s = new Studio(song, "original", "Original Score", {
    bpm: song.bpm,
    policy: "keep",
    introBars: 0,
    outroBars: 1,
    followTempo: true,
    gain: score.gain ?? 1,
  });
  const inside = (beat: number) => beat > -1e-6 && beat < song.length - 1e-6;

  for (const spec of score.parts) {
    const names = typeof spec.part === "string" ? [spec.part] : spec.part;
    const track = s.track(slug(spec.name), spec.role, spec.patch, {
      name: spec.name,
      pan: spec.pan ?? 64,
      volume: Math.round((spec.volume ?? 100) * (score.level ?? 1)),
      reverb: spec.reverb ?? 64,
    });
    const pizzTrack = spec.pizz;
    let pizzNow = false;
    // In full-score beats first, with ties joined...
    const inFull: { at: number; end: number; pitch: number; vel: number; pizz: boolean }[] = [];
    for (const name of names) {
      const open = new Map<number, (typeof inFull)[number]>();
      for (const n of performPart(name, parsed, list, score)) {
        const pitch = spec.drums ? mapPitch(spec, n.pitch) : n.pitch + align.shift;
        if (pitch === null) continue;
        const tied = open.get(n.pitch);
        if (tied && Math.abs(tied.end - n.at) < 1e-3) {
          tied.end = n.at + n.dur;
          if (!n.tie) open.delete(n.pitch);
          continue;
        }
        const event = { at: n.at, end: n.at + n.dur, pitch, vel: n.vel, pizz: n.pizz && !!pizzTrack };
        inFull.push(event);
        if (n.tie) open.set(n.pitch, event);
        else open.delete(n.pitch);
      }
    }
    // ...then placed wherever the version being played uses that stretch of the score.
    const events: typeof inFull = [];
    for (const g of segments) {
      const fullEnd = g.fullAt + (g.end - g.at) * g.scale;
      for (const e of inFull) {
        if (e.at < g.fullAt - 1e-6 || e.at >= fullEnd - 1e-6) continue;
        const at = g.at + (e.at - g.fullAt) / g.scale;
        const end = g.at + (e.end - g.fullAt) / g.scale;
        events.push({ ...e, at, end: g.jump ? Math.min(end, g.end) : end });
      }
    }
    events.sort((a, b) => a.at - b.at || a.pitch - b.pitch);
    for (const e of events) {
      if (!inside(e.at)) continue;
      const from = s.fromSongBeat(e.at);
      const to = s.fromSongBeat(Math.min(e.end, song.length));
      if (pizzTrack && e.pizz !== pizzNow) {
        pizzNow = e.pizz;
        track.automation.push({ at: from - 1e-3, kind: "program", patch: pizzNow ? pizzTrack : spec.patch });
      }
      // Plucked notes ring briefly whatever their written length; bowed and blown ones leave a breath.
      const len = e.pizz ? Math.min(to - from, 0.9) : spec.drums ? 0.25 : (to - from) * (to - from >= 1 ? 0.96 : 0.88);
      s.add(track, from, len, e.pitch, e.vel);
    }
  }
  const arrangement = s.finish();
  return { ...arrangement, label: score.kind === "composer" ? "Original Score" : "Original Score (ours)" };
}

/**
 * The 1981 excerpt, bar by bar: which beat of the full score each of its bars
 * starts on. Each bar may slide a little from the one before (up to two beats)
 * to keep its notes on the original's; consecutive bars that stay put are one
 * segment, and a segment that is followed by a slide cuts its notes short.
 */
function excerptSegments(short: Song, full: Song, align: { offset: number; shift: number; scale: number }) {
  const at = new Map<string, number>();
  for (const n of full.notes) if (n.pitch !== null) at.set(n.at.toFixed(3), n.pitch);
  let offset = align.offset;
  const bars = short.measures.map((m) => {
    const notes = short.notes.filter((n) => n.pitch !== null && n.at >= m.at - 1e-6 && n.at < m.at + m.len - 1e-6);
    const score = (o: number) => notes.filter((n) => at.get((o + n.at * align.scale).toFixed(3)) === n.pitch! - align.shift).length;
    let best = offset;
    if (notes.length) {
      for (let k = -8; k <= 8; k++) {
        const o = offset + k * 0.25 * align.scale;
        if (score(o) > score(best) || (score(o) === score(best) && Math.abs(o - offset) < Math.abs(best - offset))) best = o;
      }
    }
    offset = best;
    return { at: m.at, end: m.at + m.len, offset };
  });
  const segments: { at: number; end: number; fullAt: number; scale: number; jump: boolean }[] = [];
  for (const b of bars) {
    const last = segments[segments.length - 1];
    const fullAt = b.offset + b.at * align.scale;
    if (last && Math.abs(last.fullAt + (last.end - last.at) * align.scale - fullAt) < 1e-6) last.end = b.end;
    else {
      if (last) last.jump = true;
      segments.push({ at: b.at, end: b.end, fullAt, scale: align.scale, jump: false });
    }
  }
  return segments;
}

function mapPitch(spec: PartSpec, pitch: number) {
  if (!spec.drums) return pitch;
  return spec.drums[pitch] ?? null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Where the 1981 excerpt sits inside the full version: the full score beat of
 * its beat 0, how far the 1981 key sits from the original one, and how many
 * full-version beats one 1981 beat covers. Found by matching the first notes
 * of the two melodies, pitch for pitch and in the same rhythm.
 */
export function alignShort(short: Song, full: Song) {
  const a = short.notes.filter((n) => n.pitch !== null);
  const b = full.notes.filter((n) => n.pitch !== null);
  const probe = a.slice(0, 12);
  const at = new Map<string, number>();
  for (const n of b) at.set(n.at.toFixed(3), n.pitch!);
  let best = { score: -1, offset: 0, shift: 0, scale: 1 };
  // Anchor on each of the first few 1981 notes (its opening may be simplified) and every full note.
  for (let k = 0; k < 4; k++) {
    for (const m of b) {
      const shift = probe[k].pitch! - m.pitch!;
      if (Math.abs(shift) > 13) continue;
      for (const scale of [1, 2, 0.5]) {
        const offset = m.at - probe[k].at * scale;
        let score = 0;
        for (const n of probe) if (at.get((offset + n.at * scale).toFixed(3)) === n.pitch! - shift) score++;
        const better = score > best.score || (score === best.score && Math.abs(shift) < Math.abs(best.shift));
        if (better) best = { score, offset, shift, scale };
      }
    }
  }
  return best;
}
