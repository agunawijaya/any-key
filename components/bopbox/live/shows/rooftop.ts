import { pulse, type Lane, type Performance, type TrackCues } from "@/lib/music/perform/cues";
import { splitKit } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import { Figure, sway, type Look } from "../figure";
import { seatedLegs, SEATED_FLOOR } from "../instruments/strings";
import { add, capsule, clamp, curve, ellipse, poly, pt, roundRect, seededRandom, type Light, type Painter, type Pt } from "../paint";
import { blinking } from "../players";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * Lo-fi: a rooftop at dusk, the owner's pick. Under the awning of a little
 * rooftop room, someone in headphones sits at a café table: a walkman with
 * its reels turning, a desk lamp, a cup still steaming, a cat asleep on the
 * parapet. Rain runs down the room's window and drizzles past the awning.
 * The city across the street plays along: every note of the vibraphone
 * lights a window in the tall building (higher notes, higher floors), each
 * chord on the electric piano lights a few windows next door, the red light
 * on the radio mast blinks with the kick, and the cat's tail twitches on
 * the snare. The sky darkens slowly as the tune goes on.
 */

type Sky = { top: string; low: string; endTop: string; endLow: string };

const SKIES: Record<Theme, Sky> = {
  light: { top: "#b77ab0", low: "#ffb27a", endTop: "#6a5aa8", endLow: "#f08a8a" },
  dark: { top: "#2a2350", low: "#7a3f6a", endTop: "#0c1030", endLow: "#3a2a5a" },
};

type Palette = { far: string; near: string; window: string; lit: string; roof: string; parapet: string; shed: string; shedEdge: string; awningA: string; awningB: string; glass: string; inside: string; table: string; rain: string; cat: string; catDark: string };

const PALETTES: Record<Theme, Palette> = {
  light: { far: "#b58aa0", near: "#7a5a7a", window: "#9a7a90", lit: "#ffe7a0", roof: "#8a7a78", parapet: "#a8968e", shed: "#c9b8a8", shedEdge: "#8a7868", awningA: "#2f7a7a", awningB: "#f2e8d8", glass: "#f6d0a0", inside: "#ffcf8a", table: "#3a3038", rain: "rgba(255,255,255,0.45)", cat: "#e89a5a", catDark: "#b86a3a" },
  dark: { far: "#2a2448", near: "#1a1630", window: "#2a2646", lit: "#ffd27a", roof: "#2a2430", parapet: "#3a3242", shed: "#3e3446", shedEdge: "#241e2a", awningA: "#1f5a5a", awningB: "#cfc2b4", glass: "#3a2a3a", inside: "#ffb860", table: "#1e1a24", rain: "rgba(200,210,255,0.35)", cat: "#d8884a", catDark: "#9a5a2a" },
};

type Tower = { x: number; w: number; h: number; tone: number; windows: Pt[] };

const SHED = { x0: -158, x1: -66, top: -134 };
const AWNING = { x0: -66, x1: 44, y0: -130, y1: -116 };
const TABLE = { x: 16, top: -50 };
const PARAPET = -26;

export class Rooftop extends Scene {
  readonly caption = "Lo-fi on a rooftop at dusk: the city's windows light up with the melody.";
  private towers: Tower[] = [];
  private melody?: TrackCues;
  private chords?: TrackCues;
  private kick?: Lane;
  private snare?: Lane;
  private ids: string[];
  private look: Look;
  private fig?: Figure;

  constructor(perf: Performance) {
    super(perf);
    this.melody = perf.tracks.find((c) => c.track.role === "melody");
    this.chords = perf.tracks.find((c) => c.track.role === "chords");
    const drums = perf.tracks.find((c) => c.track.patch.drums);
    if (drums) {
      const kit = splitKit(drums.lane);
      this.kick = kit.rightFoot;
      this.snare = kit.leftHand;
    }
    this.ids = perf.tracks.map((c) => c.track.id);
    this.look = { skin: "#e8b48c", hair: "#2a1d24", hairStyle: "bob", outfit: "sweater", top: "#c98a3a", trim: "#f2dcb4", bottom: "#3a4258", shoes: "#2a2430", headphones: "#2a6a6a", shortSleeves: false, build: 1, height: 1 };
    this.city();
  }

  /** The skyline, seeded: the tall building in the middle carries the melody. */
  private city() {
    const r = seededRandom(17);
    let x = -170;
    while (x < 170) {
      const w = 16 + r() * 22;
      const tall = x > 30 && x < 60;
      const h = tall ? 132 : 40 + r() * 70;
      const windows: Pt[] = [];
      for (let wy = -h + 6; wy < PARAPET - 6; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 4.5) windows.push(pt(wx, wy));
      this.towers.push({ x, w, h, tone: r(), windows });
      x += w + 2 + r() * 4;
    }
  }

  protected world(): World {
    return { x0: -150, x1: 150, y0: -156, y1: 8 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: 0.85, y: -0.5 }, shadow: "#1a1030", shadeAmount: 0.45, shadeDepth: 3, rim: { color: "#ffc070", width: 0.9, alpha: 0.9 }, ink: 0.75, inkTone: "#1a1028" }
      : { dir: { x: 0.8, y: -0.6 }, shadow: "#6a4a6a", shadeAmount: 0.26, shadeDepth: 3, rim: { color: "#ffe2b0", width: 0.8, alpha: 0.75 }, ink: 0.7, inkTone: "#3a2a3a" };
  }

  protected paintSky(ctx: CanvasRenderingContext2D, frame: FrameInfo) {
    const sky = SKIES[frame.theme];
    const v = this.camera.view;
    // Dusk deepens over the tune.
    const u = clamp(frame.beat / Math.max(1, this.perf.arrangement.length));
    const g = ctx.createLinearGradient(0, v.y0, 0, PARAPET);
    g.addColorStop(0, mix(sky.top, sky.endTop, u));
    g.addColorStop(1, mix(sky.low, sky.endLow, u));
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    if (frame.theme === "dark") {
      const r = seededRandom(5);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 40; i++) {
        const s = pt(v.x0 + r() * (v.x1 - v.x0), v.y0 + r() * 70);
        ctx.globalAlpha = clamp(u * 1.6 - r() * 0.6) * 0.8;
        ctx.fillRect(s.x, s.y, 0.6, 0.6);
      }
      ctx.globalAlpha = 1;
    }
    // Low clouds still lit from below by the set sun.
    ctx.fillStyle = frame.theme === "dark" ? "rgba(120, 80, 140, 0.35)" : "rgba(255, 220, 200, 0.55)";
    const r = seededRandom(8);
    for (let i = 0; i < 6; i++) {
      const c = pt(v.x0 + r() * (v.x1 - v.x0), v.y0 + 12 + r() * 30);
      for (let k = 0; k < 4; k++) ctx.fill(ellipse(c.x + k * 9 - 13, c.y + (k % 2) * 2, 12, 4));
    }
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    // Towers across the street, their unlit windows.
    for (const t of this.towers) {
      ctx.fillStyle = mix(pal.far, pal.near, t.tone * 0.6);
      ctx.fillRect(t.x, -t.h, t.w, t.h + PARAPET + 10);
      ctx.fillStyle = pal.window;
      for (const w of t.windows) ctx.fillRect(w.x, w.y, 2.4, 3.2);
    }
    const mast = this.mast();
    ctx.fillStyle = pal.near;
    ctx.fillRect(mast.x - 0.6, mast.y, 1.2, 14);
    // The rooftop floor and the low parapet at its far edge.
    ctx.fillStyle = pal.parapet;
    ctx.fillRect(v.x0, PARAPET, v.x1 - v.x0, 4);
    ctx.fillStyle = mix(pal.parapet, "#000000", 0.2);
    ctx.fillRect(v.x0, PARAPET + 4, v.x1 - v.x0, -PARAPET - 4);
    ctx.fillStyle = pal.roof;
    ctx.fillRect(v.x0, 0, v.x1 - v.x0, v.y1);
    ctx.strokeStyle = mix(pal.roof, "#000000", 0.25);
    ctx.lineWidth = 0.4;
    for (let x = v.x0; x < v.x1; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 8, v.y1);
      ctx.stroke();
    }
    // The rooftop room: plaster walls, a door, the window lit from inside.
    ctx.fillStyle = pal.shed;
    ctx.fillRect(SHED.x0, SHED.top, SHED.x1 - SHED.x0, -SHED.top);
    ctx.fillStyle = pal.shedEdge;
    ctx.fillRect(SHED.x0 - 3, SHED.top - 4, SHED.x1 - SHED.x0 + 6, 4);
    ctx.fillRect(SHED.x1 - 26, -62, 20, 62);
    ctx.fillStyle = pal.inside;
    ctx.fillRect(-140, -78, 40, 30);
    ctx.fillStyle = pal.shedEdge;
    ctx.fillRect(-121, -78, 1.6, 30);
    ctx.fillRect(-140, -64, 40, 1.4);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-140, -78, 40, 30);
    // A potted plant by the door.
    ctx.fillStyle = "#a85a3a";
    ctx.fill(poly([pt(-86, -10), pt(-78, -10), pt(-79, 0), pt(-85, 0)]));
    ctx.fillStyle = theme === "dark" ? "#2a4a3a" : "#3a7a4a";
    for (let i = 0; i < 5; i++) ctx.fill(ellipse(-82 + (i - 2) * 2.6, -15 - (i % 2) * 3, 2, 6, (i - 2) * 0.3));
  }

  private mast() {
    const tall = this.towers.find((t) => t.h >= 130) ?? this.towers[0];
    return pt(tall.x + tall.w / 2, -tall.h - 14);
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    const pal = PALETTES[frame.theme];
    const muted = this.ids.every((id) => frame.muted.has(id));
    this.cityLights(p.ctx, frame, pal);
    this.rain(p.ctx, frame, pal);
    this.windowRain(p.ctx, frame, pal);
    this.cat(p, frame, pal);
    this.sitter(p, frame, muted);
    this.tableTop(p, frame, pal, muted);
    this.awning(p, frame, pal);
  }

  /** Windows lit by the music, and the mast's red light on the kick. */
  private cityLights(ctx: CanvasRenderingContext2D, frame: FrameInfo, pal: Palette) {
    const tall = this.towers.find((t) => t.h >= 130);
    const glowFor = (since: number, length: number) => clamp(1 - Math.max(0, since - length) / 1.4) * clamp(since / 0.04);
    ctx.save();
    ctx.fillStyle = pal.lit;
    if (tall && this.melody && !frame.muted.has(this.melody.track.id)) {
      const { lane, lo, hi } = this.melody;
      const rows = Math.floor((tall.h + PARAPET - 12) / 6);
      const cols = Math.floor((tall.w - 6) / 4.5);
      for (let i = Math.max(0, lane.lastIndex(frame.t) - 10); i <= lane.lastIndex(frame.t); i++) {
        const hit = lane.hits[i];
        if (!hit) continue;
        const a = glowFor(frame.t - hit.t, hit.end - hit.t);
        if (a <= 0) continue;
        const row = rows - 1 - Math.round(((hit.pitch - lo) / Math.max(1, hi - lo)) * (rows - 1));
        const col = i % cols;
        ctx.globalAlpha = a;
        ctx.fillRect(tall.x + 3 + col * 4.5, -tall.h + 6 + row * 6, 2.4, 3.2);
      }
    }
    if (this.chords && !frame.muted.has(this.chords.track.id)) {
      const { lane } = this.chords;
      const neighbours = this.towers.filter((t) => t !== tall && t.x > -60 && t.x < 150);
      for (let i = Math.max(0, lane.lastIndex(frame.t) - 12); i <= lane.lastIndex(frame.t); i++) {
        const hit = lane.hits[i];
        if (!hit) continue;
        const a = glowFor(frame.t - hit.t, hit.end - hit.t) * 0.85;
        if (a <= 0) continue;
        const r = seededRandom(Math.round(hit.t * 1000) + hit.pitch);
        const tower = neighbours[Math.floor(r() * neighbours.length)];
        if (!tower?.windows.length) continue;
        const w = tower.windows[Math.floor(r() * tower.windows.length)];
        ctx.globalAlpha = a;
        ctx.fillRect(w.x, w.y, 2.4, 3.2);
      }
    }
    const mast = this.mast();
    const blink = this.kick && !frame.muted.has(this.ids[0]) ? pulse(this.kick, frame.t, 0.25) : 0.2;
    ctx.globalAlpha = 0.35 + blink * 0.65;
    ctx.fillStyle = "#ff3a3a";
    ctx.beginPath();
    ctx.arc(mast.x, mast.y, 1.2 + blink * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A fine drizzle slanting across the city; dripping from the awning's edge. */
  private rain(ctx: CanvasRenderingContext2D, frame: FrameInfo, pal: Palette) {
    const v = this.camera.view;
    const r = seededRandom(29);
    ctx.save();
    ctx.strokeStyle = pal.rain;
    ctx.lineWidth = 0.35;
    const speed = frame.reduced ? 0.3 : 1;
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const x0 = v.x0 + r() * (v.x1 - v.x0 + 40);
      const fall = ((frame.wall * 120 * speed * (0.8 + r() * 0.4) + r() * 300) % (v.y1 - v.y0 + 20)) + v.y0 - 10;
      const x = x0 - (fall - v.y0) * 0.18;
      ctx.moveTo(x, fall);
      ctx.lineTo(x - 1.4, fall + 7);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Drops running down the lit window, each leaving a short trail. */
  private windowRain(ctx: CanvasRenderingContext2D, frame: FrameInfo, pal: Palette) {
    const r = seededRandom(41);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-140, -78, 40, 30);
    ctx.clip();
    ctx.fillStyle = mix(pal.inside, "#000000", 0.1);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(-140, -78, 40, 30);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const x = -139 + r() * 38;
      const speed = (frame.reduced ? 0.4 : 1) * (2 + r() * 6);
      const y = -80 + ((frame.wall * speed + r() * 40) % 34);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y - 5 - r() * 4);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.ellipse(x, y, 0.6, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The cat asleep on the parapet: breathing slowly, its tail tip twitching on the snare. */
  private cat(p: Painter, frame: FrameInfo, pal: Palette) {
    const c = pt(84, PARAPET - 5);
    const breathe = 1 + Math.sin(frame.wall * 1.6) * 0.04;
    const twitch = this.snare && !frame.reduced ? pulse(this.snare, frame.t, 0.18) : 0;
    const tailTip = add(c, pt(-17, -6 - twitch * 5));
    p.part(capsule(add(c, pt(-8, 3)), add(c, pt(-15, 1)), 2, 1.6), pal.cat);
    p.part(capsule(add(c, pt(-15, 1)), tailTip, 1.6, 1.3), pal.cat);
    p.part(ellipse(c.x, c.y, 12 * breathe, 6 * breathe), pal.cat);
    p.part(ellipse(c.x + 8, c.y - 0.5, 5.6, 4.6), pal.cat);
    for (const ex of [5.2, 10.4]) p.part(poly([pt(c.x + ex - 1.8, c.y - 4), pt(c.x + ex, c.y - 8.4), pt(c.x + ex + 1.8, c.y - 4)]), pal.cat, { inkScale: 0.7 });
    p.line(curve([pt(c.x + 6, c.y - 0.6), pt(c.x + 7, c.y + 0.2), pt(c.x + 8, c.y - 0.6)]), "#3a2020", 0.5);
    p.line(curve([pt(c.x + 9, c.y - 0.6), pt(c.x + 10, c.y + 0.2), pt(c.x + 11, c.y - 0.6)]), "#3a2020", 0.5);
    for (let i = 0; i < 3; i++) p.line(curve([pt(c.x - 6 + i * 4, c.y - 5.6), pt(c.x - 5 + i * 4, c.y - 2)]), pal.catDark, 1, 0.6);
  }

  private sitter(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { beat, wall } = frame;
    const playing = !muted;
    // A lazy nod, a touch behind the beat, the way lo-fi is felt.
    const lag = (beat - 0.12) % 1;
    const nod = playing ? Math.exp(-lag * 3.2) : 0;
    const ctx = p.ctx;
    ctx.save();
    ctx.translate(-30, -SEATED_FLOOR);
    // A stool.
    p.part(capsule(pt(-8, 5), pt(-10, SEATED_FLOOR), 1.1, 1.1), "#2a2430", { rim: false });
    p.part(capsule(pt(8, 5), pt(10, SEATED_FLOOR), 1.1, 1.1), "#2a2430", { rim: false });
    p.part(roundRect(-12, 1, 24, 4, 2), "#4a3a3a");
    fig.set({
      lean: 0.08 + sway(beat, 0.015, 0.3),
      face: 0.72,
      head: { tilt: 0.05 + Math.sin(beat * Math.PI * 0.25) * 0.04, nod: 0.25 + nod * 0.45, eyes: blinking(wall, 0.9) ? "closed" : nod > 0.7 ? "half" : "half", mouth: 0 },
      arms: {
        right: { hand: pt(31, -26), elbow: "down", grip: "hold", angle: -0.2 },
        left: { hand: pt(38, -22 + (playing && this.kick ? -pulse(this.kick, frame.t, 0.1) * 2 : 0)), elbow: "down", grip: "relaxed" },
      },
      legs: seatedLegs(0.72),
      breath: (Math.sin(wall * 1.2) + 1) / 2,
    });
    fig.arm("left");
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("right");
    ctx.restore();
  }

  private tableTop(p: Painter, frame: FrameInfo, pal: Palette, muted: boolean) {
    const { ctx } = p;
    // A round café table.
    p.part(capsule(pt(TABLE.x, TABLE.top), pt(TABLE.x, -2), 1.4, 1.4), pal.table, { rim: false });
    p.part(ellipse(TABLE.x, -1, 8, 1.8), pal.table, { rim: false });
    p.part(ellipse(TABLE.x, TABLE.top, 20, 3.4), mix(pal.table, "#ffffff", 0.12));
    // The walkman, its little window showing the reels turning.
    const wm = pt(TABLE.x + 2, TABLE.top - 4.6);
    p.part(roundRect(wm.x - 6, wm.y - 3.4, 12, 7, 1.2), "#3a7a9a");
    p.part(roundRect(wm.x - 4, wm.y - 2, 8, 3.6, 0.8), "#1a1a22", { rim: false });
    const spin = muted ? 0 : frame.t * 6;
    for (const dx of [-2, 2]) {
      const c = pt(wm.x + dx, wm.y - 0.2);
      p.part(ellipse(c.x, c.y, 1.3, 1.3), "#e8e2d4", { rim: false, inkScale: 0.5 });
      p.line(poly([pt(c.x + Math.cos(spin) * 1.1, c.y + Math.sin(spin) * 1.1), pt(c.x - Math.cos(spin) * 1.1, c.y - Math.sin(spin) * 1.1)]), "#3a3a44", 0.35);
    }
    // Its cable curls up to the headphones.
    p.line(curve([pt(wm.x - 6, wm.y), pt(wm.x - 12, wm.y + 7), pt(-30, -50), pt(-26, -88)]), "#1a1a22", 0.5, 0.9);
    // A cup still steaming, in the sitter's hand.
    const cup = pt(TABLE.x - 12, TABLE.top - 4);
    p.part(roundRect(cup.x - 3.4, cup.y - 4, 6.8, 7.6, 1.4), "#f2ece0");
    p.line(ellipse(cup.x + 4.2, cup.y - 0.6, 1.6, 2), "#f2ece0", 0.9);
    for (let i = 0; i < 3; i++) {
      const rise = ((frame.wall * 0.35 + i / 3) % 1);
      const y = cup.y - 5 - rise * 14;
      const sway2 = Math.sin(frame.wall * 1.4 + i * 2) * 1.6 * rise;
      p.line(curve([pt(cup.x - 1 + i, y + 3), pt(cup.x + sway2, y), pt(cup.x - sway2 * 0.6 + i * 0.5, y - 3)]), "#ffffff", 0.7, (1 - rise) * 0.55);
    }
    // The desk lamp, bent over the table, and its warm pool of light.
    const base = pt(TABLE.x + 14, TABLE.top - 1.2);
    const elbow = pt(base.x + 2, base.y - 16);
    const head = pt(base.x - 6, base.y - 24);
    p.part(ellipse(base.x, base.y, 4, 1.2), "#2a2a34");
    p.line(curve([base, elbow]), "#2a2a34", 1);
    p.line(curve([elbow, head]), "#2a2a34", 1);
    p.part(poly([pt(head.x - 2, head.y - 2), pt(head.x + 3, head.y - 1), pt(head.x + 0.5, head.y + 5), pt(head.x - 6, head.y + 4)]), "#d8a838");
    ctx.save();
    ctx.globalCompositeOperation = frame.theme === "dark" ? "screen" : "soft-light";
    const g = ctx.createRadialGradient(head.x - 2, head.y + 6, 0, head.x - 2, head.y + 6, 40);
    g.addColorStop(0, "rgba(255, 210, 130, 0.55)");
    g.addColorStop(1, "rgba(255, 210, 130, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(head.x - 42, head.y - 34, 84, 80);
    ctx.restore();
  }

  /** The striped awning over the sitter, scalloped, with drips falling from its edge. */
  private awning(p: Painter, frame: FrameInfo, pal: Palette) {
    const { ctx } = p;
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      const u0 = i / stripes;
      const u1 = (i + 1) / stripes;
      const x0 = AWNING.x0 + (AWNING.x1 - AWNING.x0) * u0;
      const x1 = AWNING.x0 + (AWNING.x1 - AWNING.x0) * u1;
      const y = (u: number) => AWNING.y0 + (AWNING.y1 - AWNING.y0) * u;
      ctx.fillStyle = i % 2 ? pal.awningB : pal.awningA;
      ctx.fill(poly([pt(x0, y(u0) - 6), pt(x1, y(u1) - 6), pt(x1, y(u1) + 4), pt(x0, y(u0) + 4)]));
      ctx.beginPath();
      ctx.moveTo(x0, y(u0) + 4);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y(u0) + y(u1)) / 2 + 9, x1, y(u1) + 4);
      ctx.fill();
    }
    p.line(poly([pt(AWNING.x1, AWNING.y1 + 4), pt(AWNING.x1, 0)]), "#2a2430", 1.1);
    const r = seededRandom(3);
    ctx.fillStyle = "rgba(220, 230, 255, 0.7)";
    for (let i = 0; i < 4; i++) {
      const x = AWNING.x0 + 20 + r() * (AWNING.x1 - AWNING.x0 - 20);
      const t = (frame.wall * (0.6 + r() * 0.4) + r()) % 1;
      const y0 = AWNING.y0 + ((x - AWNING.x0) / (AWNING.x1 - AWNING.x0)) * (AWNING.y1 - AWNING.y0) + 10;
      ctx.beginPath();
      ctx.ellipse(x, y0 + t * t * 90, 0.5, 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  regions(): Region[] {
    return [this.region(this.ids, "the listener (the whole tune)", -60, -100, 50, 6)];
  }
}
