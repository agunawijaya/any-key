/*
 * The player: a small, round-headed kid in a teal bobble hat, a mustard coat
 * and a long red scarf, brave in a way that shows mostly in the eyebrows.
 * Units are the kid's own: feet on (0, 0), about 1.7 tall to the bobble.
 */

import { blobOf, ellipse, furTufts, inkLine, limb, paintFigure, type FigurePaint, type Part } from "./figure";
import type { Look } from "./look";
import { alpha, type Pt } from "./paint";

export type Expression = "brave" | "scared" | "shock" | "joy" | "sheepish";

export type KidPose = {
  face: Expression;
  /** Where the eyes look, -1 to 1 each way. */
  look: Pt;
  /** Mitten positions; the elbows find themselves. */
  hands: { left: Pt; right: Pt };
  legs: "stand" | "sit" | "spread" | "climb";
  /** The scarf's tail streams this way: x sideways, y up when falling. */
  wind: Pt;
  /** Seen from behind, climbing. */
  back: boolean;
  /** Climbing gait, -1 to 1: above 0 the left foot steps up, below 0 the right. */
  stride?: number;
  /** False once the rabbit has snatched the bobble hat. */
  hat?: boolean;
  time: number;
};

export const STANDING: KidPose = {
  face: "brave",
  look: { x: 0, y: 0 },
  hands: { left: { x: -0.33, y: -0.36 }, right: { x: 0.33, y: -0.36 } },
  legs: "stand",
  wind: { x: 0.2, y: 0 },
  back: false,
  time: 0,
};

const LINE = 0.024;
const SHOULDER = { left: { x: -0.2, y: -0.7 }, right: { x: 0.2, y: -0.7 } };
const HEAD = { x: 0, y: -1.13, r: 0.41 };

function paints(look: Look) {
  const k = look.kid;
  const base = { ink: look.ink, line: LINE, light: look.lightScreen, shadeDepth: 0.07, rim: k.rim ? { color: k.rim, width: 0.022 } : undefined };
  return {
    skin: { ...base, fill: k.skin, shade: k.skinShade } satisfies FigurePaint,
    coat: { ...base, fill: k.coat, shade: k.coatShade } satisfies FigurePaint,
    hat: { ...base, fill: k.hat, shade: k.hatShade } satisfies FigurePaint,
    pompom: { ...base, fill: k.pompom, shade: look.night ? "#9fa2b4" : "#d8cdb8" } satisfies FigurePaint,
    scarf: { ...base, fill: k.scarf, shade: look.night ? "#7a2422" : "#a8311f" } satisfies FigurePaint,
    trousers: { ...base, fill: k.trousers, shade: look.night ? "#1b2238" : "#2b3552" } satisfies FigurePaint,
    boots: { ...base, fill: k.boots, shade: look.night ? "#22171a" : "#3f2619" } satisfies FigurePaint,
    pack: { ...base, fill: k.pack, shade: look.night ? "#47302a" : "#674128" } satisfies FigurePaint,
    mitten: { ...base, fill: k.hat, shade: k.hatShade, shadeDepth: 0.03 } satisfies FigurePaint,
  };
}

/** An arm from the shoulder to the mitten, bending at an elbow that sits outside the straight line. */
function arm(shoulder: Pt, hand: Pt, side: -1 | 1): Part {
  const mid = { x: (shoulder.x + hand.x) / 2, y: (shoulder.y + hand.y) / 2 };
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.max(0, 0.42 - len) * 0.6 + 0.03;
  const elbow = { x: mid.x + (-dy / len) * bend * -side, y: mid.y + (dx / len) * bend * -side };
  return limb([shoulder, elbow, hand], (t) => 0.135 - t * 0.02, 14);
}

/** One leg on the ladder: hanging straight, or knee up to the next rung as `lift` goes to 1. */
function climbingLeg(side: -1 | 1, lift: number) {
  const mix = (down: number, up: number) => down + (up - down) * lift;
  const knee = { x: side * mix(0.12, 0.2), y: mix(-0.24, -0.44) };
  const ankle = { x: side * mix(0.12, 0.17), y: mix(-0.08, -0.28) };
  return {
    leg: limb([{ x: side * 0.1, y: -0.4 }, knee, ankle], () => 0.13, 10),
    boot: ellipse(side * mix(0.13, 0.17), mix(-0.04, -0.22), 0.12, 0.07),
  };
}

function legParts(legs: KidPose["legs"], stride = 0): { legs: Part[]; boots: Part[] } {
  switch (legs) {
    case "sit":
      // Sitting with legs stuck out towards us: short foreshortened legs and the soles of the boots.
      return {
        legs: [limb([{ x: -0.12, y: -0.2 }, { x: -0.19, y: -0.1 }, { x: -0.23, y: -0.02 }], () => 0.16, 10), limb([{ x: 0.12, y: -0.2 }, { x: 0.19, y: -0.1 }, { x: 0.24, y: -0.03 }], () => 0.16, 10)],
        boots: [ellipse(-0.25, 0.02, 0.11, 0.14, 0.25), ellipse(0.27, 0.01, 0.11, 0.14, -0.25)],
      };
    case "spread":
      return {
        legs: [limb([{ x: -0.1, y: -0.4 }, { x: -0.25, y: -0.22 }, { x: -0.36, y: -0.1 }], () => 0.13, 10), limb([{ x: 0.1, y: -0.4 }, { x: 0.25, y: -0.24 }, { x: 0.38, y: -0.14 }], () => 0.13, 10)],
        boots: [ellipse(-0.42, -0.04, 0.13, 0.075, -0.6), ellipse(0.45, -0.08, 0.13, 0.075, 0.6)],
      };
    case "climb": {
      // Left and right take turns stepping up a rung.
      const left = climbingLeg(-1, Math.max(0, stride));
      const right = climbingLeg(1, Math.max(0, -stride));
      return { legs: [left.leg, right.leg], boots: [left.boot, right.boot] };
    }
    default:
      return {
        legs: [limb([{ x: -0.1, y: -0.4 }, { x: -0.11, y: -0.22 }, { x: -0.12, y: -0.08 }], () => 0.13, 10), limb([{ x: 0.1, y: -0.4 }, { x: 0.11, y: -0.22 }, { x: 0.12, y: -0.08 }], () => 0.13, 10)],
        boots: [ellipse(-0.15, -0.05, 0.13, 0.075, -0.1), ellipse(0.15, -0.05, 0.13, 0.075, 0.1)],
      };
  }
}

const coatShape = (): Part =>
  blobOf([
    { x: -0.14, y: -0.8 },
    { x: -0.25, y: -0.7 },
    { x: -0.29, y: -0.5 },
    { x: -0.33, y: -0.34 },
    { x: -0.12, y: -0.3 },
    { x: 0.12, y: -0.3 },
    { x: 0.33, y: -0.34 },
    { x: 0.29, y: -0.5 },
    { x: 0.25, y: -0.7 },
    { x: 0.14, y: -0.8 },
  ]);

function scarfTail(wind: Pt, time: number): Part {
  const flap = Math.sin(time * 9) * 0.05 * Math.hypot(wind.x, wind.y);
  const root = { x: 0.13, y: -0.76 };
  const reach = 0.42;
  const tipX = root.x + 0.04 + wind.x * reach;
  const tipY = root.y + 0.3 * (1 - Math.min(1, Math.abs(wind.x) + Math.max(0, wind.y))) - wind.y * reach;
  const mid = { x: (root.x + tipX) / 2 + flap, y: (root.y + tipY) / 2 + 0.05 - flap };
  return limb([root, mid, { x: tipX, y: tipY + flap }], (t) => 0.12 - t * 0.02, 14);
}

function scarfStripes(ctx: CanvasRenderingContext2D, look: Look, tail: Part) {
  // Stripes across the tail, clipped to it: two cream bands near the end.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tail[0].x, tail[0].y);
  for (const p of tail) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.clip();
  const half = Math.floor(tail.length / 2);
  const tip = tail[Math.floor(half * 0.5)];
  const root = tail[0];
  const dx = tip.x - root.x;
  const dy = tip.y - root.y;
  ctx.strokeStyle = look.kid.scarfStripe;
  ctx.lineWidth = 0.035;
  for (const t of [0.62, 0.8]) {
    const c = { x: root.x + dx * t, y: root.y + dy * t };
    ctx.beginPath();
    ctx.moveTo(c.x - dy * 0.6, c.y + dx * 0.6);
    ctx.lineTo(c.x + dy * 0.6, c.y - dx * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** The kid, in any pose. */
export function drawKid(ctx: CanvasRenderingContext2D, look: Look, pose: KidPose) {
  const p = paints(look);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const { legs, boots } = legParts(pose.legs, pose.stride);
  const tail = scarfTail(pose.wind, pose.time);
  const flyingBack = pose.back || pose.wind.y > 0.3;
  if (flyingBack) {
    paintFigure(ctx, [tail], p.scarf);
    scarfStripes(ctx, look, tail);
  }

  const seated = pose.legs === "sit";
  if (!seated) {
    for (const leg of legs) paintFigure(ctx, [leg], p.trousers);
    for (const boot of boots) paintFigure(ctx, [boot], p.boots);
  }
  // Seated, the body sinks down onto its seat; the legs come after, in front of the coat.
  ctx.save();
  if (seated) ctx.translate(0, 0.17);

  const handsBehind = pose.back;
  if (handsBehind) drawArms(ctx, pose, p);

  paintFigure(ctx, [coatShape()], p.coat);
  if (pose.back) backpack(ctx, look, p.pack);
  else coatDetails(ctx, look);

  if (look.night && !pose.back) lantern(ctx, look, pose.time);
  if (!handsBehind) drawArms(ctx, pose, p);

  // The scarf wraps the neck; its tail hangs in front unless the wind takes it behind.
  const wrap = ellipse(0, -0.78, 0.22, 0.075);
  paintFigure(ctx, [wrap], p.scarf);
  if (!flyingBack) {
    paintFigure(ctx, [tail], p.scarf);
    scarfStripes(ctx, look, tail);
  }

  head(ctx, look, pose, p);
  ctx.restore();
  if (seated) {
    for (const leg of legs) paintFigure(ctx, [leg], p.trousers);
    for (const boot of boots) {
      paintFigure(ctx, [boot], p.boots);
      soleTread(ctx, look, boot);
    }
  }
  ctx.restore();
}

function soleTread(ctx: CanvasRenderingContext2D, look: Look, boot: Part) {
  const box = { x: 0, y: 0 };
  for (const p of boot) {
    box.x += p.x / boot.length;
    box.y += p.y / boot.length;
  }
  ctx.strokeStyle = alpha(look.ink, 0.55);
  ctx.lineWidth = 0.018;
  for (const dy of [-0.05, 0, 0.05]) {
    ctx.beginPath();
    ctx.moveTo(box.x - 0.05, box.y + dy);
    ctx.lineTo(box.x + 0.05, box.y + dy);
    ctx.stroke();
  }
}

/** By night the kid carries a little lantern on their belt: the one warm light in the pit. */
function lantern(ctx: CanvasRenderingContext2D, look: Look, time: number) {
  const sway = Math.sin(time * 2.2) * 0.08;
  ctx.save();
  ctx.translate(0.3, -0.5);
  ctx.rotate(sway);
  const flicker = 0.9 + Math.sin(time * 17) * 0.05 + Math.sin(time * 7.3) * 0.05;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(0, 0.16, 0, 0, 0.16, 0.75);
  halo.addColorStop(0, alpha("#ffb54a", 0.55 * flicker));
  halo.addColorStop(0.35, alpha("#ff9a3a", 0.16 * flicker));
  halo.addColorStop(1, alpha("#ff9a3a", 0));
  ctx.fillStyle = halo;
  ctx.fillRect(-0.8, -0.6, 1.6, 1.6);
  ctx.restore();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.arc(0, 0, 0.06, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.roundRect(-0.075, 0.04, 0.15, 0.2, 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff6d0";
  ctx.beginPath();
  ctx.ellipse(0, 0.15, 0.025, 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b5236";
  ctx.fillRect(-0.09, 0.02, 0.18, 0.035);
  ctx.fillRect(-0.09, 0.235, 0.18, 0.035);
  ctx.restore();
}

function drawArms(ctx: CanvasRenderingContext2D, pose: KidPose, p: ReturnType<typeof paints>) {
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? -1 : 1;
    paintFigure(ctx, [arm(SHOULDER[side], pose.hands[side], sign)], p.coat);
    paintFigure(ctx, [ellipse(pose.hands[side].x, pose.hands[side].y, 0.075, 0.07)], p.mitten);
  }
}

function coatDetails(ctx: CanvasRenderingContext2D, look: Look) {
  ctx.fillStyle = look.ink;
  for (const y of [-0.6, -0.46]) {
    ctx.beginPath();
    ctx.arc(0.02, y, 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  // A seam down the front and a pocket.
  inkLine(ctx, [{ x: 0.0, y: -0.7 }, { x: 0.01, y: -0.32 }], 0.012, alpha(look.night ? "#0d1324" : "#3a271d", 0.5));
  inkLine(ctx, [{ x: -0.24, y: -0.48 }, { x: -0.12, y: -0.47 }], 0.014, alpha(look.night ? "#0d1324" : "#3a271d", 0.7));
}

function backpack(ctx: CanvasRenderingContext2D, look: Look, paint: FigurePaint) {
  const bag = blobOf([
    { x: -0.2, y: -0.72 },
    { x: 0.2, y: -0.72 },
    { x: 0.23, y: -0.45 },
    { x: 0.18, y: -0.36 },
    { x: -0.18, y: -0.36 },
    { x: -0.23, y: -0.45 },
  ]);
  paintFigure(ctx, [bag], paint);
  const flap = blobOf([
    { x: -0.19, y: -0.71 },
    { x: 0.19, y: -0.71 },
    { x: 0.17, y: -0.56 },
    { x: 0, y: -0.52 },
    { x: -0.17, y: -0.56 },
  ]);
  paintFigure(ctx, [flap], { ...paint, shadeDepth: 0.03 });
  ctx.fillStyle = look.night ? "#c9b27a" : "#e9c35a";
  ctx.beginPath();
  ctx.roundRect(-0.03, -0.56, 0.06, 0.05, 0.01);
  ctx.fill();
}

function head(ctx: CanvasRenderingContext2D, look: Look, pose: KidPose, p: ReturnType<typeof paints>) {
  const { x, y, r } = HEAD;
  const ears = [ellipse(x - r * 0.97, y + 0.06, 0.075, 0.09), ellipse(x + r * 0.97, y + 0.06, 0.075, 0.09)];
  paintFigure(ctx, [ellipse(x, y, r, r * 0.96), ...ears], p.skin);

  // Hair peeking out under the hat.
  const hair = look.night ? "#2a1a1c" : "#5a3424";
  ctx.fillStyle = hair;
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = LINE;
  if (pose.back) {
    ctx.beginPath();
    ctx.ellipse(x, y + 0.02, r * 0.93, r * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const [hx, hy, rot] of [
      [-0.25, -1.36, -0.5],
      [-0.12, -1.38, 0.2],
      [0.24, -1.36, 0.6],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(hx, hy, 0.08, 0.05, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (pose.hat === false) messyHair(ctx, look, hair);
  else bobbleHat(ctx, look);

  if (!pose.back) face(ctx, look, pose);
}

/**
 * The bobble hat: a soft dome, a turned-up cuff and a bobble, in the kid's own
 * units (its cuff sits at y -1.22). Exported so the rabbit can wear it after
 * snatching it.
 */
export function bobbleHat(ctx: CanvasRenderingContext2D, look: Look) {
  const p = paints(look);
  const dome = blobOf([
    { x: -0.4, y: -1.24 },
    { x: -0.38, y: -1.45 },
    { x: -0.18, y: -1.62 },
    { x: 0.08, y: -1.66 },
    { x: 0.3, y: -1.55 },
    { x: 0.41, y: -1.38 },
    { x: 0.41, y: -1.24 },
    { x: 0, y: -1.22 },
  ]);
  paintFigure(ctx, [dome], p.hat);
  ribs(ctx, look, -1.6, -1.3);
  const cuff = blobOf([
    { x: -0.44, y: -1.34 },
    { x: 0, y: -1.37 },
    { x: 0.45, y: -1.34 },
    { x: 0.45, y: -1.22 },
    { x: 0, y: -1.2 },
    { x: -0.44, y: -1.22 },
  ]);
  paintFigure(ctx, [cuff], { ...p.hat, fill: look.kid.hatShade, shade: look.night ? "#123c40" : "#185653", shadeDepth: 0.03 });
  const bobble = ellipse(0.08, -1.7, 0.12, 0.11);
  paintFigure(ctx, [bobble, ...furTufts([bobble], { seed: 9, spacing: 0.06, length: 0.04, width: 0.05 })], p.pompom);
}

/** Without the hat: a mop of hair, a little startled. */
function messyHair(ctx: CanvasRenderingContext2D, look: Look, hair: string) {
  const mop = blobOf([
    { x: -0.42, y: -1.12 },
    { x: -0.4, y: -1.38 },
    { x: -0.22, y: -1.56 },
    { x: 0.05, y: -1.6 },
    { x: 0.3, y: -1.5 },
    { x: 0.42, y: -1.3 },
    { x: 0.42, y: -1.1 },
    { x: 0.2, y: -1.28 },
    { x: -0.05, y: -1.24 },
    { x: -0.25, y: -1.3 },
  ]);
  paintFigure(ctx, [mop, ...furTufts([mop], { seed: 4, spacing: 0.1, length: 0.07, width: 0.08, where: (e) => e.n.y < 0 })], {
    fill: hair,
    shade: look.night ? "#140c0e" : "#3a2116",
    ink: look.ink,
    line: LINE,
    light: look.lightScreen,
    shadeDepth: 0.05,
  });
}

function ribs(ctx: CanvasRenderingContext2D, look: Look, top: number, bottom: number) {
  ctx.save();
  ctx.strokeStyle = alpha(look.night ? "#0d1324" : "#14423f", 0.35);
  ctx.lineWidth = 0.014;
  for (const x of [-0.24, -0.08, 0.08, 0.24]) {
    ctx.beginPath();
    ctx.moveTo(x * 0.85, top + 0.1 + Math.abs(x) * 0.3);
    ctx.quadraticCurveTo(x * 1.05, (top + bottom) / 2, x * 1.1, bottom);
    ctx.stroke();
  }
  ctx.restore();
}

function face(ctx: CanvasRenderingContext2D, look: Look, pose: KidPose) {
  const ink = look.ink;
  const lookAt = pose.look;
  const eyeY = -1.06;
  const eyes = [-0.15, 0.15];

  // Cheeks.
  ctx.fillStyle = alpha(look.kid.cheek, pose.face === "scared" ? 0.25 : 0.55);
  for (const ex of eyes) {
    ctx.beginPath();
    ctx.ellipse(ex * 1.55, -0.95, 0.075, 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const wide = pose.face === "scared" || pose.face === "shock";
  for (const [i, ex] of eyes.entries()) {
    if (pose.face === "joy") {
      // Happy eyes squeeze shut into little arches.
      inkLine(ctx, [{ x: ex - 0.06, y: eyeY + 0.02 }, { x: ex, y: eyeY - 0.04 }, { x: ex + 0.06, y: eyeY + 0.02 }], 0.03, ink);
      continue;
    }
    if (wide) {
      ctx.fillStyle = "#fffdf7";
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 0.075, 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(ex + lookAt.x * 0.03, eyeY + lookAt.y * 0.035, pose.face === "shock" ? 0.022 : 0.03, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(ex + lookAt.x * 0.02, eyeY + lookAt.y * 0.02, 0.045, 0.062, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex + lookAt.x * 0.02 - 0.014, eyeY + lookAt.y * 0.02 - 0.022, 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
    // Brows carry most of the feeling.
    const side = i === 0 ? -1 : 1;
    const brow = BROWS[pose.face];
    inkLine(
      ctx,
      [
        { x: ex - 0.07, y: eyeY - 0.13 + brow.inner * (side < 0 ? 0 : 1) + brow.outer * (side < 0 ? 1 : 0) },
        { x: ex, y: eyeY - 0.15 + brow.mid },
        { x: ex + 0.07, y: eyeY - 0.13 + brow.inner * (side < 0 ? 1 : 0) + brow.outer * (side < 0 ? 0 : 1) },
      ],
      0.028,
      ink,
    );
  }

  // Nose: a small arch.
  inkLine(ctx, [{ x: -0.02, y: -0.97 }, { x: 0.0, y: -0.955 }, { x: 0.025, y: -0.97 }], 0.018, alpha(look.night ? "#0d1324" : "#3a271d", 0.75));
  mouth(ctx, look, pose.face);
}

/** Brow heights for each feeling: negative raises an end. */
const BROWS: Record<Expression, { inner: number; outer: number; mid: number }> = {
  brave: { inner: 0.03, outer: -0.01, mid: 0.0 },
  scared: { inner: -0.05, outer: 0.03, mid: -0.03 },
  shock: { inner: -0.04, outer: -0.02, mid: -0.05 },
  joy: { inner: -0.01, outer: 0.0, mid: -0.03 },
  sheepish: { inner: -0.03, outer: 0.02, mid: -0.01 },
};

function mouth(ctx: CanvasRenderingContext2D, look: Look, expression: Expression) {
  const ink = look.ink;
  const y = -0.87;
  ctx.lineWidth = 0.022;
  ctx.strokeStyle = ink;
  switch (expression) {
    case "brave":
      inkLine(ctx, [{ x: -0.07, y: y - 0.005 }, { x: 0, y: y + 0.012 }, { x: 0.08, y: y - 0.02 }], 0.024, ink);
      break;
    case "sheepish":
      inkLine(ctx, [{ x: -0.08, y: y }, { x: -0.02, y: y + 0.03 }, { x: 0.05, y: y + 0.02 }, { x: 0.09, y: y - 0.02 }], 0.024, ink);
      break;
    case "scared":
      // A wobbly mouth with a glimpse of teeth.
      ctx.fillStyle = look.night ? "#3a1620" : "#6e2a2a";
      ctx.beginPath();
      ctx.moveTo(-0.09, y + 0.005);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-0.09 + i * 0.03, y + (i % 2 ? -0.012 : 0.008));
      ctx.lineTo(0.09, y + 0.045);
      ctx.quadraticCurveTo(0, y + 0.075, -0.09, y + 0.045);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "shock":
      ctx.fillStyle = look.night ? "#3a1620" : "#6e2a2a";
      ctx.beginPath();
      ctx.ellipse(0, y + 0.03, 0.05, 0.065, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case "joy":
      ctx.fillStyle = look.night ? "#3a1620" : "#6e2a2a";
      ctx.beginPath();
      ctx.moveTo(-0.11, y - 0.02);
      ctx.quadraticCurveTo(0, y - 0.005, 0.11, y - 0.02);
      ctx.quadraticCurveTo(0.08, y + 0.1, 0, y + 0.1);
      ctx.quadraticCurveTo(-0.08, y + 0.1, -0.11, y - 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = look.night ? "#b75a6e" : "#ec7f86";
      ctx.beginPath();
      ctx.ellipse(0, y + 0.1, 0.06, 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.stroke();
      break;
  }
}
