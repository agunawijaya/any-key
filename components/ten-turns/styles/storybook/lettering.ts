/*
 * Picture-book lettering for the big moments: every letter cut out on its
 * own, tipped a little, with an inked edge and a block of shadow beneath.
 */

import type { Look } from "./look";
import { hash2, type Pt } from "./paint";

/** Springy ease for letters popping onto the page: overshoots, then settles. */
const popIn = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/**
 * Draws `text` centred on `at`, `size` pixels tall, arched by `arch` (pixels
 * the middle rises above the ends). `t` from 0 to 1 pops the letters in one
 * after another.
 */
export function shout(ctx: CanvasRenderingContext2D, look: Look, text: string, at: Pt, size: number, family: string, t: number, arch = 0, seed = 3) {
  const colors = look.lettering;
  ctx.save();
  ctx.font = `${Math.round(size)}px ${family}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  const letters = [...text];
  const widths = letters.map((ch) => ctx.measureText(ch).width * 0.96);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = at.x - total / 2;
  letters.forEach((ch, i) => {
    const w = widths[i];
    const local = Math.max(0, Math.min(1, t * (1 + letters.length * 0.12) - i * 0.12));
    const scale = popIn(local);
    const centre = x + w / 2;
    x += w;
    if (scale <= 0) return;
    const u = (centre - at.x) / (total / 2 || 1);
    const lift = arch * (1 - u * u);
    const tip = (hash2(i, 1, seed) - 0.5) * 0.22 + u * arch * 0.0016;
    const bob = (hash2(i, 2, seed) - 0.5) * size * 0.08;
    ctx.save();
    ctx.translate(centre, at.y - lift + bob);
    ctx.rotate(tip);
    ctx.scale(scale, scale);
    // The block shadow, stepped down and to the right.
    const depth = size * 0.07;
    ctx.fillStyle = colors.ink;
    for (let k = depth; k > 0; k -= 1) ctx.fillText(ch, k * 0.7, k);
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = colors.ink;
    ctx.strokeText(ch, 0, 0);
    // Paint, with a lighter band along the top of each letter and a darker foot.
    const fill = ctx.createLinearGradient(0, -size * 0.75, 0, 0);
    fill.addColorStop(0, colors.fill);
    fill.addColorStop(0.1, "#fffbe8");
    fill.addColorStop(0.2, colors.fill);
    fill.addColorStop(0.62, colors.fill);
    fill.addColorStop(1, colors.shade);
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
