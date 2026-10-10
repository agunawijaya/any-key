/*
 * The Spooky Storybook: the pit as a picture-book page. The meadow, the bowl
 * of earth and the step marks are painted once per pit and appearance; rocks,
 * burrows, patches, cairns, carrots and everyone in the pit are painted every
 * frame, back to front, so a rabbit behind a boulder is hidden by it.
 */

import { type Cell, inCircle, keyOf } from "@/lib/ten-turns/geometry";
import type { PitCamera } from "../../scene/camera";
import { type BoardView, type KidView, type RabbitView, type SceneFrame, type Spot, standingKid } from "../../scene/view";
import type { PitStyle, ReleaseMoment, ScreenSpot } from "../style";
import { castShadow, circlingStars, critters, dustPuff, landingShadow, paperFinish, softEllipse } from "./fx";
import { drawKid, STANDING, type KidPose } from "./kid";
import { shout } from "./lettering";
import { lookFor, type Look } from "./look";
import { turnPage } from "./page";
import { paperTile, type Pt } from "./paint";
import { paintPit, pitCamera, pitShape, type PitLayers, type PitShape } from "./pit";
import { boulder, burrow, cairn, carrot, carrotPatch, cellRing, intentArc, rustlingGrass } from "./props";
import { drawFlatRabbit, drawLeapingRabbit, drawRabbit, RESTING } from "./rabbit";
import { StorybookRelease } from "./release";

/** World units per rabbit unit and per kid unit: how big the figures stand in the pit. */
export const RABBIT_SIZE = 1.7;
export const KID_SIZE = 1.5;

/** Ribbon colours for tunnel pairs, so you can tell which hole leads where. */
const RIBBONS = ["#d8432e", "#2e7fd8", "#e8b63a"];

type Zoom = SceneFrame["zoom"];

export class StorybookStyle implements PitStyle {
  readonly id = "storybook" as const;
  private look: Look = lookFor(false);
  private width = 1;
  private height = 1;
  private dpr = 1;
  private shape: PitShape = pitShape(10);
  private board: BoardView | null = null;
  private camera: PitCamera = pitCamera(1, 1);
  private layers: PitLayers | null = null;
  /** A sharp painting for a held zoom, made a moment after the zoom settles. */
  private zoomed: { key: string; camera: PitCamera; layers: PitLayers } | null = null;
  private zoomTimer = 0;
  private paper: CanvasPattern | null = null;
  private release: StorybookRelease;
  private current: PitCamera = this.camera;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly fonts: { shout: string; book: string },
  ) {
    this.release = new StorybookRelease(ctx);
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.release.resize(width, height, dpr);
    this.repaint();
  }

  setNight(night: boolean) {
    if (this.look.night === night) return;
    this.look = lookFor(night);
    this.release.setNight(night);
    this.repaint();
  }

  setBoard(board: BoardView) {
    const radiusChanged = !this.board || this.board.radius !== board.radius;
    this.board = board;
    if (radiusChanged) {
      this.shape = pitShape(board.radius);
      this.repaint();
    }
  }

  private repaint() {
    if (this.width < 2) return;
    this.camera = pitCamera(this.width, this.height, this.shape);
    this.current = this.camera;
    this.layers = paintPit(this.camera, this.look, this.width, this.height, this.dpr, this.shape);
    this.zoomed = null;
    this.paper ??= this.ctx.createPattern(paperTile(256, 5), "repeat");
  }

  dispose() {
    window.clearTimeout(this.zoomTimer);
    this.layers = null;
    this.zoomed = null;
  }

  /* ---------- Cameras ---------- */

  /** The same view, nearer: the whole pit fitted to a bigger box, then slid so the focus keeps its place, drawn a third of the way to the middle. */
  private zoomCamera(zoom: Zoom): PitCamera {
    const focus = this.camera.project(zoom.focus.x, zoom.focus.y, 0);
    const camera = pitCamera(this.width * zoom.factor, this.height * zoom.factor, this.shape);
    const moved = camera.project(zoom.focus.x, zoom.focus.y, 0);
    camera.shift(focus.x - moved.x + (this.width / 2 - focus.x) * 0.35, focus.y - moved.y + (this.height / 2 - focus.y) * 0.35);
    return camera;
  }

  project(spot: Spot, lift = 0): ScreenSpot {
    return this.current.project(spot.x, spot.y, lift);
  }

  cellAt(x: number, y: number): Cell | null {
    const floor = this.current.toPlane(x, y, 0);
    const cell = { x: Math.round(floor.x), y: Math.round(floor.y) };
    return inCircle(cell, this.shape.lattice) ? cell : null;
  }

  /* ---------- A frame ---------- */

  render(frame: SceneFrame) {
    const ctx = this.ctx;
    if (!this.layers || !this.board) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackdrop(frame.zoom);
    const look = this.look;
    const camera = this.current;
    const at = (c: Spot, lift = 0) => camera.project(c.x, c.y, lift);
    const t = frame.time;

    // Flat things on the floor.
    const board = frame.board;
    const ribbon = new Map<string, string>();
    board.tunnels.forEach(([a, b], i) => {
      ribbon.set(keyOf(a), RIBBONS[i % RIBBONS.length]);
      ribbon.set(keyOf(b), RIBBONS[i % RIBBONS.length]);
    });
    for (const c of board.caved) burrow(ctx, look, at(c), "caved", null);
    for (const c of board.burrows) burrow(ctx, look, at(c), "open", ribbon.get(keyOf(c)) ?? null);
    if (frame.marks.rustle) for (const c of frame.marks.rustle) rustlingGrass(ctx, look, at(c), c, t);
    for (const c of frame.marks.reachable) cellRing(ctx, look, at(c), "reachable");
    for (const c of frame.marks.targets) cellRing(ctx, look, at(c), "target");
    if (frame.marks.hover) cellRing(ctx, look, at(frame.marks.hover), "hover");
    if (frame.marks.refused) cellRing(ctx, look, at(frame.marks.refused.cell), "refused", frame.marks.refused.age, frame.marks.refused.shake);
    for (const l of frame.effects.landing) {
      const p = at(l.at);
      landingShadow(ctx, look, p, p.scale * l.size, l.closeness);
    }
    if (frame.kid && frame.kid.pose !== "hidden") this.kidShadow(frame.kid);
    for (const r of frame.rabbits) this.rabbitShadow(r);
    if (frame.kid && look.night && frame.kid.pose !== "hidden") this.lanternPool(frame.kid);
    // The rabbit's intent sits under the figures, so its arc seems to leave from behind the rabbit.
    for (const i of frame.marks.intents) {
      const from = at(i.from, RABBIT_SIZE * 0.45);
      intentArc(ctx, look, from, at(i.to), from.scale * 1.9, i.first, t);
    }

    // Upright things, back to front.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const c of board.rocks) items.push({ y: c.y, draw: () => boulder(ctx, look, at(c), c) });
    for (const c of board.stones) items.push({ y: c.y, draw: () => cairn(ctx, look, at(c)) });
    for (const c of board.patches) items.push({ y: c.y, draw: () => carrotPatch(ctx, look, at(c), t) });
    for (const c of board.carrots) items.push({ y: c.y, draw: () => carrot(ctx, look, at(c), 0, 0.3 + ((c.x * 7 + c.y * 3) % 5) * 0.2) });
    frame.rabbits.forEach((r) => items.push({ y: r.at.y - (r.pose === "leap" ? 0.6 : 0), draw: () => this.drawRabbit(r, t) }));
    if (frame.kid) {
      const kid = frame.kid;
      items.push({ y: kid.at.y - 0.01, draw: () => this.drawKid(kid, t) });
    }
    items.sort((a, b) => b.y - a.y);
    for (const item of items) item.draw();

    // Marks and effects over everything.
    for (const d of frame.effects.dust) {
      const p = at(d.at);
      dustPuff(ctx, look, p, p.scale * d.size, d.age, Math.round(d.at.x * 13 + d.at.y * 7));
    }
    for (const s of frame.effects.stars) {
      const p = at(s.at, s.lift);
      circlingStars(ctx, look, p, p.scale * s.size, t, 4);
    }
    for (const f of frame.effects.flying) carrot(ctx, look, at(f.at, f.lift), f.lift, f.spin);
    if (frame.effects.shout) {
      const s = frame.effects.shout;
      const p = at(s.at, s.lift);
      shout(ctx, look, s.text, p, p.scale * 2.1, this.fonts.shout, s.age, p.scale * 0.45);
    }
    this.drawLayer("foreground", frame.zoom);
    critters(ctx, look, this.width, this.height, t, look.night ? 16 : 5);
    if (frame.effects.blackout > 0) this.blackout(frame);
    if (frame.effects.burp) this.burp(frame.effects.burp);
    if (frame.effects.pageTurn) {
      const page = frame.effects.pageTurn;
      turnPage(ctx, look, this.width, this.height, page.amount * Math.hypot(this.width, this.height) * 1.1, {
        title: page.title,
        line: page.line,
        font: this.fonts.book,
        picture: (c, ground, size) => this.squishPicture(c, ground, size, t),
      });
    }
    if (this.paper) paperFinish(ctx, look, this.paper, this.width, this.height);
  }

  renderRelease(moment: ReleaseMoment) {
    this.release.draw(moment);
  }

  /* ---------- The backdrop, near or far ---------- */

  private drawBackdrop(zoom: Zoom) {
    if (zoom.factor <= 1.001) this.current = this.camera;
    else if (this.zoomed?.key === zoomKey(zoom)) this.current = this.zoomed.camera;
    else {
      // While the zoom moves, the far painting is stretched to match; a sharp one follows once it holds still.
      const near = this.zoomCamera(zoom);
      this.current = near;
      const key = zoomKey(zoom);
      window.clearTimeout(this.zoomTimer);
      this.zoomTimer = window.setTimeout(() => {
        this.zoomed = { key, camera: near, layers: paintPit(near, this.look, this.width, this.height, this.dpr, this.shape) };
      }, 180);
    }
    this.drawLayer("backdrop", zoom);
  }

  /** Draws one painted layer for the current camera: the sharp zoomed painting if there is one, else the far one, stretched. */
  private drawLayer(which: keyof PitLayers, zoom: Zoom) {
    const ctx = this.ctx;
    if (zoom.factor > 1.001 && this.zoomed?.key === zoomKey(zoom)) {
      ctx.drawImage(this.zoomed.layers[which], 0, 0, this.width, this.height);
      return;
    }
    const a = this.camera.lens;
    const b = this.current.lens;
    const k = b.focal / a.focal;
    ctx.save();
    ctx.setTransform(this.dpr * k, 0, 0, this.dpr * k, this.dpr * (b.cx - k * a.cx), this.dpr * (b.cy - k * a.cy));
    ctx.drawImage(this.layers![which], 0, 0, this.width, this.height);
    ctx.restore();
  }

  /* ---------- Figures ---------- */

  private kidShadow(kid: KidView) {
    const look = this.look;
    const foot = this.current.project(kid.at.x, kid.at.y, 0);
    if (kid.lift > 0.05) {
      const k = 1 / (1 + kid.lift * 0.22);
      softEllipse(this.ctx, foot, foot.scale * 0.5 * k, foot.scale * 0.2 * k, 0, look.shadow, (look.night ? 0.5 : 0.36) * k, 0.6);
      return;
    }
    const reach = ((1.6 * KID_SIZE) / Math.tan(look.lightElevation)) * 0.8;
    const tip = this.current.project(kid.at.x - look.lightGround.x * reach, kid.at.y - look.lightGround.y * reach, 0);
    castShadow(this.ctx, look, foot, tip, foot.scale * 0.9);
  }

  private rabbitShadow(r: RabbitView) {
    const look = this.look;
    const foot = this.current.project(r.at.x, r.at.y, 0);
    if (r.pose === "flat") {
      softEllipse(this.ctx, foot, foot.scale * 1.7, foot.scale * 0.55, 0, look.shadow, look.night ? 0.45 : 0.3, 0.6);
      return;
    }
    if (r.lift > 0.05) {
      const k = 1 / (1 + r.lift * 0.22);
      softEllipse(this.ctx, foot, foot.scale * 0.75 * k, foot.scale * 0.3 * k, 0, look.shadow, (look.night ? 0.55 : 0.4) * k, 0.6);
      return;
    }
    const reach = ((1.3 * RABBIT_SIZE) / Math.tan(look.lightElevation)) * 0.8;
    const tip = this.current.project(r.at.x - look.lightGround.x * reach, r.at.y - look.lightGround.y * reach, 0);
    castShadow(this.ctx, look, foot, tip, foot.scale * 1.4);
  }

  /** By night the kid's lantern throws a warm pool round their feet. */
  private lanternPool(kid: KidView) {
    const ground = this.current.project(kid.at.x, kid.at.y, 0);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    softEllipse(ctx, { x: ground.x + kid.facing * ground.scale * 0.35, y: ground.y }, ground.scale * 2.1, ground.scale * 1.15, 0, "#ff9f45", 0.2 / (1 + kid.lift * 0.4), 0.95);
    ctx.restore();
  }

  private drawKid(kid: KidView, time: number) {
    const ctx = this.ctx;
    const p = this.current.project(kid.at.x, kid.at.y, kid.lift);
    if (kid.pose === "hidden") {
      this.peekFromBurrow(p, time);
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    const s = p.scale * KID_SIZE;
    ctx.scale((s * kid.facing) / Math.sqrt(kid.squash), s * kid.squash);
    drawKid(ctx, this.look, kidPose(kid, time));
    ctx.restore();
  }

  /** The end page's picture of a squish: the rabbit flat as a rug and the kid standing on it, arms up. */
  private squishPicture(ctx: CanvasRenderingContext2D, ground: Pt, size: number, time: number) {
    const look = this.look;
    const u = size * 1.25;
    softEllipse(ctx, { x: ground.x, y: ground.y + u * 0.12 }, u * 2.3, u * 0.5, 0, look.ink, 0.16, 0.6);
    ctx.save();
    ctx.translate(ground.x, ground.y);
    ctx.scale(u, u * 0.82);
    drawFlatRabbit(ctx, look, 1, time);
    ctx.restore();
    circlingStars(ctx, look, { x: ground.x + u * 1.45, y: ground.y - u * 0.35 }, u * 0.45, time, 3);
    ctx.save();
    ctx.translate(ground.x - u * 0.2, ground.y - u * 0.05);
    ctx.scale(u * 0.95, u * 0.95);
    drawKid(ctx, look, kidPose({ ...standingKid({ x: 0, y: 0 }), pose: "cheer", mood: "joy" }, time));
    ctx.restore();
  }

  /** Hiding: two eyes in the dark of the hole, blinking now and then. */
  private peekFromBurrow(p: ScreenSpot, time: number) {
    const ctx = this.ctx;
    const u = p.scale;
    const open = Math.sin(time * 0.9) > -0.92;
    ctx.save();
    for (const dx of [-0.09, 0.09]) {
      ctx.fillStyle = "#fffbe8";
      ctx.beginPath();
      ctx.ellipse(p.x + dx * u, p.y - u * 0.02, u * 0.06, open ? u * 0.05 : u * 0.01, 0, 0, Math.PI * 2);
      ctx.fill();
      if (open) {
        ctx.fillStyle = "#1a1210";
        ctx.beginPath();
        ctx.arc(p.x + dx * u + Math.sin(time * 0.7) * u * 0.015, p.y - u * 0.02, u * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawRabbit(r: RabbitView, time: number) {
    const ctx = this.ctx;
    const look = this.look;
    if (r.pose === "flat") {
      const p = this.current.project(r.at.x, r.at.y, 0);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale * RABBIT_SIZE * r.facing, p.scale * RABBIT_SIZE);
      drawFlatRabbit(ctx, look, r.flat, time);
      ctx.restore();
      return;
    }
    if (r.pose === "leap") {
      const p = this.current.project(r.at.x, r.at.y, r.lift + 0.55 * RABBIT_SIZE);
      const loom = 1 + r.lift * 0.045;
      const f = r.flight;
      const pitch = f < 0.5 ? -0.45 + 0.9 * f : (f - 0.5) * 1.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale * RABBIT_SIZE * loom * r.facing, p.scale * RABBIT_SIZE * loom);
      drawLeapingRabbit(ctx, look, { stretch: 1 + 0.32 * Math.sin(Math.PI * f), pitch, mouth: r.mouth, menace: r.menace, look: r.look, time, wearsHat: r.hat });
      ctx.restore();
      return;
    }
    const p = this.current.project(r.at.x, r.at.y, r.lift);
    const loom = 1 + r.lift * 0.045;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.scale * RABBIT_SIZE * loom * r.facing, p.scale * RABBIT_SIZE * loom);
    const chewing = r.pose === "eat" ? Math.abs(Math.sin(time * 9)) * 0.3 : 0;
    drawRabbit(ctx, look, {
      ...RESTING,
      time,
      squash: r.squash,
      menace: r.pose === "eat" || r.pose === "stunned" ? 0 : r.menace,
      mouth: Math.max(r.mouth, chewing),
      earsBack: r.earsBack,
      look: r.look,
      // Blinks every few seconds; a stunned rabbit keeps its eyes screwed shut.
      blink: r.pose === "stunned" ? 1 : (time * 0.37 + r.at.x * 0.13) % 3.1 < 0.12 ? 1 : 0,
      nose: r.pose === "sit" ? Math.sin(time * 17 + r.at.y) * (Math.sin(time * 0.8) > 0.3 ? 1 : 0) : 0,
      wearsHat: r.hat,
    });
    ctx.restore();
    if (r.pose === "eat") {
      const paws = this.current.project(r.at.x + 0.25 * r.facing, r.at.y - 0.05, 0.45 * RABBIT_SIZE);
      carrot(ctx, look, paws, 1, -0.9 * r.facing);
    }
  }

  /** After a crunch, in the dark: a small, satisfied word. */
  private burp(burp: { at: Spot; age: number }) {
    const ctx = this.ctx;
    const p = this.current.project(burp.at.x, burp.at.y, 1.6 * RABBIT_SIZE);
    const size = Math.max(18, p.scale * 0.55);
    ctx.save();
    ctx.globalAlpha = Math.min(1, burp.age * 3);
    ctx.font = `italic ${Math.round(size)}px ${this.fonts.book}`;
    ctx.textAlign = "center";
    ctx.fillStyle = this.look.night ? "#f1e8cf" : "#fbf4e3";
    ctx.fillText(BURP, p.x + p.scale * 0.6, p.y - burp.age * p.scale * 0.4);
    ctx.restore();
  }

  /** The crunch: the dark closes in on the rabbit like the end of a story. */
  private blackout(frame: SceneFrame) {
    const ctx = this.ctx;
    const r = frame.rabbits[0];
    const centre = r ? this.current.project(r.at.x, r.at.y, 0.6 * RABBIT_SIZE) : { x: this.width / 2, y: this.height / 2, scale: 40 };
    const reach = Math.hypot(this.width, this.height) * (1 - frame.effects.blackout) + centre.scale * 1.2 * (1 - frame.effects.blackout);
    ctx.save();
    ctx.fillStyle = this.look.night ? "#03040a" : "#1a1210";
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.arc(centre.x, centre.y, Math.max(0, reach), 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  }
}

const BURP = "burp.";

const zoomKey = (zoom: Zoom) => `${zoom.factor.toFixed(3)}/${zoom.focus.x.toFixed(2)},${zoom.focus.y.toFixed(2)}`;

/** The kid's body for each pose the play screens ask for. */
function kidPose(kid: KidView, time: number): KidPose {
  const base: KidPose = { ...STANDING, face: kid.mood, look: kid.look, time, hat: kid.hat };
  const sway = Math.sin(time * 2.2) * 0.015;
  switch (kid.pose) {
    case "step":
      return { ...base, hands: { left: { x: -0.36, y: -0.42 + Math.sin(time * 14) * 0.06 }, right: { x: 0.36, y: -0.42 - Math.sin(time * 14) * 0.06 } }, wind: { x: 0.5, y: 0.1 } };
    case "cower":
      return { ...base, hands: { left: { x: -0.4, y: -1.02 }, right: { x: 0.3, y: -1.2 } } };
    case "fall":
      return { ...base, hands: { left: { x: -0.5, y: -1.1 }, right: { x: 0.5, y: -1.15 } }, legs: "spread", wind: { x: 0.1, y: 1 } };
    case "sit":
      return { ...base, hands: { left: { x: -0.42, y: -0.62 }, right: { x: 0.5, y: -1.2 + Math.sin(time * 8) * 0.06 } }, legs: "sit", wind: { x: 0.25, y: 0.1 } };
    case "cheer":
      return { ...base, hands: { left: { x: -0.62, y: -1.62 + Math.sin(time * 6) * 0.05 }, right: { x: 0.64, y: -1.66 - Math.sin(time * 6) * 0.05 } }, wind: { x: 0.55, y: 0.1 } };
    default:
      return { ...base, hands: { left: { x: -0.33, y: -0.36 + sway }, right: { x: 0.33, y: -0.36 - sway } } };
  }
}
