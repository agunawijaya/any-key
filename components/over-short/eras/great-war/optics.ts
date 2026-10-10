import { context, makeCanvas, type Ctx } from "../../scene/paint";
import type { Appearance } from "../../scene/side";

/*
 * How the observer sees: through field glasses, two overlapping circles,
 * dark at their rims, with a graticule scratched across them.
 */

let mask: HTMLCanvasElement | null = null;

/** Field glasses: everything outside the two lenses is black, and the lenses darken towards their rims. */
export function fieldGlasses(ctx: Ctx, width: number, height: number, appearance: Appearance) {
  if (!mask || mask.width !== Math.ceil(width) || mask.height !== Math.ceil(height)) mask = makeCanvas(width, height);
  const m = context(mask);
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = "source-over";
  m.fillStyle = "#050505";
  m.fillRect(0, 0, width, height);
  const radius = height * 0.47;
  const centres = [width / 2 - radius * 0.56, width / 2 + radius * 0.56];
  m.globalCompositeOperation = "destination-out";
  for (const cx of centres) {
    const g = m.createRadialGradient(cx, height / 2, radius * 0.72, cx, height / 2, radius);
    g.addColorStop(0, "rgb(0 0 0 / 1)");
    g.addColorStop(0.75, "rgb(0 0 0 / 0.9)");
    g.addColorStop(1, "rgb(0 0 0 / 0)");
    m.fillStyle = g;
    m.beginPath();
    m.arc(cx, height / 2, radius, 0, Math.PI * 2);
    m.fill();
  }
  ctx.drawImage(mask, 0, 0, width, height);
  graticule(ctx, width / 2, height / 2, height, appearance);
}

/** The scale etched in the glass: a horizontal line of tens of mils, a short vertical, small figures. */
function graticule(ctx: Ctx, cx: number, cy: number, height: number, appearance: Appearance) {
  const ink = appearance === "day" ? "rgb(20 18 14 / 0.65)" : "rgb(200 220 210 / 0.45)";
  const unit = height * 0.022;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - unit * 12, cy);
  ctx.lineTo(cx + unit * 12, cy);
  ctx.moveTo(cx, cy - unit * 2.2);
  ctx.lineTo(cx, cy + unit * 5.5);
  for (let k = -10; k <= 10; k++) {
    if (k === 0) continue;
    const tall = k % 5 === 0 ? unit * 0.9 : unit * 0.45;
    ctx.moveTo(cx + k * unit, cy - tall);
    ctx.lineTo(cx + k * unit, cy);
  }
  for (let k = 1; k <= 4; k++) {
    ctx.moveTo(cx - unit * 0.35, cy + k * unit);
    ctx.lineTo(cx + unit * 0.35, cy + k * unit);
  }
  ctx.stroke();
  ctx.font = `500 ${Math.round(unit * 0.62)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  for (const k of [-10, -5, 5, 10]) ctx.fillText(String(Math.abs(k) * 2), cx + k * unit, cy - unit * 1.25);
  ctx.restore();
}
