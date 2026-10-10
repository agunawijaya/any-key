/*
 * The meadow's small things, each drawn at a given size in screen pixels:
 * grass tufts, wild flowers, pebbles, toadstools.
 */

import type { Look } from "./look";
import { alpha, mix, taperedStroke } from "./paint";

/** A tuft of three to five blades rising from (x, y), leaning by `lean` radians. */
export function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: string[], rand: () => number, lean = 0) {
  const blades = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blades; i++) {
    const spread = (i / (blades - 1) - 0.5) * 0.9;
    const angle = -Math.PI / 2 + spread + lean + (rand() - 0.5) * 0.35;
    const len = size * (0.55 + rand() * 0.6) * (1 - Math.abs(spread) * 0.4);
    const bend = (spread + (rand() - 0.5) * 0.4) * 0.6;
    const bx = x + spread * size * 0.18;
    const mid = { x: bx + Math.cos(angle) * len * 0.5, y: y + Math.sin(angle) * len * 0.5 };
    const tip = { x: bx + Math.cos(angle + bend) * len, y: y + Math.sin(angle + bend) * len };
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    taperedStroke(ctx, [{ x: bx, y }, mid, tip], Math.max(1, size * 0.13), 0, 1);
  }
}

export type FlowerKind = "daisy" | "buttercup" | "clover" | "poppy" | "forget";

export const FLOWER_KINDS: FlowerKind[] = ["daisy", "buttercup", "clover", "poppy", "forget"];

/** A wild flower on a short stem; `size` is the bloom's width in pixels. */
export function flower(ctx: CanvasRenderingContext2D, look: Look, kind: FlowerKind, x: number, y: number, size: number, rand: () => number) {
  const stemTop = { x: x + (rand() - 0.5) * size * 0.4, y: y - size * (1 + rand() * 0.8) };
  ctx.strokeStyle = look.meadow.deep;
  ctx.lineWidth = Math.max(0.8, size * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x, (y + stemTop.y) / 2, stemTop.x, stemTop.y);
  ctx.stroke();
  // A leaf on the stem.
  ctx.fillStyle = look.meadow.blades[1];
  ctx.beginPath();
  ctx.ellipse(x + size * 0.18, y - size * 0.45, size * 0.22, size * 0.08, -0.6, 0, Math.PI * 2);
  ctx.fill();

  const [daisy, buttercup, clover, poppy, forget] = look.meadow.flowers;
  const ink = alpha(look.ink, 0.55);
  const { x: cx, y: cy } = stemTop;
  ctx.lineWidth = Math.max(0.6, size * 0.05);
  switch (kind) {
    case "daisy": {
      const petals = 9;
      ctx.fillStyle = daisy;
      ctx.strokeStyle = ink;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + rand() * 0.2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * size * 0.32, cy + Math.sin(a) * size * 0.2, size * 0.24, size * 0.09, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = look.meadow.flowerHearts;
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.16, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "buttercup": {
      ctx.fillStyle = buttercup;
      ctx.strokeStyle = ink;
      for (const a of [-0.9, 0, 0.9]) {
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(a) * size * 0.2, cy - Math.cos(a) * size * 0.08, size * 0.18, size * 0.26, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = mix(buttercup, "#ffffff", 0.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.1, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "clover": {
      for (let i = 0; i < 12; i++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * size * 0.25;
        ctx.fillStyle = mix(clover, "#ffffff", rand() * 0.35);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9 - size * 0.05, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "poppy": {
      ctx.fillStyle = poppy;
      ctx.strokeStyle = ink;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * size * 0.2, cy + Math.sin(a) * size * 0.15, size * 0.26, size * 0.21, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = look.ink;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "forget": {
      for (let k = 0; k < 3; k++) {
        const fx = cx + (rand() - 0.5) * size * 0.6;
        const fy = cy + (rand() - 0.5) * size * 0.4;
        ctx.fillStyle = forget;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * size * 0.1, fy + Math.sin(a) * size * 0.08, size * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = look.meadow.flowerHearts;
        ctx.beginPath();
        ctx.arc(fx, fy, size * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

/** A smooth pebble, softly shaded, with a little shine; light comes from the upper left. */
export function pebble(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, rx: number, ry: number, color: string, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = alpha(look.shadow, look.night ? 0.45 : 0.25);
  ctx.beginPath();
  ctx.ellipse(rx * 0.25, ry * 0.45, rx * 1.05, ry * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, 0, 0, 0, Math.max(rx, ry) * 1.15);
  body.addColorStop(0, mix(color, "#ffffff", look.night ? 0.12 : 0.28));
  body.addColorStop(0.55, color);
  body.addColorStop(1, mix(color, look.ink, look.night ? 0.45 : 0.35));
  ctx.fillStyle = body;
  ctx.strokeStyle = alpha(look.ink, look.night ? 0.55 : 0.6);
  ctx.lineWidth = Math.max(0.6, rx * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A spotted toadstool, `size` pixels across the cap. */
export function toadstool(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rand: () => number) {
  const ink = look.ink;
  const lean = (rand() - 0.5) * 0.3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.strokeStyle = ink;
  ctx.fillStyle = look.night ? "#c9c3cf" : "#f5ead6";
  ctx.beginPath();
  ctx.moveTo(-size * 0.14, 0);
  ctx.quadraticCurveTo(-size * 0.18, -size * 0.4, -size * 0.1, -size * 0.62);
  ctx.lineTo(size * 0.1, -size * 0.62);
  ctx.quadraticCurveTo(size * 0.18, -size * 0.4, size * 0.14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.night ? "#a8434c" : "#d7473a";
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.55);
  ctx.bezierCurveTo(-size * 0.48, -size * 1.08, size * 0.48, -size * 1.08, size * 0.5, -size * 0.55);
  ctx.quadraticCurveTo(0, -size * 0.45, -size * 0.5, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = alpha("#ffffff", 0.9);
  for (const [sx, sy, sr] of [
    [-0.24, -0.72, 0.08],
    [0.08, -0.86, 0.07],
    [0.3, -0.66, 0.06],
    [-0.04, -0.66, 0.05],
  ]) {
    ctx.beginPath();
    ctx.ellipse(sx * size, sy * size, sr * size, sr * size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}
