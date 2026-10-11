import { createRng } from "@/lib/kit/rng";
import { FONT_STACKS } from "../../fonts";
import type { Lettering } from "../style";
import type { PosterPalette } from "./palette";

/*
 * The poster around the scene: a cream (or, at night, deep blue) sheet with
 * a double rule, rosettes in the corners, the title in ornamental wood type
 * across the top, a ribbon along the bottom naming what is happening, and,
 * at the big moments, a headline that stamps in letter by letter. A fine
 * lithographic grain lies over everything.
 */

export type PosterLayout = {
  width: number;
  height: number;
  /** The window the scene is drawn in. */
  image: { x: number; y: number; w: number; h: number };
  header: { y: number; h: number };
  footer: { y: number; h: number };
  unit: number;
};

export function posterLayout(width: number, height: number): PosterLayout {
  const unit = Math.min(width / 1920, height / 1080);
  const side = Math.round(30 * unit);
  const header = Math.round(132 * unit);
  const footer = Math.round(44 * unit);
  return {
    width,
    height,
    image: { x: side, y: header, w: width - side * 2, h: height - header - footer },
    header: { y: 0, h: header },
    footer: { y: height - footer, h: footer },
    unit,
  };
}

/** The sheet behind the scene. */
export function paintPaper(ctx: CanvasRenderingContext2D, layout: PosterLayout, p: PosterPalette) {
  const g = ctx.createRadialGradient(layout.width / 2, layout.height / 2, layout.height * 0.3, layout.width / 2, layout.height / 2, layout.width * 0.75);
  g.addColorStop(0, p.paper);
  g.addColorStop(1, p.paperEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, layout.width, layout.height);
}

/** The rules round the image window, the corner rosettes, the title, the ribbon and the stamped headline. */
export function paintFrame(ctx: CanvasRenderingContext2D, layout: PosterLayout, p: PosterPalette, text: Lettering) {
  const { image: im, unit: u } = layout;
  ctx.save();
  // Double rule: ink, gold, ink.
  const rule = (inset: number, width: number, colour: string) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.strokeRect(im.x - inset, im.y - inset, im.w + inset * 2, im.h + inset * 2);
  };
  rule(0, 3 * u, p.ink);
  rule(7 * u, 5 * u, p.frameGold);
  rule(12 * u, 1.6 * u, p.ink);
  for (const [cx, cy] of [
    [im.x, im.y],
    [im.x + im.w, im.y],
    [im.x, im.y + im.h],
    [im.x + im.w, im.y + im.h],
  ]) {
    rosette(ctx, cx, cy, 15 * u, p);
  }

  // The title, with a solid ink shadow as a two-colour print would have it.
  const titleSize = Math.round(70 * u);
  ctx.font = `${titleSize}px ${FONT_STACKS.headline}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleY = layout.header.h * 0.58;
  spacedText(ctx, text.title, layout.width / 2 + 4 * u, titleY + 4 * u, 0.06 * titleSize, p.titleShadow);
  spacedText(ctx, text.title, layout.width / 2, titleY, 0.06 * titleSize, p.title);
  // Little suns on either side of the title.
  const titleWidth = measureSpaced(ctx, text.title, 0.06 * titleSize);
  for (const side of [-1, 1]) sunMark(ctx, layout.width / 2 + side * (titleWidth / 2 + 46 * u), titleY - titleSize * 0.33, 18 * u, p);
  ctx.font = `italic ${Math.round(22 * u)}px ${FONT_STACKS.print}`;
  ctx.fillStyle = p.subtitle;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text.subtitle, layout.width / 2, layout.header.h - 26 * u);
  ctx.globalAlpha = 1;

  if (text.ribbon) ribbon(ctx, layout, p, text.ribbon);
  ctx.restore();
}

/** The headline that stamps in over the scene, each letter landing with a thump, a little after the last. */
export function paintStamp(ctx: CanvasRenderingContext2D, layout: PosterLayout, p: PosterPalette, stamp: { text: string; t: number }) {
  const { image: im, unit: u } = layout;
  const size = Math.round(150 * u);
  ctx.save();
  ctx.font = `${size}px ${FONT_STACKS.headline}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const letters = [...stamp.text];
  const spacing = 0.04 * size;
  const widths = letters.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = layout.width / 2 - total / 2;
  const baseline = im.y + im.h * 0.23;
  letters.forEach((ch, i) => {
    const w = widths[i];
    const local = stamp.t - i * 0.09;
    if (local <= 0 || ch === " ") {
      x += w;
      return;
    }
    // Falls in big, overshoots a touch, settles.
    const k = Math.min(1, local / 0.32);
    const scale = k < 1 ? 2.4 - 1.5 * (k * k) + 0.1 * Math.sin(k * Math.PI) : 1;
    const alpha = Math.min(1, local / 0.12);
    const cx = x + (w - spacing) / 2;
    ctx.save();
    ctx.translate(cx, baseline - size * 0.35);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.titleShadow;
    ctx.fillText(ch, 6 * u, size * 0.35 + 6 * u);
    ctx.fillStyle = p.frameRed;
    ctx.fillText(ch, 0, size * 0.35);
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = p.frameGold;
    ctx.strokeText(ch, 0, size * 0.35);
    ctx.restore();
    x += w;
  });
  ctx.restore();
}

function ribbon(ctx: CanvasRenderingContext2D, layout: PosterLayout, p: PosterPalette, label: string) {
  const u = layout.unit;
  const size = Math.round(38 * u);
  ctx.font = `${size}px ${FONT_STACKS.banner}`;
  const width = measureSpaced(ctx, label, size * 0.12) + 120 * u;
  const h = 56 * u;
  const cx = layout.width / 2;
  // The ribbon sits across the window's bottom rule, as a printed banner does.
  const cy = layout.image.y + layout.image.h;
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const notch = 18 * u;
  // The folded tails behind, then the band.
  ctx.fillStyle = mixDark(p.frameRed);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? x0 : x1;
    const tail = edge + side * 54 * u;
    ctx.beginPath();
    ctx.moveTo(edge - side * 10 * u, cy - h * 0.32);
    ctx.lineTo(tail, cy - h * 0.32);
    ctx.lineTo(tail - side * notch, cy + h * 0.18);
    ctx.lineTo(tail, cy + h * 0.68);
    ctx.lineTo(edge - side * 10 * u, cy + h * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.rect(x0, cy - h / 2, width, h);
  ctx.fillStyle = p.frameRed;
  ctx.fill();
  ctx.lineWidth = 2.5 * u;
  ctx.strokeStyle = p.ink;
  ctx.stroke();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = p.frameGold;
  ctx.strokeRect(x0 + 6 * u, cy - h / 2 + 6 * u, width - 12 * u, h - 12 * u);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  spacedText(ctx, label, cx, cy + 2 * u, size * 0.12, "#fbf1dc");
}

function rosette(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: PosterPalette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = p.frameGold;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = Math.max(1, r * 0.1);
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.45, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = p.frameRed;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function sunMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: PosterPalette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = p.frameGold;
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    ctx.lineTo(Math.cos(a) * r * (i % 2 ? 1.05 : 1.3), Math.sin(a) * r * (i % 2 ? 1.05 : 1.3));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = p.frameGold;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = p.ink;
  ctx.stroke();
  ctx.restore();
}

function measureSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
}

/** Text with letter spacing, centred on x. */
function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, colour: string) {
  const total = measureSpaced(ctx, text, spacing);
  let at = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  ctx.fillStyle = colour;
  for (const ch of text) {
    ctx.fillText(ch, at, y);
    at += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

const mixDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.72);
  return `rgb(${f((n >> 16) & 255)} ${f((n >> 8) & 255)} ${f(n & 255)})`;
};

/* ---------- The lithographic grain ---------- */

const grainTiles = new Map<string, HTMLCanvasElement>();

/** A speckle of ink and paper over everything, as a stone print has. */
export function paintGrain(ctx: CanvasRenderingContext2D, layout: PosterLayout, dark: boolean) {
  const key = dark ? "dark" : "light";
  let tile = grainTiles.get(key);
  if (!tile) {
    tile = document.createElement("canvas");
    tile.width = 256;
    tile.height = 256;
    const g = tile.getContext("2d")!;
    const rng = createRng(`sol-y-sombra/grain/${key}`);
    for (let i = 0; i < 2600; i++) {
      const x = rng.float() * 256;
      const y = rng.float() * 256;
      const r = 0.3 + rng.float() * 0.9;
      g.fillStyle = dark ? `rgb(255 240 210 / ${0.05 + rng.float() * 0.12})` : `rgb(40 25 10 / ${0.05 + rng.float() * 0.16})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // A few crayon drags.
    for (let i = 0; i < 70; i++) {
      const x = rng.float() * 256;
      const y = rng.float() * 256;
      g.strokeStyle = dark ? "rgb(255 240 210 / 0.05)" : "rgb(40 25 10 / 0.06)";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng.float() - 0.5) * 14, y + (rng.float() - 0.5) * 3);
      g.stroke();
    }
    grainTiles.set(key, tile);
  }
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.restore();
}
