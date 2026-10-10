import type { Arrangement, ArrNote, Track } from "../arrange/types";
import { barIndexAt, secondsAt } from "../tempo";

/*
 * Performers never keep their own time. Everything they do is read from the
 * arrangement the engine is playing: a stick comes down because a note starts
 * there, a bow turns because the next note begins, a hand slides along the
 * keyboard because the pitch moved. This module turns an arrangement into
 * lanes of hits with times in seconds, so motion can be shaped in real time
 * (a stick's rebound lasts the same at any tempo) while staying locked to
 * the beat the engine reports.
 */

/** One note, with its start and end in seconds of song time. */
export type Hit = ArrNote & { t: number; end: number };

/** A time-ordered run of hits for one hand, one foot, one bow or one whole track. */
export class Lane {
  readonly hits: Hit[];

  constructor(hits: Hit[]) {
    this.hits = [...hits].sort((a, b) => a.t - b.t);
  }

  /** Index of the last hit starting at or before `t`, or -1. */
  lastIndex(t: number) {
    let lo = 0;
    let hi = this.hits.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.hits[mid].t <= t + 1e-6) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  /** The hit before (or at) `t` and the one after it. */
  around(t: number): { prev?: Hit; next?: Hit; index: number } {
    const index = this.lastIndex(t);
    return { prev: this.hits[index], next: this.hits[index + 1], index };
  }

  /** Every hit still sounding at `t`. */
  sounding(t: number): Hit[] {
    const out: Hit[] = [];
    for (let i = this.lastIndex(t); i >= 0; i--) {
      const hit = this.hits[i];
      if (hit.end > t) out.push(hit);
      // Nothing in these arrangements rings for more than a few bars.
      if (t - hit.t > 30) break;
    }
    return out;
  }

  get isEmpty() {
    return this.hits.length === 0;
  }
}

/** A track's notes as one lane, plus the pitch range its player covers. */
export type TrackCues = {
  track: Track;
  lane: Lane;
  lo: number;
  hi: number;
};

export type BarPosition = {
  index: number;
  /** Beat where the bar starts. */
  at: number;
  len: number;
  /** Beats into the bar. */
  into: number;
  /** Which beat of the bar, from 0. */
  beat: number;
  /** How far through that beat, 0 to 1. */
  frac: number;
};

export type Section = "intro" | "main" | "outro";

/** The arrangement, read for performing: lanes per track, bars, sections and how busy each bar is. */
export class Performance {
  readonly arrangement: Arrangement;
  readonly tracks: TrackCues[];
  private byId = new Map<string, TrackCues>();
  private busy: number[];
  private tuneStart: number;
  private tuneEnd: number;

  constructor(arrangement: Arrangement) {
    this.arrangement = arrangement;
    this.tracks = arrangement.tracks.map((track) => {
      const hits = track.notes.map((n) => toHit(arrangement, n));
      const pitched = track.patch.drums ? [] : hits.map((h) => h.pitch);
      const cues = { track, lane: new Lane(hits), lo: pitched.length ? Math.min(...pitched) : 60, hi: pitched.length ? Math.max(...pitched) : 72 };
      this.byId.set(track.id, cues);
      return cues;
    });
    const passes = arrangement.passes;
    this.tuneStart = passes[0]?.at ?? 0;
    const last = passes[passes.length - 1];
    this.tuneEnd = last ? last.at + last.length : arrangement.length;
    this.busy = busyBars(arrangement);
  }

  track(id: string) {
    return this.byId.get(id);
  }

  /** Song seconds at a beat. */
  seconds(beat: number) {
    return secondsAt(this.arrangement.tempos, beat);
  }

  bar(beat: number): BarPosition {
    const grid = this.arrangement.grid;
    const index = barIndexAt(grid, beat);
    const bar = grid[index] ?? { at: 0, len: this.arrangement.barBeats };
    const into = Math.max(0, beat - bar.at);
    const whole = Math.floor(into + 1e-6);
    return { index, at: bar.at, len: bar.len, into, beat: whole, frac: into - whole };
  }

  section(beat: number): Section {
    if (beat < this.tuneStart - 1e-6) return "intro";
    if (beat >= this.tuneEnd - 1e-6) return "outro";
    return "main";
  }

  /** How busy the band is in this bar compared with its busiest bar, 0 to 1. */
  energy(beat: number) {
    const index = barIndexAt(this.arrangement.grid, beat);
    return this.busy[index] ?? 0;
  }

  /** Beat where the first melody pass starts. */
  get downbeatOfTune() {
    return this.tuneStart;
  }
}

function toHit(arrangement: Arrangement, note: ArrNote): Hit {
  return { ...note, t: secondsAt(arrangement.tempos, note.at), end: secondsAt(arrangement.tempos, note.at + note.dur) };
}

/** Notes started per bar, all tracks together, scaled so the busiest bar is 1. */
function busyBars(arrangement: Arrangement) {
  const counts = arrangement.grid.map(() => 0);
  for (const track of arrangement.tracks) {
    // A hand drum or hi-hat line would swamp the count; weight drums lightly.
    const weight = track.patch.drums ? 0.35 : 1;
    for (const note of track.notes) counts[barIndexAt(arrangement.grid, note.at)] += (weight * note.vel) / 127;
  }
  const most = Math.max(1e-6, ...counts);
  return counts.map((c) => c / most);
}

// ---------- Motion primitives ----------

export type Strike = {
  prev?: Hit;
  next?: Hit;
  /** Height above the target: 0 touching, 1 a full lift. */
  lift: number;
  /** Progress from the last target to the next one, 0 to 1. */
  travel: number;
  /** Seconds since the last hit (Infinity before the first). */
  since: number;
  /** Seconds to the next hit (Infinity after the last). */
  until: number;
};

export type StrikeShape = {
  /** How long the bounce off a hit takes, at most. */
  rebound?: number;
  /** How long the fall into a hit takes, at most. */
  prep?: number;
  /** A gap this long or more earns a full lift. */
  fullGap?: number;
  /** Height to settle at when nothing more is coming. */
  rest?: number;
};

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * How a stick, mallet, hammer or hand moves between hits on a lane: it bounces
 * up off each hit, travels towards where the next hit lands, and drops onto it
 * exactly when the note starts. The lift grows with the gap and the next
 * note's loudness, the way a player winds up for an accent.
 */
export function strike(lane: Lane, t: number, shape: StrikeShape = {}): Strike {
  const { rebound = 0.12, prep = 0.16, fullGap = 0.5, rest = 0.35 } = shape;
  const { prev, next } = lane.around(t);
  const since = prev ? t - prev.t : Infinity;
  const until = next ? next.t - t : Infinity;
  if (!prev && !next) return { lift: rest, travel: 0, since, until };
  if (!prev) {
    // Before the first hit: wait at rest, then wind up into it.
    return { next, lift: rest + (1 - rest) * smooth(1 - until / Math.max(prep * 2.5, 0.3)) * (until < prep ? smooth(until / prep) : 1), travel: 1, since, until };
  }
  if (!next) {
    const up = smooth(since / rebound);
    return { prev, lift: up * (1 - smooth((since - 0.4) / 0.6)) + rest * smooth((since - 0.4) / 0.6), travel: 0, since, until };
  }
  const gap = next.t - prev.t;
  const amp = Math.min(1, Math.max(0.22, gap / fullGap)) * (0.55 + (0.45 * next.vel) / 127);
  const up = smooth(since / Math.min(rebound, gap * 0.35));
  const down = smooth(until / Math.min(prep, gap * 0.45));
  // Long waits sag towards rest in the middle, then wind up again.
  const sag = gap > 1.2 ? 1 - (1 - rest) * smooth(Math.min(since - 0.35, until - 0.45) / 0.4) : 1;
  const lift = Math.min(up, down) * amp * sag;
  const travel = smooth(since / Math.max(0.05, gap - Math.min(prep, gap * 0.45) * 0.6));
  return { prev, next, lift, travel, since, until };
}

/** A quick swell that peaks just after a hit and dies away: for glows, skins and flashes. */
export function pulse(lane: Lane, t: number, decay = 0.25) {
  const { prev } = lane.around(t);
  if (!prev) return 0;
  const since = t - prev.t;
  return since < 0 ? 0 : Math.exp(-since / decay) * (0.4 + (0.6 * prev.vel) / 127);
}

/** Where a value sits between two others, clamped to 0..1. */
export const span = (value: number, from: number, to: number) => (to === from ? 0.5 : Math.min(1, Math.max(0, (value - from) / (to - from))));
