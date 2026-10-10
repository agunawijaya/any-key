import { strike, type Hit, type Lane, type StrikeShape } from "./cues";

/*
 * Where a hand sits on a row of keys (or bars, or strings laid flat), and
 * which finger plays each note. A real player keeps the hand still while the
 * notes stay under its five fingers and shifts only when a note falls
 * outside them, so the hand moves in steps instead of chasing every note.
 */

export type HandStep = {
  /** Onset time in seconds. */
  t: number;
  /** Where the middle finger sits, in the caller's units. */
  centre: number;
  /** The notes struck together and the finger on each, 0 to 4 from the hand's left. */
  presses: { pitch: number; x: number; finger: number; end: number }[];
};

export type HandPlan = { steps: HandStep[]; lane: Lane };

export type HandNow = {
  centre: number;
  /** 0 when the fingers are down on the keys, up to 1 lifted. */
  lift: number;
  /** Notes held right now, with their fingers. */
  down: HandStep["presses"];
  /** The step being travelled to, for fingers getting ready. */
  next?: HandStep;
  since: number;
};

const TOGETHER = 0.012;

/**
 * Plans one hand over a lane of notes. `keyX` places a pitch along the
 * instrument; `width` is the distance between neighbouring fingers.
 */
export function planHand(lane: Lane, keyX: (pitch: number) => number, width: number, start?: number): HandPlan {
  const steps: HandStep[] = [];
  let centre = start ?? (lane.hits[0] ? keyX(lane.hits[0].pitch) : 0);
  for (let i = 0; i < lane.hits.length; ) {
    const group: Hit[] = [];
    const at = lane.hits[i].t;
    while (i < lane.hits.length && lane.hits[i].t - at < TOGETHER) group.push(lane.hits[i++]);
    const xs = group.map((h) => keyX(h.pitch));
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    if (hi - lo > 4 * width) centre = (lo + hi) / 2;
    // The smallest move that brings every note under a finger.
    else centre = Math.min(Math.max(centre, hi - 2 * width), lo + 2 * width);
    const used = new Set<number>();
    const presses = group
      .map((h, k) => ({ pitch: h.pitch, x: xs[k], end: h.end }))
      .sort((a, b) => a.x - b.x)
      .map((p) => {
        let finger = Math.max(0, Math.min(4, Math.round((p.x - centre) / width) + 2));
        while (used.has(finger) && finger < 4) finger++;
        used.add(finger);
        return { ...p, finger };
      });
    steps.push({ t: at, centre, presses });
  }
  return { steps, lane };
}

export function handAt(plan: HandPlan, t: number, shape?: StrikeShape): HandNow {
  const { steps } = plan;
  if (!steps.length) return { centre: 0, lift: 0.5, down: [], since: Infinity };
  // Steps and the lane's onsets line up one to one after grouping, so find the step by time.
  let lo = 0;
  let hi = steps.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid].t <= t + 1e-6) lo = mid + 1;
    else hi = mid;
  }
  const prev = steps[lo - 1];
  const next = steps[lo];
  const s = strike(plan.lane, t, shape);
  const from = prev?.centre ?? next.centre;
  const to = next?.centre ?? from;
  return {
    centre: from + (to - from) * s.travel,
    lift: s.lift,
    down: prev ? prev.presses.filter((p) => p.end > t) : [],
    next,
    since: s.since,
  };
}
