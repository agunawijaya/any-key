import { css, mix, type Rgb } from "../../scene/color";
import type { Ctx } from "../../scene/paint";

/*
 * A spotter biplane far off. Drawn flat side-on, a biplane is two planks
 * over a stick; what makes it read as an aeroplane is its wings spreading
 * towards and away from us. So it is a small solid model in metres (x to
 * the nose, y up, z out along the right wing), turned three-quarters to
 * the view and seen a little from below, and painted far parts first.
 */

type Point3 = readonly [number, number, number];
type Pose = { yaw: number; lookUp: number; roll: number };
type Flat = { x: number; y: number };

const UPPER_WING = { lead: 1.55, trail: 0.05, y: 1.75, span: 4.7 };
const LOWER_WING = { lead: 1.15, trail: -0.25, y: -0.5, span: 4.2 };
const STRUT_AT = 3.1;
const WHEEL_AT = 0.85;

/** The side of the fuselage from nose to tail, top edge then bottom edge. */
const FUSELAGE_TOP: [number, number][] = [
  [3.0, 0.5], [2.5, 0.62], [1.0, 0.62], [-0.3, 0.58], [-1.4, 0.48], [-3.7, 0.2],
];
const FUSELAGE_BOTTOM: [number, number][] = [
  [3.0, -0.5], [2.5, -0.6], [1.0, -0.62], [-1.4, -0.42], [-3.7, 0.02],
];
const FUSELAGE_HALF_WIDTH = 0.42;
/** The fin and rudder, in the fuselage's own plane. */
const FIN: [number, number][] = [
  [-2.9, 0.38], [-3.35, 1.2], [-3.75, 1.32], [-4.0, 1.05], [-3.95, 0.4], [-3.7, 0.12],
];

/**
 * Draws the biplane with its nose to the left at (x, y), `size` pixels to
 * the metre. `time` rocks it gently and spins the propeller's shimmer.
 */
export function biplane(ctx: Ctx, x: number, y: number, size: number, night: boolean, sky: Rgb, time: number) {
  const pose: Pose = { yaw: -0.5, lookUp: 0.22, roll: Math.sin(time * 0.7) * 0.06 };
  const at = (p: Point3) => project(p, pose, x, y, size);
  // Far enough off that the air pales it towards the sky. By night it is a
  // dark shape whose undersides catch the glow of the fires below.
  const haze = night ? 0.1 : 0.12;
  const body = mix(night ? [10, 11, 16] : [50, 48, 42], sky, haze);
  const under = mix(night ? [31, 26, 28] : [72, 70, 62], sky, haze);
  const edge = mix(night ? [6, 7, 10] : [34, 33, 29], sky, haze * 0.6);
  const line = Math.max(0.8, size * 0.09);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // The far side: the wing halves and the wheel away from us.
  wing(ctx, at, UPPER_WING, -1, under, edge, line);
  wing(ctx, at, LOWER_WING, -1, under, edge, line);
  struts(ctx, at, -1, edge, line);
  tailplane(ctx, at, -1, under);
  wheel(ctx, at, -WHEEL_AT, edge, body, line);

  fuselage(ctx, at, body, under, edge);
  polygon(ctx, FIN.map(([fx, fy]) => at([fx, fy, 0])), body);
  stroke(ctx, [at([-3.45, 1.28, 0]), at([-3.6, 0.15, 0])], edge, line * 0.7);
  // The pilot's head and shoulders above the cockpit rim.
  polygon(ctx, circle([-0.55, 0.78, 0], 0.26, "z").map(at), edge);

  // The near side: tail, wheel, wings and struts towards us.
  tailplane(ctx, at, 1, under);
  wheel(ctx, at, WHEEL_AT, edge, body, line);
  wing(ctx, at, UPPER_WING, 1, under, edge, line);
  struts(ctx, at, 1, edge, line);
  wing(ctx, at, LOWER_WING, 1, under, edge, line);

  propeller(ctx, at, time, body, night);
  ctx.restore();
}

/** Turns the model by the pose and lays it on the screen, nose to the left. */
function project([px, py, pz]: Point3, pose: Pose, x: number, y: number, size: number): Flat {
  const ry = py * Math.cos(pose.roll) - pz * Math.sin(pose.roll);
  const rz = py * Math.sin(pose.roll) + pz * Math.cos(pose.roll);
  const along = px * Math.cos(pose.yaw) + rz * Math.sin(pose.yaw);
  const towards = -px * Math.sin(pose.yaw) + rz * Math.cos(pose.yaw);
  // Seen from below, what is nearer to us sits lower on the screen.
  const up = ry * Math.cos(pose.lookUp) - towards * Math.sin(pose.lookUp);
  return { x: x - along * size, y: y - up * size };
}

type At = (p: Point3) => Flat;

function wing(ctx: Ctx, at: At, w: typeof UPPER_WING, side: 1 | -1, fill: Rgb, edge: Rgb, line: number) {
  const tip = w.span * side;
  // Rounded-off tips: the chord narrows over the last half metre.
  const outline = [
    at([w.lead, w.y, 0]),
    at([w.lead, w.y, tip - 0.5 * side]),
    at([w.lead - 0.25, w.y, tip]),
    at([w.trail + 0.2, w.y, tip]),
    at([w.trail, w.y, tip - 0.4 * side]),
    at([w.trail, w.y, 0]),
  ];
  polygon(ctx, outline, fill);
  // The leading edge is the wing's thickness, seen as a darker line.
  stroke(ctx, outline.slice(0, 3), edge, line);
}

function struts(ctx: Ctx, at: At, side: 1 | -1, edge: Rgb, line: number) {
  const z = STRUT_AT * side;
  const lower = LOWER_WING.y;
  const upper = UPPER_WING.y;
  // The two interplane struts, and the cabane struts holding the top wing over the fuselage.
  stroke(ctx, [at([1.0, lower, z]), at([1.35, upper, z])], edge, line);
  stroke(ctx, [at([-0.1, lower, z]), at([0.2, upper, z])], edge, line);
  stroke(ctx, [at([1.3, 0.6, 0.35 * side]), at([1.4, upper, 0.55 * side])], edge, line * 0.8);
  stroke(ctx, [at([0.4, 0.6, 0.35 * side]), at([0.4, upper, 0.55 * side])], edge, line * 0.8);
  // The bracing wires, a criss-cross between the struts.
  ctx.globalAlpha = 0.45;
  stroke(ctx, [at([1.0, lower, z]), at([0.4, upper, 0.55 * side])], edge, line * 0.45);
  stroke(ctx, [at([1.3, 0.6, 0.35 * side]), at([0.2, upper, z])], edge, line * 0.45);
  ctx.globalAlpha = 1;
}

function tailplane(ctx: Ctx, at: At, side: 1 | -1, fill: Rgb) {
  const z = 1.6 * side;
  polygon(ctx, [at([-2.75, 0.18, 0]), at([-3.0, 0.18, z]), at([-3.55, 0.18, z]), at([-3.85, 0.18, 0])], fill);
}

function wheel(ctx: Ctx, at: At, z: number, edge: Rgb, body: Rgb, line: number) {
  const axle: Point3 = [1.55, -1.45, z];
  stroke(ctx, [at([2.1, -0.55, z * 0.5]), at(axle)], edge, line);
  stroke(ctx, [at([0.95, -0.6, z * 0.5]), at(axle)], edge, line);
  polygon(ctx, circle(axle, 0.42, "z").map(at), edge);
  polygon(ctx, circle(axle, 0.16, "z").map(at), body);
}

function fuselage(ctx: Ctx, at: At, body: Rgb, under: Rgb, edge: Rgb) {
  const side = (z: number) => [...FUSELAGE_TOP.map(([fx, fy]) => at([fx, fy, z])), ...[...FUSELAGE_BOTTOM].reverse().map(([fx, fy]) => at([fx, fy, z]))];
  // From below we see the far side's outline past the belly, then the belly, then the near side.
  polygon(ctx, side(-FUSELAGE_HALF_WIDTH), body);
  const belly = [...FUSELAGE_BOTTOM.map(([fx, fy]) => at([fx, fy, -FUSELAGE_HALF_WIDTH])), ...[...FUSELAGE_BOTTOM].reverse().map(([fx, fy]) => at([fx, fy, FUSELAGE_HALF_WIDTH]))];
  polygon(ctx, belly, under);
  polygon(ctx, side(FUSELAGE_HALF_WIDTH), body);
  // The engine cowling, rounder and darker than the fuselage behind it.
  polygon(ctx, circle([3.0, 0, 0], 0.55, "x").map(at), edge);
}

function propeller(ctx: Ctx, at: At, time: number, body: Rgb, night: boolean) {
  // A spinning propeller is a pale shimmer, with a blade caught now and then.
  const disc = circle([3.12, 0, 0], 1.35, "x").map(at);
  polygon(ctx, disc, body, night ? 0.12 : 0.18);
  const turn = time * 31;
  const blade = (angle: number) => at([3.12, Math.sin(angle) * 1.3, Math.cos(angle) * 1.3]);
  ctx.globalAlpha = 0.45;
  stroke(ctx, [blade(turn), blade(turn + Math.PI)], body, 1);
  ctx.globalAlpha = 1;
}

/** Points around a circle in the plane facing along `axis`. */
function circle([cx, cy, cz]: Point3, r: number, axis: "x" | "z"): Point3[] {
  const points: Point3[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    points.push(axis === "x" ? [cx, cy + Math.sin(a) * r, cz + Math.cos(a) * r] : [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
  }
  return points;
}

function polygon(ctx: Ctx, points: Flat[], color: Rgb, alpha = 1) {
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

function stroke(ctx: Ctx, points: Flat[], color: Rgb, width: number) {
  ctx.strokeStyle = css(color);
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}
