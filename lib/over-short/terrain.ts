/*
 * The lie of the land along the line of fire, for Field Artillery: real
 * heights, so a crest can hide one gun from the other and a round can come
 * down on a forward slope short of where it would have on the flat.
 *
 * A terrain is a handful of surveyed heights joined smoothly (level at each
 * surveyed point, so crests and hollows are round), with a little
 * unevenness laid over them. Heights are metres above the lowest ground;
 * distances are metres along the line of fire.
 */

export type SurveyPoint = { x: number; height: number };

export type Terrain = {
  survey: SurveyPoint[];
  /** Metres of unevenness laid over the smooth survey. */
  roughness: number;
  seed: number;
  /** Stretches under water, metres along the line of fire: rivers and flooded ground. */
  water?: { from: number; to: number; level: number }[];
};

/** The height of the ground at distance x. Beyond the survey the land runs level. */
export function heightAt(terrain: Terrain, x: number): number {
  const s = terrain.survey;
  let base: number;
  if (x <= s[0].x) base = s[0].height;
  else if (x >= s[s.length - 1].x) base = s[s.length - 1].height;
  else {
    let i = 0;
    while (s[i + 1].x < x) i++;
    const a = s[i];
    const b = s[i + 1];
    const k = (x - a.x) / (b.x - a.x);
    base = a.height + (b.height - a.height) * k * k * (3 - 2 * k);
  }
  return base + unevenness(terrain, x);
}

/** Small swells and dips, the same every time for a seed. */
function unevenness(terrain: Terrain, x: number) {
  const p = terrain.seed * 2.39;
  const swell = Math.sin(x / 173 + p) * 0.55 + Math.sin(x / 61 + p * 2.3) * 0.3 + Math.sin(x / 23 + p * 5.1) * 0.15;
  return swell * terrain.roughness;
}

/** The highest ground between two distances. */
export function highestBetween(terrain: Terrain, from: number, to: number): number {
  let best = -Infinity;
  for (let x = from; x <= to; x += 10) best = Math.max(best, heightAt(terrain, x));
  return best;
}
