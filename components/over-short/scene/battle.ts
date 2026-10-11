import type { Ctx } from "./paint";
import type { SideView } from "./side";

/*
 * Two moments every battlefield director shares: the heat of a burst
 * washing over the main screen, and the screen shaking with it (a CSS
 * transform on the canvas, which costs no repainting).
 */

export type Burst = { at: number; x: number; power: number };

/** The burst's heat over the side view for its first half second: stronger at night. */
export function drawBurstWash(ctx: Ctx, view: SideView, burst: Burst | null, time: number) {
  if (!burst) return;
  const age = time - burst.at;
  if (age < 0 || age > 0.6) return;
  const x = view.screenX(burst.x);
  const y = view.groundY(burst.x) - view.height * 0.04;
  const strength = (1 - age / 0.6) ** 2 * (view.appearance === "night" ? 0.55 : 0.32) * Math.min(1.4, burst.power);
  const g = ctx.createRadialGradient(x, y, 0, x, y, view.width * 0.55);
  g.addColorStop(0, `rgb(255 236 200 / ${strength})`);
  g.addColorStop(0.18, `rgb(255 170 90 / ${strength * 0.45})`);
  g.addColorStop(1, "rgb(255 120 60 / 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.restore();
}

/**
 * The canvas's transform for a shake that began at `shaking.at` with
 * `power` (1 is a round landing in view), or "" once it has died away.
 * A little larger than the view while it moves, so its edges never show.
 */
export function shakeTransform(shaking: { at: number; power: number } | null, time: number, height: number): string {
  if (!shaking) return "";
  const age = time - shaking.at;
  const fade = Math.exp(-age * 5.5);
  if (fade < 0.02) return "";
  const amp = height * 0.009 * shaking.power * fade;
  return `translate(${Math.sin(age * 71) * amp}px, ${Math.cos(age * 57) * amp}px) scale(1.025)`;
}
