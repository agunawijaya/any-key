import { css, mix, shade, type Rgb } from "../../scene/color";
import type { Ctx } from "../../scene/paint";
import type { Appearance } from "../../scene/side";
import type { GunPose } from "../types";

/*
 * A Great War field gun side-on, facing right: big spoked wooden wheels, a
 * steel shield, the barrel with its recoil cylinder above it, and the box
 * trail running back to a spade in the mud. Its crew stand round it: one at
 * the sight, one with a round ready, one holding the lanyard. Drawn at any
 * size from the wheel's diameter; elevation turns the barrel, recoil throws
 * it back along its own line.
 */


type GunColors = { steel: Rgb; steelDark: Rgb; wood: Rgb; woodDark: Rgb; iron: Rgb; rim: Rgb; crew: Rgb; crewDark: Rgb };

const COLORS: Record<Appearance, GunColors> = {
  day: {
    steel: [86, 90, 72],
    steelDark: [52, 55, 44],
    wood: [104, 80, 54],
    woodDark: [66, 50, 34],
    iron: [40, 40, 38],
    rim: [236, 228, 208],
    crew: [78, 74, 56],
    crewDark: [50, 47, 36],
  },
  night: {
    steel: [30, 32, 34],
    steelDark: [18, 19, 21],
    wood: [34, 30, 26],
    woodDark: [22, 20, 18],
    iron: [14, 14, 16],
    rim: [120, 130, 156],
    crew: [26, 26, 28],
    crewDark: [16, 16, 18],
  },
};

/** The gun with its crew, standing on the ground at (x, y). `wheel` is the wheel's diameter in pixels. */
export function drawFieldGun(ctx: Ctx, x: number, y: number, wheel: number, pose: GunPose, appearance: Appearance) {
  const c = COLORS[appearance];
  const r = wheel / 2;
  const axle = { x, y: y - r };
  crewMember(ctx, x - wheel * 2.1, y, wheel, c, "kneel");
  trail(ctx, axle, x - wheel * 2.3, y, wheel, c);
  barrel(ctx, axle, wheel, pose, c);
  shield(ctx, axle, wheel, c);
  wheelOf(ctx, axle, r, c);
  crewMember(ctx, x - wheel * 0.95, y, wheel, c, "sight");
  crewMember(ctx, x + wheel * 0.95, y, wheel, c, "stand");
}

/** The muzzle at rest, from the point the gun is drawn at: the barrel pivots above the axle and reaches 1.85 wheels out. */
export function fieldGunMuzzle(wheel: number, elevation: number) {
  const angle = (elevation * Math.PI) / 180;
  return { x: wheel * 0.05 + Math.cos(angle) * wheel * 1.85, y: -wheel * 0.68 - Math.sin(angle) * wheel * 1.85 };
}

function trail(ctx: Ctx, axle: { x: number; y: number }, endX: number, groundY: number, wheel: number, c: GunColors) {
  ctx.fillStyle = css(c.steelDark);
  ctx.beginPath();
  ctx.moveTo(axle.x + wheel * 0.08, axle.y - wheel * 0.06);
  ctx.lineTo(endX + wheel * 0.15, groundY - wheel * 0.12);
  ctx.lineTo(endX, groundY);
  ctx.lineTo(endX + wheel * 0.2, groundY);
  ctx.lineTo(axle.x + wheel * 0.1, axle.y + wheel * 0.12);
  ctx.closePath();
  ctx.fill();
  // The spade dug into the ground.
  ctx.fillStyle = css(c.iron);
  ctx.fillRect(endX - wheel * 0.03, groundY - wheel * 0.18, wheel * 0.06, wheel * 0.22);
}

function barrel(ctx: Ctx, axle: { x: number; y: number }, wheel: number, pose: GunPose, c: GunColors) {
  const angle = (-pose.elevation * Math.PI) / 180;
  const pivot = { x: axle.x + wheel * 0.05, y: axle.y - wheel * 0.18 };
  const length = wheel * 2.3;
  const back = wheel * (0.45 + pose.recoil * 0.4);
  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(angle);
  // Cradle and recoil cylinder.
  ctx.fillStyle = css(c.steelDark);
  ctx.fillRect(-wheel * 0.5, -wheel * 0.05, wheel * 1.25, wheel * 0.16);
  ctx.fillStyle = css(c.steel);
  roundRect(ctx, -back * 0.9, -wheel * 0.2, length * 0.62, wheel * 0.15, wheel * 0.06);
  // The barrel itself, tapering to the muzzle, with the breech block behind.
  ctx.beginPath();
  ctx.moveTo(-back, -wheel * 0.05);
  ctx.lineTo(length - back, -wheel * 0.035);
  ctx.lineTo(length - back, wheel * 0.07);
  ctx.lineTo(-back, wheel * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(c.iron);
  ctx.fillRect(length - back - wheel * 0.05, -wheel * 0.05, wheel * 0.07, wheel * 0.14);
  ctx.fillRect(-back - wheel * 0.12, -wheel * 0.08, wheel * 0.16, wheel * 0.22);
  // Light along the top of the barrel.
  ctx.strokeStyle = css(c.rim, 0.45);
  ctx.lineWidth = Math.max(0.6, wheel * 0.02);
  ctx.beginPath();
  ctx.moveTo(-back, -wheel * 0.2);
  ctx.lineTo(length * 0.62 - back * 0.9, -wheel * 0.2);
  ctx.stroke();
  ctx.restore();
}

function shield(ctx: Ctx, axle: { x: number; y: number }, wheel: number, c: GunColors) {
  // A steel plate, a little tilted back, with a notch for the barrel and a skirt below.
  ctx.fillStyle = css(c.steel);
  ctx.beginPath();
  ctx.moveTo(axle.x + wheel * 0.16, axle.y + wheel * 0.25);
  ctx.lineTo(axle.x + wheel * 0.24, axle.y - wheel * 0.62);
  ctx.lineTo(axle.x + wheel * 0.36, axle.y - wheel * 0.6);
  ctx.lineTo(axle.x + wheel * 0.3, axle.y + wheel * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(c.rim, 0.5);
  ctx.lineWidth = Math.max(0.6, wheel * 0.02);
  ctx.beginPath();
  ctx.moveTo(axle.x + wheel * 0.24, axle.y - wheel * 0.62);
  ctx.lineTo(axle.x + wheel * 0.36, axle.y - wheel * 0.6);
  ctx.stroke();
}

function wheelOf(ctx: Ctx, axle: { x: number; y: number }, r: number, c: GunColors) {
  ctx.save();
  ctx.translate(axle.x, axle.y);
  ctx.strokeStyle = css(c.iron);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0, r - ctx.lineWidth / 2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = css(c.wood);
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.6, r * 0.06);
  ctx.strokeStyle = css(c.woodDark);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16);
    ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = css(c.iron);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Light catching the top of the tyre.
  ctx.strokeStyle = css(c.rim, 0.35);
  ctx.lineWidth = Math.max(0.6, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();
}

type Stance = "stand" | "sight" | "kneel";

/**
 * One of the crew in silhouette: steel helmet, greatcoat, puttees. Simple
 * shapes, no faces; the stance tells the job.
 */
function crewMember(ctx: Ctx, x: number, groundY: number, wheel: number, c: GunColors, stance: Stance) {
  const h = wheel * (stance === "kneel" ? 0.95 : 1.45);
  const body = c.crew;
  ctx.save();
  ctx.fillStyle = css(body);
  ctx.translate(x, groundY);
  const bend = stance === "sight" ? 0.35 : 0;
  // Legs.
  ctx.fillStyle = css(c.crewDark);
  if (stance === "kneel") {
    ctx.fillRect(-h * 0.12, -h * 0.3, h * 0.36, h * 0.12);
    ctx.fillRect(-h * 0.12, -h * 0.3, h * 0.11, h * 0.3);
  } else {
    ctx.fillRect(-h * 0.09, -h * 0.45, h * 0.08, h * 0.45);
    ctx.fillRect(h * 0.02, -h * 0.45, h * 0.08, h * 0.45);
  }
  // Greatcoat, leaning in for the sight.
  ctx.fillStyle = css(body);
  ctx.beginPath();
  const hip = stance === "kneel" ? -h * 0.28 : -h * 0.42;
  ctx.moveTo(-h * 0.14, hip);
  ctx.lineTo(-h * 0.12 + bend * h * 0.5, -h * 0.84);
  ctx.lineTo(h * 0.12 + bend * h * 0.5, -h * 0.84);
  ctx.lineTo(h * 0.15, hip);
  ctx.closePath();
  ctx.fill();
  // Head and the flat brim of the helmet.
  const head = { x: bend * h * 0.55, y: -h * 0.92 };
  ctx.beginPath();
  ctx.arc(head.x, head.y, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(shade(body, 0.8));
  ctx.beginPath();
  ctx.ellipse(head.x, head.y - h * 0.035, h * 0.14, h * 0.04, 0, Math.PI, 0);
  ctx.fill();
  if (stance === "kneel") {
    // Cradling the next round.
    ctx.fillStyle = css(mix(c.wood, [170, 130, 70], 0.4));
    ctx.fillRect(h * 0.1, -h * 0.62, h * 0.32, h * 0.08);
  }
  if (stance === "stand") {
    // An arm out to the lanyard.
    ctx.strokeStyle = css(body);
    ctx.lineWidth = Math.max(0.8, h * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-h * 0.05, -h * 0.72);
    ctx.lineTo(-h * 0.32, -h * 0.55);
    ctx.stroke();
  }
  ctx.strokeStyle = css(c.rim, 0.3);
  ctx.lineWidth = Math.max(0.5, h * 0.02);
  ctx.beginPath();
  ctx.moveTo(-h * 0.12 + bend * h * 0.5, -h * 0.84);
  ctx.lineTo(-h * 0.14, hip);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
