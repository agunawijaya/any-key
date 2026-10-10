/*
 * Turning the page: the storybook's way from one moment to the next. The
 * bottom-right corner lifts and folds back over the picture, and the next
 * page shows underneath with its first words.
 */

import type { Look } from "./look";
import { alpha, mix, type Pt } from "./paint";

export type NextPage = {
  title: string;
  line?: string;
  font: string;
  /** Draws the page's little picture standing on `ground`, `size` being about a head's height. */
  picture?: (ctx: CanvasRenderingContext2D, ground: Pt, size: number) => void;
};

/**
 * Folds the page back from the bottom-right corner by `amount` pixels along
 * the diagonal. 0 leaves the picture alone; the length of the diagonal turns it fully.
 */
export function turnPage(ctx: CanvasRenderingContext2D, look: Look, width: number, height: number, amount: number, next: NextPage) {
  if (amount <= 0) return;
  const corner = { x: width, y: height };
  // Folded along a steep line, so the corner lifts like a page a finger is about to turn.
  const d = { x: -0.5, y: -Math.sqrt(3) / 2 };
  // The fold line meets the bottom and the right edges here (or runs off them, which is fine).
  const onBottom = { x: corner.x + amount / d.x, y: height };
  const onRight = { x: width, y: corner.y + amount / d.y };
  const tip = { x: corner.x + 2 * amount * d.x, y: corner.y + 2 * amount * d.y };

  // Underneath: the next page.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corner.x, corner.y);
  ctx.lineTo(onBottom.x, onBottom.y);
  ctx.lineTo(onRight.x, onRight.y);
  ctx.closePath();
  ctx.clip();
  // Cream paper by day; at night the book turns to a midnight page with pale ink, so it does not glare.
  const paper = look.night ? "#25253d" : "#f8efdc";
  const ink = look.night ? "#efe3c8" : "#3a271d";
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  // The shadow the lifted flap throws on the page below.
  const shade = ctx.createLinearGradient(onBottom.x, onBottom.y, onBottom.x + d.x * -amount * 0.3, onBottom.y + d.y * -amount * 0.3);
  shade.addColorStop(0, alpha("#000000", look.night ? 0.45 : 0.22));
  shade.addColorStop(1, alpha("#000000", 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  const size = Math.min(width, height) * 0.062;
  ctx.fillStyle = ink;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = `italic 600 ${Math.round(size)}px ${next.font}`;
  ctx.fillText(next.title, width - size * 0.6, height - size * 1.2);
  if (next.line) {
    ctx.font = `italic ${Math.round(size * 0.34)}px ${next.font}`;
    ctx.fillStyle = alpha(ink, 0.72);
    ctx.fillText(next.line, width - size * 0.65, height - size * 0.6);
  }
  ornament(ctx, ink, { x: width - size * 3.7, y: height - size * 2.35 }, size * 0.5);
  next.picture?.(ctx, { x: width - size * 3.7, y: height - size * 3.3 }, size);
  ctx.restore();

  // The flap: the back of the turned page, lighter along the fold, shadowed towards its tip.
  const flapPath = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(onBottom.x + dx, onBottom.y + dy);
    ctx.lineTo(onRight.x + dx, onRight.y + dy);
    ctx.lineTo(tip.x + dx, tip.y + dy);
    ctx.closePath();
  };
  ctx.save();
  // A soft shadow under the flap, built from a few offset layers rather than a blur.
  for (const k of [3, 2, 1]) {
    flapPath(-k * 5, -k * 3.5);
    ctx.fillStyle = alpha("#000000", (look.night ? 0.16 : 0.08) / k);
    ctx.fill();
  }
  flapPath(0, 0);
  const mid = { x: (onBottom.x + onRight.x) / 2, y: (onBottom.y + onRight.y) / 2 };
  const back = ctx.createLinearGradient(mid.x, mid.y, tip.x, tip.y);
  const flap = look.night ? "#3a3957" : "#efe2c6";
  back.addColorStop(0, mix(flap, "#ffffff", 0.25));
  back.addColorStop(0.35, flap);
  back.addColorStop(1, mix(flap, "#000000", 0.18));
  ctx.fillStyle = back;
  ctx.fill();
  ctx.strokeStyle = alpha(look.ink, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** A small flourish over the next page's words: a sprig with two leaves. */
function ornament(ctx: CanvasRenderingContext2D, ink: string, at: Pt, size: number) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.strokeStyle = alpha(ink, 0.6);
  ctx.fillStyle = alpha(ink, 0.6);
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(-size * 1.6, 0);
  ctx.quadraticCurveTo(0, -size * 0.5, size * 1.6, 0);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * size * 0.5, -size * 0.32, size * 0.32, size * 0.13, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
