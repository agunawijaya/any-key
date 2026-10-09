import { drawLayer, GOBI_LAYERS, surfaceY, type GroundView } from "./dunes";
import { css, lightAt, smoothstep, type Light } from "./light";
import { drawSkyGradient, drawSun, NightSky, sunPosition, type SkyView } from "./sky";

/*
 * The trek as a side-on diorama: sky, ranges, dunes and the sand under the
 * camel, with whatever stands on it. One canvas, drawn back to front. A scene
 * (the trek, the night camp, the party) draws its actors through hooks:
 * between ground layers for things in the distance, or over the ground.
 *
 * The sky and the three farthest layers barely change from one frame to the
 * next, so they are painted into an offscreen backdrop and only repainted
 * when the clock or the far dunes have moved, or a few times a second for
 * the stars' twinkle. Scenes hook in from layer 3 up.
 */

export type DioramaFrame = {
  /** Hours since midnight on the trek's clock. */
  clock: number;
  /** Seconds of animation time. */
  time: number;
  /** How far the ground has slid past, in pixels at this size. */
  travel: number;
  /** Raises the near ground, as a share of the height, to clear controls along the bottom. */
  lift?: number;
};

export type SceneInfo = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  horizon: number;
  light: Light;
  time: number;
  /** The y of the sand the camel walks on, at screen x. */
  groundAt: (x: number) => number;
  ground: GroundView;
};

export type SceneHooks = {
  /** Called before ground layer `index` is drawn (0 is the far ranges). */
  beforeLayer?: (index: number, info: SceneInfo) => void;
  /** Called after all the ground is drawn. */
  overlay?: (info: SceneInfo) => void;
  /** Light added to the sand by the scene's own lamps, at a point. */
  glowAt?: (x: number, y: number) => [number, number, number];
};

export const GROUND_LAYER = GOBI_LAYERS.length - 1;

/** Layers below this index live in the cached backdrop. */
const BACKDROP_LAYERS = 3;

/** How often the backdrop repaints while nothing moves, for the twinkle. */
const TWINKLES_PER_SECOND = 3;

export class Diorama {
  private ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private night: NightSky;
  private backdrop: HTMLCanvasElement;
  private backdropKey = "";

  constructor(
    private canvas: HTMLCanvasElement,
    seed: number,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.night = new NightSky(seed);
    this.backdrop = document.createElement("canvas");
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    this.backdrop.width = this.canvas.width;
    this.backdrop.height = this.canvas.height;
    this.backdropKey = "";
    this.night.build(this.skyView(), this.pole());
  }

  private skyView(): SkyView {
    return { width: this.width, height: this.height, horizon: this.height * 0.6 };
  }

  /** The celestial pole: up in the north, which is to the left of the scene. */
  private pole() {
    return { x: this.width * 0.16, y: this.height * 0.2 };
  }

  render(frame: DioramaFrame, hooks: SceneHooks = {}) {
    const { ctx } = this;
    const light: Light = lightAt(frame.clock);
    const sky = this.skyView();
    const ground: GroundView = { width: this.width, height: this.height, travel: frame.travel, lift: frame.lift };
    const info: SceneInfo = {
      ctx,
      width: this.width,
      height: this.height,
      horizon: sky.horizon,
      light,
      time: frame.time,
      ground,
      groundAt: (x) => surfaceY(GOBI_LAYERS[GROUND_LAYER], ground, x),
    };

    this.paintBackdrop(frame, light, sky, ground, hooks);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.restore();

    GOBI_LAYERS.forEach((layer, index) => {
      if (index < BACKDROP_LAYERS) return;
      hooks.beforeLayer?.(index, info);
      drawLayer(ctx, layer, ground, light, { glowAt: hooks.glowAt });
    });
    this.sunOnSand(light, sky);
    hooks.overlay?.(info);
  }

  /** The sky, sun, stars and far layers, repainted only when they would look different. */
  private paintBackdrop(frame: DioramaFrame, light: Light, sky: SkyView, ground: GroundView, hooks: SceneHooks) {
    const farthestMoving = GOBI_LAYERS[BACKDROP_LAYERS - 1];
    const key = [
      frame.clock.toFixed(3),
      Math.round(frame.travel * farthestMoving.parallax * this.dpr),
      (frame.lift ?? 0).toFixed(3),
      Math.floor(frame.time * TWINKLES_PER_SECOND),
    ].join("|");
    if (key === this.backdropKey) return;
    this.backdropKey = key;

    const ctx = this.backdrop.getContext("2d")!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawSkyGradient(ctx, sky, light);
    // The sky turns 15° an hour; the stars come out as the sun goes down.
    const turn = (frame.clock / 24) * Math.PI * 2;
    this.night.draw(ctx, this.pole(), turn, smoothstep(0.05, 0.9, light.starlight), frame.time);
    drawSun(ctx, sky, light);
    for (let index = 0; index < BACKDROP_LAYERS; index++) drawLayer(ctx, GOBI_LAYERS[index], ground, light, { glowAt: hooks.glowAt });
  }

  /** The low sun washes warm light over the sand on its side of the scene. */
  private sunOnSand(light: Light, sky: SkyView) {
    const strength = smoothstep(-3, 4, light.sunElevation) * (1 - smoothstep(14, 40, light.sunElevation));
    if (strength <= 0) return;
    const { ctx } = this;
    const sun = sunPosition(sky, light);
    const radius = this.width * 0.75;
    const g = ctx.createRadialGradient(sun.x, sky.horizon, 0, sun.x, sky.horizon, radius);
    g.addColorStop(0, css(light.glow, 0.42 * strength));
    g.addColorStop(0.45, css(light.glow, 0.14 * strength));
    g.addColorStop(1, css(light.glow, 0));
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}
