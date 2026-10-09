import { hash1, noise1 } from "@/lib/two-humps/noise";
import { css, lerp3, type RGB } from "./light";

/*
 * The ger camp at the end of the trek: round felt gers with painted doors,
 * strings of paper lanterns, and a low table with a cake. A ger's frame is a
 * lattice wall (khana) under roof poles that meet at a crown ring (toono);
 * felt and a white canvas cover it, tied round with ropes.
 */

export const LANTERN: RGB = [255, 186, 92];

export type GerPaint = { felt: string; feltShade: string; band: string; bandTrim: string; door: string; doorTrim: string; rope: string; pipe: string };

export function gerPaint(night: number, warmth: number): GerPaint {
  const lit = (c: RGB, k = 1) => css(lerp3(lerp3(c, [40, 46, 90], night * 0.62), [255, 190, 120], warmth * 0.18 * k));
  return {
    felt: lit([240, 234, 220]),
    feltShade: lit([196, 186, 172]),
    band: lit([40, 84, 160]),
    bandTrim: lit([236, 196, 80]),
    door: lit([214, 92, 40], 1.6),
    doorTrim: lit([250, 200, 80], 1.6),
    rope: lit([150, 120, 90]),
    pipe: lit([90, 80, 76]),
  };
}

/** A ger side on, its door facing us, lit from inside. */
export function drawGer(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, paint: GerPaint, doorGlow: number, time: number) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size, -size);
  const wallTop = 0.56;

  // Light spilling from the open door onto the sand.
  if (doorGlow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flicker = 0.9 + 0.1 * noise1(time * 3, 901);
    const pool = ctx.createRadialGradient(0, -0.02, 0, 0, -0.02, 1.4);
    pool.addColorStop(0, css(LANTERN, 0.45 * doorGlow * flicker));
    pool.addColorStop(1, css(LANTERN, 0));
    ctx.fillStyle = pool;
    ctx.scale(1, 0.25);
    ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
    ctx.restore();
  }

  // A soft shadow where the ger sits on the sand.
  ctx.fillStyle = "rgb(10 8 20 / 0.28)";
  ctx.beginPath();
  ctx.ellipse(0.06, 0, 1.12, 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // The wall: a low cylinder, shaded hard towards its sides so it reads as round.
  const wall = ctx.createLinearGradient(-1, 0, 1, 0);
  wall.addColorStop(0, paint.feltShade);
  wall.addColorStop(0.12, paint.feltShade);
  wall.addColorStop(0.42, paint.felt);
  wall.addColorStop(0.58, paint.felt);
  wall.addColorStop(0.9, paint.feltShade);
  wall.addColorStop(1, paint.pipe);
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(-1, wallTop);
  ctx.quadraticCurveTo(0, wallTop + 0.06, 1, wallTop);
  ctx.lineTo(1, 0);
  ctx.quadraticCurveTo(0, -0.06, -1, 0);
  ctx.fill();

  // The roof: a low cone up to the crown.
  const roof = ctx.createLinearGradient(-1, 0, 1, 0);
  roof.addColorStop(0, paint.feltShade);
  roof.addColorStop(0.45, paint.felt);
  roof.addColorStop(1, paint.feltShade);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-1.06, wallTop - 0.02);
  ctx.quadraticCurveTo(-0.6, wallTop + 0.28, -0.16, wallTop + 0.44);
  ctx.lineTo(0.16, wallTop + 0.44);
  ctx.quadraticCurveTo(0.6, wallTop + 0.28, 1.06, wallTop - 0.02);
  ctx.quadraticCurveTo(0, wallTop + 0.08, -1.06, wallTop - 0.02);
  ctx.fill();

  // Roof ropes running up to the crown, curving with the cone.
  ctx.strokeStyle = paint.rope;
  ctx.lineWidth = 0.014;
  ctx.globalAlpha = 0.6;
  for (const t of [-0.75, -0.4, 0.4, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(t * 1.04, wallTop + 0.04 - t * t * 0.03);
    ctx.quadraticCurveTo(t * 0.55, wallTop + 0.32, t * 0.17, wallTop + 0.43);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The decorated band round the roof's edge, and the ropes that hold the felt.
  ctx.strokeStyle = paint.band;
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(-1.02, wallTop + 0.02);
  ctx.quadraticCurveTo(0, wallTop + 0.13, 1.02, wallTop + 0.02);
  ctx.stroke();
  ctx.fillStyle = paint.bandTrim;
  for (let i = -9; i <= 9; i++) {
    const t = i / 10;
    ctx.beginPath();
    ctx.arc(t, wallTop + 0.075 - t * t * 0.055, 0.016, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = paint.rope;
  ctx.lineWidth = 0.018;
  for (const y of [0.18, 0.42]) {
    ctx.beginPath();
    ctx.moveTo(-1, y);
    ctx.quadraticCurveTo(0, y + 0.05, 1, y);
    ctx.stroke();
  }

  // The crown ring and the stove pipe, with a thread of smoke.
  ctx.fillStyle = paint.feltShade;
  ctx.fillRect(-0.17, wallTop + 0.42, 0.34, 0.06);
  ctx.fillStyle = paint.pipe;
  ctx.fillRect(0.05, wallTop + 0.46, 0.06, 0.2);
  ctx.strokeStyle = "rgb(200 200 220 / 0.18)";
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(0.08, wallTop + 0.68);
  for (let i = 1; i <= 8; i++) ctx.lineTo(0.08 + Math.sin(time * 0.8 + i * 0.9) * 0.05 + i * 0.05, wallTop + 0.68 + i * 0.09);
  ctx.stroke();

  // The painted door, open a crack, warm light inside.
  ctx.fillStyle = paint.doorTrim;
  ctx.fillRect(-0.2, 0, 0.4, 0.5);
  ctx.fillStyle = css(LANTERN, 0.9 * doorGlow + 0.1);
  ctx.fillRect(-0.16, 0.02, 0.32, 0.44);
  ctx.fillStyle = paint.door;
  ctx.fillRect(-0.16, 0.02, 0.2, 0.44);
  ctx.strokeStyle = paint.doorTrim;
  ctx.lineWidth = 0.018;
  ctx.strokeRect(-0.13, 0.06, 0.14, 0.36);
  ctx.beginPath();
  ctx.moveTo(-0.13, 0.24);
  ctx.lineTo(0.01, 0.24);
  ctx.stroke();
  ctx.restore();
}

/** A string of paper lanterns, sagging between two points, each glowing and swinging a little. */
export function drawLanternString(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number], sag: number, count: number, size: number, time: number, seed: number) {
  const at = (t: number): [number, number] => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + Math.sin(Math.PI * t) * sag];
  ctx.strokeStyle = "rgb(40 30 30 / 0.7)";
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const [x, y] = at(i / 24);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const colours: RGB[] = [
    [255, 120, 80],
    [255, 196, 90],
    [120, 200, 255],
    [255, 150, 200],
    [160, 230, 140],
  ];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const [x, y] = at(t);
    const swing = Math.sin(time * 1.4 + i * 1.3 + seed) * 0.12;
    const colour = colours[Math.floor(hash1(i, seed) * colours.length)];
    const flicker = 0.85 + 0.15 * noise1(time * 4 + i, seed + 3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(swing);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, size * 1.1, 0, 0, size * 1.1, size * 4);
    glow.addColorStop(0, css(colour, 0.38 * flicker));
    glow.addColorStop(1, css(colour, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-size * 4, -size * 3, size * 8, size * 8);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgb(40 30 30 / 0.7)";
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size * 0.4);
    ctx.stroke();
    const body = ctx.createRadialGradient(0, size * 1.1, 0, 0, size * 1.1, size * 0.8);
    body.addColorStop(0, css(lerp3(colour, [255, 250, 230], 0.6)));
    body.addColorStop(1, css(colour));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, size * 1.1, size * 0.62, size * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgb(60 30 30 / 0.8)";
    ctx.fillRect(-size * 0.35, size * 0.35, size * 0.7, size * 0.12);
    ctx.fillRect(-size * 0.35, size * 1.78, size * 0.7, size * 0.12);
    ctx.restore();
  }
}

/** A low table with a round, layered cake and candles that gutter in the breeze. */
export function drawCakeTable(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, time: number, night: number, candlesOut = false) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size, -size);
  const wood = css(lerp3([150, 70, 40], [50, 30, 50], night * 0.45));
  const woodTop = css(lerp3([200, 110, 50], [90, 50, 60], night * 0.35));
  ctx.fillStyle = wood;
  ctx.fillRect(-0.9, 0, 0.12, 0.32);
  ctx.fillRect(0.78, 0, 0.12, 0.32);
  ctx.fillStyle = woodTop;
  ctx.fillRect(-1.0, 0.3, 2.0, 0.1);
  ctx.fillStyle = "rgb(250 200 80 / 0.9)";
  for (let i = -4; i <= 4; i++) ctx.fillRect(i * 0.2 - 0.03, 0.33, 0.06, 0.04);

  // The cake: two tiers, cream on top, berries round the edge.
  const cake = (y: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(0, y, w, h * 0.22, 0, 0, Math.PI);
    ctx.rect(-w, y, w * 2, h);
    ctx.fill();
    ctx.fillStyle = "rgb(255 248 236)";
    ctx.beginPath();
    ctx.ellipse(0, y + h, w, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  cake(0.4, 0.5, 0.28, "rgb(236 170 120)");
  cake(0.68, 0.32, 0.22, "rgb(244 190 140)");
  ctx.fillStyle = "rgb(220 40 70)";
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(i * 0.14, 0.7, 0.035, 0, Math.PI * 2);
    ctx.fill();
  }

  // Candles: four of them, for forty miles.
  for (let i = 0; i < 4; i++) {
    const cx = -0.18 + i * 0.12;
    ctx.fillStyle = ["rgb(120 200 255)", "rgb(255 140 180)", "rgb(255 220 90)", "rgb(160 230 140)"][i];
    ctx.fillRect(cx - 0.02, 0.9, 0.04, 0.2);
    if (candlesOut) {
      ctx.strokeStyle = "rgb(220 220 230 / 0.4)";
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(cx, 1.12);
      ctx.quadraticCurveTo(cx + 0.06, 1.2, cx + 0.02, 1.3);
      ctx.stroke();
      continue;
    }
    const lean = (noise1(time * 3 + i, 931) - 0.5) * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(cx, 1.16, 0, cx, 1.16, 0.3);
    glow.addColorStop(0, "rgb(255 200 110 / 0.45)");
    glow.addColorStop(1, "rgb(255 200 110 / 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 0.3, 0.86, 0.6, 0.6);
    ctx.fillStyle = "rgb(255 236 160)";
    ctx.beginPath();
    ctx.moveTo(cx - 0.025, 1.12);
    ctx.quadraticCurveTo(cx + lean, 1.26, cx + lean * 1.5, 1.24);
    ctx.quadraticCurveTo(cx + 0.03, 1.18, cx + 0.025, 1.12);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
