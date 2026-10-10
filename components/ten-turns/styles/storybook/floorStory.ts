/*
 * The pit floor tells a story before anyone moves: rabbit tracks looping
 * round and round, watercolour blooms in the dry earth, and a few things
 * earlier visitors left behind in a hurry.
 */

import type { PitCamera } from "../../scene/camera";
import type { Look } from "./look";
import { alpha, noise2, scatter, type Pt } from "./paint";

/** An ellipse lying on the floor, projected: centre, half-length along `heading`, half-width across. */
function groundEllipse(camera: PitCamera, centre: Pt, length: number, width: number, heading: number): Pt[] {
  const pts: Pt[] = [];
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const u = Math.cos(a) * length;
    const v = Math.sin(a) * width;
    pts.push(camera.project(centre.x + u * c - v * s, centre.y + u * s + v * c, 0));
  }
  return pts;
}

function fillPolygon(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
}

/** A rabbit's track along a curving path: long hind prints side by side, small fore prints behind them. */
function track(ctx: CanvasRenderingContext2D, camera: PitCamera, look: Look, path: (t: number) => Pt, hops: number) {
  const pressed = alpha(look.floor.spot, look.night ? 0.42 : 0.3);
  const rim = alpha(look.floor.light, look.night ? 0.35 : 0.5);
  for (let i = 0; i < hops; i++) {
    const t = i / hops;
    const here = path(t);
    const ahead = path(t + 0.01);
    const heading = Math.atan2(ahead.y - here.y, ahead.x - here.x);
    const across = { x: -Math.sin(heading), y: Math.cos(heading) };
    const along = { x: Math.cos(heading), y: Math.sin(heading) };
    const prints: [Pt, number, number][] = [
      [{ x: here.x + along.x * 0.18 + across.x * 0.13, y: here.y + along.y * 0.18 + across.y * 0.13 }, 0.17, 0.065],
      [{ x: here.x + along.x * 0.18 - across.x * 0.13, y: here.y + along.y * 0.18 - across.y * 0.13 }, 0.17, 0.065],
      [{ x: here.x - along.x * 0.2 + across.x * 0.03, y: here.y - along.y * 0.2 + across.y * 0.03 }, 0.06, 0.05],
      [{ x: here.x - along.x * 0.36 - across.x * 0.02, y: here.y - along.y * 0.36 - across.y * 0.02 }, 0.06, 0.05],
    ];
    for (const [at, length, width] of prints) {
      // A pressed print: a light lip on the side away from the light, the dent itself darker.
      ctx.fillStyle = rim;
      fillPolygon(ctx, groundEllipse(camera, { x: at.x + 0.025, y: at.y - 0.025 }, length, width, heading));
      ctx.fillStyle = pressed;
      fillPolygon(ctx, groundEllipse(camera, at, length, width, heading));
    }
  }
}

/** Tracks that loop round the pit, the way an animal paces its home. */
export function rabbitTracks(ctx: CanvasRenderingContext2D, camera: PitCamera, look: Look, seed: number) {
  const loop = (r: number, phase: number, wander: number) => (t: number) => {
    const a = phase + t * Math.PI * 1.6;
    const rr = r + (noise2(t * 4, phase, seed) - 0.5) * wander;
    return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
  };
  track(ctx, camera, look, loop(7.6, 0.4, 2.2), 30);
  track(ctx, camera, look, loop(4.4, 3.4, 1.6), 18);
  const dash = (t: number) => ({ x: -6 + t * 7.5, y: -5.5 + Math.sin(t * 3) * 1.4 });
  track(ctx, camera, look, dash, 8);
}

/** Watercolour blooms: pale patches with darker, wetter edges. */
export function blooms(ctx: CanvasRenderingContext2D, camera: PitCamera, look: Look, radius: number, seed: number) {
  const rand = scatter(seed + 71);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * radius * 0.9;
    const centre = { x: Math.cos(a) * d, y: Math.sin(a) * d };
    const size = 0.8 + rand() * 1.8;
    const pts: Pt[] = [];
    for (let k = 0; k < 28; k++) {
      const b = (k / 28) * Math.PI * 2;
      const r = size * (0.75 + noise2(Math.cos(b) * 1.5 + i, Math.sin(b) * 1.5, seed) * 0.5);
      pts.push(camera.project(centre.x + Math.cos(b) * r, centre.y + Math.sin(b) * r, 0));
    }
    const tone = rand() < 0.5 ? look.floor.dark : look.floor.light;
    ctx.fillStyle = alpha(tone, look.night ? 0.09 : 0.16);
    fillPolygon(ctx, pts);
    // The wet edge: pigment gathers where a wash dries.
    ctx.strokeStyle = alpha(look.floor.dark, look.night ? 0.14 : 0.22);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

/* ---------- Left behind ---------- */

export function lostThings(ctx: CanvasRenderingContext2D, camera: PitCamera, look: Look) {
  const boot = camera.project(-7.4, 3.9, 0);
  wellington(ctx, look, boot.x, boot.y, boot.scale * 0.85, -0.35);
  const glasses = camera.project(6.9, 5.0, 0);
  spectacles(ctx, look, glasses.x, glasses.y, glasses.scale * 0.55, 0.2);
  const brolly = camera.project(5.6, -6.6, 0);
  umbrella(ctx, look, brolly.x, brolly.y, brolly.scale * 1.5, -0.5);
}

function wellington(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineJoin = "round";
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = size * 0.05;
  ctx.fillStyle = alpha(look.shadow, look.night ? 0.45 : 0.25);
  ctx.beginPath();
  ctx.ellipse(size * 0.05, size * 0.12, size * 0.55, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  const red = look.night ? "#9a3a3a" : "#d64b3a";
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.18);
  ctx.lineTo(size * 0.12, -size * 0.2);
  ctx.quadraticCurveTo(size * 0.2, -size * 0.02, size * 0.45, 0);
  ctx.quadraticCurveTo(size * 0.58, size * 0.05, size * 0.5, size * 0.13);
  ctx.lineTo(-size * 0.5, size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.night ? "#2a1e24" : "#4a2e28";
  ctx.beginPath();
  ctx.ellipse(-size * 0.5, -size * 0.03, size * 0.06, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = alpha("#ffffff", 0.45);
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.moveTo(-size * 0.38, -size * 0.12);
  ctx.lineTo(size * 0.05, -size * 0.14);
  ctx.stroke();
  ctx.restore();
}

function spectacles(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(1, 0.6);
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = size * 0.07;
  ctx.fillStyle = alpha(look.night ? "#9fb4e8" : "#ffffff", 0.35);
  for (const dx of [-0.24, 0.24]) {
    ctx.beginPath();
    ctx.arc(dx * size, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-size * 0.05, -size * 0.04);
  ctx.quadraticCurveTo(0, -size * 0.1, size * 0.05, -size * 0.04);
  ctx.moveTo(-size * 0.44, 0);
  ctx.lineTo(-size * 0.7, size * 0.18);
  ctx.moveTo(size * 0.44, 0);
  ctx.lineTo(size * 0.62, -size * 0.2);
  ctx.stroke();
  ctx.restore();
}

function umbrella(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = size * 0.03;
  ctx.fillStyle = alpha(look.shadow, look.night ? 0.4 : 0.22);
  ctx.beginPath();
  ctx.ellipse(0, size * 0.06, size * 0.5, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // The furled canopy, a long folded cone.
  ctx.fillStyle = look.night ? "#2c3550" : "#3b4f7a";
  ctx.beginPath();
  ctx.moveTo(-size * 0.32, 0);
  ctx.quadraticCurveTo(-size * 0.05, -size * 0.11, size * 0.28, -size * 0.015);
  ctx.lineTo(size * 0.3, size * 0.01);
  ctx.quadraticCurveTo(-size * 0.05, size * 0.09, -size * 0.32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.42, 0);
  ctx.moveTo(size * 0.3, 0);
  ctx.lineTo(size * 0.44, 0);
  ctx.arc(size * 0.44, -size * 0.06, size * 0.06, Math.PI / 2, -Math.PI / 2, true);
  ctx.stroke();
  ctx.restore();
}
