import { add, addScaled, cross, distance, dot, length, normalize, scale, sub, type Vec3 } from "./vec";

/*
 * Two-bone inverse kinematics: given a root (a hip, a shoulder), a target
 * (an ankle, a wrist) and a pole (which way the knee or elbow should point),
 * find the middle joint.
 *
 * Near full stretch an ordinary solver snaps the limb straight in a single
 * frame, which reads as a pop. This one softens the last few percent of the
 * reach: the limb straightens along a smooth curve and the end falls a
 * little short of the target instead. Feet never ask for that much reach
 * (the pelvis is kept within it), so for them the target is met exactly.
 */

export type LimbSolution = { mid: Vec3; end: Vec3; reached: boolean };

/** How much of the full reach is softened, as a fraction of it. */
const SOFT_ZONE = 0.035;

/** The distance the limb actually spans when asked to span `wanted`. */
export function softReach(wanted: number, upper: number, lower: number, soft = SOFT_ZONE) {
  const full = upper + lower;
  const zone = full * soft;
  const start = full - zone;
  if (wanted <= start) return wanted;
  return start + zone * (1 - Math.exp(-(wanted - start) / zone));
}

/**
 * `pole` says which way the middle joint should point. When the limb lines up
 * with it, the bend plane would spin; `fallback` (a second preference) takes
 * over smoothly before that happens, so the elbow or knee never flips.
 */
export function solveTwoBone(root: Vec3, target: Vec3, upper: number, lower: number, pole: Vec3, fallback: Vec3 = { x: 0, y: 0, z: 1 }): LimbSolution {
  const toTarget = sub(target, root);
  const wanted = length(toTarget);
  const dir = normalize(toTarget, { x: 0, y: -1, z: 0 });
  const shortest = Math.abs(upper - lower) + 1e-4;
  const span = Math.max(shortest, softReach(wanted, upper, lower));

  // The bend plane holds the limb and the pole; the middle joint sits on the pole's side.
  const across = (v: Vec3) => sub(v, scale(dir, dot(v, dir)));
  const main = across(pole);
  const strength = length(main);
  const takeover = 1 - Math.min(1, Math.max(0, (strength - 0.08) / 0.3));
  let bend =
    takeover > 0 ? add(scale(normalize(main, { x: 0, y: 0, z: 0 }), 1 - takeover), scale(normalize(across(fallback), { x: 0, y: 0, z: 0 }), takeover)) : main;
  if (length(bend) < 1e-6) bend = cross(dir, Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 });
  bend = normalize(bend);

  const cosRoot = (upper * upper + span * span - lower * lower) / (2 * upper * span);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosRoot)));
  const mid = add(addScaled(root, dir, upper * Math.cos(angle)), scale(bend, upper * Math.sin(angle)));
  const end = addScaled(root, dir, span);
  return { mid, end, reached: distance(end, target) < 1e-3 };
}

/** The farthest a limb reaches before softening begins: keep feet inside it. */
export const comfortableReach = (upper: number, lower: number) => (upper + lower) * (1 - SOFT_ZONE);
