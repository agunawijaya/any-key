import { css, lerp3, litColour, type Light, type RGB } from "./light";
import { bandPath, lerp, smoothPath, solveJoint, type Point } from "./shapes";

/*
 * The Bactrian camel, rigged in code.
 *
 * The camel is drawn in its own units, one unit to the shoulder, y up, facing
 * right. Legs are two-segment limbs placed by solving the middle joint for
 * where each foot is in the gait cycle: camels pace, moving both legs on one
 * side together, and switch to a rotary gallop when pushed. The humps hold the
 * camel's reserves, so they stand up when it is fresh and flop over as it
 * tires. A rider in a deel sits between them.
 */

export type Gait = "walk" | "gallop" | "rest";

export type CamelPose = {
  gait: Gait;
  /** Where in the stride, 0–1. */
  phase: number;
  /** 0 head up, 1 head down into the wind (fear, effort or weariness). */
  headLow: number;
  /** 1 full humps, 0 empty and flopped over. */
  hump: number;
  /** How hard the wind blows fur and cloth to the right, 0–1. */
  wind: number;
  /** Animation time, for idle motion. */
  time: number;
  rider: boolean;
};

export type CamelPaint = {
  coat: string;
  coatShade: string;
  fur: string;
  furLight: string;
  legs: string;
  far: string;
  dark: string;
  rim: string;
  /** Light from the sun, a fire or a lantern: which side it comes from (−1 left, 1 right) and how strong. */
  rimSide: number;
  rimStrength: number;
  deel: string;
  deelShade: string;
  sash: string;
  blanket: string;
  blanketTrim: string;
  skin: string;
  hat: string;
};

const COAT: RGB = [188, 132, 82];
const FUR: RGB = [132, 86, 48];
const LEGS: RGB = [176, 128, 86];

/** The camel's colours under a light, with an optional warm light of its own (a campfire). */
export function camelPaint(light: Light, side: number, extra: RGB = [0, 0, 0], extraSide = side): CamelPaint {
  const sunUp = light.sun[0] > 0.05;
  const lit = (albedo: RGB, facing: number) => css(litColour(light, albedo, facing, extra));
  const rimLight: RGB = sunUp ? lerp3([255, 222, 170], [255, 190, 120], 0.5) : extra[0] > 0.2 ? [255, 176, 96] : [170, 190, 255];
  const rimStrength = sunUp ? Math.min(1, light.sun[0]) : Math.min(1, Math.max(extra[0] * 1.2, light.moon[2] * 1.2));
  return {
    coat: lit(COAT, 0.35),
    coatShade: lit(COAT, -0.3),
    fur: lit(FUR, 0.2),
    furLight: lit(lerp3(FUR, [235, 196, 140], 0.45), 0.6),
    legs: lit(LEGS, 0.25),
    far: lit(lerp3(COAT, [60, 40, 30], 0.35), -0.2),
    dark: css(litColour(light, [40, 28, 22], 0.2, extra)),
    rim: css(rimLight),
    rimSide: sunUp ? side : extraSide,
    rimStrength,
    deel: lit([46, 86, 168], 0.45),
    deelShade: lit([30, 56, 120], -0.1),
    sash: lit([238, 176, 44], 0.6),
    blanket: lit([196, 40, 52], 0.4),
    blanketTrim: lit([250, 206, 92], 0.6),
    skin: lit([196, 140, 100], 0.5),
    hat: lit([176, 36, 44], 0.5),
  };
}

type Leg = { root: Point; upper: number; lower: number; bend: 1 | -1; offset: number; near: boolean; fore: boolean };

const LEGS_RIG: Leg[] = [
  { root: [-0.58, 1.02], upper: 0.5, lower: 0.56, bend: -1, offset: 0.5, near: false, fore: false },
  { root: [0.42, 1.04], upper: 0.47, lower: 0.6, bend: 1, offset: 0.5, near: false, fore: true },
  { root: [-0.52, 1.0], upper: 0.5, lower: 0.56, bend: -1, offset: 0, near: true, fore: false },
  { root: [0.5, 1.02], upper: 0.47, lower: 0.6, bend: 1, offset: 0, near: true, fore: true },
];

/** Gallop timing: a rotary gallop, hind feet then fore feet, with a moment in the air. */
const GALLOP_OFFSET = [0.08, 0.6, 0, 0.5];

function footAt(leg: Leg, index: number, pose: CamelPose): Point {
  const gallop = pose.gait === "gallop";
  const duty = gallop ? 0.38 : 0.62;
  const stride = gallop ? 0.82 : 0.5;
  const lift = gallop ? 0.26 : 0.16;
  const p = (((pose.phase + (gallop ? GALLOP_OFFSET[index] : leg.offset)) % 1) + 1) % 1;
  const reachX = leg.root[0] + (leg.fore ? 0.06 : -0.02);
  if (p < duty) return [reachX + stride * (0.5 - p / duty), 0];
  const u = (p - duty) / (1 - duty);
  const eased = u * u * (3 - 2 * u);
  return [reachX + stride * (-0.5 + eased), lift * Math.sin(Math.PI * u) ** 0.8];
}

export function drawCamel(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, pose: CamelPose, screenPaint: CamelPaint, facing = 1) {
  // The rig is drawn facing right; light sides are given on screen, so they flip with it.
  const paint = { ...screenPaint, rimSide: screenPaint.rimSide * facing };
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size * facing, -size);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Soft contact shadow on the sand.
  ctx.fillStyle = "rgb(40 20 10 / 0.18)";
  ctx.beginPath();
  ctx.ellipse(0.05, 0.01, pose.gait === "rest" ? 1.1 : 0.95, 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pose.gait === "rest") drawCouched(ctx, pose, paint);
  else drawStanding(ctx, pose, paint);
  ctx.restore();
}

function bodyBob(pose: CamelPose) {
  const gallop = pose.gait === "gallop";
  const wave = Math.sin(pose.phase * Math.PI * 2 * (gallop ? 1 : 2));
  return { lift: gallop ? 0.05 * wave : 0.018 * wave, pitch: gallop ? 0.045 * Math.sin(pose.phase * Math.PI * 2 + 0.6) : 0 };
}

function drawStanding(ctx: CanvasRenderingContext2D, pose: CamelPose, paint: CamelPaint) {
  const { lift, pitch } = bodyBob(pose);
  const legs = LEGS_RIG.map((leg, i) => ({ leg, foot: footAt(leg, i, pose) }));

  // Far legs behind the body, in shadow. The near legs come after it: their
  // thighs are the body's own muscle, the same coat fading into the leg.
  for (const { leg, foot } of legs.filter((l) => !l.leg.near)) drawLeg(ctx, leg, foot, lift, paint, true);

  ctx.save();
  ctx.translate(0, lift);
  ctx.rotate(pitch);
  drawTail(ctx, pose, paint);
  const shape = drawBody(ctx, pose, paint, headAngle(pose));
  ctx.restore();

  for (const { leg, foot } of legs.filter((l) => l.leg.near)) drawLeg(ctx, leg, foot, lift, paint, false);

  if (pose.rider) {
    ctx.save();
    ctx.translate(0, lift);
    ctx.rotate(pitch);
    drawRider(ctx, pose, paint, shape);
    ctx.restore();
  }
}

function drawLeg(ctx: CanvasRenderingContext2D, leg: Leg, foot: Point, lift: number, paint: CamelPaint, far: boolean) {
  const root: Point = [leg.root[0], leg.root[1] + lift];
  const ankle: Point = [foot[0] + (leg.fore ? 0.02 : 0), foot[1] + 0.07];
  const joint = solveJoint(root, ankle, leg.upper, leg.lower, leg.bend);
  // Near legs start in the body's coat and turn to leg colour below the belly.
  const colour = far ? paint.far : ctx.createLinearGradient(0, root[1], 0, joint[1]);
  if (typeof colour !== "string") {
    colour.addColorStop(0, paint.coat);
    colour.addColorStop(0.45, paint.coat);
    colour.addColorStop(1, paint.legs);
  }
  const thigh = leg.fore ? 0.27 : 0.34;
  const limb = bandPath(
    [root, [lerp(root[0], joint[0], 0.5), lerp(root[1], joint[1], 0.5)], joint, [lerp(joint[0], ankle[0], 0.55), lerp(joint[1], ankle[1], 0.55)], ankle],
    [thigh, thigh * 0.62, 0.125, 0.085, 0.095],
  );
  ctx.fillStyle = colour;
  ctx.fill(limb);
  // The knobbly knee, and the broad padded foot that keeps a camel up on sand.
  ctx.fillStyle = far ? paint.far : paint.legs;
  ctx.beginPath();
  ctx.ellipse(joint[0], joint[1], 0.07, 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(foot[0] + 0.04, foot[1] + 0.04, 0.105, 0.045, 0, 0, Math.PI * 2);
  ctx.fillStyle = far ? paint.far : paint.coatShade;
  ctx.fill();
  if (leg.fore && !far) {
    // Shaggy "chaps" of long hair on the upper foreleg.
    shag(ctx, [root, [lerp(root[0], joint[0], 0.45), lerp(root[1], joint[1], 0.45)], [lerp(root[0], joint[0], 0.85), lerp(root[1], joint[1], 0.85)]], 0.1, -1, paint, 0.4);
  }
  if (!far) {
    // Shade the leg's back edge so it reads as round, not cut out; never up on the thigh, where it meets the body.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-2, -1, 4, 1.72 + root[1] - 1.0 - 0.1);
    ctx.clip();
    ctx.clip(limb);
    ctx.translate(paint.rimSide * 0.035, 0);
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = paint.coatShade;
    ctx.globalAlpha = 0.5;
    ctx.stroke(limb);
    ctx.restore();
  }
}

/*
 * Body, neck and head are one silhouette, so nothing reads as stuck on. The
 * neck leaves the front of the shoulders low, sags forward and rises to the
 * head; when the camel lowers its head the neck bends progressively from its
 * root while the head itself stays nearly level, as a camel's does.
 */

/** Where the neck bends from, inside the shoulder. */
const NECK_ROOT: Point = [0.64, 1.22];
/** The poll, where the head meets the neck. */
const POLL: Point = [1.28, 1.48];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rotate([x, y]: Point, [cx, cy]: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}

/** How far the neck swings down (negative) or up from its resting carriage. */
function headAngle(pose: CamelPose) {
  if (pose.gait === "rest") return 0.1 + Math.sin(pose.time * 0.8) * 0.02;
  const nod = Math.sin(pose.phase * Math.PI * (pose.gait === "gallop" ? 2 : 4) + 1) * 0.035;
  return -0.4 * pose.headLow - (pose.gait === "gallop" ? 0.08 : 0) + nod;
}

/** The head drawn a touch larger than life, so it reads at small sizes. */
const enlargeHead = ([x, y]: Point): Point => [POLL[0] + (x - POLL[0]) * 1.14, POLL[1] + (y - POLL[1]) * 1.14];

/** Bends a point of the neck or head into the pose. */
function poseNeck(p: Point, angle: number): Point {
  const bent = rotate(p, NECK_ROOT, angle * smooth(0.6, 1.15, p[0]));
  const level = smooth(1.16, 1.3, p[0]);
  if (level === 0) return bent;
  return rotate(bent, rotate(POLL, NECK_ROOT, angle), -0.55 * angle * level);
}

export type CamelShape = {
  outline: Point[];
  /** Where the rein ties on, at the nose peg. */
  nose: Point;
  /** Maps a point given in the resting head's coordinates into the pose. */
  head: (p: Point) => Point;
  /** The head's tilt in the pose, for drawing its features. */
  headTilt: number;
};

type Silhouette = CamelShape & { hump1: Point[]; hump2: Point[]; neckTop: Point[]; throat: Point[]; belly: Point[] };

/** The whole silhouette, in camel units. Humps sag and lean as `hump` falls. */
function camelShape(hump: number, angle: number): Silhouette {
  const h = 0.35 + 0.65 * hump;
  const lean = (1 - hump) * 0.14;
  const back = 1.52;
  const peak = (height: number) => back + (height - back) * h;
  const neck = (points: Point[]) => points.map((p) => poseNeck(p, angle));

  const rump: Point[] = [
    [-0.84, 1.2],
    [-0.76, 1.4],
    [-0.62, 1.52],
  ];
  const hump1: Point[] = [
    [-0.5 + lean * 0.4, peak(1.86)],
    [-0.36 + lean, peak(2.02)],
    [-0.22 + lean, peak(1.9)],
  ];
  const saddle: Point[] = [
    [-0.1, 1.62],
    [0.02, 1.6],
  ];
  const hump2: Point[] = [
    [0.12 + lean * 0.4, peak(1.88)],
    [0.26 + lean, peak(2.04)],
    [0.4 + lean, peak(1.9)],
  ];
  const withers: Point[] = [[0.53, 1.62]];
  const neckTop = neck([
    [0.64, 1.54],
    [0.8, 1.42],
    [0.96, 1.33],
    [1.1, 1.34],
    [1.2, 1.42],
    [1.25, 1.52],
  ]);
  const head = neck(
    (
      [
        [1.3, 1.58],
        [1.4, 1.62],
        [1.54, 1.585],
        [1.63, 1.53],
        [1.665, 1.455],
        [1.625, 1.395],
        [1.55, 1.36],
        [1.46, 1.38],
        [1.36, 1.4],
        [1.28, 1.36],
      ] as Point[]
    ).map(enlargeHead),
  );
  const throat = neck([
    [1.2, 1.17],
    [1.08, 1.0],
    [0.95, 0.93],
    [0.82, 0.95],
  ]);
  const chest: Point[] = [
    [0.74, 1.02],
    [0.64, 0.88],
  ];
  const belly: Point[] = [
    [0.36, 0.8],
    [0.0, 0.78],
    [-0.34, 0.84],
    [-0.6, 0.92],
    [-0.8, 1.04],
  ];
  return {
    outline: [...rump, ...hump1, ...saddle, ...hump2, ...withers, ...neckTop, ...head, ...throat, ...chest, ...belly],
    hump1: [rump[2], ...hump1, saddle[0]],
    hump2: [saddle[1], ...hump2, withers[0]],
    neckTop: neckTop.slice(1, 4),
    throat: [poseNeck([1.24, 1.3], angle), ...throat],
    belly: [chest[1], ...belly.slice(0, 4)],
    nose: poseNeck(enlargeHead([1.63, 1.47]), angle),
    head: (p: Point) => poseNeck(p[0] > 1.27 ? enlargeHead(p) : p, angle),
    headTilt: 0.45 * angle,
  };
}

function drawBody(ctx: CanvasRenderingContext2D, pose: CamelPose, paint: CamelPaint, angle: number): CamelShape {
  const shape = camelShape(pose.hump, angle);
  const body = new Path2D();
  smoothPath(body, shape.outline, true, 0.5);
  const g = ctx.createLinearGradient(0, 2.0, 0, 0.78);
  g.addColorStop(0, paint.coat);
  g.addColorStop(0.62, paint.coat);
  g.addColorStop(1, paint.coatShade);
  ctx.fillStyle = g;
  ctx.fill(body);

  // A soft shadow where neck and shoulder fold into each other gives the join its form.
  ctx.save();
  ctx.clip(body);
  const fold = ctx.createRadialGradient(0.7, 1.1, 0, 0.7, 1.1, 0.32);
  fold.addColorStop(0, paint.coatShade);
  fold.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = fold;
  ctx.fillRect(0.3, 0.7, 0.8, 0.8);
  ctx.restore();

  rimStroke(ctx, body, paint, 0.025);
  // Long winter hair: crowning the humps, a short mane, the beard down the throat, a fringe on the belly.
  shag(ctx, shape.hump1, 0.085, 1, paint, pose.wind);
  shag(ctx, shape.hump2, 0.09, 1, paint, pose.wind);
  shag(ctx, shape.neckTop, 0.04, 1, paint, pose.wind);
  shag(ctx, shape.throat, 0.15, -1, paint, pose.wind * 0.6);
  shag(ctx, shape.belly, 0.06, -1, paint, pose.wind * 0.4);
  drawFace(ctx, pose, paint, shape);
  return shape;
}

/** Ear, forelock, eye under a heavy brow, nostril slit and the drooping lip. */
function drawFace(ctx: CanvasRenderingContext2D, pose: CamelPose, paint: CamelPaint, shape: CamelShape) {
  const at = shape.head;
  const tilt = shape.headTilt;
  const [earX, earY] = at([1.305, 1.625]);
  ctx.fillStyle = paint.coatShade;
  ctx.beginPath();
  ctx.ellipse(earX, earY, 0.05, 0.024, 2.6 + tilt - pose.headLow * 0.3, 0, Math.PI * 2);
  ctx.fill();
  shag(ctx, [at([1.3, 1.6]), at([1.36, 1.63]), at([1.42, 1.63])], 0.05, 1, paint, pose.wind);

  const [eyeX, eyeY] = at([1.44, 1.535]);
  ctx.fillStyle = paint.dark;
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, 0.022, 0.016, tilt + 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = paint.coatShade;
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  const brow = [at([1.4, 1.565]), at([1.45, 1.58]), at([1.49, 1.56])];
  ctx.moveTo(...brow[0]);
  ctx.quadraticCurveTo(...brow[1], ...brow[2]);
  ctx.moveTo(...at([1.615, 1.49]));
  ctx.lineTo(...at([1.645, 1.47]));
  ctx.moveTo(...at([1.53, 1.405]));
  ctx.lineTo(...at([1.63, 1.42]));
  ctx.stroke();
}

function drawTail(ctx: CanvasRenderingContext2D, pose: CamelPose, paint: CamelPaint) {
  const swish = Math.sin(pose.time * 2.1) * 0.05 + pose.wind * 0.1;
  const tail = bandPath(
    [
      [-0.8, 1.3],
      [-0.9, 1.1],
      [-0.92 + swish, 0.86],
    ],
    [0.07, 0.05, 0.035],
  );
  ctx.fillStyle = paint.coatShade;
  ctx.fill(tail);
  shag(ctx, [[-0.9 + swish, 0.96], [-0.92 + swish, 0.86], [-0.93 + swish, 0.8]], 0.08, -1, paint, pose.wind);
}

function drawCouched(ctx: CanvasRenderingContext2D, pose: CamelPose, paint: CamelPaint) {
  // Folded legs: knees forward under the chest, hind legs tucked under the belly.
  ctx.fillStyle = paint.far;
  ctx.beginPath();
  ctx.ellipse(0.62, 0.1, 0.2, 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint.legs;
  ctx.beginPath();
  ctx.ellipse(-0.4, 0.12, 0.32, 0.12, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -0.68);
  drawTail(ctx, { ...pose, wind: pose.wind * 0.5 }, paint);
  const shape = drawBody(ctx, pose, paint, headAngle(pose));
  if (pose.rider) drawRider(ctx, pose, paint, shape);
  ctx.restore();
  ctx.fillStyle = paint.legs;
  ctx.beginPath();
  ctx.ellipse(0.7, 0.09, 0.22, 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint.coatShade;
  ctx.beginPath();
  ctx.ellipse(0.86, 0.07, 0.08, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRider(ctx: CanvasRenderingContext2D, pose: CamelPose, paint: CamelPaint, shape: CamelShape) {
  const bounce = pose.gait === "gallop" ? Math.sin(pose.phase * Math.PI * 2 + 2) * 0.03 : 0;
  const lean = pose.gait === "gallop" ? 0.18 : 0.05;
  // A felt saddle cloth between the humps, edged with a woven border.
  const blanket = new Path2D();
  smoothPath(
    blanket,
    [
      [-0.15, 1.62],
      [0.09, 1.62],
      [0.13, 1.44],
      [0.08, 1.38],
      [-0.1, 1.38],
      [-0.16, 1.46],
    ],
    true,
    0.35,
  );
  ctx.fillStyle = paint.blanket;
  ctx.fill(blanket);
  ctx.save();
  ctx.clip(blanket);
  ctx.strokeStyle = paint.blanketTrim;
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = -0.15 + i * 0.045;
    ctx.moveTo(x, 1.4);
    ctx.lineTo(x + 0.022, 1.43);
    ctx.lineTo(x + 0.045, 1.4);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(-0.03, 1.6 + bounce);
  ctx.rotate(-lean);
  ctx.scale(0.78, 0.78);
  // Leg and boot down the camel's side.
  ctx.fillStyle = paint.deelShade;
  ctx.fill(bandPath([[0.02, 0.04], [0.12, -0.14], [0.08, -0.3]], [0.11, 0.09, 0.08]));
  ctx.fillStyle = paint.dark;
  ctx.beginPath();
  ctx.ellipse(0.1, -0.33, 0.07, 0.035, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // The deel: a long robe with a bright sash.
  const deel = new Path2D();
  smoothPath(
    deel,
    [
      [-0.1, 0.02],
      [-0.07, 0.24],
      [-0.02, 0.4],
      [0.08, 0.41],
      [0.12, 0.24],
      [0.14, 0.02],
    ],
    true,
    0.4,
  );
  ctx.fillStyle = paint.deel;
  ctx.fill(deel);
  ctx.fillStyle = paint.sash;
  ctx.fillRect(-0.085, 0.13, 0.215, 0.05);
  // A scarf streaming out with the wind.
  const flutter = Math.sin(pose.time * 9) * 0.03;
  ctx.fillStyle = paint.sash;
  ctx.fill(
    bandPath(
      [
        [0.0, 0.38],
        [-0.12 - pose.wind * 0.05, 0.36 + flutter],
        [-0.26 - pose.wind * 0.12, 0.37 - flutter],
      ],
      [0.05, 0.04, 0.02],
    ),
  );
  // Arms forward to the reins.
  ctx.fillStyle = paint.deelShade;
  ctx.fill(bandPath([[0.04, 0.34], [0.16, 0.24], [0.26, 0.22]], [0.07, 0.06, 0.05]));
  // Head and a peaked hat with an upturned brim.
  ctx.fillStyle = paint.skin;
  ctx.beginPath();
  ctx.arc(0.04, 0.5, 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint.hat;
  ctx.beginPath();
  ctx.moveTo(-0.06, 0.53);
  ctx.quadraticCurveTo(0.03, 0.72, 0.1, 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = paint.blanketTrim;
  ctx.beginPath();
  ctx.ellipse(0.02, 0.535, 0.1, 0.025, -0.1, 0, Math.PI * 2);
  ctx.fill();
  rimStroke(ctx, deel, paint, 0.015);
  ctx.restore();

  // The rein, from the rider's hands to the camel's nose peg.
  ctx.strokeStyle = paint.dark;
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  const [nx, ny] = shape.nose;
  ctx.moveTo(0.17, 1.78 + bounce);
  ctx.quadraticCurveTo(lerp(0.17, nx, 0.55), Math.min(1.78, ny) - 0.12, nx, ny);
  ctx.stroke();
}

/**
 * Long hair along a run of outline points: a mass of hair that hangs away
 * from the outline (`side` +1 up, −1 down) with a ragged edge, drifting with
 * the wind, and a few lighter strands combed through it.
 */
function shag(ctx: CanvasRenderingContext2D, along: Point[], depth: number, side: number, paint: CamelPaint, wind: number) {
  if (along.length < 2) return;
  const samples: Point[] = [];
  const steps = 14 * (along.length - 1);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (along.length - 1);
    const s = Math.min(along.length - 2, Math.floor(t));
    const u = t - s;
    samples.push([lerp(along[s][0], along[s + 1][0], u), lerp(along[s][1], along[s + 1][1], u)]);
  }
  const ragged: Point[] = samples.map(([x, y], i) => {
    const tooth = i % 2 === 0 ? 1 : 0.45;
    const vary = 0.75 + 0.5 * (((i * 53) % 11) / 11);
    const len = depth * tooth * vary;
    return [x + wind * len * 0.7 + 0.01, y + side * len];
  });
  const mass = new Path2D();
  mass.moveTo(samples[0][0], samples[0][1] - side * depth * 0.25);
  for (const [x, y] of samples) mass.lineTo(x, y - side * depth * 0.25);
  for (let i = ragged.length - 1; i >= 0; i--) mass.lineTo(ragged[i][0], ragged[i][1]);
  mass.closePath();
  ctx.fillStyle = paint.fur;
  ctx.fill(mass);

  ctx.strokeStyle = paint.furLight;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = depth * 0.12;
  ctx.beginPath();
  for (let i = 1; i < samples.length; i += 2) {
    const [x, y] = samples[i];
    const [rx, ry] = ragged[i];
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(lerp(x, rx, 0.5) + wind * depth * 0.2, lerp(y, ry, 0.6), rx, ry);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A thin line of light along the edge that faces the light source. */
function rimStroke(ctx: CanvasRenderingContext2D, path: Path2D, paint: CamelPaint, width: number) {
  if (paint.rimStrength < 0.05) return;
  ctx.save();
  ctx.clip(path);
  ctx.translate(-paint.rimSide * width * 0.9, -width * 0.4);
  ctx.globalAlpha = 0.65 * paint.rimStrength;
  ctx.lineWidth = width * 2;
  ctx.strokeStyle = paint.rim;
  ctx.stroke(path);
  ctx.restore();
}
