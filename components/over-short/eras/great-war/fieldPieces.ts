import { css, mix, shade, type Rgb } from "../../scene/color";
import { dab, type Ctx } from "../../scene/paint";
import type { Appearance } from "../../scene/side";
import type { BridgeGeometry, RiverGeometry, TeamPose } from "../types";
import { paletteFor } from "./palette";

/*
 * What Field Artillery adds to the Great War's side view: a river in its
 * valley with the star shells shaking on it, a stone viaduct carrying the
 * road across from rim to rim, lorries side-on, and the team of horses and
 * the limber that move the gun. All drawn far larger than life, like the
 * gun, so they read across kilometres of land.
 */

/** Dark water between the banks, and every light in the sky laid on it in broken streaks. */
export function drawRiver(ctx: Ctx, river: RiverGeometry, appearance: Appearance) {
  const { left, right, surface, bed, bankY, lights, time, moonlit } = river;
  const night = appearance === "night";
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, bed);
  for (let x = left; x <= right; x += 3) ctx.lineTo(x, Math.max(surface, bankY(x)));
  ctx.lineTo(right, bed);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, surface, 0, bed);
  const pal = paletteFor(appearance);
  g.addColorStop(0, night ? (moonlit ? "rgb(70 82 104)" : "rgb(40 48 64)") : css(mix(pal.water, pal.skyLow, 0.35)));
  g.addColorStop(1, night ? "rgb(12 14 20)" : css(shade(pal.water, 0.55)));
  ctx.fillStyle = g;
  ctx.fillRect(left, surface - 2, right - left, bed - surface + 2);
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    for (let k = 0; k < 12; k++) {
      const y = surface + 1 + k * ((bed - surface) / 12);
      const reach = (bed - surface) * (0.8 + k * 0.45) * (0.7 + 0.3 * Math.sin(time * 2.1 + k * 2.3));
      const shift = Math.sin(time * 3.3 + k * 1.7) * (bed - surface) * 0.2;
      ctx.fillStyle = `rgb(225 234 255 / ${(night ? 0.42 : 0.18) * light.intensity * (1 - k / 13)})`;
      ctx.fillRect(light.x - reach + shift, y, reach * 2, Math.max(1, (bed - surface) * 0.06));
    }
  }
  ctx.restore();
}

/**
 * A stone viaduct across a valley, its piers standing on the slopes and in
 * the river. Damaged, a bite out of the parapet and a scorch; destroyed,
 * the middle arch gone into the water.
 */
export function drawBridge(ctx: Ctx, bridge: BridgeGeometry, appearance: Appearance) {
  const { x0, x1, deckY, footY, light, state } = bridge;
  const night = appearance === "night";
  const day: Rgb = mix([150, 142, 124], paletteFor("day").mud, 0.2);
  const stone = night ? mix([30, 32, 38], [108, 110, 118], light * 0.8) : day;
  const arches = 5;
  const pier = (x1 - x0) * 0.05;
  const span = (x1 - x0 - pier * (arches + 1)) / arches;
  const springY = deckY + bridge.scale * 0.024;
  const rise = bridge.scale * 0.015;
  const gone = state === "destroyed" ? 2 : -1;
  const outline = new Path2D();
  outline.moveTo(x0, deckY);
  const gapFrom = x0 + gone * (span + pier) + pier;
  const gapTo = gapFrom + span;
  if (gone >= 0) {
    // The fallen span: the deck stops short with a jagged edge either side.
    outline.lineTo(gapFrom - span * 0.08, deckY);
    outline.lineTo(gapFrom + span * 0.05, deckY + rise * 1.6);
    outline.lineTo(gapFrom, springY);
    outline.moveTo(gapTo, springY);
    outline.lineTo(gapTo - span * 0.06, deckY + rise * 1.4);
    outline.lineTo(gapTo + span * 0.1, deckY);
  }
  outline.lineTo(x1, deckY);
  for (let k = arches; k >= 0; k--) {
    const right = x0 + k * (span + pier) + pier;
    const left = right - pier;
    const foot = footY(left + pier / 2);
    outline.lineTo(right, Math.max(springY, foot));
    outline.lineTo(right, foot);
    outline.lineTo(left, foot);
    outline.lineTo(left, Math.min(springY, foot));
    if (k > 0 && k - 1 !== gone) outline.ellipse(left - span / 2, springY, span / 2, rise, 0, 0, Math.PI, true);
    else if (k > 0) outline.lineTo(left - span, springY);
  }
  outline.closePath();
  ctx.save();
  const g = ctx.createLinearGradient(0, deckY, 0, springY + bridge.scale * 0.04);
  g.addColorStop(0, css(shade(stone, 1.15)));
  g.addColorStop(1, css(shade(stone, 0.7)));
  ctx.fillStyle = g;
  ctx.fill(outline, "evenodd");
  ctx.strokeStyle = css(shade(stone, 1.35), 0.55);
  ctx.lineWidth = Math.max(1, bridge.scale * 0.0016);
  for (let k = 1; k <= arches; k++) {
    if (k - 1 === gone) continue;
    const left = x0 + k * (span + pier);
    ctx.beginPath();
    ctx.ellipse(left - span / 2, springY, span / 2 + 1.5, rise + 1.5, 0, 0, Math.PI, true);
    ctx.stroke();
  }
  // The parapet, its top edge lit from above; a bite out of it once hit.
  const parapet = bridge.scale * 0.007;
  ctx.fillStyle = css(shade(stone, 1.2));
  const bite = state === "damaged" ? [x0 + (x1 - x0) * 0.46, x0 + (x1 - x0) * 0.56] : null;
  const runs: [number, number][] = gone >= 0 ? [[x0 - 3, gapFrom - span * 0.08], [gapTo + span * 0.1, x1 + 3]] : bite ? [[x0 - 3, bite[0]], [bite[1], x1 + 3]] : [[x0 - 3, x1 + 3]];
  for (const [a, b] of runs) ctx.fillRect(a, deckY - parapet, b - a, parapet);
  ctx.strokeStyle = night ? css([230, 236, 252], 0.2 + light * 0.6) : css([255, 250, 238], 0.45);
  ctx.lineWidth = 1.5;
  for (const [a, b] of runs) {
    ctx.beginPath();
    ctx.moveTo(a, deckY - parapet);
    ctx.lineTo(b, deckY - parapet);
    ctx.stroke();
  }
  if (bite) dab(ctx, (bite[0] + bite[1]) / 2, deckY + rise, (bite[1] - bite[0]) * 0.8, [26, 22, 18], 0.5, 0.7);
  ctx.restore();
}

/** A lorry side-on, facing left or right, `s` pixels a metre (drawn far larger than life). */
export function drawLorrySide(ctx: Ctx, x: number, roadY: number, s: number, facing: 1 | -1, appearance: Appearance, light: number, wrecked: boolean) {
  const night = appearance === "night";
  const dark: Rgb = night ? [12, 13, 16] : [44, 42, 36];
  const body = wrecked ? [26, 22, 20] : night ? mix(dark, [62, 64, 56], light * 0.5) : ([86, 88, 66] as Rgb);
  const tilt = wrecked ? [34, 28, 24] : night ? mix([18, 19, 22], [104, 102, 90], light * 0.55) : ([150, 142, 112] as Rgb);
  ctx.save();
  ctx.translate(x, roadY);
  ctx.scale(-facing, 1);
  if (wrecked) ctx.rotate(-0.08);
  ctx.fillStyle = css(dark);
  for (const wx of [-1.7, 1.7]) {
    ctx.beginPath();
    ctx.arc(wx * s, -s * 0.55, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = css(body as Rgb);
  ctx.fillRect(-s * 2.6, -s * 1.4, s * 5.3, s * 0.6);
  // Bonnet and cab at the front (to the left before the mirror).
  ctx.beginPath();
  ctx.moveTo(-s * 2.9, -s * 1.3);
  ctx.lineTo(-s * 2.9, -s * 2.0);
  ctx.lineTo(-s * 2.0, -s * 2.15);
  ctx.lineTo(-s * 1.75, -s * 3.0);
  ctx.lineTo(-s * 0.85, -s * 3.0);
  ctx.lineTo(-s * 0.85, -s * 1.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(tilt as Rgb);
  ctx.beginPath();
  ctx.moveTo(-s * 0.65, -s * 1.4);
  ctx.lineTo(-s * 0.65, -s * 3.05);
  ctx.quadraticCurveTo(s * 1.0, -s * 3.55, s * 2.7, -s * 3.05);
  ctx.lineTo(s * 2.7, -s * 1.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = night ? css([236, 240, 252], 0.15 + light * 0.55) : css([250, 246, 232], 0.4);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.65, -s * 3.05);
  ctx.quadraticCurveTo(s * 1.0, -s * 3.55, s * 2.7, -s * 3.05);
  ctx.stroke();
  ctx.restore();
  // A hooded headlamp at night: a slit of warm light and a little pool on the road ahead.
  if (night && !wrecked) {
    dab(ctx, x - facing * s * 2.95, roadY - s * 1.7, s * 0.7, [255, 200, 130], 0.8, 0.45);
    dab(ctx, x - facing * s * 4.2, roadY - s * 0.2, s * 1.8, [255, 190, 120], 0.16, 0.25);
  }
}

/* ---------- The team that moves the gun ---------- */

type HorseColors = { coat: Rgb; dark: Rgb; harness: Rgb; rider: Rgb; wood: Rgb; iron: Rgb; rim: Rgb };

const TEAM: Record<Appearance, HorseColors> = {
  day: { coat: [96, 70, 50], dark: [62, 44, 32], harness: [40, 34, 28], rider: [78, 74, 56], wood: [104, 80, 54], iron: [40, 40, 38], rim: [236, 228, 208] },
  night: { coat: [34, 30, 28], dark: [20, 18, 17], harness: [14, 13, 12], rider: [26, 26, 28], wood: [34, 30, 26], iron: [14, 14, 16], rim: [120, 130, 156] },
};

/**
 * One horse side-on, facing left, standing on (0, 0) with a body `h` long;
 * `phase` (0–1) moves its legs through a walk.
 */
function horse(ctx: Ctx, h: number, phase: number, c: HorseColors) {
  const leg = (x: number, swing: number, colour: Rgb) => {
    ctx.strokeStyle = css(colour);
    ctx.lineWidth = Math.max(1, h * 0.09);
    ctx.lineCap = "round";
    const knee = { x: x + swing * h * 0.12, y: -h * 0.32 };
    const hoof = { x: x + swing * h * 0.22, y: Math.min(0, -Math.max(0, swing) * h * 0.06) };
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.58);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(hoof.x, hoof.y);
    ctx.stroke();
  };
  const a = Math.sin(phase * Math.PI * 2);
  const b = Math.sin(phase * Math.PI * 2 + Math.PI);
  // Far legs first, darker; then the body; then the near legs.
  leg(-h * 0.36, -b, c.dark);
  leg(h * 0.34, -a, c.dark);
  ctx.fillStyle = css(c.coat);
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.66, h * 0.48, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Neck and head, reaching forward and down a little at the walk.
  const nod = Math.sin(phase * Math.PI * 4) * h * 0.02;
  ctx.beginPath();
  ctx.moveTo(-h * 0.3, -h * 0.74);
  ctx.quadraticCurveTo(-h * 0.5, -h * 1.0, -h * 0.62, -h * 1.02 + nod);
  ctx.lineTo(-h * 0.8, -h * 0.86 + nod);
  ctx.lineTo(-h * 0.74, -h * 0.8 + nod);
  ctx.lineTo(-h * 0.5, -h * 0.84);
  ctx.lineTo(-h * 0.36, -h * 0.56);
  ctx.closePath();
  ctx.fill();
  // Tail.
  ctx.strokeStyle = css(c.dark);
  ctx.lineWidth = Math.max(1, h * 0.07);
  ctx.beginPath();
  ctx.moveTo(h * 0.46, -h * 0.72);
  ctx.quadraticCurveTo(h * 0.6, -h * 0.6, h * 0.56, -h * 0.4);
  ctx.stroke();
  leg(-h * 0.3, a, c.coat);
  leg(h * 0.38, b, c.coat);
  // Collar and traces.
  ctx.strokeStyle = css(c.harness);
  ctx.lineWidth = Math.max(1, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(-h * 0.36, -h * 0.82);
  ctx.lineTo(-h * 0.3, -h * 0.58);
  ctx.moveTo(-h * 0.3, -h * 0.66);
  ctx.lineTo(h * 0.9, -h * 0.64);
  ctx.stroke();
  ctx.strokeStyle = css(c.rim, 0.35);
  ctx.lineWidth = Math.max(0.6, h * 0.025);
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.66, h * 0.48, h * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

/** A driver astride the near horse: helmet, greatcoat, a whip held up. */
function rider(ctx: Ctx, h: number, c: HorseColors) {
  ctx.fillStyle = css(c.rider);
  ctx.beginPath();
  ctx.moveTo(-h * 0.12, -h * 0.82);
  ctx.lineTo(-h * 0.08, -h * 1.22);
  ctx.lineTo(h * 0.1, -h * 1.22);
  ctx.lineTo(h * 0.14, -h * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -h * 1.3, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(shade(c.rider, 0.7));
  ctx.fillRect(-h * 0.14, -h * 1.37, h * 0.28, h * 0.035);
  ctx.strokeStyle = css(c.rider);
  ctx.lineWidth = Math.max(1, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(-h * 0.06, -h * 0.82);
  ctx.lineTo(-h * 0.12, -h * 0.62);
  ctx.stroke();
  ctx.strokeStyle = css(c.harness);
  ctx.lineWidth = Math.max(0.6, h * 0.02);
  ctx.beginPath();
  ctx.moveTo(-h * 0.04, -h * 1.12);
  ctx.quadraticCurveTo(-h * 0.2, -h * 1.5, -h * 0.4, -h * 1.45);
  ctx.stroke();
}

/**
 * The gun's team, facing left the way they will haul it: two pairs of
 * horses, a driver on each near horse, and the two-wheeled limber whose
 * hook takes the end of the gun's trail at (x, y). `wheel` is the gun's
 * wheel, so the team is drawn at the gun's scale.
 */
export function drawTeam(ctx: Ctx, x: number, y: number, wheel: number, pose: TeamPose, appearance: Appearance) {
  const c = TEAM[appearance];
  const h = wheel * 1.25;
  ctx.save();
  ctx.translate(x, y);
  // The limber: an ammunition box on two wheels, its pole forward to the wheelers.
  const limberX = -wheel * 0.9;
  ctx.fillStyle = css(c.wood);
  ctx.fillRect(limberX - wheel * 0.6, -wheel * 1.05, wheel * 1.1, wheel * 0.55);
  ctx.fillStyle = css(shade(c.wood, 0.7));
  ctx.fillRect(limberX - wheel * 0.6, -wheel * 0.55, wheel * 1.1, wheel * 0.08);
  ctx.strokeStyle = css(c.iron);
  ctx.lineWidth = Math.max(1, wheel * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -wheel * 0.25);
  ctx.lineTo(limberX + wheel * 0.5, -wheel * 0.45);
  ctx.moveTo(limberX - wheel * 0.6, -wheel * 0.6);
  ctx.lineTo(limberX - wheel * 2.2, -wheel * 0.75);
  ctx.stroke();
  const r = wheel * 0.45;
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  ctx.arc(limberX, -r, Math.max(0, r - ctx.lineWidth / 2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = css(c.wood);
  ctx.lineWidth = Math.max(0.6, r * 0.08);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + pose.wheelTurn;
    ctx.beginPath();
    ctx.moveTo(limberX, -r);
    ctx.lineTo(limberX + Math.cos(a) * r * 0.85, -r + Math.sin(a) * r * 0.85);
    ctx.stroke();
  }
  // The wheelers, then the leaders ahead of them, each with a driver.
  for (const [k, offset] of [
    [0, -wheel * 2.9],
    [1, -wheel * 5.0],
  ] as const) {
    ctx.save();
    ctx.translate(offset, 0);
    horse(ctx, h, (pose.step + k * 0.25) % 1, c);
    rider(ctx, h, c);
    ctx.restore();
  }
  ctx.restore();
}
