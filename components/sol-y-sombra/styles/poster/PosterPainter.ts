import { mix } from "@/lib/kit/color";
import type { Thrown } from "@/lib/sol-y-sombra/crowd";
import { around, inShadow, PLAZA, wallRadius, type SunPatch } from "@/lib/sol-y-sombra/plaza";
import type { Cloth } from "@/lib/sol-y-sombra/rig/cloth";
import type { Dust } from "@/lib/sol-y-sombra/rig/dust";
import { add, addScaled, cross, dot, flat, normalize, scale, sub, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { bullItems, bullShadowParts, type BullColours, type DrawItem } from "../../render/bullFigure";
import { NEAR, type Camera } from "../../render/camera";
import { matadorItems, matadorLimbs, type MatadorColours } from "../../render/matadorFigure";
import { capsulePath, polygonPath } from "../../render/shapes";
import type { Lettering, RingFrame, RingStyle } from "../style";
import { CrowdPainter } from "./crowdPainter";
import { paintFrame, paintGrain, paintPaper, paintStamp, posterLayout, type PosterLayout } from "./frame";
import { POSTER_DARK, POSTER_LIGHT, type PosterPalette } from "./palette";
import { PlazaPainter } from "./plazaPainter";

/*
 * The Vintage Poster style: the whole picture, from the paper up.
 *
 * The scene is drawn inside the poster's window, then the frame and its
 * lettering over it; at the big moments the closest figures are drawn once
 * more over the frame's edge, so the bull and the cape break out of the
 * print. Figures standing in the stands' shadow are printed in the cool
 * shade inks, the ones in the sun in the warm ones.
 */

export class PosterPainter implements RingStyle {
  readonly id = "poster" as const;
  private width = 0;
  private height = 0;
  private readonly ctx: CanvasRenderingContext2D;
  /** The background (sky, stands, crowd, sand) is painted into its own canvas, and only when it changes. */
  private readonly back: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; plaza: PlazaPainter; crowd: CrowdPainter };
  private backKey = "";
  private backDrawnAt = -Infinity;
  /** The shadow line's sand and the gate's glow are drawn on the main canvas too, so it keeps its own plaza painter. */
  private readonly plaza: PlazaPainter;
  private shadeCache = new Map<string, { matador: MatadorColours; bull: BullColours }>();
  /** The paper round the window, the rules and the lettering: the same every frame until the text or the size changes. */
  private overlay: { key: string; canvas: HTMLCanvasElement } | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.plaza = new PlazaPainter(ctx);
    const canvas = document.createElement("canvas");
    const backCtx = canvas.getContext("2d")!;
    this.back = { canvas, ctx: backCtx, plaza: new PlazaPainter(backCtx), crowd: new CrowdPainter(backCtx) };
  }

  resize(width: number, height: number, dpr: number) {
    const canvas = this.ctx.canvas;
    this.width = width;
    this.height = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** The whole poster, in the light afternoon's inks or the evening festival's; the camera is fitted to the poster's window. */
  paint(frame: RingFrame, camera: Camera, dark: boolean) {
    this.print(frame, camera, dark ? POSTER_DARK : POSTER_LIGHT, this.width, this.height, dark);
  }

  /** `camera` is sized to the poster's window; `width` and `height` are the whole canvas. */
  print(scene: RingFrame, camera: Camera, p: PosterPalette, width: number, height: number, dark: boolean): PosterLayout {
    const ctx = this.ctx;
    const layout = posterLayout(width, height);
    const im = layout.image;
    if (camera.width !== im.w || camera.height !== im.h) camera.resize(im.w, im.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(im.x, im.y, im.w, im.h);
    ctx.clip();
    ctx.translate(im.x, im.y);
    this.paintBackground(scene, camera, p, dark);
    this.paintShadows(scene, camera, p);
    const items = this.actorItems(scene, camera, p);
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) item.paint();
    ctx.restore();

    this.paintOverlay(layout, p, scene.text, dark);
    if (scene.breakout) this.breakOut(scene, camera, p, layout);
    if (scene.text.stamp) paintStamp(ctx, layout, p, scene.text.stamp);
    paintGrain(ctx, layout, dark);
    return layout;
  }

  /**
   * The sky, the stands with their crowd, and the sand: thousands of shapes
   * that change only when the camera moves or the crowd stirs. They are
   * painted into their own canvas, again when the camera has moved, and
   * otherwise twelve times a second for the crowd's waving, which suits a
   * printed poster's flicker; every frame the canvas is laid down in one go.
   */
  private paintBackground(scene: RingFrame, camera: Camera, p: PosterPalette, dark: boolean) {
    const ctx = this.ctx;
    const scale = ctx.getTransform().a;
    const { canvas, ctx: back, plaza, crowd } = this.back;
    const w = Math.round(camera.width * scale);
    const h = Math.round(camera.height * scale);
    const view = [camera.eye.x, camera.eye.y, camera.eye.z, camera.target.x, camera.target.y, camera.target.z, camera.fov].map((v) => v.toFixed(3)).join(",");
    const key = [
      view,
      w,
      h,
      dark,
      p.paper,
      scene.sun.x.toFixed(3),
      scene.sun.z.toFixed(3),
      scene.gateGlow.toFixed(2),
      scene.sky?.top ?? "",
      scene.torilOpen ?? false,
    ].join("|");
    const stale = key !== this.backKey || scene.time - this.backDrawnAt >= 1 / 12 || scene.time < this.backDrawnAt;
    if (stale) {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      back.setTransform(scale, 0, 0, scale, 0, 0);
      plaza.paintSky(camera, scene.sky ? { ...p, skyTop: scene.sky.top, skyLow: scene.sky.low } : p, scene.time);
      plaza.paintStands(camera, p, scene.sun, (k, r) => crowd.paintRow(scene.crowd, camera, p, scene.sun, k, r), scene.gateGlow, scene.torilOpen);
      if (p.lamp) plaza.paintLamps(camera, p);
      if (scene.gateGlow > 0) this.paintGateLight(back, camera, p, scene.gateGlow);
      plaza.paintSand(camera, p, scene.patch);
      if (scene.gateGlow > 0) plaza.paintGateLight(camera, p, scene.gateGlow);
      this.backKey = key;
      this.backDrawnAt = scene.time;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, ctx.getTransform().e, ctx.getTransform().f);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  }

  /** Draws the cached frame over the scene, making it again when anything on it changed. */
  private paintOverlay(layout: PosterLayout, p: PosterPalette, text: Lettering, dark: boolean) {
    const ctx = this.ctx;
    const scale = ctx.getTransform().a;
    const key = [layout.width, layout.height, scale, dark, text.title, text.subtitle, text.ribbon, p.paper].join("|");
    if (!this.overlay || this.overlay.key !== key) {
      const canvas = this.overlay?.canvas ?? document.createElement("canvas");
      canvas.width = Math.round(layout.width * scale);
      canvas.height = Math.round(layout.height * scale);
      const o = canvas.getContext("2d")!;
      o.setTransform(scale, 0, 0, scale, 0, 0);
      paintPaper(o, layout, p);
      const im = layout.image;
      o.clearRect(im.x, im.y, im.w, im.h);
      paintFrame(o, layout, p, { ...text, stamp: null });
      this.overlay = { key, canvas };
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.overlay.canvas, 0, 0);
    ctx.restore();
  }

  /* ---------- Figures ---------- */

  private actorItems(scene: RingFrame, camera: Camera, p: PosterPalette): DrawItem[] {
    const ctx = this.ctx;
    const items: DrawItem[] = [];
    for (const figure of scene.figures) {
      const shaded = inShadow(flat(figure.skeleton.pelvis), scene.patch);
      const base = { ...p.matador, ...figure.dress };
      const colours = shaded ? this.shaded(base, p.bull, p).matador : base;
      items.push(...matadorItems(ctx, figure.skeleton, figure.strands, camera, colours, figure.holds, { hat: figure.hat }));
    }
    if (scene.bull) {
      const shaded = inShadow(flat(scene.bull.withers), scene.patch);
      items.push(...bullItems(ctx, scene.bull, camera, shaded ? this.shaded(p.matador, p.bull, p).bull : p.bull));
    }
    for (const cape of scene.capes) items.push(...this.capeItems(cape, camera, p, scene.patch));
    items.push(...this.thrownItems(scene.thrown, camera, p));
    if (scene.dust) items.push(...this.dustItems(scene.dust, camera, p));
    return items;
  }

  /** The same inks pushed towards the shade's cool blue, for figures across the shadow line. */
  private shaded(matador: MatadorColours, bull: BullColours, p: PosterPalette) {
    const key = `${p.shadeTint}/${matador.suit}/${matador.jacket ?? ""}/${matador.gold}`;
    let cached = this.shadeCache.get(key);
    if (!cached) {
      const cool = p.shadeTint;
      const m = (c: string, t = 0.32) => mix(c, cool, t);
      cached = {
        matador: {
          ...matador,
          suit: m(matador.suit, 0.3),
          jacket: matador.jacket && m(matador.jacket, 0.3),
          gold: m(matador.gold),
          skin: m(matador.skin),
          skinShade: m(matador.skinShade),
          stocking: m(matador.stocking),
          shirt: m(matador.shirt),
        },
        bull: {
          ...bull,
          light: m(bull.light, 0.45),
          sheen: m(bull.sheen, 0.5),
          horn: m(bull.horn, 0.35),
          muzzle: m(bull.muzzle, 0.4),
          eyeWhite: m(bull.eyeWhite, 0.2),
        },
      };
      this.shadeCache.set(key, cached);
    }
    return cached;
  }

  /** The cape in two inks per face, like a print: lit folds and shadowed folds, and the gold braid round its edge. */
  private capeItems(cape: Cloth, camera: Camera, p: PosterPalette, patch: SunPatch): DrawItem[] {
    const ctx = this.ctx;
    const items: DrawItem[] = [];
    const { pos, triangles, count, shape } = cape;
    const at = (i: number): Vec3 => ({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] });
    const normals: Vec3[] = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0 }));
    for (let t = 0; t < triangles.length; t += 3) {
      const [i, j, k] = [triangles[t], triangles[t + 1], triangles[t + 2]];
      const n = cross(sub(at(j), at(i)), sub(at(k), at(i)));
      for (const v of [i, j, k]) normals[v] = add(normals[v], n);
    }
    const centre = at(Math.floor(count / 2));
    const shaded = inShadow(flat(centre), patch);
    const tone = (c: string) => (shaded ? mix(c, p.shadeTint, 0.28) : c);
    const light = normalize({ x: 0.4, y: 1, z: 0.35 });
    // One shape per cell of the cloth (two triangles), coloured by which face it shows and whether that face is lit.
    const { columns, rows } = shape;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < columns - 1; c++) {
        const ids = [r * columns + c, r * columns + c + 1, (r + 1) * columns + c + 1, (r + 1) * columns + c];
        const corners = ids.map(at);
        const pts = corners.map((q) => camera.project(q));
        if (pts.some((q) => q.depth < NEAR)) continue;
        const n = normalize(ids.reduce((sum, id) => add(sum, normals[id]), { x: 0, y: 0, z: 0 }));
        const mid = scale(add(add(corners[0], corners[1]), add(corners[2], corners[3])), 0.25);
        const toEye = scale(camera.viewDir(mid), -1);
        // The front face is the side the cloth's triangles wind towards (see Cloth).
        const faceNormal = cross(sub(corners[3], corners[0]), sub(corners[1], corners[0]));
        const front = dot(faceNormal, toEye) > 0;
        const facing = front ? n : scale(n, -1);
        // Two inks per face: a fold either catches the light or doesn't.
        const lit = dot(facing, light) > 0.25;
        const colour = tone(front ? (lit ? p.cape.front : p.cape.frontShade) : lit ? p.cape.back : p.cape.backShade);
        items.push({
          depth: camera.depthOf(mid),
          paint: () => {
            ctx.beginPath();
            polygonPath(ctx, pts);
            ctx.fillStyle = colour;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = colour;
            ctx.stroke();
          },
        });
      }
    }
    // The braid round the hem and sides, inked.
    const edge: Vec3[] = [];
    const cell = (c: number, r: number) => at(r * shape.columns + c);
    for (let r = 0; r < shape.rows; r++) edge.push(cell(0, r));
    for (let c = 1; c < shape.columns; c++) edge.push(cell(c, shape.rows - 1));
    for (let r = shape.rows - 2; r >= 0; r--) edge.push(cell(shape.columns - 1, r));
    for (let k = 0; k < edge.length - 1; k++) {
      const a = camera.project(edge[k]);
      const b = camera.project(edge[k + 1]);
      if (a.depth < NEAR || b.depth < NEAR) continue;
      items.push({
        depth: Math.min(a.depth, b.depth) - 0.004,
        paint: () => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(1.6, a.scale * 0.036);
          ctx.strokeStyle = p.ink;
          ctx.stroke();
          ctx.lineWidth = Math.max(1, a.scale * 0.022);
          ctx.strokeStyle = tone(p.cape.braid);
          ctx.stroke();
        },
      });
    }
    return items;
  }

  private thrownItems(thrown: Thrown[], camera: Camera, p: PosterPalette): DrawItem[] {
    const ctx = this.ctx;
    const items: DrawItem[] = [];
    for (const t of thrown) {
      const q = camera.project(t.pos);
      if (q.depth < NEAR) continue;
      const r = (t.kind === "hat" ? 0.15 : 0.09) * q.scale;
      if (r < 0.6) continue;
      items.push({
        depth: q.depth,
        paint: () => {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(t.angle);
          ctx.lineWidth = Math.max(1, r * 0.14);
          ctx.strokeStyle = p.ink;
          if (t.kind === "hat") {
            // A flat-brimmed hat with a low round crown and a band: black felt or straw.
            ctx.rotate(-t.angle * 0.85);
            const felt = t.look % 3 !== 0;
            const body = felt ? p.hatDark : p.hatStraw;
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r * 0.3, 0, 0, Math.PI * 2);
            ctx.fillStyle = body;
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-r * 0.5, 0);
            ctx.lineTo(-r * 0.48, -r * 0.5);
            ctx.quadraticCurveTo(0, -r * 0.62, r * 0.48, -r * 0.5);
            ctx.lineTo(r * 0.5, 0);
            ctx.closePath();
            ctx.fillStyle = felt ? mix(body, "#ffffff", 0.1) : body;
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = felt ? p.frameRed : p.hatDark;
            ctx.fillRect(-r * 0.49, -r * 0.18, r * 0.98, r * 0.12);
          } else {
            // A carnation: a ring of petals round a darker heart.
            const colour = p.flowers[t.look % p.flowers.length];
            ctx.fillStyle = colour;
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = mix(colour, "#000000", 0.25);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(r * 0.3, r * 0.3);
            ctx.lineTo(r * 1.4, r * 1.6);
            ctx.strokeStyle = "#3f6b35";
            ctx.lineWidth = Math.max(1, r * 0.2);
            ctx.stroke();
          }
          ctx.restore();
        },
      });
    }
    return items;
  }

  /** Dust as a stipple of dots, the way a stone print shows a cloud. */
  private dustItems(dust: Dust, camera: Camera, p: PosterPalette): DrawItem[] {
    const ctx = this.ctx;
    const items: DrawItem[] = [];
    for (let i = 0; i < dust.count; i++) {
      const q = camera.project({ x: dust.x[i], y: dust.y[i], z: dust.z[i] });
      if (q.depth < NEAR) continue;
      const alpha = dust.opacity(i) * 0.75;
      if (alpha < 0.03) continue;
      const r = dust.size[i] * q.scale;
      items.push({
        depth: q.depth,
        paint: () => {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.dust;
          ctx.beginPath();
          for (let k = 0; k < 7; k++) {
            // A fixed scatter per puff, so the stipple doesn't shimmer.
            const a = (i * 2.399 + k * 2.1) % (Math.PI * 2);
            const d = r * (0.2 + ((i * 7 + k * 13) % 10) / 9);
            const dot = Math.max(0.7, r * (0.07 + ((i + k * 5) % 4) * 0.025));
            ctx.moveTo(q.x + Math.cos(a) * d + dot, q.y + Math.sin(a) * d * 0.7);
            ctx.arc(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.7, dot, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        },
      });
    }
    return items;
  }

  /* ---------- Shadows, only where the sun reaches ---------- */

  private paintShadows(scene: RingFrame, camera: Camera, p: PosterPalette) {
    const ctx = this.ctx;
    const sunny = this.plaza.discPath(camera, scene.patch.centre, scene.patch.radius);
    if (!sunny) return;
    // By day the low sun throws long shadows; under the evening's lamps each figure stands in a short pool of its own.
    const light = p.lamp ? normalize({ x: scene.sun.x * 0.25, y: -1, z: scene.sun.z * 0.25 }) : scene.sun;
    const onGround = (q: Vec3) => camera.project(addScaled(q, light, q.y / -light.y));
    const path = new Path2D();
    const limb = (a: Vec3, b: Vec3, ra: number, rb: number) => {
      const pa = onGround(a);
      const pb = onGround(b);
      if (pa.depth < NEAR || pb.depth < NEAR) return;
      capsulePath(path, pa, ra * pa.scale, pb, rb * pb.scale);
    };
    for (const figure of scene.figures) for (const [a, b, ra, rb] of matadorLimbs(figure.skeleton)) limb(a, b, ra, rb);
    if (scene.bull) for (const part of bullShadowParts(scene.bull)) limb(part.a, part.b, part.ra, part.rb);
    for (const cape of scene.capes) {
      const { pos, triangles } = cape;
      for (let t = 0; t < triangles.length; t += 3) {
        const pts = [triangles[t], triangles[t + 1], triangles[t + 2]].map((i) => onGround({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] }));
        if (pts.some((q) => q.depth < NEAR)) continue;
        polygonPath(path, pts);
      }
    }
    ctx.save();
    ctx.clip(sunny);
    ctx.fillStyle = p.shadow;
    ctx.fill(path, "nonzero");
    ctx.restore();
  }

  /* ---------- The gate's evening light ---------- */

  private paintGateLight(ctx: CanvasRenderingContext2D, camera: Camera, p: PosterPalette, glow: number) {
    const gate = camera.project(around(PLAZA.gateAzimuth, wallRadius(), PLAZA.gateHeight * 0.5));
    if (gate.depth < NEAR) return;
    const reach = Math.max(camera.width * 0.25, PLAZA.gateWidth * 3 * gate.scale);
    const g = ctx.createRadialGradient(gate.x, gate.y, 0, gate.x, gate.y, reach);
    g.addColorStop(0, p.gateGlow);
    g.addColorStop(1, "transparent");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.18 * glow;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, camera.width, camera.height);
    ctx.restore();
  }

  /* ---------- Breaking out of the frame ---------- */

  /** The nearest figures drawn again over the frame's rules, within a band round the window. */
  private breakOut(scene: RingFrame, camera: Camera, p: PosterPalette, layout: PosterLayout) {
    const ctx = this.ctx;
    const im = layout.image;
    const band = 70 * layout.unit;
    ctx.save();
    const region = new Path2D();
    region.rect(im.x - band, im.y - band, im.w + band * 2, im.h + band * 2);
    region.rect(im.x, im.y, im.w, im.h);
    ctx.clip(region, "evenodd");
    ctx.translate(im.x, im.y);
    const items = this.actorItems({ ...scene, thrown: [], dust: null }, camera, p);
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) item.paint();
    ctx.restore();
  }
}
