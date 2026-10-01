import { EMPTY, GLASS, STONE, WOOD, type Game } from "@/lib/outta/engine";

/*
 * Draws one frame of Outta Here on a canvas: the keyboard strip on top (the
 * hiding place), the screen of blocks, warnings, items, bombs, chasers, the
 * star, and short-lived effects (blasts, chain flashes).
 */

export type Palette = {
  bg: string;
  glass: string;
  grid: string;
  keys: string;
  keyEdge: string;
  keyInk: string;
  wood: string;
  woodDark: string;
  glassBlock: string;
  glassDark: string;
  stone: string;
  stoneDark: string;
  star: string;
  starInk: string;
  exit: string;
  exitInk: string;
  trail: string;
  warn: string;
  bouncer: string;
  eraser: string;
  glitch: string;
  bomb: string;
  chain: string;
  rush: string;
  letter: string;
  letterInk: string;
  seam: string;
  floor: string;
};

export const LIGHT: Palette = {
  bg: "#E4D8C3",
  glass: "#FBF8F1",
  grid: "rgba(43,34,51,0.05)",
  keys: "#F4EEE2",
  keyEdge: "#CDBEA3",
  keyInk: "#8A7C70",
  wood: "#F6B99A",
  woodDark: "#D98A63",
  glassBlock: "#9ED9C0",
  glassDark: "#5FB08E",
  stone: "#8C93A6",
  stoneDark: "#5E6477",
  star: "#FF6B4A",
  starInk: "#2B2233",
  exit: "#F2B230",
  exitInk: "#2B2233",
  trail: "rgba(255,107,74,0.45)",
  warn: "rgba(43,34,51,0.45)",
  bouncer: "#3A86FF",
  eraser: "#FF4F9A",
  glitch: "#7B2FF7",
  bomb: "#2B2233",
  chain: "#00A37A",
  rush: "#F2B230",
  letter: "#2B2233",
  letterInk: "#FBF8F1",
  seam: "#C5B5EE",
  floor: "rgba(242,178,48,0.12)",
};

export const DARK: Palette = {
  bg: "#151B3D",
  glass: "#060918",
  grid: "rgba(233,236,255,0.04)",
  keys: "#1D2450",
  keyEdge: "#0E1330",
  keyInk: "#7880B8",
  wood: "#FFB547",
  woodDark: "#B87618",
  glassBlock: "#2EF2A0",
  glassDark: "#12A86B",
  stone: "#5A6594",
  stoneDark: "#353E6B",
  star: "#FFD66B",
  starInk: "#0B1026",
  exit: "#FFD66B",
  exitInk: "#0B1026",
  trail: "rgba(255,214,107,0.55)",
  warn: "rgba(233,236,255,0.6)",
  bouncer: "#45D2FF",
  eraser: "#FF5FA8",
  glitch: "#B388FF",
  bomb: "#E9ECFF",
  chain: "#2EF2A0",
  rush: "#FFD66B",
  letter: "#E9ECFF",
  letterInk: "#0B1026",
  seam: "#45D2FF",
  floor: "rgba(255,214,107,0.08)",
};

/* The five computers of the Screens campaign each have their own screen, whatever the page theme. */
const world = (base: Palette, change: Partial<Palette>): Palette => ({ ...base, ...change });

export const WORLDS: Record<"green" | "amber" | "micro" | "lcd" | "last", Palette> = {
  green: world(DARK, {
    bg: "#20263F",
    glass: "#03140B",
    grid: "rgba(46,242,160,0.05)",
    keys: "#2A3150",
    keyEdge: "#141A30",
    keyInk: "#6FAF92",
    wood: "#1E9E66",
    woodDark: "#0B5233",
    glassBlock: "#2EF2A0",
    glassDark: "#0E8A57",
    stone: "#2F5A47",
    stoneDark: "#163024",
    starInk: "#03140B",
    exitInk: "#03140B",
    warn: "rgba(46,242,160,0.6)",
    seam: "#2EF2A0",
  }),
  amber: world(DARK, {
    bg: "#2A2218",
    glass: "#140B02",
    grid: "rgba(255,181,71,0.05)",
    keys: "#3A3022",
    keyEdge: "#1C150D",
    keyInk: "#B08A5A",
    wood: "#C77A1E",
    woodDark: "#6E420C",
    glassBlock: "#FFB547",
    glassDark: "#A8650F",
    stone: "#5A4630",
    stoneDark: "#2E2317",
    star: "#FFF3C4",
    starInk: "#140B02",
    exit: "#FFF3C4",
    exitInk: "#140B02",
    trail: "rgba(255,243,196,0.5)",
    warn: "rgba(255,181,71,0.65)",
    chain: "#9CF5D0",
    rush: "#FFF3C4",
    letter: "#FFF3C4",
    letterInk: "#140B02",
    seam: "#FFB547",
  }),
  micro: world(DARK, {
    bg: "#2B2F55",
    glass: "#1B2A9C",
    grid: "rgba(255,255,255,0.05)",
    keys: "#3A3F70",
    keyEdge: "#1C1F40",
    keyInk: "#A9B1E6",
    wood: "#FFE45C",
    woodDark: "#A8922A",
    glassBlock: "#5AF0FF",
    glassDark: "#1F9FB0",
    stone: "#7A82D0",
    stoneDark: "#454C98",
    star: "#FFFFFF",
    starInk: "#1B2A9C",
    exit: "#FFFFFF",
    exitInk: "#1B2A9C",
    trail: "rgba(255,255,255,0.5)",
    warn: "rgba(255,255,255,0.65)",
    bouncer: "#FF5A5A",
    eraser: "#FF6BD6",
    glitch: "#C9A6FF",
    seam: "#5AF0FF",
  }),
  lcd: world(LIGHT, {
    bg: "#3A3F46",
    glass: "#AEB99A",
    grid: "rgba(14,20,12,0.06)",
    keys: "#4A5058",
    keyEdge: "#25292E",
    keyInk: "#AEB99A",
    wood: "#6E7D5C",
    woodDark: "#2F3A2A",
    glassBlock: "#D5E0B8",
    glassDark: "#2F3A2A",
    stone: "#2F3A2A",
    stoneDark: "#0E140C",
    star: "#0E140C",
    starInk: "#AEB99A",
    exit: "#0E140C",
    exitInk: "#AEB99A",
    trail: "rgba(14,20,12,0.35)",
    warn: "rgba(14,20,12,0.6)",
    bouncer: "#2B4C7E",
    eraser: "#8A2E55",
    glitch: "#4B2A7A",
    bomb: "#0E140C",
    chain: "#1E5A3A",
    rush: "#6B4A10",
    letter: "#0E140C",
    letterInk: "#AEB99A",
    seam: "#0E140C",
    floor: "rgba(14,20,12,0.06)",
  }),
  last: world(DARK, {
    bg: "#2A1430",
    glass: "#120712",
    grid: "rgba(255,107,214,0.05)",
    keys: "#3A2042",
    keyEdge: "#1A0A1E",
    keyInk: "#C58BD0",
    wood: "#B98CFF",
    woodDark: "#6A44B0",
    glassBlock: "#45D2FF",
    glassDark: "#1A86AD",
    stone: "#5E4A6E",
    stoneDark: "#33263F",
    starInk: "#120712",
    exitInk: "#120712",
    bouncer: "#7CF0C8",
    eraser: "#FF5FA8",
    glitch: "#F2E9FF",
    seam: "#FF6BD6",
  }),
};

export type Boom = { x: number; y: number; at: number; cells: number[]; chain: boolean };

export type View = {
  cell: number;
  /** Pixel offset of the board's left edge (negative when the camera scrolls). */
  offsetX: number;
  keysH: number;
  width: number;
  height: number;
  now: number;
  reducedMotion: boolean;
};

export function layout(width: number, cols: number, rows: number, focusX: number) {
  const cell = Math.max(14, Math.floor(width / cols));
  const boardW = cell * cols;
  const keysH = Math.round(cell * 1.5);
  let offsetX = Math.floor((width - boardW) / 2);
  if (boardW > width) {
    const want = width / 2 - (focusX + 0.5) * cell;
    offsetX = Math.round(Math.max(width - boardW, Math.min(0, want)));
  }
  return { cell, offsetX, keysH, height: keysH + cell * rows + 6 };
}

/** Sizes the canvas to its wrapper (sharp on high-density screens) and draws the game into it. */
export function paint(canvas: HTMLCanvasElement, wrap: HTMLElement, g: Game, pal: Palette, booms: Boom[], now: number, reducedMotion: boolean) {
  const width = wrap.clientWidth;
  const L = layout(width, g.cols, g.rows, g.player.x);
  const height = L.height + 4;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(ctx, g, { cell: L.cell, offsetX: L.offsetX, keysH: L.keysH, width, height, now, reducedMotion }, pal, booms);
}

export function draw(ctx: CanvasRenderingContext2D, g: Game, v: View, pal: Palette, booms: Boom[]) {
  const { cell: s, offsetX: ox, keysH } = v;
  const oy = keysH + 6;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  ctx.clearRect(0, 0, v.width, v.height);

  // The keyboard strip: where you hide when you walk off the top row.
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, v.width, v.height);
  const keyW = s * 2;
  const labels = "1234567890QWERTYUIOPASDFGHJKLZXC";
  for (let k = 0; k * 2 < g.cols; k++) {
    const kx = X(k * 2) + 1.5;
    roundRect(ctx, kx, 3, keyW - 3, keysH - 8, Math.min(8, s * 0.4));
    ctx.fillStyle = pal.keyEdge;
    ctx.fill();
    roundRect(ctx, kx, 1, keyW - 3, keysH - 11, Math.min(8, s * 0.4));
    ctx.fillStyle = pal.keys;
    ctx.fill();
    ctx.fillStyle = pal.keyInk;
    ctx.font = `600 ${Math.round(s * 0.55)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[k % labels.length], kx + (keyW - 3) / 2, (keysH - 10) / 2 + 1);
  }

  // The screen.
  roundRect(ctx, X(0) - 2, oy - 2, g.cols * s + 4, g.rows * s + 4, 8);
  ctx.fillStyle = pal.glass;
  ctx.fill();
  ctx.fillStyle = pal.grid;
  for (let x = 1; x < g.cols; x++) ctx.fillRect(X(x), oy, 1, g.rows * s);
  for (let y = 1; y < g.rows; y++) ctx.fillRect(X(0), Y(y), g.cols * s, 1);
  if (g.s.floorClear) {
    ctx.fillStyle = pal.floor;
    ctx.fillRect(X(0), Y(g.rows - 1), g.cols * s, s);
  }

  // Edge tunnels: dashed seams on both sides.
  ctx.fillStyle = pal.seam;
  for (let y = 0; y < g.rows * s; y += 8) {
    ctx.fillRect(X(0) - 6, oy + y, 3, 5);
    ctx.fillRect(X(g.cols) + 3, oy + y, 3, 5);
  }

  // The Eraser's road: your trail from where it is now.
  const eraser = g.enemies.find((e) => e.kind === "eraser");
  const from = eraser ? eraser.trailIndex! + 1 : Math.max(0, g.trail.length - 40);
  ctx.fillStyle = pal.trail;
  for (let i = from; i < g.trail.length; i++) {
    const p = g.trail[i];
    ctx.beginPath();
    ctx.arc(X(p.x) + s / 2, Y(p.y) + s / 2, Math.max(1.5, s * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }

  // Blocks.
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) {
      const b = g.grid[g.idx(x, y)];
      if (b !== EMPTY) drawBlock(ctx, X(x), Y(y), s, b, pal);
    }
  }

  // Exit (or, in the finale, the corner where the 1980 program crashed).
  const pulse = v.reducedMotion ? 0 : Math.sin(v.now * 4) * 0.08;
  drawExit(ctx, X(g.exit.x) + s / 2, Y(g.exit.y) + s / 2, s * (0.62 + pulse), pal, g.s.exitMode === "crash");

  // Warnings: what is about to land, and what it will be.
  for (const f of g.falling) {
    const left = Math.max(0, Math.min(1, (f.at - g.t) / g.s.warning));
    const cx = X(f.x);
    const cy = Y(f.y);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = pal.warn;
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx + 2, cy + 2, s - 4, s - 4, 4);
    ctx.stroke();
    ctx.restore();
    const inset = 2 + (s / 2 - 2) * left;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = f.item ? (f.item === "rush" ? pal.rush : pal.chain) : f.block === WOOD ? pal.wood : f.block === GLASS ? pal.glassBlock : pal.stone;
    roundRect(ctx, cx + inset, cy + inset, Math.max(1, s - inset * 2), Math.max(1, s - inset * 2), 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Items.
  for (const it of g.items) {
    const cx = X(it.x) + s / 2;
    const cy = Y(it.y) + s / 2;
    if (it.kind === "letter") {
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = pal.letter;
      ctx.fill();
      ctx.fillStyle = pal.letterInk;
      ctx.font = `800 ${Math.round(s * 0.62)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(it.letter!, cx, cy + 1);
    } else {
      const life = Math.max(0, (it.until - g.t) / 8);
      drawChainIcon(ctx, cx, cy, s * 0.42, it.kind === "rush" ? pal.rush : pal.chain, it.kind === "rush");
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life);
      ctx.strokeStyle = it.kind === "rush" ? pal.rush : pal.chain;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Bombs, with their fuse running round them.
  for (const b of g.bombs) {
    const cx = X(b.x) + s / 2;
    const cy = Y(b.y) + s / 2;
    const left = Math.max(0, (b.at - g.t) / g.s.fuse);
    const throb = v.reducedMotion ? 1 : 1 + (1 - left) * 0.18 * Math.abs(Math.sin(v.now * 14));
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.34 * throb, 0, Math.PI * 2);
    ctx.fillStyle = pal.bomb;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    ctx.strokeStyle = b.chain ? pal.chain : pal.warn;
    ctx.lineWidth = b.chain ? 3 : 2;
    ctx.stroke();
    // Where it will reach.
    ctx.globalAlpha = 0.1 + (1 - left) * 0.12;
    ctx.fillStyle = b.chain ? pal.chain : pal.bomb;
    ctx.fillRect(X(b.x - 1), Y(b.y - 1), s * 3, s * 3);
    ctx.globalAlpha = 1;
  }

  // Blasts and chain flashes.
  for (const boom of booms) {
    const age = v.now - boom.at;
    if (age > 0.45) continue;
    const a = 1 - age / 0.45;
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = boom.chain ? pal.chain : pal.exit;
    ctx.fillRect(X(boom.x - 1), Y(boom.y - 1), s * 3, s * 3);
    ctx.globalAlpha = a;
    for (const i of boom.cells) {
      const x = i % g.cols;
      const y = Math.floor(i / g.cols);
      const grow = v.reducedMotion ? 0 : age * s * 0.6;
      ctx.fillStyle = pal.glassBlock;
      ctx.fillRect(X(x) + s / 2 - s * 0.1 - grow, Y(y) + s / 2 - s * 0.1, s * 0.2, s * 0.2);
      ctx.fillRect(X(x) + s / 2 + grow, Y(y) + s / 2 - grow, s * 0.16, s * 0.16);
    }
    ctx.globalAlpha = 1;
  }

  // Chasers.
  for (const e of g.enemies) {
    if (e.awayUntil > g.t) {
      if (e.kind === "eraser" && e.awayUntil - g.t < 6) {
        ctx.globalAlpha = 0.35;
        drawEraser(ctx, X(e.x) + s / 2, Y(e.y) + s / 2, s, pal, 0);
        ctx.globalAlpha = 1;
      }
      continue;
    }
    const cx = X(e.x) + s / 2;
    const cy = Y(e.y) + s / 2;
    if (e.kind === "bouncer") drawBouncer(ctx, cx, cy, s, pal, v.reducedMotion ? 0 : v.now);
    else if (e.kind === "eraser") drawEraser(ctx, cx, cy, s, pal, v.reducedMotion ? 0 : v.now);
    else drawGlitch(ctx, cx, cy, s, pal, v.reducedMotion ? 0 : v.now);
  }

  // The star.
  const under = g.underKeys();
  const px = X(g.player.x) + s / 2;
  const py = under ? keysH / 2 - 2 : Y(g.player.y) + s / 2;
  const blink = g.t < g.invulnerableUntil && !v.reducedMotion && Math.floor(v.now * 12) % 2 === 0;
  ctx.globalAlpha = under ? 0.75 : blink ? 0.35 : 1;
  if (g.rushLeft() > 0) {
    ctx.beginPath();
    ctx.arc(px, py, s * 0.9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.rushLeft()) / 30);
    ctx.strokeStyle = pal.rush;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  drawStar(ctx, px, py, s * 0.72, pal.star, pal.starInk);
  ctx.globalAlpha = 1;
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, b: number, pal: Palette) {
  const r = Math.max(2, s * 0.22);
  if (b === WOOD) {
    roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
    ctx.fillStyle = pal.wood;
    ctx.fill();
    ctx.strokeStyle = pal.woodDark;
    ctx.lineWidth = 1;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y + (s * k) / 3);
      ctx.quadraticCurveTo(x + s / 2, y + (s * k) / 3 + s * 0.08, x + s * 0.8, y + (s * k) / 3);
      ctx.stroke();
    }
  } else if (b === GLASS) {
    roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
    ctx.fillStyle = pal.glassBlock;
    ctx.fill();
    ctx.strokeStyle = pal.glassDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.25, y + s * 0.2);
    ctx.lineTo(x + s * 0.48, y + s * 0.5);
    ctx.lineTo(x + s * 0.4, y + s * 0.8);
    ctx.moveTo(x + s * 0.48, y + s * 0.5);
    ctx.lineTo(x + s * 0.78, y + s * 0.55);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(x + s * 0.62, y + s * 0.16, s * 0.18, s * 0.08);
  } else if (b === STONE) {
    roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r * 0.6);
    ctx.fillStyle = pal.stone;
    ctx.fill();
    ctx.fillStyle = pal.stoneDark;
    const d = s * 0.24;
    for (const [dx, dy] of [
      [d, d],
      [s - d, d],
      [d, s - d],
      [s - d, s - d],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, Math.max(1, s * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, ink: string) {
  const armW = size * 0.26;
  const armL = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
    ctx.save();
    ctx.rotate(a);
    roundRect(ctx, -armW / 2, -armL / 2, armW, armL, armW / 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(-size * 0.1, -size * 0.05, Math.max(1, size * 0.06), 0, Math.PI * 2);
  ctx.arc(size * 0.1, -size * 0.05, Math.max(1, size * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExit(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, pal: Palette, crash = false) {
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.3);
  ctx.fillStyle = pal.exit;
  ctx.fill();
  ctx.strokeStyle = pal.exitInk;
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (crash) {
    // A crack in the screen.
    ctx.moveTo(cx - size * 0.28, cy - size * 0.26);
    ctx.lineTo(cx - size * 0.02, cy - size * 0.04);
    ctx.lineTo(cx - size * 0.14, cy + size * 0.06);
    ctx.lineTo(cx + size * 0.26, cy + size * 0.28);
  } else {
    ctx.moveTo(cx - size * 0.24, cy);
    ctx.lineTo(cx + size * 0.24, cy);
    ctx.moveTo(cx, cy - size * 0.24);
    ctx.lineTo(cx, cy + size * 0.24);
  }
  ctx.stroke();
}

function eyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, ink = "#16131F") {
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx - s * 0.13, cy - s * 0.04, s * 0.1, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.13, cy - s * 0.04, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(cx - s * 0.11, cy - s * 0.03, s * 0.05, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.15, cy - s * 0.03, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawBouncer(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, pal: Palette, now: number) {
  const squash = 1 + Math.sin(now * 10) * 0.06;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.04, s * 0.42 * squash, (s * 0.42) / squash, 0, 0, Math.PI * 2);
  ctx.fillStyle = pal.bouncer;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  eyes(ctx, cx, cy, s);
}

function drawEraser(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, pal: Palette, now: number) {
  const tilt = Math.sin(now * 6) * 0.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  roundRect(ctx, -s * 0.46, -s * 0.36, s * 0.92, s * 0.72, s * 0.14);
  ctx.fillStyle = pal.eraser;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(-s * 0.46, s * 0.14, s * 0.92, s * 0.1);
  ctx.restore();
  eyes(ctx, cx, cy - s * 0.02, s);
}

function drawGlitch(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, pal: Palette, now: number) {
  const j = now ? Math.sin(now * 37) * s * 0.06 : 0;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#FF3B6B";
  ctx.beginPath();
  ctx.arc(cx - s * 0.06 + j, cy, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#23E0FF";
  ctx.beginPath();
  ctx.arc(cx + s * 0.06 - j, cy, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.glitch;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, cx, cy, s);
}

function drawChainIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, clock: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.3);
  roundRect(ctx, -r * 0.95, -r * 0.35, r * 1.1, r * 0.7, r * 0.35);
  ctx.stroke();
  roundRect(ctx, -r * 0.15, -r * 0.35, r * 1.1, r * 0.7, r * 0.35);
  ctx.stroke();
  ctx.restore();
  if (clock) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** The way you went, small: the blocks at the end, your trail, and the exit. */
export function drawRoute(ctx: CanvasRenderingContext2D, g: Game, width: number, pal: Palette) {
  const c = width / g.cols;
  const h = c * g.rows;
  ctx.clearRect(0, 0, width, h);
  ctx.fillStyle = pal.glass;
  ctx.fillRect(0, 0, width, h);
  ctx.globalAlpha = 0.45;
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) {
      const b = g.grid[g.idx(x, y)];
      if (b === EMPTY) continue;
      ctx.fillStyle = b === WOOD ? pal.wood : b === GLASS ? pal.glassBlock : pal.stone;
      ctx.fillRect(x * c + 0.5, y * c + 0.5, c - 1, c - 1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = pal.star;
  ctx.lineWidth = Math.max(1.5, c * 0.35);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let prev: { x: number; y: number } | null = null;
  for (const p of g.trail) {
    const px = p.x * c + c / 2;
    const py = p.y * c + c / 2;
    // Tunnels and trips under the keys are jumps, not lines across the map.
    if (!prev || p.gap || Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) > 1) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    prev = p;
  }
  ctx.stroke();
  drawExit(ctx, g.exit.x * c + c / 2, g.exit.y * c + c / 2, c * 1.4, pal, g.s.exitMode === "crash");
}
