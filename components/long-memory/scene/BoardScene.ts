/*
 * The board as the screens use it. It owns the renderer, the seeds and
 * their choreography, and turns what the rules say happened (a MoveOutcome)
 * into seeds flying, pouring and settling. It also answers the questions the
 * input needs: which pit is under the pointer, where a pit is on screen, and
 * where in the room the pointer is when the player carries seeds by hand.
 *
 * It knows nothing about turns or opponents; the screens do.
 */

import { HOLES, isStore, NORTH_STORE, pitsOf, SOUTH_STORE, type Board } from "@/lib/long-memory/board";
import type { MoveOutcome } from "@/lib/long-memory/rules";
import { createRng } from "@/lib/kit/rng";
import { Choreographer, NORMAL_TEMPO, type Tempo } from "./choreography";
import { BOOK } from "./book";
import { BOARD, HOLLOWS, holeTop, PIT } from "./layout";

/** Counts sit on the wood between each pit and the long edge nearest it. */
const PIT_EDGE = PIT.rowZ + PIT.radius + 1.05;
import { invert, type Vec3 } from "./math";
import { bookPoseAt, ghostsAt, memorySprites, type Remembering } from "./memory";
import type { PageEntry } from "./pages";
import { BoardRenderer, type SafeArea, type SceneFrame, type SeedPose, type Sprite } from "./Renderer";
import { makeSeed, settleInto, type Impact, type Seed } from "./seeds";
import { FADE_AFTER_LANDING, flightSprites } from "./trails";

const TRAIL_LAGS = [0.02, 0.04, 0.06, 0.08, 0.1];

/** The light board's longest wait between drawings: about 30 a second. */
const LIGHT_FRAME_SECONDS = 1 / 32;

export const TEMPOS: Record<"relaxed" | "normal" | "brisk", Tempo & { scale: number }> = {
  relaxed: { ...NORMAL_TEMPO, interval: 0.24, scale: 0.85 },
  normal: { ...NORMAL_TEMPO, scale: 1 },
  brisk: { ...NORMAL_TEMPO, interval: 0.13, lift: 0.32, scale: 1.45 },
};

export type Preview = {
  /** The holes the seeds would go to, in order. */
  path: number[];
  /** Pits the move would capture from. */
  captures: number[];
  /** The move earns another one. */
  extra: boolean;
};

export type Marks = {
  preview?: Preview | null;
  /** The pit the keyboard has selected. */
  focus?: number | null;
  /** The pit under the pointer. */
  hover?: number | null;
  /** Pits that can be sown now, softly lit when the player is choosing. */
  choosable?: number[];
  /** The pit the hidden help suggests. */
  hint?: number | null;
};

type Palette = { accent: Vec3; ghost: Vec3; glow: Vec3; capture: Vec3; hint: Vec3 };
const PALETTES: Record<"day" | "night", Palette> = {
  day: { accent: [0.62, 0.3, 0.08], ghost: [0.2, 0.42, 0.95], glow: [1, 0.66, 0.24], capture: [0.75, 0.38, 0.06], hint: [0.1, 0.52, 0.3] },
  night: { accent: [1, 0.68, 0.32], ghost: [0.42, 0.7, 1], glow: [1, 0.7, 0.32], capture: [1, 0.82, 0.45], hint: [0.45, 0.95, 0.62] },
};

export class BoardScene {
  readonly renderer: BoardRenderer;
  private scene: Choreographer;
  private width = 1;
  private height = 1;
  private dark = false;
  private marks: Marks = {};
  private remembering: Remembering | null = null;
  private running = false;
  private raf = 0;
  private last = 0;
  private speed = 1;
  private seedLabel = "board";
  private pitShapes: { hole: number; cx: number; cy: number; rx: number; ry: number }[] = [];
  /** Counts as the seeds show them; called when a seed lands or leaves. */
  onCounts?: (counts: number[]) => void;
  /** Hard knocks for the sound: seed on wood or seed on seed. */
  onImpact?: (impact: Impact) => void;
  /** Called when the camera has come to rest somewhere new, so the HUD can move with it. */
  onCamera?: () => void;
  /** Called once if the board cannot be drawn after all: a shader the graphics driver refused. */
  onFailed?: () => void;
  /** Frames drawn per second, for the performance notes. */
  fps = 0;
  /** Something changed that the light board has not drawn yet (see `needsDrawing`). */
  private stale = true;
  private safeTarget: SafeArea | null = null;
  private safeNow: SafeArea | null = null;
  private shownCounts = "";
  /** Bumped whenever a new position is laid out: an animation from an older board must not touch the new one. */
  private generation = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new BoardRenderer(canvas);
    this.scene = new Choreographer([]);
  }

  /* ---------- Setup ---------- */

  setAppearance(dark: boolean, immediately = false) {
    this.dark = dark;
    this.renderer.setAppearance(dark, immediately);
    this.stale = true;
  }

  /** The board is drawn at the light level of detail (no graphics card, or a slow one). */
  get light() {
    return this.renderer.detail === "light";
  }

  /** Where on the canvas the board should sit; with `glide`, the camera eases there over half a second. */
  setSafeArea(safe: SafeArea, glide = false) {
    this.safeTarget = safe;
    this.stale = true;
    if (!glide || !this.safeNow) {
      this.safeNow = safe;
      this.renderer.setSafeArea(safe);
      this.measurePits();
      this.onCamera?.();
    }
  }

  private glideCamera(dt: number) {
    const target = this.safeTarget;
    const now = this.safeNow;
    if (!target || !now || target === now) return;
    const k = 1 - Math.exp(-dt * 7);
    const next = {
      left: now.left + (target.left - now.left) * k,
      right: now.right + (target.right - now.right) * k,
      top: now.top + (target.top - now.top) * k,
      bottom: now.bottom + (target.bottom - now.bottom) * k,
    };
    const close = Math.abs(next.left - target.left) + Math.abs(next.right - target.right) + Math.abs(next.top - target.top) + Math.abs(next.bottom - target.bottom) < 0.002;
    this.safeNow = close ? target : next;
    this.renderer.setSafeArea(this.safeNow);
    if (close) {
      this.measurePits();
      this.onCamera?.();
    }
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;
    this.renderer.resize(width, height, pixelRatio);
    this.measurePits();
    this.stale = true;
  }

  /** For the Hall's card: the board alone fills the frame. */
  frameBoardOnly() {
    this.renderer.frameBoardOnly();
    this.measurePits();
  }

  setTempo(tempo: keyof typeof TEMPOS) {
    this.speed = TEMPOS[tempo].scale;
  }

  setPages(entries: PageEntry[], glowing: number | null) {
    this.renderer.setPages(entries, glowing);
    this.stale = true;
  }

  /** Lays out a position at once: every seed already resting in its hole. */
  setBoard(board: Board, label = "board") {
    this.seedLabel = label;
    const rng = createRng(`same-trick-twice/${label}/seeds`);
    const seeds: Seed[] = [];
    board.forEach((count, hole) => {
      for (let i = 0; i < count; i++) seeds.push(makeSeed(seeds.length, hole, rng));
    });
    settleInto(seeds, `same-trick-twice/${label}/settle`);
    this.scene = new Choreographer(seeds);
    this.generation += 1;
    this.stale = true;
    this.publishCounts(true);
  }

  get counts() {
    return [...this.scene.counts];
  }

  /* ---------- Moves ---------- */

  /**
   * Animates a move the rules have already decided: the sowing, then any
   * capture, then the end-of-game sweep. Resolves when every seed has
   * settled. With `instant` (reduced motion, or a skip) it lands at once.
   */
  async animate(outcome: MoveOutcome, tempo: keyof typeof TEMPOS = "normal", instant = false) {
    const t = TEMPOS[tempo];
    const s = this.scene;
    const generation = this.generation;
    const start = s.time + 0.02;
    let done = s.sow(outcome.pit, outcome.path, start, t);
    if (outcome.captures.length) {
      const capture = outcome.captures[0];
      const at = done + 0.12;
      done = Math.max(done, at + 0.9);
      s.at(at, () => s.capture(capture.from, capture.to, at));
    }
    if (outcome.sweep) {
      const at = done + 0.2;
      s.at(at, () => {
        s.capture(pitsOf("south"), SOUTH_STORE, at);
        s.capture(pitsOf("north"), NORTH_STORE, at);
      });
    }
    if (instant) s.finish();
    await this.whenSettled(generation);
    if (generation === this.generation) this.reconcile(outcome.next.board);
  }

  /** Lands everything that is in the air now. */
  skip() {
    this.scene.finish();
  }

  get busy() {
    return this.scene.busy;
  }

  /** Resolves when every seed is still, or at once if the board has been laid out anew meanwhile. */
  private whenSettled(generation = this.generation) {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (generation !== this.generation || (!this.scene.busy && this.scene.seeds.every((s) => s.asleep || s.carried))) resolve();
        else window.setTimeout(check, 60);
      };
      check();
    });
  }

  /** The seeds must agree with the rules; if they ever do not, lay the position out again. */
  private reconcile(board: Board) {
    const counts = Array.from({ length: HOLES }, (_, h) => this.scene.seeds.filter((s) => s.hole === h).length);
    if (counts.some((c, h) => c !== board[h])) this.setBoard(board, `${this.seedLabel}/again`);
    this.publishCounts(true);
  }

  /* ---------- Carrying seeds by hand ---------- */

  pickUp(pit: number) {
    return this.scene.pickUp(pit);
  }

  /** Moves the carried cluster to follow a point on screen. */
  carryTo(x: number, y: number) {
    const point = this.pointOnPlane(x, y, BOARD.top + 4.6);
    if (point) this.scene.moveCarry(point);
  }

  dropOne(hole: number) {
    return this.scene.dropOne(hole);
  }

  async sowRest(path: number[], tempo: keyof typeof TEMPOS = "normal") {
    this.scene.sowRest(path, TEMPOS[tempo]);
    await this.whenSettled();
  }

  putBack(pit: number) {
    this.scene.putBack(pit);
  }

  /** After a hand-sown move: any capture and sweep, then settle and check against the rules. */
  async finishHandMove(outcome: MoveOutcome) {
    const generation = this.generation;
    await this.whenSettled(generation);
    if (generation !== this.generation) return;
    const s = this.scene;
    let at = s.time + 0.1;
    if (outcome.captures.length) {
      const capture = outcome.captures[0];
      s.capture(capture.from, capture.to, at);
      at += 0.9;
    }
    if (outcome.sweep) {
      const when = at + 0.2;
      s.at(when, () => {
        s.capture(pitsOf("south"), SOUTH_STORE, when);
        s.capture(pitsOf("north"), NORTH_STORE, when);
      });
    }
    await this.whenSettled(generation);
    if (generation === this.generation) this.reconcile(outcome.next.board);
  }

  /* ---------- Marks, memory ---------- */

  setMarks(marks: Marks) {
    this.marks = marks;
    this.stale = true;
  }

  /** Who hears the seeds knock (null: nobody, as behind the game menu). */
  listen(listener: ((impact: Impact) => void) | null) {
    this.onImpact = listener ?? undefined;
  }

  /** Starts (or clears) the Learner's moment of remembering, timed from now. */
  remember(memory: Omit<Remembering, "start"> | null) {
    this.remembering = memory ? { ...memory, start: this.scene.time } : null;
    this.stale = true;
  }

  /* ---------- Where things are on screen ---------- */

  toScreen(p: Vec3) {
    return this.renderer.toScreen(p);
  }

  private measurePits() {
    this.pitShapes = HOLLOWS.map((h) => {
      const c = this.renderer.toScreen([h.cx, BOARD.top - h.depth * 0.3, h.cz]);
      const right = this.renderer.toScreen([h.cx + h.ax, BOARD.top, h.cz]);
      const near = this.renderer.toScreen([h.cx, BOARD.top, h.cz + h.az]);
      const far = this.renderer.toScreen([h.cx, BOARD.top, h.cz - h.az]);
      return { hole: h.hole, cx: c.x, cy: (near.y + far.y) / 2, rx: Math.abs(right.x - c.x), ry: Math.abs(near.y - far.y) / 2 };
    });
  }

  /** Where the HUD writes things: a count by each pit, the totals beyond the ends of the board. */
  hudAnchors() {
    const point = (p: Vec3) => {
      const s = this.renderer.toScreen(p);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    };
    return {
      counts: HOLLOWS.map((h) => point([h.cx, BOARD.top, Math.sign(h.cz || 1) * (PIT_EDGE)])),
      learnerScore: point([-BOARD.halfLength - 7.5, BOARD.top * 0.5, 1]),
      playerScore: point([BOARD.halfLength + 7.5, BOARD.top * 0.5, 1]),
      book: point([BOOK.position[0] + 2, BOOK.cover + BOOK.pages + 1, BOOK.position[2]]),
    };
  }

  /** Each hole's opening on screen, as an ellipse in CSS pixels. */
  get pitEllipses() {
    return this.pitShapes;
  }

  /** The hole under a point on the canvas, if any (a little generous at the rim). */
  holeAt(x: number, y: number): number | null {
    let best: number | null = null;
    let bestD = 1.18;
    for (const p of this.pitShapes) {
      const d = Math.hypot((x - p.cx) / p.rx, (y - p.cy) / p.ry);
      if (d < bestD) {
        bestD = d;
        best = p.hole;
      }
    }
    return best;
  }

  /** The point at height `y` in the room under a point on the canvas. */
  private pointOnPlane(x: number, y: number, height: number): Vec3 | null {
    const inverse = invert(this.renderer.viewProjection);
    const ndcX = (x / this.width) * 2 - 1;
    const ndcY = 1 - (y / this.height) * 2;
    const unproject = (z: number): Vec3 => {
      const m = inverse;
      const wx = m[0] * ndcX + m[4] * ndcY + m[8] * z + m[12];
      const wy = m[1] * ndcX + m[5] * ndcY + m[9] * z + m[13];
      const wz = m[2] * ndcX + m[6] * ndcY + m[10] * z + m[14];
      const w = m[3] * ndcX + m[7] * ndcY + m[11] * z + m[15];
      return [wx / w, wy / w, wz / w];
    };
    const a = unproject(-1);
    const b = unproject(1);
    const t = (height - a[1]) / (b[1] - a[1]);
    if (!Number.isFinite(t)) return null;
    const p: Vec3 = [a[0] + (b[0] - a[0]) * t, height, a[2] + (b[2] - a[2]) * t];
    // Keep a carried handful over the table near the board.
    p[0] = Math.max(-BOARD.halfLength - 4, Math.min(BOARD.halfLength + 4, p[0]));
    p[2] = Math.max(-BOARD.halfWidth - 6, Math.min(BOARD.halfWidth + 6, p[2]));
    return p;
  }

  /* ---------- The loop ---------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    let frames = 0;
    let since = this.last;
    let undrawn = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      // Booked first, so a frame that fails can never stop the board for good.
      this.raf = requestAnimationFrame(loop);
      // A long gap (a hidden tab) must not jump the seeds; the light board's slow frames still keep time.
      const dt = Math.min(this.light ? 0.25 : 0.1, (now - this.last) / 1000);
      this.last = now;
      this.glideCamera(dt);
      this.scene.advance(dt * this.speed);
      for (const impact of this.scene.impacts.splice(0)) this.onImpact?.(impact);
      this.publishCounts();
      undrawn += dt;
      if (!this.drawable()) return;
      // The light board draws only when something has changed, and then at most about 30 times a second: between moves the processor is the player's.
      if (!this.light || (undrawn >= LIGHT_FRAME_SECONDS && this.needsDrawing())) {
        this.renderer.render(this.frame(), undrawn);
        undrawn = 0;
        this.stale = false;
        frames++;
      }
      if (now - since > 1000) {
        this.fps = Math.round((frames * 1000) / (now - since));
        frames = 0;
        since = now;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  /**
   * Whether the shaders are ready. They compile in the background where the
   * browser allows it, so the page answers at once; the canvas is shown
   * (`data-ready`) with the first frame drawn. `data-detail` says which level
   * of detail it draws, for anyone checking in the browser's tools.
   */
  private drawable() {
    try {
      if (!this.renderer.ready) return false;
    } catch (error) {
      this.stop();
      reportError(error);
      this.onFailed?.();
      return false;
    }
    this.canvas.dataset.ready = "true";
    this.canvas.dataset.detail = this.renderer.detail;
    return true;
  }

  /** Whether the light board has anything new to show: seeds or the camera moving, trails fading, the book at work, a mark changed. */
  private needsDrawing() {
    const s = this.scene;
    if (this.stale || s.busy || this.remembering || this.safeNow !== this.safeTarget || !this.renderer.settled) return true;
    if (s.flights.some((f) => s.time - (f.start + f.duration) < FADE_AFTER_LANDING)) return true;
    return s.seeds.some((seed) => !seed.asleep);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Draws one frame now, for a paused or off-screen scene that still needs to show a change. */
  drawOnce() {
    if (this.drawable()) this.renderer.render(this.frame(), 0);
  }

  private publishCounts(force = false) {
    const key = this.scene.counts.join(",");
    if (force || key !== this.shownCounts) {
      this.shownCounts = key;
      this.onCounts?.([...this.scene.counts]);
    }
  }

  private frame(): SceneFrame {
    const { seeds, resting } = this.scene.ordered();
    const trails: SeedPose[] = [];
    for (const seed of this.scene.seeds) {
      if (!this.scene.isFlying(seed)) continue;
      TRAIL_LAGS.forEach((lag, i) => {
        const pos = this.scene.trailOf(seed, lag);
        if (pos) trails.push({ ...seed, pos, look: [seed.look[0], seed.look[1], seed.look[2], 0.62 + i * 0.075] });
      });
    }
    const palette = PALETTES[this.dark ? "night" : "day"];
    const book = bookPoseAt(this.remembering, this.scene.time);
    const sprites: Sprite[] = [
      ...this.markSprites(palette),
      ...flightSprites(this.scene.flights, this.scene.time, this.dark),
      ...memorySprites(this.remembering, this.scene.time, book, palette.ghost, palette.glow, this.dark),
    ];
    return { seeds, resting, trails, ghosts: ghostsAt(this.remembering, this.scene.time), sprites, book };
  }

  /** Rings and dots for choosing a move: the pits you may sow, the one under the pointer, and the path it would take. */
  private markSprites(palette: Palette): Sprite[] {
    const sprites: Sprite[] = [];
    const ring = (hole: number, color: Vec3, alpha: number, radius = 0.84, grow = 1.28) => {
      const h = HOLLOWS[hole];
      sprites.push({ kind: "ring", pos: [h.cx, BOARD.top + 0.06, h.cz], size: h.ax * grow, color, alpha, ring: radius, stretch: h.az / h.ax });
    };
    const { preview, focus, hover, choosable, hint } = this.marks;
    // The light board holds still between moves, so its rings don't pulse.
    const pulse = this.light ? 0.9 : 0.75 + 0.25 * Math.sin(this.scene.time * 3.2);
    for (const hole of choosable ?? []) ring(hole, palette.accent, 0.16 * pulse, 0.86, 1.22);
    if (hover !== null && hover !== undefined) ring(hover, palette.accent, 0.55);
    if (focus !== null && focus !== undefined && focus !== hover) ring(focus, palette.accent, 0.75, 0.8, 1.34);
    if (hint !== null && hint !== undefined) {
      ring(hint, palette.hint, 0.9 * pulse, 0.9, 1.56);
      ring(hint, palette.hint, 0.4 * pulse, 0.72, 1.14);
    }
    if (preview) {
      preview.path.forEach((hole, i) => {
        const last = i === preview.path.length - 1;
        const top = holeTop(hole);
        // Several seeds into one hole on a long lap stack their dots.
        const repeat = preview.path.slice(0, i).filter((h) => h === hole).length;
        const offset = isStore(hole) ? (repeat - 1) * 1.1 : repeat * 0.9;
        if (!last) sprites.push({ kind: "dot", pos: [top[0] + offset, BOARD.top + 0.08, top[2]], size: 0.42, color: palette.accent, alpha: 0.85 });
      });
      const landing = preview.path[preview.path.length - 1];
      if (landing !== undefined) ring(landing, preview.extra ? palette.glow : palette.accent, 0.95, 0.8, 1.38);
      for (const hole of preview.captures) ring(hole, palette.capture, 0.9, 0.78, 1.4);
    }
    return sprites;
  }

  dispose() {
    this.stop();
    this.renderer.dispose();
  }
}
