import type { Performance } from "@/lib/music/perform/cues";
import { Painter, type Light } from "./paint";

/*
 * What every show shares: a camera that fits a scene's world into whatever
 * size the view has (a laptop gives a wide letterbox, a phone a near
 * square), a painter, and a backdrop painted once per size and theme and
 * reused every frame.
 */

export type Theme = "light" | "dark";

export type FrameInfo = {
  /** Arrangement beat now playing. */
  beat: number;
  /** Song seconds at that beat. */
  t: number;
  /** Seconds of wall time since the view opened: rain, steam and breathing keep moving while paused. */
  wall: number;
  theme: Theme;
  reduced: boolean;
  /** Drawing without a graphics card: skip the shading passes so big bands stay smooth. */
  software?: boolean;
  muted: Set<string>;
  playing: boolean;
};

/** A clickable performer, in CSS pixels of the view. */
export type Region = { ids: string[]; label: string; x: number; y: number; w: number; h: number };

export interface Show {
  readonly caption: string;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, frame: FrameInfo): void;
  regions(w: number, h: number): Region[];
}

export type World = {
  /** The part of the world that must always be seen. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Where the floor line sits, so a tall view shows more ceiling, not more floor. */
  floor?: number;
};

/** Maps world units to the view: fits the important part, then shows as much around it as the shape allows. */
export class Camera {
  scale = 1;
  ox = 0;
  oy = 0;
  w = 1;
  h = 1;

  fit(w: number, h: number, world: World) {
    this.w = w;
    this.h = h;
    const ww = world.x1 - world.x0;
    const wh = world.y1 - world.y0;
    this.scale = Math.min(w / ww, h / wh);
    const cx = (world.x0 + world.x1) / 2;
    this.ox = w / 2 - cx * this.scale;
    // Spare height goes above the scene: the floor stays near the bottom of the view.
    const spare = h - wh * this.scale;
    this.oy = h - spare * 0.18 - world.y1 * this.scale;
  }

  /** The world rectangle the view shows. */
  get view() {
    return { x0: -this.ox / this.scale, x1: (this.w - this.ox) / this.scale, y0: -this.oy / this.scale, y1: (this.h - this.oy) / this.scale };
  }

  apply(ctx: CanvasRenderingContext2D, dpr: number) {
    ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.ox, dpr * this.oy);
  }

  toScreen(x: number, y: number) {
    return { x: x * this.scale + this.ox, y: y * this.scale + this.oy };
  }
}

/** A backdrop painted into its own canvas whenever the size or theme changes. */
export class BackdropCache {
  private canvas?: HTMLCanvasElement;
  private key = "";

  draw(ctx: CanvasRenderingContext2D, key: string, w: number, h: number, dpr: number, paint: (bg: CanvasRenderingContext2D) => void) {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    const fullKey = `${key}|${pw}x${ph}`;
    if (!this.canvas || this.key !== fullKey) {
      this.canvas ??= document.createElement("canvas");
      this.canvas.width = pw;
      this.canvas.height = ph;
      const bg = this.canvas.getContext("2d")!;
      bg.setTransform(1, 0, 0, 1, 0, 0);
      bg.clearRect(0, 0, pw, ph);
      paint(bg);
      this.key = fullKey;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }
}

/** The common shape of a show: a camera, a painter and a cached backdrop. */
export abstract class Scene implements Show {
  abstract readonly caption: string;
  protected readonly perf: Performance;
  protected readonly camera = new Camera();
  protected readonly backdrop = new BackdropCache();
  protected painter?: Painter;

  constructor(perf: Performance) {
    this.perf = perf;
  }

  protected abstract world(w: number, h: number): World;
  protected abstract light(theme: Theme): Light;
  protected abstract paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme): void;
  protected abstract paintScene(p: Painter, frame: FrameInfo): void;
  /** Anything behind the cached backdrop that changes as the music goes (a sky that darkens). The backdrop must leave it uncovered. */
  protected paintSky?(ctx: CanvasRenderingContext2D, frame: FrameInfo): void;
  abstract regions(w: number, h: number): Region[];

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, frame: FrameInfo) {
    this.camera.fit(w, h, this.world(w, h));
    if (this.paintSky) {
      this.camera.apply(ctx, dpr);
      this.paintSky(ctx, frame);
    }
    this.backdrop.draw(ctx, `${frame.theme}|${frame.reduced}`, w, h, dpr, (bg) => {
      this.camera.apply(bg, dpr);
      this.paintBackdrop(bg, frame.theme);
    });
    this.camera.apply(ctx, dpr);
    const full = this.light(frame.theme);
    const light = frame.software ? { ...full, rim: undefined, shadeAmount: 0 } : full;
    if (!this.painter || this.painter.ctx !== ctx) this.painter = new Painter(ctx, light);
    this.painter.light = light;
    this.paintScene(this.painter, frame);
  }

  /** A world rectangle as a region in view pixels. */
  protected region(ids: string[], label: string, x0: number, y0: number, x1: number, y1: number): Region {
    const a = this.camera.toScreen(x0, y0);
    const b = this.camera.toScreen(x1, y1);
    return { ids, label, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }
}
