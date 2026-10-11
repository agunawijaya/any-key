/*
 * The crowd's verdict. Everything the matador does builds a meter the player
 * can see (bravery, artistry, the bull, the risk taken, the finish) and at
 * the end the crowd rolls once: the needle lands somewhere in a band round
 * the meter's value, and the zone it lands in is the award. The odds of each
 * award are the widths of the zones inside that band, and the screen shows
 * them before the roll.
 *
 * The 1970s program rolled three times, once per tier, which pulled results
 * towards the middle; this is the honest version of the same idea.
 */

export type Tier = 0 | 1 | 2 | 3;

export const TIERS: Record<Tier, { name: string; line: string }> = {
  0: { name: "Polite silence", line: "The ring is quiet. A few hands, then the band." },
  1: { name: "Applause", line: "Warm applause from both sides of the ring." },
  2: { name: "A lap of honour", line: "They call you round the ring; flowers come down as you pass." },
  3: { name: "Carried out on shoulders", line: "Out through the great gate, high on the crowd's shoulders." },
};

/** Where each award starts on the meter. */
export const THRESHOLDS: Record<Exclude<Tier, 0>, number> = { 1: 8, 2: 15, 3: 22 };

/** How far the crowd's mood can swing either side of the meter. */
export const SWING = 3.5;

export type Meter = {
  bravery: number;
  artistry: number;
  bull: number;
  risk: number;
  finish: number;
  /** Carrying on after a goring, retiring, dragging on: the rest. */
  courage: number;
};

export const emptyMeter = (): Meter => ({ bravery: 0, artistry: 0, bull: 0, risk: 0, finish: 0, courage: 0 });

export const meterTotal = (m: Meter) => m.bravery + m.artistry + m.bull + m.risk + m.finish + m.courage;

/** What the crowd will give at most: no finish, no shoulders. */
export type Cap = Tier;

/** The chance of each award for a meter value, under a cap. */
export function awardOdds(total: number, cap: Cap = 3): [number, number, number, number] {
  const lo = total - SWING;
  const hi = total + SWING;
  const share = (from: number, to: number) => Math.max(0, Math.min(hi, to) - Math.max(lo, from)) / (hi - lo);
  const raw: [number, number, number, number] = [
    share(-Infinity, THRESHOLDS[1]),
    share(THRESHOLDS[1], THRESHOLDS[2]),
    share(THRESHOLDS[2], THRESHOLDS[3]),
    share(THRESHOLDS[3], Infinity),
  ];
  // Anything above the cap falls to the cap.
  for (let t = 3; t > cap; t--) {
    raw[cap] += raw[t];
    raw[t] = 0;
  }
  return raw;
}

/** The needle's place for a roll r in [0, 1), and the award it lands on. */
export function award(total: number, r: number, cap: Cap = 3): { needle: number; tier: Tier } {
  const needle = total - SWING + 2 * SWING * r;
  let tier: Tier = needle >= THRESHOLDS[3] ? 3 : needle >= THRESHOLDS[2] ? 2 : needle >= THRESHOLDS[1] ? 1 : 0;
  if (tier > cap) tier = cap;
  return { needle, tier };
}
