import { css, type Rgb } from "./color";
import { clamp } from "./noise";
import { applyGrain, context, makeCanvas, type Ctx } from "./paint";
import type { Particles, Projector, SceneLight } from "./particles";
import type { Appearance, Lighting } from "./side";

/*
 * The battlefield seen from the observation post: looking out from a
 * height, down the line of fire towards the target. From here a round that
 * falls short bursts in front of the target, lower in the picture and a
 * little bigger; one that goes over bursts behind it, higher and smaller.
 *
 * The ground is a perspective painting made once, pixel by pixel, from the
 * era's ground colour at each point (in metres across and metres away), at
 * half resolution, since it is soft anyway. Props stand on it as cut-outs,
 * nearest last; effects are drawn in the same metres. At night the ground
 * is painted twice, dark and lit by a flare, like the side view.
 */

export type FrontCamera = {
  /** Metres above the ground: an observation post on a rise. */
  height: number;
  /** Focal length as a share of the view's height (binoculars are long, the naked eye short). */
  focal: number;
  /** Where the horizon sits, as a share of the view's height. */
  horizon: number;
};

/** What the era supplies for this view. */
export type FrontScenery = {
  /** The ground's colour `across` metres to the side and `away` metres out. */
  ground: (across: number, away: number, appearance: Appearance, lighting: Lighting) => Rgb;
  /** The sky and anything on the horizon, painted once into a buffer the size of the view. */
  sky: (ctx: Ctx, width: number, height: number, horizonY: number, appearance: Appearance) => void;
  /** Things standing on the ground in this camera's view, drawn far to near each frame. */
  props: (camera: FrontCamera, aspect: number) => FrontProp[];
};

export type FrontProp = {
  across: number;
  away: number;
  /** Draws the prop standing at (x, y) on screen, `scale` pixels per metre. */
  draw: (ctx: Ctx, x: number, y: number, scale: number, appearance: Appearance, lighting: Lighting) => void;
};

export type FrontFrame = {
  time: number;
  fx?: Particles;
  lights?: SceneLight[];
  /** Drawn after the ground and props, before the effects: things that belong to this shot. */
  actors?: (ctx: Ctx, view: FrontView) => void;
  /** Drawn last, over everything: an optic's mask, a reticle. */
  overlay?: (ctx: Ctx, view: FrontView) => void;
};

const GROUND_RESOLUTION = 0.5;

export class FrontView {
  private ctx: Ctx;
  width = 1;
  height = 1;
  private dpr = 1;
  appearance: Appearance = "day";
  private buffers = new Map<string, HTMLCanvasElement>();
  private props: FrontProp[] = [];
  private propsSet = false;
  private scratch: HTMLCanvasElement | null = null;
  private mask: HTMLCanvasElement | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly scenery: FrontScenery,
    public camera: FrontCamera,
  ) {
    this.ctx = context(canvas);
  }

  /** The era's props for this camera plus the shot's own (its target), far to near. */
  setProps(extra: FrontProp[]) {
    this.props = [...this.scenery.props(this.camera, this.width / this.height), ...extra].sort((a, b) => b.away - a.away);
    this.propsSet = true;
  }

  get hasProps() {
    return this.propsSet;
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.buffers.clear();
    // The props depend on how wide the view is; the shot sets them again.
    this.propsSet = false;
  }

  setAppearance(appearance: Appearance) {
    if (appearance === this.appearance) return;
    this.appearance = appearance;
    this.buffers.clear();
  }

  /** Moves the observer: the ground is painted again from the new post and the props are set again. */
  setCamera(camera: FrontCamera) {
    if (camera.height === this.camera.height && camera.focal === this.camera.focal && camera.horizon === this.camera.horizon) return;
    this.camera = camera;
    this.buffers.clear();
    this.propsSet = false;
  }

  /** Paints ahead the ground as a flare lights it, which night needs at the first burst and is slow to paint. */
  prepare() {
    if (this.appearance === "night") this.buffer("ground/flare");
  }

  get focal() {
    return this.camera.focal * this.height;
  }

  get horizonY() {
    return this.camera.horizon * this.height;
  }

  /** Screen position of a point `up` metres above the ground, `across` to the side and `away` out. */
  readonly project: Projector = (across, up, away) => {
    if (away <= 1) return null;
    const scale = this.focal / away;
    return { x: this.width / 2 + across * scale, y: this.horizonY + (this.camera.height - up) * scale, scale };
  };

  /** How far out the ground is at screen row y (Infinity at and above the horizon). */
  awayAt(y: number) {
    const below = y - this.horizonY;
    return below <= 0 ? Infinity : (this.focal * this.camera.height) / below;
  }

  draw(frame: FrontFrame) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const night = this.appearance === "night";
    const lights = frame.lights ?? [];
    ctx.drawImage(this.buffer("sky"), 0, 0, this.width, this.height);
    ctx.drawImage(this.buffer("ground/ambient"), 0, 0, this.width, this.height);
    if (night && lights.length) this.drawLitGround(lights);
    this.drawProps(ctx, "ambient");
    frame.actors?.(ctx, this);
    frame.fx?.draw(ctx, this.project, { night: night ? 1 : 0 });
    this.drawGlows(ctx, lights, night);
    frame.overlay?.(ctx, this);
  }

  private buffer(key: "sky" | "ground/ambient" | "ground/flare") {
    const known = this.buffers.get(key);
    if (known) return known;
    let canvas: HTMLCanvasElement;
    if (key === "sky") {
      canvas = makeCanvas(this.width * this.dpr, this.height * this.dpr);
      const ctx = context(canvas);
      ctx.scale(this.dpr, this.dpr);
      this.scenery.sky(ctx, this.width, this.height, this.horizonY, this.appearance);
    } else canvas = this.paintGround(key === "ground/flare" ? "flare" : "ambient");
    this.buffers.set(key, canvas);
    return canvas;
  }

  /** The ground in perspective, one pixel at a time, at half resolution. */
  private paintGround(lighting: Lighting) {
    const w = Math.ceil(this.width * GROUND_RESOLUTION);
    const h = Math.ceil(this.height * GROUND_RESOLUTION);
    const canvas = makeCanvas(w, h);
    const ctx = context(canvas);
    const image = ctx.createImageData(w, h);
    const top = Math.max(0, Math.floor(this.horizonY * GROUND_RESOLUTION));
    for (let py = top; py < h; py++) {
      const away = this.awayAt((py + 0.5) / GROUND_RESOLUTION);
      if (!Number.isFinite(away)) continue;
      // Blend into the horizon over the last few rows instead of a hard line.
      const edge = clamp((py + 0.5 - this.horizonY * GROUND_RESOLUTION) / 3);
      for (let px = 0; px < w; px++) {
        const across = ((px + 0.5) / GROUND_RESOLUTION - this.width / 2) * (away / this.focal);
        const [r, g, b] = this.scenery.ground(across, away, this.appearance, lighting);
        const i = (py * w + px) * 4;
        image.data[i] = r;
        image.data[i + 1] = g;
        image.data[i + 2] = b;
        image.data[i + 3] = 255 * edge;
      }
    }
    ctx.putImageData(image, 0, 0);
    // A touch of softening and the canvas grain, so the ground reads as paint rather than pixels.
    const soft = makeCanvas(w, h);
    const s = context(soft);
    s.filter = "blur(0.8px)";
    s.drawImage(canvas, 0, 0);
    s.filter = "none";
    applyGrain(s, 0, 0, w, h, 0.4, 17, GROUND_RESOLUTION);
    return soft;
  }

  private drawProps(ctx: Ctx, lighting: Lighting) {
    for (const prop of this.props) {
      const at = this.project(prop.across, 0, prop.away);
      if (!at || at.x < -400 || at.x > this.width + 400) continue;
      prop.draw(ctx, at.x, at.y, at.scale, this.appearance, lighting);
    }
  }

  /** Where flares light the ground: the lit painting, masked to each light's pool on the ground. */
  private drawLitGround(lights: SceneLight[]) {
    if (!this.scratch) this.scratch = makeCanvas(this.width * this.dpr, this.height * this.dpr);
    const s = context(this.scratch);
    s.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, this.width, this.height);
    s.drawImage(this.buffer("ground/flare"), 0, 0, this.width, this.height);
    this.drawProps(s, "flare");
    s.globalCompositeOperation = "destination-in";
    if (!this.mask || this.mask.width !== Math.ceil(this.width) || this.mask.height !== Math.ceil(this.height)) this.mask = makeCanvas(this.width, this.height);
    const mask = this.mask;
    const m = context(mask);
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, mask.width, mask.height);
    m.globalCompositeOperation = "lighter";
    for (const light of lights) {
      if (light.intensity <= 0.01 || light.color[2] < 200) continue;
      const centre = this.project(light.x, 0, light.z);
      const near = this.project(light.x, 0, Math.max(5, light.z - light.radius * 0.8));
      const far = this.project(light.x, 0, light.z + light.radius);
      if (!centre || !near || !far) continue;
      const rx = light.radius * centre.scale;
      const ry = Math.max(4, (near.y - far.y) / 2);
      const cy = (near.y + far.y) / 2;
      const g = m.createRadialGradient(centre.x, cy, 0, centre.x, cy, rx);
      g.addColorStop(0, `rgb(255 255 255 / ${clamp(light.intensity)})`);
      g.addColorStop(0.35, `rgb(255 255 255 / ${clamp(light.intensity) * 0.5})`);
      g.addColorStop(1, "rgb(255 255 255 / 0)");
      m.save();
      m.translate(centre.x, cy);
      m.scale(1, ry / rx);
      m.translate(-centre.x, -cy);
      m.fillStyle = g;
      m.fillRect(centre.x - rx, cy - rx, rx * 2, rx * 2);
      m.restore();
    }
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.drawImage(mask, 0, 0, this.width * this.dpr, this.height * this.dpr);
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.scratch, 0, 0);
    this.ctx.restore();
  }

  /** Light in the air: flares' halos and the warm glow fires throw on the ground and the smoke. */
  private drawGlows(ctx: Ctx, lights: SceneLight[], night: boolean) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const light of lights) {
      if (light.intensity <= 0.01) continue;
      const at = this.project(light.x, light.y, light.z);
      if (!at) continue;
      const flare = light.color[2] >= 200;
      const r = light.radius * at.scale * (flare ? 0.5 : 0.22);
      const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
      const k = (night ? 1 : 0.5) * (flare ? 1 : 0.55);
      g.addColorStop(0, css(light.color, 0.35 * light.intensity * k));
      g.addColorStop(0.3, css(light.color, 0.12 * light.intensity * k));
      g.addColorStop(1, css(light.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(at.x - r, at.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}
