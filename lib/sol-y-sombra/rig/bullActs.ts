import { BULL, type Bull, type BullDrive } from "./bull";
import { planTrack, standingBull, TICK, type Track } from "./choreography";
import { addScaled, angleDelta, clamp, flat, headingDir, headingOf, mix, normalize, smootherstep, sub, type Vec3 } from "./vec";

/*
 * What the bull does when no pass is running: stand and watch (turning on
 * its hindquarters to keep facing what it watches), run or walk a route
 * (into the ring, after a cape, out to the pasture), lie down to rest and
 * get up again. Each answers the bull's rig with a cue, tick by tick.
 */

export interface BullAct {
  /** Ring time when it has played out; Infinity holds until something replaces it. */
  readonly until: number;
  cue(time: number): BullDrive;
}

/** A turn on the hindquarters, standing: the withers swing round the hips until it faces the point. */
function turnTrack(bull: Bull, point: Vec3): Vec3[] {
  const rear = flat(bull.rear);
  const from = headingOf(sub(bull.front, rear));
  const turn = angleDelta(from, headingOf(sub(flat(point), rear)));
  const ticks = Math.round((0.8 + Math.abs(turn) / 1.1) / TICK);
  const fronts: Vec3[] = [];
  for (let i = 1; i <= ticks; i++) fronts.push(addScaled(rear, headingDir(from + turn * smootherstep(0, 1, i / ticks)), BULL.bodyLength));
  return fronts;
}

export type Mood = { headLow: number; arousal: number };

/** Standing, watching something; when it goes too far round to follow with the head, the bull turns to face it. */
export class BullWatching implements BullAct {
  readonly until = Infinity;
  private turn: { fronts: Vec3[]; start: number } | null = null;

  constructor(
    private readonly bull: Bull,
    private readonly target: () => Vec3 | null,
    private readonly mood: Mood = { headLow: 0.3, arousal: 0.4 },
  ) {}

  cue(time: number): BullDrive {
    const look = this.target();
    if (this.turn) {
      const i = Math.round((time - this.turn.start) / TICK);
      if (i < this.turn.fronts.length) return standingBull(this.turn.fronts[i], look, this.mood.headLow, this.mood.arousal);
      this.turn = null;
    }
    if (look) {
      const off = angleDelta(this.bull.heading, headingOf(sub(flat(look), this.bull.front)));
      if (Math.abs(off) > 0.8) this.turn = { fronts: turnTrack(this.bull, look), start: time };
    }
    return standingBull(this.bull.front, look, this.mood.headLow, this.mood.arousal);
  }
}

export type RunOptions = {
  topSpeed: number;
  /** Turn to face this point once stopped. */
  face?: Vec3 | null;
  /** What to watch once stopped. */
  look?: () => Vec3 | null;
  /** Seconds standing before it sets off. */
  wait?: number;
};

/** Running or walking a route through waypoints, then standing. */
export class BullRun implements BullAct {
  readonly until: number;
  readonly track: Track;
  private readonly start: number;

  constructor(
    bull: Bull,
    points: Vec3[],
    start: number,
    private readonly options: RunOptions,
  ) {
    this.start = start;
    this.track = planTrack({
      points: [flat(bull.front), ...points.map((p) => flat(p))],
      rear: bull.rear,
      heading: bull.heading,
      waitTicks: Math.round((options.wait ?? 0) / TICK),
      topSpeed: options.topSpeed,
      slowAt: null,
      slowSpeed: options.topSpeed,
      accel: options.topSpeed > 4 ? 5 : 2.2,
      decel: options.topSpeed > 4 ? 4 : 1.8,
      face: options.face ?? null,
    });
    this.until = start + this.track.front.length * TICK;
  }

  /** Where the withers come to rest. */
  get end(): Vec3 {
    return this.track.front[this.track.front.length - 1];
  }

  cue(time: number): BullDrive {
    const { front, speed, brake, stopTick } = this.track;
    const i = clamp(Math.round((time - this.start) / TICK), 0, front.length - 1);
    const v = speed[i] ?? 0;
    const moving = i < stopTick;
    const ahead = normalize(sub(front[Math.min(i + 24, front.length - 1)], front[Math.max(0, i - 24)]), headingDir(0));
    const look = moving ? { ...addScaled(front[i], ahead, 5), y: 0.6 } : (this.options.look?.() ?? null);
    const fast = clamp(v / 6, 0, 1);
    return {
      front: front[i],
      look,
      headLow: mix(0.28, 0.6, fast),
      toss: 0,
      tossSide: 1,
      paw: null,
      brake: brake[i] ?? 0,
      arousal: mix(0.35, 0.9, fast),
      rest: 0,
    };
  }
}

/** Lying on the sand, legs folded under, head low: resting after the finish. */
export class BullLying implements BullAct {
  readonly until = Infinity;
  constructor(private readonly bull: Bull) {}

  cue(): BullDrive {
    return { ...standingBull(this.bull.front, null, 0.75, 0.1), rest: 1 };
  }
}

/** Getting up again: hind end first, then the front, and a moment standing. */
export class BullRising implements BullAct {
  readonly until: number;

  constructor(
    private readonly bull: Bull,
    private readonly start: number,
  ) {
    this.until = start + 3;
  }

  cue(time: number): BullDrive {
    const rest = 1 - smootherstep(this.start, this.start + 2.2, time);
    return { ...standingBull(this.bull.front, null, mix(0.35, 0.75, rest), 0.25), rest };
  }
}
