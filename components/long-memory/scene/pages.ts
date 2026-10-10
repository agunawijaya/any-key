/*
 * Paints the Memory Book's open spread with Canvas 2D: each remembered game
 * is a small entry with its number, the day it was learned, a miniature
 * board, and the opening moves that lost, numbered in the order they were
 * played. The canvas becomes the pages' texture (transparent paper, ink only;
 * the paper itself is shaded on the GPU).
 */

export type PageEntry = {
  /** The lesson's number in the book. */
  number: number;
  /** "4 Oct", in the player's own calendar. */
  learned: string;
  /** Holes played, in order: 0–5 for the player's pits, 7–12 for the Learner's. */
  moves: number[];
};

export const SPREAD = { width: 1024, height: 704 };

/** Where an entry sits on the spread, as uv (0..1): left page holds two, right page two. */
export function entrySlot(index: number) {
  const page = index < 2 ? 0 : 1;
  const row = index % 2;
  const x0 = page * 0.5 + 0.06;
  const y0 = 0.1 + row * 0.44;
  return { u0: x0, v0: y0, u1: x0 + 0.38, v1: y0 + 0.38 };
}

const INK = "rgb(52 32 18)";
const INK_SOFT = "rgb(52 32 18 / 0.45)";
const GOLD = "rgb(150 92 20)";

function fontFamily(variable: string, fallback: string) {
  const value = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** A tiny board: two rows of six cups and a store at each end, with the lost line numbered in its pits. */
function drawMiniBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, entry: PageEntry, highlight: boolean, serif: string) {
  const h = w * 0.34;
  const cup = w / 8.6;
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = highlight ? GOLD : INK;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h * 0.5);
  ctx.stroke();
  const centres: [number, number][] = [];
  for (let hole = 0; hole < 14; hole++) {
    if (hole === 6 || hole === 13) {
      const cx = hole === 6 ? x + w - cup * 0.95 : x + cup * 0.95;
      centres[hole] = [cx, y + h / 2];
      ctx.beginPath();
      ctx.ellipse(cx, y + h / 2, cup * 0.45, h * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const south = hole < 6;
    const column = south ? hole : 12 - hole;
    const cx = x + cup * 1.95 + column * cup * 1.1;
    const cy = y + h * (south ? 0.71 : 0.29);
    centres[hole] = [cx, cy];
    ctx.beginPath();
    ctx.arc(cx, cy, cup * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The line that lost, step by step: the Learner's moves filled, the player's hollow.
  ctx.font = `${Math.round(cup * 0.52)}px ${serif}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  entry.moves.forEach((hole, i) => {
    const [cx, cy] = centres[hole];
    const learner = hole > 6;
    const offset = entry.moves.slice(0, i).filter((m) => m === hole).length;
    const px = cx + offset * cup * 0.22;
    ctx.beginPath();
    ctx.arc(px, cy, cup * 0.3, 0, Math.PI * 2);
    if (learner) {
      ctx.fillStyle = highlight ? GOLD : INK;
      ctx.fill();
      ctx.fillStyle = "rgb(240 228 200)";
    } else {
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = highlight ? GOLD : INK;
    }
    ctx.fillText(String(i + 1), px, cy + 1);
  });
}

export function paintSpread(canvas: HTMLCanvasElement | OffscreenCanvas, entries: PageEntry[], glowing: number | null) {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const { width, height } = SPREAD;
  ctx.clearRect(0, 0, width, height);
  const serif = fontFamily("--font-instrument", "Georgia, serif");

  // Faint rules, as in a notebook.
  ctx.strokeStyle = "rgb(70 90 120 / 0.13)";
  ctx.lineWidth = 1;
  for (let y = 64; y < height - 30; y += 26) {
    for (const [x0, x1] of [
      [36, width / 2 - 30],
      [width / 2 + 30, width - 36],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
  }

  entries.slice(0, 4).forEach((entry, i) => {
    const slot = entrySlot(i);
    const x = slot.u0 * width;
    const y = slot.v0 * height;
    const w = (slot.u1 - slot.u0) * width;
    const highlight = glowing === i;
    ctx.fillStyle = highlight ? GOLD : INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `italic 34px ${serif}`;
    ctx.fillText(`No. ${entry.number}`, x, y + 30);
    ctx.font = `22px ${serif}`;
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = "right";
    ctx.fillText(entry.learned, x + w, y + 30);
    drawMiniBoard(ctx, x, y + 52, w, entry, highlight, serif);
    // A short stroke under each entry, like a pen lifted off the page.
    ctx.strokeStyle = INK_SOFT;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + 52 + w * 0.34 + 34);
    ctx.lineTo(x + w * 0.7, y + 52 + w * 0.34 + 34);
    ctx.stroke();
  });
}
