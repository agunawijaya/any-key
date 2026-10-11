import { css, type Rgb } from "./color";
import { clamp } from "./noise";
import { context, makeCanvas, type Ctx } from "./paint";
import type { Particles, Projector, SceneLight } from "./particles";

/*
 * The battlefield seen side-on: the view that follows a shell along its arc.
 * The land is a stack of painted layers, nearest at the bottom, each sliding
 * at its own pace as the camera moves (parallax). Layers are painted once into
 * tiles and kept, so a landscape kilometres long scrolls without repainting.
 *
 * Heights in the sky are not to scale: a shell's altitude is squeezed so the
 * whole arc fits above the land, climbing fast near the ground and flattening
 * out high up, the way a hand-drawn range diagram would show it.
 *
 * At night every layer is painted twice, dark and as lit white by a flare;
 * the flares' light is a mask that lets the lit painting show through.
 *
 * A battlefield with real hills (Field Artillery) gives the view a relief:
 * the shells' ground then rises and falls with the true heights, squeezed
 * the same way as the sky, so a shell that clears a crest in the physics
 * clears it on screen too.
 */

export type Appearance = "day" | "night";
/** Which of a layer's two paintings: the ordinary one, or the land lit white by a star shell. */
export type Lighting = "ambient" | "flare";

export type TileRequest = {
  ctx: Ctx;
  /** Layer metres covered by this tile, and pixels per layer metre. */
  u0: number;
  u1: number;
  scale: number;
  /** Tile size in pixels; its top edge sits at screen y `top`. */
  width: number;
  height: number;
  top: number;
  /** The whole view's height, for anything sized to the screen. */
  viewHeight: number;
  appearance: Appearance;
  lighting: Lighting;
  /** Screen y of the contour at layer metre u (already including `top` offsets: subtract `top` for tile y). */
  contourY: (u: number) => number;
  /** Tile x of layer metre u. */
  tileX: (u: number) => number;
};

export type SideLayer = {
  id: string;
  /** How fast the layer slides with the camera: 1 is the ground the shells land on. */
  parallax: number;
  /** Screen y of the layer's ground line, as a share of the view's height. */
  baseline: number;
  /** Room above the ground line for trees, spires and smoke, as a share of the height. */
  headroom: number;
  /** The ground line's rise and fall at layer metre u, as a share of the height (positive is lower). */
  contour: (u: number) => number;
  paint: (tile: TileRequest) => void;
  /** Painted in front of the shells and the bursts rather than behind them. */
  front?: boolean;
};

export type SideSky = {
  /** Paints the whole sky into a buffer the size of the view (repainted when the size or appearance changes). */
  paint: (ctx: Ctx, width: number, height: number, appearance: Appearance) => void;
  /** Things that move in the sky every frame: clouds' drift, a plane, a balloon swaying. */
  overlay?: (ctx: Ctx, view: SideFrameInfo) => void;
};

export type SideScenery = { sky: SideSky; layers: SideLayer[]; nightAmbient: Rgb };

/** The true lie of the land under the shells: metres above the lowest ground, at world metre x. */
export type Relief = {
  height: (x: number) => number;
  /** The highest the ground gets anywhere, so the land's tiles leave room above it. */
  highest: number;
  /** The altitude in metres that takes up about two-thirds of the sky (see `heightY`). */
  squeeze: number;
};

export type SideFrameInfo = { width: number; height: number; time: number; appearance: Appearance; cameraX: number; scale: number };

export type SideFrame = {
  time: number;
  /** World metres at the centre of the view, on the shells' ground. */
  cameraX: number;
  /** Pixels per metre on the shells' ground. */
  scale: number;
  /** The highest point of the flight being followed, which sets how the sky is shared out (see `altitudeY`). */
  apex?: number;
  fx?: Particles;
  /** Star shells and other lights in world metres (y up from the ground). */
  lights?: SceneLight[];
  /** Drawn after the land behind the shells and before the land in front: the shell, its trail, the gun. */
  actors?: (ctx: Ctx, view: SideView) => void;
  /** Drawn over the bursts and smoke: whatever stands nearer than they do, such as the gun when rounds land beyond it. */
  foreground?: (ctx: Ctx, view: SideView) => void;
  /** Drawn last, over everything: the heat of a burst washing over the view. */
  overlay?: (ctx: Ctx, view: SideView) => void;
};

const TILE = 768;

type Tile = { canvas: HTMLCanvasElement; used: number };

export class SideView {
  private ctx: Ctx;
  width = 1;
  height = 1;
  private dpr = 1;
  appearance: Appearance = "day";
  private sky: HTMLCanvasElement | null = null;
  private tiles = new Map<string, Tile>();
  private warming: { layer: SideLayer; lighting: Lighting; index: number; scale: number }[] = [];
  private forgotten = 0;
  private scratch: HTMLCanvasElement | null = null;
  private frameNo = 0;
  /** The camera of the frame being drawn. */
  cameraX = 0;
  scale = 1;
  apex = 1500;
  relief: Relief | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly scenery: SideScenery,
  ) {
    this.ctx = context(canvas);
  }

  resize(width: number, height: number, dpr: number) {
    // Layout often reports the same size twice; repainting every tile for it would cost a frame.
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.forget();
  }

  setAppearance(appearance: Appearance) {
    if (appearance === this.appearance) return;
    this.appearance = appearance;
    this.forget();
  }

  /** Gives the shells' ground real hills, or takes them away again (`null`). */
  setRelief(relief: Relief | null) {
    this.relief = relief;
    this.forget();
  }

  /** How many times every painted buffer was dropped: tiles prepared ahead before then need preparing again. */
  get generation() {
    return this.forgotten;
  }

  /** Drops every painted buffer (size or appearance changed). */
  forget() {
    this.forgotten++;
    this.sky = null;
    this.tiles.clear();
    this.warming = [];
    this.scratch = null;
  }

  /* ---------- Where things are ---------- */

  /** The ground layer the shells land on. */
  get ground() {
    return this.scenery.layers.find((l) => l.parallax === 1)!;
  }

  /** Screen x of a world metre on a layer with parallax `p`. */
  screenX(x: number, p = 1) {
    return this.width / 2 + (x * p - this.cameraX * p) * this.scale;
  }

  /** Screen y of the shells' ground under world metre x. */
  groundY(x: number) {
    if (this.relief) return this.heightY(this.relief.height(x));
    const g = this.ground;
    return (g.baseline + g.contour(x)) * this.height;
  }

  /**
   * With a relief, the screen y of `metres` above the lowest ground: the
   * ground and the shells over it share one squeezed scale, true to the
   * metre near the ground and ever more compressed higher up.
   */
  heightY(metres: number) {
    const base = this.ground.baseline * this.height;
    const sky = base - this.height * 0.1;
    return base - sky * (1 - Math.exp(-metres / (this.relief?.squeeze ?? 1000)));
  }

  /**
   * Screen y of a shell `altitude` metres above a straight line from the gun
   * to where it lands; `apex` sets how the sky is shared out.
   */
  altitudeY(baseY: number, altitude: number, apex: number) {
    const sky = baseY - this.height * 0.1;
    const squeeze = Math.max(150, apex * 0.72);
    return baseY - sky * (1 - Math.exp(-Math.max(0, altitude) / squeeze));
  }

  /** Screen y of something flying `altitude` metres above the shells' ground at x: shells, flares, planes. */
  skyY(x: number, altitude: number) {
    if (this.relief) return this.heightY(this.relief.height(x) + altitude);
    return this.altitudeY(this.groundY(x), altitude, this.apex);
  }

  /** Effects near the ground: metres to pixels at the ground layer's scale, y up from the ground under x. */
  readonly project: Projector = (x, y, z) => {
    const p = 1 / (1 + z / 400);
    const s = this.scale * p;
    return { x: this.screenX(x, p), y: this.groundY(x) - y * s - z * 0.02 * this.scale, scale: s };
  };

  /* ---------- Drawing ---------- */

  draw(frame: SideFrame) {
    this.cameraX = frame.cameraX;
    this.apex = frame.apex ?? this.apex;
    // Tiles are kept per scale, so a cut to a closer view and back again repaints nothing it has painted before.
    this.scale = frame.scale;
    this.frameNo++;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const info: SideFrameInfo = { width: this.width, height: this.height, time: frame.time, appearance: this.appearance, cameraX: frame.cameraX, scale: this.scale };
    ctx.drawImage(this.skyBuffer(), 0, 0, this.width, this.height);
    this.scenery.sky.overlay?.(ctx, info);

    const night = this.appearance === "night";
    const lights = frame.lights ?? [];
    const behind = this.scenery.layers.filter((l) => !l.front);
    const front = this.scenery.layers.filter((l) => l.front);

    this.drawLayers(ctx, behind, "ambient");
    if (night && lights.length) this.drawLit(behind, lights);
    frame.actors?.(ctx, this);
    frame.fx?.draw(ctx, this.project, { night: night ? 1 : 0 });
    frame.foreground?.(ctx, this);
    this.drawLayers(ctx, front, "ambient");
    if (night && lights.length) this.drawLit(front, lights);
    if (night) this.drawGlows(ctx, lights);
    frame.overlay?.(ctx, this);
    this.evict();
  }

  private skyBuffer() {
    if (!this.sky) {
      this.sky = makeCanvas(this.width * this.dpr, this.height * this.dpr);
      const ctx = context(this.sky);
      ctx.scale(this.dpr, this.dpr);
      this.scenery.sky.paint(ctx, this.width, this.height, this.appearance);
    }
    return this.sky;
  }

  private drawLayers(ctx: Ctx, layers: SideLayer[], lighting: Lighting) {
    for (const layer of layers) this.drawLayer(ctx, layer, lighting);
  }

  /** The tiles of a layer in view with the camera at `cameraX` and this scale. */
  private tilesInView(layer: SideLayer, cameraX: number, scale: number) {
    const tileMetres = TILE / scale;
    const u = cameraX * layer.parallax;
    const halfMetres = this.width / 2 / scale;
    return { first: Math.floor((u - halfMetres) / tileMetres), last: Math.floor((u + halfMetres) / tileMetres), u, tileMetres };
  }

  private drawLayer(ctx: Ctx, layer: SideLayer, lighting: Lighting) {
    const { first, last, u, tileMetres } = this.tilesInView(layer, this.cameraX, this.scale);
    const top = this.layerTop(layer);
    for (let i = first; i <= last; i++) {
      const tile = this.tile(layer, lighting, i, top);
      // On whole device pixels: two tiles meeting mid-pixel would each half cover it, and the land behind would show through as a seam.
      const x = Math.round((this.width / 2 + (i * tileMetres - u) * this.scale) * this.dpr) / this.dpr;
      ctx.drawImage(tile, x, top, TILE, this.height - top);
    }
  }

  /** Screen y of the top of a layer's tiles: its headroom above its ground, or above the highest hill. */
  private layerTop(layer: SideLayer) {
    const top = (layer.baseline - layer.headroom) * this.height;
    if (!this.relief || layer.parallax !== 1) return top;
    return Math.min(top, this.heightY(this.relief.highest) - layer.headroom * this.height);
  }

  /** Screen y of a layer's ground line at layer metre u: the relief's true heights for the shells' ground. */
  private contourY(layer: SideLayer, u: number) {
    if (this.relief && layer.parallax === 1) return this.heightY(this.relief.height(u));
    return (layer.baseline + layer.contour(u)) * this.height;
  }

  /**
   * Paints ahead the tiles of a view the camera is about to cut to (closer in
   * on the gun, say) or travel through (out to the target with a round), one a
   * frame through `warmOne`, so the camera never waits for land to be painted.
   */
  prepare(cameraX: number, scale: number, toCameraX = cameraX) {
    const lightings: Lighting[] = this.appearance === "night" ? ["ambient", "flare"] : ["ambient"];
    for (const layer of this.scenery.layers) {
      const { first } = this.tilesInView(layer, cameraX, scale);
      const { last } = this.tilesInView(layer, toCameraX, scale);
      for (let i = first; i <= last; i++) for (const lighting of lightings) this.warming.push({ layer, lighting, index: i, scale });
    }
  }

  /** Paints one tile prepared ahead, if one still needs it; true while more are waiting. */
  warmOne() {
    for (let next = this.warming.shift(); next; next = this.warming.shift()) {
      if (this.tiles.has(this.tileKey(next.layer, next.lighting, next.index, next.scale))) continue;
      this.tile(next.layer, next.lighting, next.index, this.layerTop(next.layer), next.scale);
      break;
    }
    return this.warming.length > 0;
  }

  private tileKey(layer: SideLayer, lighting: Lighting, index: number, scale: number) {
    return `${scale.toFixed(5)}/${layer.id}/${lighting}/${index}`;
  }

  private tile(layer: SideLayer, lighting: Lighting, index: number, top: number, scale = this.scale) {
    const key = this.tileKey(layer, lighting, index, scale);
    const known = this.tiles.get(key);
    if (known) {
      known.used = this.frameNo;
      return known.canvas;
    }
    const height = this.height - top;
    const canvas = makeCanvas(TILE * this.dpr, height * this.dpr);
    const ctx = context(canvas);
    ctx.scale(this.dpr, this.dpr);
    const tileMetres = TILE / scale;
    const u0 = index * tileMetres;
    layer.paint({
      ctx,
      u0,
      u1: u0 + tileMetres,
      scale,
      width: TILE,
      height,
      top,
      viewHeight: this.height,
      appearance: this.appearance,
      lighting,
      contourY: (u) => this.contourY(layer, u),
      tileX: (u) => (u - u0) * scale,
    });
    this.tiles.set(key, { canvas, used: this.frameNo });
    return canvas;
  }

  /** Keeps the tile cache from growing without end while the camera travels. */
  private evict() {
    if (this.tiles.size < 160) return;
    const old = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.tiles.size - 120);
    for (const [key] of old) this.tiles.delete(key);
  }

  /**
   * The flare-lit painting of the layers, shown only where star shells and
   * fires throw light: painted into a scratch buffer, masked by the lights'
   * reach, then laid over the dark painting.
   */
  private drawLit(layers: SideLayer[], lights: SceneLight[]) {
    if (!this.scratch) this.scratch = makeCanvas(this.width * this.dpr, this.height * this.dpr);
    const s = context(this.scratch);
    s.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, this.width, this.height);
    this.drawLayers(s, layers, "flare");
    // The mask: where each light reaches the land, how strongly.
    s.globalCompositeOperation = "destination-in";
    const mask = makeMask(this.width, this.height);
    const m = context(mask);
    m.clearRect(0, 0, this.width, this.height);
    m.globalCompositeOperation = "lighter";
    for (const light of lights) {
      if (light.intensity <= 0.01) continue;
      const x = this.screenX(light.x);
      const groundY = this.groundY(light.x) + this.height * 0.02;
      const reach = light.radius * this.scale * 0.6;
      // A pool of light on the land, wide and shallow, brightest under the light and soon gone.
      const g = m.createRadialGradient(x, groundY, 0, x, groundY, reach);
      const strength = clamp(light.intensity * (light.color[2] > 200 ? 1 : 0.65));
      g.addColorStop(0, `rgb(255 255 255 / ${strength})`);
      g.addColorStop(0.3, `rgb(255 255 255 / ${strength * 0.5})`);
      g.addColorStop(0.65, `rgb(255 255 255 / ${strength * 0.12})`);
      g.addColorStop(1, "rgb(255 255 255 / 0)");
      m.save();
      m.translate(x, groundY);
      m.scale(1, 0.32);
      m.translate(-x, -groundY);
      m.fillStyle = g;
      m.fillRect(x - reach, groundY - reach, reach * 2, reach * 2);
      m.restore();
    }
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.drawImage(mask, 0, 0, this.width * this.dpr, this.height * this.dpr);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.scratch, 0, 0);
    ctx.restore();
  }

  /** The flares themselves and warm fire glow: light in the air, added over everything. */
  private drawGlows(ctx: Ctx, lights: SceneLight[]) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const light of lights) {
      if (light.intensity <= 0.01) continue;
      const x = this.screenX(light.x);
      // High lights share the shells' squeezed sky; fires near the ground keep true scale.
      const y = light.y > 60 ? this.skyY(light.x, light.y) : this.groundY(light.x) - light.y * this.scale;
      const r = light.radius * this.scale * 0.35;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, css(light.color, 0.32 * light.intensity));
      g.addColorStop(0.3, css(light.color, 0.1 * light.intensity));
      g.addColorStop(1, css(light.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}

let maskBuffer: HTMLCanvasElement | null = null;

/** One shared low-detail canvas for light masks (light is soft, so it can be coarse). */
function makeMask(width: number, height: number) {
  if (!maskBuffer || maskBuffer.width !== Math.ceil(width) || maskBuffer.height !== Math.ceil(height)) maskBuffer = makeCanvas(width, height);
  return maskBuffer;
}
