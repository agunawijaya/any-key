/*
 * Things on the pit floor, painted in the Storybook's hand: boulders, the
 * player's cairns, burrows (open, tunnelled or caved in), carrot patches,
 * tossed carrots, the rustling grass before the drop, and the marks the game
 * lays over the floor (rings, the rabbit's intent, its landing shadow).
 * Each takes the projected floor point and the pixels per pit unit there.
 */

import type { ScreenPoint } from "../../scene/camera";
import { softEllipse } from "./fx";
import type { Look } from "./look";
import { alpha, hash2, mix, noise2, type Pt } from "./paint";

/** A boulder sitting on its cell: its shape comes from the cell, so each rock is its own. */
export function boulder(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint, cell: Pt) {
  const u = at.scale;
  const seed = Math.round(cell.x * 31 + cell.y * 17);
  const w = u * (0.5 + hash2(cell.x, cell.y, 3) * 0.12);
  const h = u * (0.42 + hash2(cell.x, cell.y, 5) * 0.14);
  const away = { x: -look.lightScreen.x, y: -look.lightScreen.y };
  softEllipse(ctx, { x: at.x + away.x * w * 0.5, y: at.y + u * 0.08 }, w * 1.2, u * 0.22, 0, look.shadow, look.night ? 0.55 : 0.32, 0.6);
  const pts: Pt[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const bump = 0.86 + noise2(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4, 9) * 0.28;
    // Flat along the ground, domed on top.
    const y = Math.sin(a) > 0 ? Math.sin(a) * 0.22 : Math.sin(a);
    pts.push({ x: at.x + Math.cos(a) * w * bump, y: at.y - h * 0.32 + y * h * bump });
  }
  const base = look.earth.pebble[Math.abs(seed) % look.earth.pebble.length];
  ctx.save();
  ctx.lineJoin = "round";
  path(ctx, pts);
  ctx.lineWidth = Math.max(1.2, u * 0.05);
  ctx.strokeStyle = look.ink;
  ctx.stroke();
  const body = ctx.createLinearGradient(at.x + look.lightScreen.x * w, at.y - h + look.lightScreen.y * h, at.x - look.lightScreen.x * w, at.y);
  body.addColorStop(0, mix(base, "#ffffff", look.night ? 0.12 : 0.3));
  body.addColorStop(0.55, base);
  body.addColorStop(1, mix(base, look.ink, look.night ? 0.5 : 0.4));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  // A crack or two, and moss on the top where the rain sits.
  ctx.strokeStyle = alpha(look.ink, 0.45);
  ctx.lineWidth = Math.max(0.7, u * 0.025);
  ctx.beginPath();
  ctx.moveTo(at.x - w * 0.15, at.y - h * 0.9);
  ctx.lineTo(at.x - w * 0.05, at.y - h * 0.55);
  ctx.lineTo(at.x - w * 0.22, at.y - h * 0.3);
  ctx.stroke();
  ctx.fillStyle = alpha(look.night ? "#3f6a5c" : "#7d9b4a", 0.75);
  ctx.beginPath();
  ctx.ellipse(at.x + w * 0.1, at.y - h * 1.0, w * 0.45, h * 0.18, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The player's stone: a little cairn of three, so it never looks like a rock that was always there. */
export function cairn(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint) {
  const u = at.scale;
  softEllipse(ctx, { x: at.x + u * 0.12, y: at.y + u * 0.06 }, u * 0.42, u * 0.16, 0, look.shadow, look.night ? 0.5 : 0.3, 0.6);
  const stones: [number, number, number, number, string][] = [
    [0, -0.12, 0.34, 0.17, look.night ? "#7b86a4" : "#b9b2a3"],
    [0.02, -0.34, 0.25, 0.13, look.night ? "#8f99b6" : "#cdc5b4"],
    [-0.01, -0.51, 0.16, 0.09, look.night ? "#a3add0" : "#e2dccd"],
  ];
  ctx.save();
  ctx.lineWidth = Math.max(1, u * 0.04);
  ctx.strokeStyle = look.ink;
  for (const [dx, dy, rx, ry, color] of stones) {
    ctx.beginPath();
    ctx.ellipse(at.x + dx * u, at.y + dy * u, rx * u, ry * u, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(at.x, at.y + (dy - ry) * u, at.x, at.y + (dy + ry) * u);
    g.addColorStop(0, mix(color, "#ffffff", 0.25));
    g.addColorStop(1, mix(color, look.ink, 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A burrow: a dark hole with a crescent of dug earth behind it. Tunnel ends
 * carry a ribbon on a stick, the same colour at both ends; a caved-in burrow
 * is a soft mound.
 */
export function burrow(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint, state: "open" | "caved", ribbon: string | null) {
  const u = at.scale;
  ctx.save();
  if (state === "caved") {
    softEllipse(ctx, { x: at.x, y: at.y + u * 0.04 }, u * 0.42, u * 0.16, 0, look.shadow, look.night ? 0.4 : 0.22, 0.7);
    ctx.fillStyle = mix(look.floor.dark, look.earth.wall, 0.4);
    ctx.strokeStyle = alpha(look.ink, 0.6);
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.beginPath();
    ctx.ellipse(at.x, at.y - u * 0.04, u * 0.36, u * 0.15, 0, Math.PI, 0);
    ctx.quadraticCurveTo(at.x, at.y + u * 0.06, at.x - u * 0.36, at.y - u * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  // The mound of dug earth behind the hole.
  ctx.fillStyle = mix(look.earth.wall, look.floor.base, 0.35);
  ctx.strokeStyle = alpha(look.ink, 0.7);
  ctx.lineWidth = Math.max(1, u * 0.035);
  ctx.beginPath();
  ctx.ellipse(at.x, at.y - u * 0.1, u * 0.5, u * 0.26, 0, Math.PI, 0);
  ctx.lineTo(at.x + u * 0.38, at.y - u * 0.02);
  ctx.ellipse(at.x, at.y, u * 0.38, u * 0.18, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The hole: dark, deepest at the back.
  const hole = ctx.createRadialGradient(at.x, at.y - u * 0.05, 0, at.x, at.y, u * 0.4);
  hole.addColorStop(0, look.night ? "#02030a" : "#1c120c");
  hole.addColorStop(1, look.night ? "#141626" : "#3f2a1d");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, u * 0.36, u * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (ribbon) {
    const post = { x: at.x + u * 0.42, y: at.y - u * 0.04 };
    ctx.strokeStyle = look.ink;
    ctx.lineWidth = Math.max(1.2, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(post.x, post.y);
    ctx.lineTo(post.x + u * 0.02, post.y - u * 0.55);
    ctx.stroke();
    ctx.fillStyle = ribbon;
    ctx.lineWidth = Math.max(0.8, u * 0.025);
    ctx.beginPath();
    ctx.moveTo(post.x + u * 0.02, post.y - u * 0.55);
    ctx.quadraticCurveTo(post.x + u * 0.22, post.y - u * 0.5, post.x + u * 0.3, post.y - u * 0.36);
    ctx.lineTo(post.x + u * 0.16, post.y - u * 0.42);
    ctx.lineTo(post.x + u * 0.02, post.y - u * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A carrot patch: a hump of soil with feathery tops and an orange shoulder showing. */
export function carrotPatch(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint, time: number) {
  const u = at.scale;
  ctx.save();
  ctx.fillStyle = mix(look.earth.wall, look.floor.dark, 0.3);
  ctx.strokeStyle = alpha(look.ink, 0.6);
  ctx.lineWidth = Math.max(1, u * 0.03);
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, u * 0.42, u * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.night ? "#b8683a" : "#ef8a2c";
  ctx.beginPath();
  ctx.ellipse(at.x, at.y - u * 0.04, u * 0.12, u * 0.08, 0, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  frond(ctx, look, { x: at.x, y: at.y - u * 0.09 }, u, time);
  ctx.restore();
}

/** Feathery carrot leaves, swaying a little. */
function frond(ctx: CanvasRenderingContext2D, look: Look, root: Pt, u: number, time: number) {
  const greens = look.night ? ["#3f7a5e", "#2e5f4c"] : ["#5fa043", "#3f8a35"];
  for (let i = -2; i <= 2; i++) {
    const sway = Math.sin(time * 1.6 + i) * 0.06;
    const a = -Math.PI / 2 + i * 0.32 + sway;
    const len = u * (0.42 - Math.abs(i) * 0.05);
    const tip = { x: root.x + Math.cos(a) * len, y: root.y + Math.sin(a) * len };
    ctx.strokeStyle = greens[Math.abs(i) % 2];
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(root.x + Math.cos(a) * len * 0.5 + i * u * 0.03, root.y + Math.sin(a) * len * 0.5, tip.x, tip.y);
    ctx.stroke();
    // Little leaflets along the stem.
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const p = { x: root.x + (tip.x - root.x) * t, y: root.y + (tip.y - root.y) * t };
      ctx.lineWidth = Math.max(0.8, u * 0.022);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - u * 0.06, p.y - u * 0.05);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + u * 0.06, p.y - u * 0.05);
      ctx.stroke();
    }
  }
}

/** A carrot lying on the ground where it was tossed. */
export function carrot(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint, lift = 0, spin = 0.3) {
  const u = at.scale;
  ctx.save();
  if (lift < 0.05) softEllipse(ctx, { x: at.x, y: at.y + u * 0.04 }, u * 0.38, u * 0.1, 0, look.shadow, look.night ? 0.45 : 0.28, 0.6);
  ctx.translate(at.x, at.y - u * 0.08);
  ctx.rotate(spin);
  ctx.lineJoin = "round";
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = Math.max(1, u * 0.035);
  ctx.fillStyle = look.night ? "#c8743d" : "#f08a2a";
  ctx.beginPath();
  ctx.moveTo(-u * 0.32, 0);
  ctx.quadraticCurveTo(-u * 0.05, -u * 0.12, u * 0.18, -u * 0.08);
  ctx.quadraticCurveTo(u * 0.24, 0, u * 0.18, u * 0.08);
  ctx.quadraticCurveTo(-u * 0.05, u * 0.12, -u * 0.32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = alpha(look.ink, 0.5);
  ctx.lineWidth = Math.max(0.6, u * 0.02);
  for (const x of [-0.18, -0.04, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(u * x, -u * 0.06);
    ctx.lineTo(u * (x + 0.03), -u * 0.01);
    ctx.stroke();
  }
  ctx.strokeStyle = look.night ? "#3f7a5e" : "#4f9a3a";
  ctx.lineWidth = Math.max(1, u * 0.04);
  for (const a of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(u * 0.2, 0);
    ctx.lineTo(u * (0.2 + Math.cos(a) * 0.22), Math.sin(a) * u * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

/** Tall grass on one cell, shivering: the rabbit is somewhere in it. */
export function rustlingGrass(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint, cell: Pt, time: number) {
  const u = at.scale;
  const shiver = Math.sin(time * 9 + cell.x * 1.7 + cell.y * 2.3) * (0.5 + 0.5 * Math.sin(time * 1.3 + cell.x)) ** 2;
  const blades = look.meadow.blades;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const ox = (hash2(cell.x * 7 + i, cell.y, 3) - 0.5) * u * 0.8;
    const oy = (hash2(cell.x, cell.y * 7 + i, 5) - 0.5) * u * 0.4;
    const len = u * (0.5 + hash2(i, cell.x + cell.y, 7) * 0.35);
    const lean = (hash2(i, cell.x, 11) - 0.5) * 0.5 + shiver * 0.35;
    ctx.strokeStyle = blades[(i + Math.abs(cell.x)) % blades.length];
    ctx.lineWidth = Math.max(1.2, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(at.x + ox, at.y + oy);
    ctx.quadraticCurveTo(at.x + ox + lean * len * 0.3, at.y + oy - len * 0.6, at.x + ox + lean * len, at.y + oy - len);
    ctx.stroke();
  }
  ctx.restore();
}

/** A ring on a cell: somewhere you can step, the cell you're pointing at, a tool's target, or a refused move. */
export function cellRing(ctx: CanvasRenderingContext2D, look: Look, at: ScreenPoint, kind: "reachable" | "hover" | "target" | "refused", age = 0, shaking = true) {
  const u = at.scale;
  const shake = kind === "refused" && shaking ? Math.sin(age * 60) * u * 0.06 * Math.max(0, 1 - age * 2.5) : 0;
  ctx.save();
  ctx.translate(at.x + shake, at.y);
  const paper = look.night ? "#f1e8cf" : "#fffaf0";
  switch (kind) {
    case "reachable":
      ctx.strokeStyle = alpha(paper, look.night ? 0.42 : 0.65);
      ctx.lineWidth = Math.max(1.2, u * 0.035);
      ctx.setLineDash([u * 0.08, u * 0.06]);
      break;
    case "hover":
      ctx.fillStyle = alpha(paper, look.night ? 0.22 : 0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.4, u * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha(paper, 0.95);
      ctx.lineWidth = Math.max(2, u * 0.06);
      break;
    case "target":
      ctx.strokeStyle = alpha(look.lettering.fill, 0.9);
      ctx.lineWidth = Math.max(1.5, u * 0.045);
      ctx.setLineDash([u * 0.1, u * 0.07]);
      break;
    case "refused":
      ctx.strokeStyle = alpha(look.rabbit.rage, Math.max(0, 1 - age * 1.6));
      ctx.lineWidth = Math.max(2, u * 0.06);
      break;
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 0.4, u * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * The rabbit's intent: a dotted arc from it to where its pounce will land, a
 * red ring on that cell and a shadow in it. The locked first pounce is drawn
 * firmly: that is the cell not to be standing on.
 */
export function intentArc(ctx: CanvasRenderingContext2D, look: Look, from: ScreenPoint, to: ScreenPoint, rise: number, first: boolean, time: number) {
  const u = to.scale;
  const color = look.night ? "#ff8f84" : look.rabbit.rage;
  softEllipse(ctx, to, u * 0.6, u * 0.29, 0, color, (look.night ? 0.42 : 0.3) * (first ? 1 : 0.6), 0.5);
  ctx.save();
  ctx.strokeStyle = alpha(color, first ? 0.95 : 0.5);
  ctx.lineWidth = Math.max(2, u * 0.055);
  ctx.setLineDash([u * 0.12, u * 0.08]);
  ctx.lineDashOffset = -time * u * 0.3;
  ctx.beginPath();
  ctx.ellipse(to.x, to.y, u * 0.52, u * 0.25, 0, 0, Math.PI * 2);
  ctx.stroke();
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - rise };
  ctx.lineWidth = Math.max(2.5, u * (first ? 0.09 : 0.06));
  ctx.lineCap = "round";
  ctx.setLineDash([u * 0.01, u * 0.16]);
  ctx.lineDashOffset = -time * u * 0.6;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(control.x, control.y, to.x, to.y - u * 0.12);
  ctx.stroke();
  ctx.setLineDash([]);
  // An arrowhead pointing down the arc's last stretch.
  const angle = Math.atan2(to.y - u * 0.12 - control.y, to.x - control.x);
  const tip = { x: to.x, y: to.y - u * 0.08 };
  ctx.fillStyle = alpha(color, first ? 0.95 : 0.55);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - Math.cos(angle - 0.5) * u * 0.26, tip.y - Math.sin(angle - 0.5) * u * 0.26);
  ctx.lineTo(tip.x - Math.cos(angle + 0.5) * u * 0.26, tip.y - Math.sin(angle + 0.5) * u * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function path(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i % pts.length];
    const b = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  ctx.closePath();
}
