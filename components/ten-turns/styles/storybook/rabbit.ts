/*
 * The rabbit: a soft white storybook bunny, round as a loaf, until it means
 * business. One drawing covers sitting, crouching, leaping and landing; the
 * pose blends between them. Units are the rabbit's own: it sits on (0, 0),
 * faces +x, and is about 2.1 tall to the ear tips.
 */

import { ellipse, furTufts, inkLine, limb, paintFigure, tracePath, type FigurePaint, type Part } from "./figure";
import { bobbleHat } from "./kid";
import type { Look } from "./look";
import { alpha, type Pt } from "./paint";

export type RabbitPose = {
  /** 1 sitting; below 1 squashed into a crouch or a landing; above 1 stretched in a leap. */
  squash: number;
  /** The body's lean, in radians: positive pitches the head towards where it faces. */
  tilt: number;
  /** 0 a sweet bunny, 1 a predator: red eyes, brows, bristling fur. */
  menace: number;
  /** How wide the mouth is open, 0 to 1. */
  mouth: number;
  /** 0 ears up, 1 ears flat back. */
  earsBack: number;
  /** 0 paws tucked, 1 front paws reaching and hind legs flung back. */
  reach: number;
  blink: number;
  /** Nose twitch, -1 to 1. */
  nose: number;
  /** Where the pupils look, roughly -1 to 1 each way. */
  look: Pt;
  /** Seconds, for the ears' flutter and the fur's small movements. */
  time: number;
  /** 0 to 1: drooping ears, folded arms and a pout. */
  sulk: number;
  /** Wearing the kid's snatched bobble hat. */
  wearsHat?: boolean;
};

export const RESTING: RabbitPose = { squash: 1, tilt: 0, menace: 0, mouth: 0, earsBack: 0, reach: 0, blink: 0, nose: 0, look: { x: 0.2, y: 0 }, time: 0, sulk: 0 };

const LINE = 0.022;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** Where the body bends around: squash and stretch happen about this point. */
const PIVOT = { x: 0, y: -0.62 };

function earPart(base: Pt, angle: number, length: number, flop: number, wave: number): { outer: Part; inner: Part } {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  // The ear bends at its middle; `flop` folds the top half over, `wave` sways it.
  const bend = angle - flop * 1.5 + wave;
  const mid = { x: base.x + dir.x * length * 0.5, y: base.y + dir.y * length * 0.5 };
  const tipDir = { x: Math.cos(bend), y: Math.sin(bend) };
  const tip = { x: mid.x + tipDir.x * length * 0.5, y: mid.y + tipDir.y * length * 0.5 };
  const quarter = { x: base.x + dir.x * length * 0.25, y: base.y + dir.y * length * 0.25 };
  const three = { x: mid.x + tipDir.x * length * 0.25, y: mid.y + tipDir.y * length * 0.25 };
  const spine = [base, quarter, mid, three, tip];
  const width = (t: number) => 0.13 + 0.11 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85));
  const outer = limb(spine, width, 20);
  const inner = limb(
    spine.map((p, i) => (i === 0 ? lerpPt(p, quarter, 0.5) : p)),
    (t) => width(t) * (0.5 - 0.25 * t * t),
    20,
  );
  return { outer, inner };
}

/** The rabbit, sitting, crouching or in mid-air, depending on the pose. */
export function drawRabbit(ctx: CanvasRenderingContext2D, look: Look, pose: RabbitPose, seed = 1) {
  const r = look.rabbit;
  const light = look.lightScreen;
  const furPaint = { fill: r.fur, shade: r.shade, ink: look.ink, line: LINE, light, shadeDepth: 0.075, rim: r.rim ? { color: r.rim, width: 0.022 } : undefined };

  ctx.save();
  ctx.translate(PIVOT.x, PIVOT.y);
  ctx.rotate(pose.tilt);
  const stretch = pose.squash;
  ctx.scale(1 / Math.sqrt(stretch), stretch);
  ctx.translate(-PIVOT.x, -PIVOT.y);

  const reach = pose.reach;
  const sulk = pose.sulk;
  const breathe = Math.sin(pose.time * 2.4) * 0.008 * (1 - reach);

  /* ---- Ears, behind the head ---- */
  const flutter = Math.sin(pose.time * 7) * 0.05 * reach + Math.sin(pose.time * 1.3) * 0.03;
  const back = pose.earsBack;
  // A sulk lets both ears flop over, one to each side.
  const farEar = earPart({ x: -0.04, y: -1.25 }, lerp(lerp(-1.74, -2.75, back), -2.75, sulk), lerp(0.86, 0.8, sulk), lerp(0.12 + back * 0.15, 1.35, sulk), flutter);
  const nearEar = earPart({ x: 0.22, y: -1.26 }, lerp(lerp(-1.38, -2.6, back), -0.4, sulk), lerp(0.88, 0.8, sulk), lerp(back * 0.1, -1.35, sulk), -flutter * 0.7);
  inHeadFrame(ctx, pose, () => {
    for (const ear of [farEar, nearEar]) {
      paintFigure(ctx, [ear.outer], furPaint);
      ctx.fillStyle = pose.menace > 0.5 ? mixEar(look, pose.menace) : r.innerEar;
      tracePath(ctx, [ear.inner]);
      ctx.fill();
    }
  });

  /* ---- Tail and body ---- */
  const tail = ellipse(-0.47, -0.3, 0.15, 0.15);
  const body = ellipse(0, -0.5 + breathe, 0.52, 0.47 + breathe);
  const bodyParts = [tail, body];
  const bodyFur = furTufts(bodyParts, {
    seed,
    spacing: lerp(0.32, 0.15, pose.menace),
    length: lerp(0.05, 0.085, pose.menace),
    width: lerp(0.09, 0.1, pose.menace),
    where: (e) => pose.menace > 0.3 || e.n.y > 0.1 || e.p.x < -0.4,
  });
  paintFigure(ctx, [...bodyParts, ...bodyFur], furPaint);
  furMarks(ctx, look, [
    { x: 0.2, y: -0.38 },
    { x: 0.3, y: -0.55 },
    { x: -0.18, y: -0.32 },
    { x: 0.05, y: -0.22 },
  ]);

  /* ---- Hind feet ---- */
  const farFoot = ellipse(lerp(-0.2, -0.16, reach), lerp(-0.06, 0.12, reach), 0.23, 0.08, lerp(0, 1.45, reach));
  const nearFoot = ellipse(lerp(0.17, 0.02, reach), lerp(-0.05, 0.16, reach), 0.27, 0.085, lerp(0, 1.35, reach));
  paintFigure(ctx, [farFoot], furPaint);
  paintFigure(ctx, [nearFoot], furPaint);
  toePads(ctx, look, reach);

  /* ---- Head ---- */
  inHeadFrame(ctx, pose, () => {
    const head = ellipse(0.08, -1.0, 0.37, 0.33);
    const cheeks = [ellipse(-0.16, -0.9, 0.16, 0.12, 0.3), ellipse(0.33, -0.9, 0.15, 0.12, -0.3)];
    const headParts = [head, ...cheeks];
    const headFur = furTufts(headParts, {
      seed: seed + 5,
      spacing: lerp(0.22, 0.13, pose.menace),
      length: lerp(0.045, 0.075, pose.menace),
      width: lerp(0.08, 0.09, pose.menace),
      where: (e) => pose.menace > 0.3 || e.n.y > 0.35 || e.p.y < -1.25,
    });
    paintFigure(ctx, [...headParts, ...headFur], furPaint);
    face(ctx, look, pose);
    if (pose.wearsHat) snatchedHat(ctx, look);
  });

  /* ---- Front paws: tucked, reaching, or folded in a sulk ---- */
  if (sulk > 0.5) foldedArms(ctx, furPaint);
  else {
    const farPaw = ellipse(lerp(0.06, 0.38, reach), lerp(-0.14, -0.86, reach), 0.085, 0.07, lerp(0, -0.9, reach));
    const nearPaw = ellipse(lerp(0.28, 0.5, reach), lerp(-0.16, -0.74, reach), 0.09, 0.072, lerp(0, -0.9, reach));
    paintFigure(ctx, [farPaw], furPaint);
    paintFigure(ctx, [nearPaw], furPaint);
  }

  ctx.restore();
}

const NECK = { x: 0.06, y: -0.8 };

/** The kid's bobble hat, worn at a jaunty angle between the ears. */
function snatchedHat(ctx: CanvasRenderingContext2D, look: Look) {
  const k = 0.6;
  ctx.save();
  ctx.translate(0.1, -1.27 + 1.22 * k);
  ctx.rotate(0.18);
  ctx.scale(k, k);
  bobbleHat(ctx, look);
  ctx.restore();
}

/**
 * The head keeps its face towards the viewer: it turns back against half of
 * the body's lean and shrugs off most of the stretch, as cartoon heads do.
 */
function inHeadFrame(ctx: CanvasRenderingContext2D, pose: RabbitPose, draw: () => void) {
  ctx.save();
  ctx.translate(NECK.x, NECK.y);
  ctx.scale(Math.pow(pose.squash, 0.3), Math.pow(pose.squash, -0.6));
  ctx.rotate(-pose.tilt * 0.6);
  ctx.translate(-NECK.x, -NECK.y);
  draw();
  ctx.restore();
}

function mixEar(look: Look, menace: number) {
  return alpha(look.rabbit.rage, 0.35 + menace * 0.35);
}

/** A few short strokes that say "fur" without drawing every hair. */
function furMarks(ctx: CanvasRenderingContext2D, look: Look, spots: Pt[]) {
  ctx.save();
  ctx.strokeStyle = alpha(look.night ? "#5a6487" : "#a79bb8", 0.75);
  ctx.lineWidth = 0.014;
  ctx.lineCap = "round";
  for (const s of spots) {
    ctx.beginPath();
    ctx.moveTo(s.x - 0.05, s.y - 0.03);
    ctx.quadraticCurveTo(s.x - 0.02, s.y + 0.02, s.x, s.y + 0.03);
    ctx.quadraticCurveTo(s.x + 0.02, s.y + 0.02, s.x + 0.05, s.y - 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

function toePads(ctx: CanvasRenderingContext2D, look: Look, reach: number) {
  if (reach > 0.3) return;
  ctx.save();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.014;
  ctx.lineCap = "round";
  for (const x of [0.35, 0.4]) {
    ctx.beginPath();
    ctx.moveTo(x, -0.1);
    ctx.lineTo(x + 0.01, -0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function foldedArms(ctx: CanvasRenderingContext2D, paint: FigurePaint) {
  const under = limb([{ x: -0.18, y: -0.6 }, { x: 0.05, y: -0.52 }, { x: 0.3, y: -0.6 }], () => 0.15, 14);
  const over = limb([{ x: 0.3, y: -0.47 }, { x: 0.08, y: -0.6 }, { x: -0.16, y: -0.53 }], () => 0.15, 14);
  paintFigure(ctx, [under], paint);
  paintFigure(ctx, [over], paint);
}

/* ---------- The face ---------- */

function face(ctx: CanvasRenderingContext2D, look: Look, pose: RabbitPose) {
  const r = look.rabbit;
  const menace = pose.menace;
  const eyes = [
    { c: { x: -0.05, y: -1.03 }, rx: 0.074, ry: 0.094 },
    { c: { x: 0.235, y: -1.03 }, rx: 0.064, ry: 0.09 },
  ];

  // Rosy cheeks while it is still sweet.
  if (menace < 0.6) {
    ctx.fillStyle = alpha(r.innerEar, 0.45 * (1 - menace));
    for (const x of [-0.13, 0.31]) {
      ctx.beginPath();
      ctx.ellipse(x, -0.92, 0.06, 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const [i, eye] of eyes.entries()) {
    const lid = Math.max(pose.blink, pose.sulk * 0.45);
    if (menace > 0.5) rageEye(ctx, look, eye, pose, i);
    else sweetEye(ctx, look, eye, pose, lid);
  }

  // Brows: only a cross or a sulking rabbit has them.
  const browWeight = Math.max(menace, pose.sulk * 0.8);
  if (browWeight > 0.15) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, browWeight * 1.5);
    const drop = 0.05 * browWeight;
    inkLine(ctx, [{ x: -0.15, y: -1.17 }, { x: -0.06, y: -1.15 + drop * 0.4 }, { x: 0.03, y: -1.12 + drop }], 0.034, look.ink);
    inkLine(ctx, [{ x: 0.17, y: -1.12 + drop }, { x: 0.24, y: -1.15 + drop * 0.4 }, { x: 0.31, y: -1.17 }], 0.03, look.ink);
    ctx.restore();
  }

  // Nose and the little "w" of a mouth.
  const nose = { x: 0.13, y: -0.925 + pose.nose * 0.01 };
  const twitch = 1 + Math.abs(pose.nose) * 0.12;
  ctx.fillStyle = r.nose;
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(nose.x - 0.038 * twitch, nose.y - 0.018);
  ctx.quadraticCurveTo(nose.x, nose.y - 0.034, nose.x + 0.038 * twitch, nose.y - 0.018);
  ctx.quadraticCurveTo(nose.x + 0.01, nose.y + 0.03, nose.x, nose.y + 0.03);
  ctx.quadraticCurveTo(nose.x - 0.01, nose.y + 0.03, nose.x - 0.038 * twitch, nose.y - 0.018);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const open = pose.mouth;
  if (open > 0.05) openMouth(ctx, look, nose, open);
  else {
    const pout = pose.sulk;
    inkLine(ctx, [{ x: nose.x, y: nose.y + 0.03 }, { x: nose.x, y: nose.y + 0.06 }], 0.016, look.ink);
    inkLine(ctx, [{ x: nose.x - 0.06, y: nose.y + 0.075 - pout * 0.03 }, { x: nose.x - 0.03, y: nose.y + 0.085 }, { x: nose.x, y: nose.y + 0.06 }], 0.016, look.ink);
    inkLine(ctx, [{ x: nose.x, y: nose.y + 0.06 }, { x: nose.x + 0.03, y: nose.y + 0.085 }, { x: nose.x + 0.06, y: nose.y + 0.075 - pout * 0.03 }], 0.016, look.ink);
    buckTeeth(ctx, look, { x: nose.x, y: nose.y + 0.068 }, 0.045);
  }

  // Whiskers.
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (const side of [-1, 1]) {
    const root = { x: nose.x + side * 0.1, y: nose.y + 0.03 };
    for (const k of [-1, 0, 1]) {
      const spread = side * (0.2 + menace * 0.04);
      inkLine(ctx, [root, { x: root.x + spread * 0.55, y: root.y + k * 0.025 - 0.005 }, { x: root.x + spread, y: root.y + k * 0.06 + (menace - 0.3) * 0.02 }], 0.009, look.ink);
    }
  }
  ctx.restore();
}

function sweetEye(ctx: CanvasRenderingContext2D, look: Look, eye: { c: Pt; rx: number; ry: number }, pose: RabbitPose, lid: number) {
  const { c, rx, ry } = eye;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = look.rabbit.eye;
  ctx.fill();
  ctx.clip();
  // Two catch-lights, nudged the way the rabbit looks.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(c.x - rx * 0.3 + pose.look.x * rx * 0.2, c.y - ry * 0.35, rx * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(c.x + rx * 0.35, c.y + ry * 0.35, rx * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (lid > 0.02) {
    // The eyelid comes down in fur colour, with an inked edge.
    const edge = c.y - ry + ry * 2 * lid;
    ctx.fillStyle = look.rabbit.fur;
    ctx.fillRect(c.x - rx - 0.01, c.y - ry - 0.01, rx * 2 + 0.02, edge - (c.y - ry) + 0.01);
    ctx.strokeStyle = look.ink;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(c.x - rx, edge);
    ctx.quadraticCurveTo(c.x, edge + 0.012, c.x + rx, edge);
    ctx.stroke();
  }
  ctx.restore();
}

function rageEye(ctx: CanvasRenderingContext2D, look: Look, eye: { c: Pt; rx: number; ry: number }, pose: RabbitPose, index: number) {
  const r = look.rabbit;
  const { c } = eye;
  const rx = eye.rx * 1.08;
  const ry = eye.ry * 0.95;
  if (r.glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 0.45);
    glow.addColorStop(0, alpha(r.rage, 0.95 * pose.menace));
    glow.addColorStop(0.25, alpha(r.rage, 0.35 * pose.menace));
    glow.addColorStop(1, alpha(r.rage, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 0.46, c.y - 0.46, 0.92, 0.92);
    ctx.restore();
  }
  ctx.save();
  // An angry lid slants down towards the nose.
  const slant = index === 0 ? 1 : -1;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = r.glow > 0 ? "#ffd9cf" : "#fffaf3";
  ctx.fill();
  ctx.clip();
  const iris = { x: c.x + pose.look.x * rx * 0.35, y: c.y + 0.012 + pose.look.y * ry * 0.3 };
  ctx.fillStyle = r.rage;
  ctx.beginPath();
  ctx.arc(iris.x, iris.y, rx * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0b0b";
  ctx.beginPath();
  ctx.ellipse(iris.x, iris.y, rx * 0.16, rx * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(iris.x - rx * 0.25, iris.y - ry * 0.25, rx * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = r.fur;
  ctx.beginPath();
  ctx.moveTo(c.x - rx - 0.02, c.y - ry - 0.02);
  ctx.lineTo(c.x + rx + 0.02, c.y - ry - 0.02);
  ctx.lineTo(c.x + rx + 0.02, c.y - ry * (0.15 - slant * 0.55));
  ctx.lineTo(c.x - rx - 0.02, c.y - ry * (0.15 + slant * 0.55));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.024;
  ctx.beginPath();
  ctx.moveTo(c.x - rx - 0.02, c.y - ry * (0.15 + slant * 0.55));
  ctx.lineTo(c.x + rx + 0.02, c.y - ry * (0.15 - slant * 0.55));
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function buckTeeth(ctx: CanvasRenderingContext2D, look: Look, top: Pt, height: number) {
  ctx.fillStyle = "#fffdf6";
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.013;
  for (const dx of [-0.026, 0.001]) {
    ctx.beginPath();
    ctx.roundRect(top.x + dx, top.y, 0.025, height, [0, 0, 0.008, 0.008]);
    ctx.fill();
    ctx.stroke();
  }
}

function openMouth(ctx: CanvasRenderingContext2D, look: Look, nose: Pt, open: number) {
  const top = nose.y + 0.045;
  const w = 0.07 + open * 0.05;
  const h = 0.03 + open * 0.13;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(nose.x - w, top);
  ctx.quadraticCurveTo(nose.x, top - 0.02, nose.x + w, top);
  ctx.quadraticCurveTo(nose.x + w * 0.9, top + h, nose.x, top + h);
  ctx.quadraticCurveTo(nose.x - w * 0.9, top + h, nose.x - w, top);
  ctx.closePath();
  ctx.fillStyle = look.night ? "#2a0d18" : "#5a1c22";
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = look.night ? "#a6455c" : "#e2697a";
  ctx.beginPath();
  ctx.ellipse(nose.x + 0.01, top + h, w * 0.6, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.restore();
  buckTeeth(ctx, look, { x: nose.x, y: top - 0.008 }, 0.05 + open * 0.035);
}

/* ---------- In mid-air ---------- */

export type LeapPose = {
  /** 1 a plain leap; more stretches the body long at the top of the arc. */
  stretch: number;
  /** Radians: positive dips the nose towards the ground. */
  pitch: number;
  mouth: number;
  menace: number;
  look: Pt;
  time: number;
  wearsHat?: boolean;
};

/**
 * The pounce, drawn side-on: the body flung out long, front paws reaching
 * for the target, hind feet trailing, ears streaming back. The origin is the
 * middle of the body; the head leads towards +x.
 */
export function drawLeapingRabbit(ctx: CanvasRenderingContext2D, look: Look, pose: LeapPose, seed = 1) {
  const r = look.rabbit;
  const paint = { fill: r.fur, shade: r.shade, ink: look.ink, line: LINE, light: look.lightScreen, shadeDepth: 0.075, rim: r.rim ? { color: r.rim, width: 0.024 } : undefined };
  const s = pose.stretch;
  const flutter = Math.sin(pose.time * 13) * 0.05;
  ctx.save();
  ctx.rotate(pose.pitch);

  // Ears stream back from the crown of the head.
  const earRoot = { x: 0.5, y: -0.4 };
  for (const lift of [-0.18, 0.02]) {
    const spine = [
      earRoot,
      { x: earRoot.x - 0.3, y: earRoot.y - 0.3 + lift + flutter },
      { x: earRoot.x - 0.62, y: earRoot.y - 0.42 + lift * 1.6 - flutter },
      { x: earRoot.x - 0.95, y: earRoot.y - 0.38 + lift * 2.2 + flutter * 1.5 },
    ];
    const width = (t: number) => 0.13 + 0.12 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.88));
    paintFigure(ctx, [limb(spine, width, 20)], paint);
    ctx.fillStyle = alpha(r.rage, 0.3 + pose.menace * 0.35);
    tracePath(ctx, [limb(spine.slice(1), (t) => width(t) * 0.45, 16)]);
    ctx.fill();
  }

  // Hind legs flung out behind: a round haunch, a long shin and a big foot on the end.
  const hindLeg = (dy: number, k: number) => [
    ellipse(-0.36, 0.06 + dy, 0.3, 0.25, 0.2),
    limb([{ x: -0.5, y: 0.14 + dy }, { x: -0.66 * s, y: 0.22 + dy }, { x: -0.78 * s, y: 0.3 + dy }], (t) => 0.17 - t * 0.05, 12),
    ellipse(-0.9 * s, 0.38 + dy + k, 0.21, 0.09, 0.55),
  ];
  paintFigure(ctx, hindLeg(0.14, 0.01), { ...paint, fill: r.shade, shade: r.deep });
  paintFigure(ctx, hindLeg(0, 0), paint);
  ctx.fillStyle = alpha(r.innerEar, 0.8);
  for (const [x, y] of [
    [-1.02, 0.47],
    [-0.97, 0.5],
    [-0.91, 0.52],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x * s, y, 0.025, 0.018, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // The body, long in the air, with fur standing up along the back.
  const body = ellipse(0, 0, 0.62 * s, 0.36 / Math.sqrt(s), -0.06);
  const tail = ellipse(-0.6 * s, -0.16, 0.15, 0.14);
  const fur = furTufts([body, tail], { seed, spacing: 0.13, length: 0.045 + pose.menace * 0.02, width: 0.09, where: (e) => e.n.y < 0.2 || e.p.x < -0.4 });
  paintFigure(ctx, [tail, body, ...fur], paint);
  ctx.save();
  ctx.strokeStyle = alpha(look.night ? "#5a6487" : "#a79bb8", 0.8);
  ctx.lineWidth = 0.014;
  ctx.lineCap = "round";
  for (const [x, y] of [
    [-0.2, 0.05],
    [0.05, 0.12],
    [-0.38, -0.06],
    [0.2, -0.05],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x * s - 0.05, y - 0.03);
    ctx.quadraticCurveTo(x * s, y + 0.03, x * s + 0.05, y - 0.03);
    ctx.stroke();
  }
  ctx.restore();

  // Front paws reaching for the target.
  const reachOut = 0.92 + (s - 1) * 0.6;
  const front = [
    limb([{ x: 0.42, y: 0.12 }, { x: 0.68, y: 0.26 }, { x: reachOut, y: 0.32 }], (t) => 0.15 - t * 0.03, 12),
    limb([{ x: 0.36, y: 0.22 }, { x: 0.6, y: 0.4 }, { x: reachOut - 0.08, y: 0.46 }], (t) => 0.14 - t * 0.03, 12),
  ];
  paintFigure(ctx, [front[1]], { ...paint, fill: r.shade, shade: r.deep });
  paintFigure(ctx, [front[0]], paint);

  // The head leads, turned to glare at whoever is underneath; it keeps upright against the dive.
  ctx.save();
  ctx.translate(0.62, -0.2);
  ctx.rotate(-pose.pitch * 0.7);
  ctx.translate(-0.08, 1.0);
  const head = ellipse(0.08, -1.0, 0.37, 0.33);
  const cheeks = [ellipse(-0.16, -0.9, 0.16, 0.12, 0.3), ellipse(0.33, -0.9, 0.15, 0.12, -0.3)];
  const headFur = furTufts([head, ...cheeks], { seed: seed + 5, spacing: 0.13, length: 0.075, width: 0.09 });
  paintFigure(ctx, [head, ...cheeks, ...headFur], paint);
  face(ctx, look, { ...RESTING, menace: pose.menace, mouth: pose.mouth, look: pose.look, time: pose.time });
  if (pose.wearsHat) snatchedHat(ctx, look);
  ctx.restore();
  ctx.restore();
}

/* ---------- Squashed flat ---------- */

/**
 * The rabbit after someone landed on it: flat as a rug on the ground, ears
 * and paws splayed, dizzy eyes and its tongue out. Drawn in ground units
 * (x along the rabbit, y towards the viewer, already foreshortened);
 * `spread` runs 0 to 1 as it flattens.
 */
export function drawFlatRabbit(ctx: CanvasRenderingContext2D, look: Look, spread: number, time: number) {
  const r = look.rabbit;
  const paint = { fill: r.fur, shade: r.shade, ink: look.ink, line: LINE, light: look.lightScreen, shadeDepth: 0.06, rim: r.rim ? { color: r.rim, width: 0.02 } : undefined };
  ctx.save();
  ctx.scale(lerp(0.55, 1, spread), lerp(2.2, 1, spread));

  // The pancake's edge: a darker rim below the top, so it has a little thickness.
  const thickness = ellipse(0, 0.07, 0.98, 0.44);
  paintFigure(ctx, [thickness], { ...paint, fill: r.deep, shade: r.deep });

  const wiggle = Math.sin(time * 6) * 0.02;
  const ears = [
    limb([{ x: 0.95, y: -0.12 }, { x: 1.3, y: -0.3 + wiggle }, { x: 1.62, y: -0.36 }], (t) => 0.2 + 0.1 * Math.sin(Math.PI * t), 16),
    limb([{ x: 0.98, y: 0.1 }, { x: 1.36, y: 0.26 - wiggle }, { x: 1.66, y: 0.36 }], (t) => 0.2 + 0.1 * Math.sin(Math.PI * t), 16),
  ];
  for (const ear of ears) paintFigure(ctx, [ear], paint);
  ctx.fillStyle = alpha(r.innerEar, 0.9);
  for (const [x, y, rot] of [
    [1.32, -0.29, -0.35],
    [1.36, 0.27, 0.35],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 0.22, 0.06, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  const limbs = [
    ellipse(-0.95, -0.3, 0.24, 0.1, -0.5),
    ellipse(-0.98, 0.3, 0.24, 0.1, 0.5),
    ellipse(0.42, -0.42, 0.13, 0.08, -0.9),
    ellipse(0.45, 0.42, 0.13, 0.08, 0.9),
  ];
  for (const paw of limbs) paintFigure(ctx, [paw], paint);
  const tail = ellipse(-1.02, 0, 0.13, 0.11);
  const body = ellipse(0, 0, 0.98, 0.42);
  const head = ellipse(0.82, 0, 0.36, 0.3);
  paintFigure(ctx, [tail, body, head, ...furTufts([tail, body, head], { seed: 41, spacing: 0.22, length: 0.045, width: 0.08 })], paint);

  // Dizzy eyes: two little spirals.
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.022;
  ctx.lineCap = "round";
  for (const [i, y] of [-0.11, 0.11].entries()) {
    ctx.beginPath();
    const spin = time * 5 * (i ? 1 : -1);
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const rr = 0.008 + a * 0.0055;
      const px = 0.86 + Math.cos(a + spin) * rr;
      const py = y + Math.sin(a + spin) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // Nose, and the tongue lolling out of the side.
  ctx.fillStyle = r.nose;
  ctx.beginPath();
  ctx.ellipse(1.13, 0, 0.035, 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.night ? "#c4607a" : "#ef7d8e";
  ctx.beginPath();
  ctx.ellipse(1.12, 0.12, 0.06, 0.035, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
