import { Lane, pulse, strike, type Performance, type TrackCues } from "@/lib/music/perform/cues";
import { kitPiece, splitKit } from "@/lib/music/perform/hands";
import { barMap, djPlan, type BarInfo, type DjMove } from "@/lib/music/perform/plans";
import { mix } from "@/lib/kit/color";
import { Figure, type Look, type Pose } from "../figure";
import { Lens, v3, type V3 } from "../lens";
import { castLook } from "../looks";
import { add, ease, ellipse, hash, lerp, poly, pt, roundRect, seededRandom, type Light, type Painter, type Pt } from "../paint";
import { blinking } from "../players";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * House: a DJ at the decks, seen from the dance floor. Two turntables and a
 * mixer on the booth, the DJ behind them, an LED wall behind the DJ and the
 * crowd's heads and hands in front. The DJ's set follows the arrangement's
 * own shape (see djPlan): headphones to one ear while the intro cues, both
 * hands on the filter for the build, a hand in the air when the tune drops,
 * then faders, EQ and fist pumps, and the fader coming down at the end.
 * Every beat nods the head; every kick lights the strip on the booth.
 *
 * Night (dark) is a club with lasers in the haze; day (light) is an open-air
 * festival stage under a blue sky.
 *
 * Koplo's DJ also has a pad controller: the kendang parts are finger-drummed
 * on it, one pad per stroke, by the left hand while the right works the set.
 */

/** Pads on the controller: the deep dhut, the open and damped strokes, the jingles. */
const PAD_FOR: Record<string, number> = { dhut: 0, congaLow: 1, congaOpen: 2, congaMute: 3, bongoHigh: 4, bongoLow: 5, tambourine: 6, splash: 7 };

const TABLE = 100;
const DJ_Z = 92;
const DECK_X = 64;
/** One model unit of a figure is this many centimetres. */
const CM_PER_UNIT = 1.5;

type Palette = {
  skyTop: string;
  skyLow: string;
  wallOff: string;
  booth: string;
  boothLit: string;
  deck: string;
  deckTop: string;
  vinyl: string;
  strip: string;
  crowd: string;
  crowdRim: string;
  truss: string;
};

const PALETTES: Record<Theme, Palette> = {
  dark: {
    skyTop: "#05040a",
    skyLow: "#120a24",
    wallOff: "#141020",
    booth: "#0f0d16",
    boothLit: "#2a2440",
    deck: "#1c1a24",
    deckTop: "#2c2a36",
    vinyl: "#0b0a0e",
    strip: "#3ddcf5",
    crowd: "#07060b",
    crowdRim: "#d33cff",
    truss: "#2a2833",
  },
  light: {
    skyTop: "#3d8fe0",
    skyLow: "#bfe3ff",
    wallOff: "#2a2a38",
    booth: "#24232e",
    boothLit: "#4a4860",
    deck: "#2a2832",
    deckTop: "#3a3844",
    vinyl: "#111015",
    strip: "#3ddcf5",
    crowd: "#3a2f52",
    crowdRim: "#fff4d6",
    truss: "#9a98a6",
  },
};

const LED_COLS = 30;
const LED_ROWS = 11;

export class DjBooth extends Scene {
  readonly caption = "The DJ: cueing in the intro, a hand up on the drop, the filter on every fill.";
  private lens = new Lens(v3(0, 232, -290), v3(0, 126, 60), 620);
  private bars: BarInfo[];
  private moves: DjMove[];
  private kick?: Lane;
  /** Koplo only: every kendang stroke, for the pad controller. */
  private pads?: Lane;
  private pitched: TrackCues[];
  private ids: string[];
  private look: Look;
  private fig?: Figure;

  constructor(perf: Performance) {
    super(perf);
    this.bars = barMap(perf);
    this.moves = djPlan(this.bars);
    const drums = perf.tracks.find((c) => c.track.patch.drums);
    if (drums) this.kick = splitKit(drums.lane).rightFoot;
    const kendang = perf.tracks.filter((c) => /kendang/i.test(c.track.name));
    if (kendang.length) this.pads = new Lane(kendang.flatMap((c) => c.lane.hits));
    this.pitched = perf.tracks.filter((c) => !c.track.patch.drums);
    this.ids = perf.tracks.map((c) => c.track.id);
    const seed = hash(`${perf.arrangement.songId}/dj`);
    // House gets a hoodie under a cool wall; koplo a batik shirt under a warm one.
    this.look = this.pads
      ? castLook(seed, { outfits: ["shirt"], tops: ["#7a1f2b"], trims: ["#f2c14e"], bottoms: ["#1a1a24"], shoes: ["#1a1a24"], hair: ["short", "crop"], skins: ["#e0a97f", "#c98d63", "#b47b52"] }, { headphones: "#2a2a34", pattern: "batik" })
      : castLook(seed, { outfits: ["hoodie"], tops: ["#2a2a3a"], trims: ["#3ddcf5"], bottoms: ["#1a1a24"], shoes: ["#f4f1ea"], hair: ["short", "curly", "bun", "crop"] }, { headphones: "#e8e6f0", outfit: "hoodie" });
  }

  private p3 = (x: number, y: number, z: number) => this.lens.project(v3(x, y, z));
  private quad = (pts: V3[]) => poly(pts.map((q) => this.lens.project(q)));

  protected world(): World {
    const a = this.p3(-140, TABLE, 0);
    const b = this.p3(140, TABLE, 0);
    const top = this.p3(0, 246, DJ_Z);
    const bottom = this.p3(0, 50, 0);
    return { x0: a.x, x1: b.x, y0: top.y, y1: bottom.y };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: 0.2, y: -0.98 }, shadow: "#120a26", shadeAmount: 0.5, shadeDepth: 3.4, rim: { color: "#7ff0ff", width: 1, alpha: 0.95 }, ink: 0.85, inkTone: "#0d0820" }
      : { dir: { x: -0.6, y: -0.8 }, shadow: "#3a4a7a", shadeAmount: 0.24, shadeDepth: 3, rim: { color: "#fffbe8", width: 0.8, alpha: 0.6 }, ink: 0.8, inkTone: "#2a2a44" };
  }

  // ---------- Backdrop: sky or club, truss, the LED wall's frame ----------

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    const sky = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    if (theme === "light") {
      // Afternoon sun and a few slow clouds over the festival field.
      const sun = this.p3(-260, 330, 600);
      const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 90);
      glow.addColorStop(0, "rgba(255, 252, 230, 1)");
      glow.addColorStop(0.15, "rgba(255, 244, 200, 0.9)");
      glow.addColorStop(1, "rgba(255, 244, 200, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 90, sun.y - 90, 180, 180);
      const r = seededRandom(5);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 5; i++) {
        const c = { x: v.x0 + r() * (v.x1 - v.x0), y: v.y0 + 6 + r() * 26 };
        for (let k = 0; k < 4; k++) ctx.fill(ellipse(c.x + k * 7 - 10, c.y + (k % 2) * 2, 9 - Math.abs(k - 1.5) * 2, 5));
      }
    }
    // The stage truss framing the wall.
    const w0 = this.p3(-210, 100, 190);
    const w1 = this.p3(210, 268, 190);
    ctx.fillStyle = pal.truss;
    for (const x of [w0.x - 6, w1.x + 1]) ctx.fillRect(x, w1.y - 6, 5, v.y1 - w1.y);
    ctx.fillRect(w0.x - 6, w1.y - 7, w1.x - w0.x + 12, 5);
    ctx.strokeStyle = mix(pal.truss, "#ffffff", 0.25);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = w0.x - 6; x < w1.x + 6; x += 5) {
      ctx.moveTo(x, w1.y - 7);
      ctx.lineTo(x + 5, w1.y - 2);
    }
    ctx.stroke();
    // The LED wall's dark face; its lights are drawn every frame.
    ctx.fillStyle = pal.wallOff;
    ctx.fillRect(w0.x, w1.y, w1.x - w0.x, w0.y - w1.y);
  }

  // ---------- Each frame ----------

  protected paintScene(p: Painter, frame: FrameInfo) {
    const pal = PALETTES[frame.theme];
    const muted = this.ids.every((id) => frame.muted.has(id));
    this.ledWall(p.ctx, frame, muted);
    if (frame.theme === "dark") this.lasers(p.ctx, frame, muted);
    this.dj(p, frame, pal, muted);
    this.crowd(p, frame, pal, muted);
  }

  private bar(beat: number) {
    const index = this.perf.bar(beat).index;
    return { info: this.bars[index], move: this.moves[index], prev: this.moves[Math.max(0, index - 1)] };
  }

  /** The LED wall: an equaliser of the notes sounding now, low notes on the left, a flash on every kick. */
  private ledWall(ctx: CanvasRenderingContext2D, frame: FrameInfo, muted: boolean) {
    const w0 = this.p3(-210, 100, 190);
    const w1 = this.p3(210, 268, 190);
    const cw = (w1.x - w0.x) / LED_COLS;
    const ch = (w0.y - w1.y) / LED_ROWS;
    const level = new Float32Array(LED_COLS);
    if (!muted) {
      for (const cues of this.pitched) {
        if (frame.muted.has(cues.track.id)) continue;
        for (const hit of cues.lane.sounding(frame.t)) {
          const col = Math.max(0, Math.min(LED_COLS - 1, Math.round(((hit.pitch - 28) / 68) * (LED_COLS - 1))));
          const fresh = Math.exp(-(frame.t - hit.t) / 0.6);
          for (let d = -2; d <= 2; d++) {
            const c = col + d;
            if (c >= 0 && c < LED_COLS) level[c] += (hit.vel / 127) * (0.45 + 0.55 * fresh) * (1 - Math.abs(d) * 0.3);
          }
        }
      }
    }
    const kick = this.kick && !muted && !frame.reduced ? pulse(this.kick, frame.t, 0.18) : 0;
    const dim = frame.theme === "dark" ? 1 : 0.8;
    for (let c = 0; c < LED_COLS; c++) {
      const lit = Math.min(LED_ROWS, Math.round(level[c] * 4.2));
      for (let r = 0; r < LED_ROWS; r++) {
        const on = r < lit;
        const hue = this.pads ? 330 + (c / LED_COLS) * 70 : 190 + (c / LED_COLS) * 110;
        const x = w0.x + c * cw + cw * 0.12;
        const y = w0.y - (r + 1) * ch + ch * 0.12;
        ctx.globalAlpha = (on ? 0.95 : 0.1 + kick * 0.35) * dim;
        ctx.fillStyle = `hsl(${hue} 95% ${on ? 62 : 40}%)`;
        ctx.fill(roundRect(x, y, cw * 0.76, ch * 0.76, cw * 0.18));
      }
    }
    ctx.globalAlpha = 1;
  }

  private lasers(ctx: CanvasRenderingContext2D, frame: FrameInfo, muted: boolean) {
    const v = this.camera.view;
    const kick = this.kick && !muted && !frame.reduced ? pulse(this.kick, frame.t, 0.2) : 0;
    const sweep = frame.reduced ? 0 : Math.sin(frame.beat * Math.PI * 0.125) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const side of [-1, 1]) {
      const from = { x: side < 0 ? v.x0 + 4 : v.x1 - 4, y: v.y0 + 4 };
      for (let i = 0; i < 6; i++) {
        // Fanned down towards the middle of the floor, sweeping with the phrase.
        const off = 0.3 + i * 0.13 + sweep * side;
        const to = { x: from.x - side * Math.sin(off) * 400, y: from.y + Math.cos(off) * 400 };
        ctx.strokeStyle = side < 0 ? "#3dffa8" : "#3ddcf5";
        ctx.globalAlpha = muted ? 0.08 : 0.16 + kick * 0.4;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- The DJ, the decks and the booth ----------

  private dj(p: Painter, frame: FrameInfo, pal: Palette, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const pelvisW = this.p3(0, 98, DJ_Z);
    const s = CM_PER_UNIT * pelvisW.k;
    const toModel = (q: Pt) => pt((q.x - pelvisW.x) / s, (q.y - pelvisW.y) / s);
    const { beat, t, wall } = frame;
    const pos = this.perf.bar(beat);
    const { info, move, prev } = this.bar(beat);
    const playing = !muted && frame.playing !== false;
    // A nod lands on every beat and eases back up; the knees give a little with it.
    const hit = playing ? Math.exp(-pos.frac * 5) : 0;
    const blend = ease((pos.into - 0) / 0.4);

    const spin = t * 3.49;
    const targets = (m: DjMove) => this.handsFor(m, pos.into, info?.len ?? 4, spin, toModel, fig, playing);
    const now = targets(move ?? "jog");
    const before = targets(prev ?? move ?? "jog");
    const hands = { left: lerp(before.left, now.left, blend), right: lerp(before.right, now.right, blend) };
    // On a koplo set the left hand lives on the pads through the tune, a stroke for every kendang hit.
    if (this.pads && playing && info?.section === "main") {
      const s = strike(this.pads, t, { rebound: 0.06, prep: 0.08, fullGap: 0.3, rest: 0.4 });
      const at = this.padAt(this.padIndex(s.next ?? s.prev));
      hands.left = add(toModel(at), pt(0, -s.lift * 6));
    }

    const pose: Pose = {
      lean: 0.08 + Math.sin(beat * Math.PI * 0.5) * (playing ? 0.025 : 0),
      face: Math.sin(beat * Math.PI * 0.25) * (playing ? 0.18 : 0.05),
      pelvis: pt(0, hit * 1.6),
      head: {
        tilt: Math.sin(beat * Math.PI * 0.5) * (playing ? 0.06 : 0),
        nod: playing ? 0.3 + hit * 1.1 : 0.2,
        eyes: blinking(wall, 0.4) ? "closed" : move === "raise" ? "up" : "open",
        mouth: move === "raise" ? 0.6 : 0,
        brows: move === "raise" ? 0.8 : 0,
      },
      arms: {
        right: { hand: hands.right, elbow: move === "raise" ? "out" : "down", grip: move === "pump" || move === "raise" ? "fist" : "flat", depth: 0.3 },
        left: { hand: hands.left, elbow: "down", grip: "flat", depth: 0.3 },
      },
      legs: { left: { foot: pt(9, 37) }, right: { foot: pt(-9, 37) } },
      breath: (Math.sin(wall * 1.6) + 1) / 2,
    };
    // The DJ stands behind the booth: draw the body, then the table and gear, then the arms reaching over them.
    p.ctx.save();
    p.ctx.translate(pelvisW.x, pelvisW.y);
    p.ctx.scale(s, s);
    fig.set(pose);
    fig.torso();
    fig.head();
    p.ctx.restore();

    this.tableAndGear(p, frame, pal, spin, muted);
    if (this.pads) this.padController(p, frame, muted);

    p.ctx.save();
    p.ctx.translate(pelvisW.x, pelvisW.y);
    p.ctx.scale(s, s);
    fig.arm("left");
    fig.arm("right");
    p.ctx.restore();

    this.boothFront(p, frame, pal, muted);
  }

  /** Where the hands go for each move, in the DJ's model space. */
  private handsFor(move: DjMove, into: number, len: number, spin: number, toModel: (q: Pt) => Pt, fig: Figure, playing: boolean) {
    const deckA = (a: number) => this.p3(-DECK_X + Math.cos(a) * 12, TABLE + 4, 30 + Math.sin(a) * 12);
    const deckB = (a: number) => this.p3(DECK_X + Math.cos(a) * 12, TABLE + 4, 30 + Math.sin(a) * 12);
    const mixer = (x: number, z: number) => this.p3(x, TABLE + 6, z);
    const wobble = playing ? Math.sin(into * Math.PI * 2) : 0;
    const u = into / Math.max(1, len);
    const sk = fig.sk;
    const ear = sk ? pt(sk.head.x - 11, sk.head.y + 2) : pt(-12, -64);
    switch (move) {
      case "cue":
        return { right: ear, left: toModel(deckB(Math.PI * 1.25 + wobble * 0.15)) };
      case "jog":
        return { right: toModel(deckA(Math.PI * 1.6 + (playing ? Math.sin(into * Math.PI) * 0.4 : 0))), left: toModel(mixer(5, 48 + wobble * 2)) };
      case "faders":
        return { right: toModel(mixer(-5, 44 + Math.sin(into * Math.PI * 0.5) * 6)), left: toModel(mixer(5, 50 - Math.sin(into * Math.PI * 0.5) * 6)) };
      case "knobs":
        return { right: toModel(mixer(-8 + wobble * 0.6, 22)), left: toModel(deckB(Math.PI * 1.4)) };
      case "filter":
        return { right: toModel(mixer(-2, 18 + u * 2)), left: toModel(mixer(3, 19 + u * 2)) };
      case "raise":
        return { right: pt(-26, -110 + Math.sin(into * Math.PI) * 3), left: toModel(mixer(0, 58)) };
      case "pump": {
        const beatPhase = into % 1;
        return { right: pt(-22, -70 - Math.exp(-beatPhase * 5) * 14 + 8), left: toModel(mixer(4, 46)) };
      }
      case "fadeOut":
        return { right: toModel(mixer(-5, 40 + u * 14)), left: toModel(mixer(10, 26)) };
    }
  }

  private tableAndGear(p: Painter, frame: FrameInfo, pal: Palette, spin: number, muted: boolean) {
    const { ctx } = p;
    // Table top.
    ctx.fillStyle = pal.boothLit;
    ctx.fill(this.quad([v3(-120, TABLE, 0), v3(120, TABLE, 0), v3(120, TABLE, 70), v3(-120, TABLE, 70)]));
    // Two turntables.
    for (const side of [-1, 1]) {
      const cx = side * DECK_X;
      const base = [v3(cx - 24, TABLE, 10), v3(cx + 24, TABLE, 10), v3(cx + 24, TABLE, 52), v3(cx - 24, TABLE, 52)];
      ctx.fillStyle = pal.deck;
      ctx.fill(this.quad(base.map((q) => v3(q.x, q.y, q.z)).concat([])));
      ctx.fill(this.quad([v3(cx - 24, TABLE + 4, 10), v3(cx + 24, TABLE + 4, 10), v3(cx + 24, TABLE, 10), v3(cx - 24, TABLE, 10)]));
      ctx.fillStyle = pal.deckTop;
      ctx.fill(this.quad(base.map((q) => v3(q.x, TABLE + 4, q.z))));
      // The record: grooves, a coloured label and a mark that shows it turning.
      const ring = (r: number) => {
        const pts: Pt[] = [];
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          pts.push(this.p3(cx + Math.cos(a) * r, TABLE + 5, 30 + Math.sin(a) * r));
        }
        return poly(pts);
      };
      ctx.fillStyle = pal.vinyl;
      ctx.fill(ring(15));
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.3;
      for (let r = 6; r < 15; r += 1.6) ctx.stroke(ring(r));
      ctx.fillStyle = side < 0 ? "#ff5aa5" : "#3ddcf5";
      ctx.fill(ring(5));
      const turn = muted ? 0 : spin * (side < 0 ? 1 : 1.01);
      const mark = this.p3(cx + Math.cos(turn) * 4, TABLE + 5.2, 30 + Math.sin(turn) * 4);
      ctx.fillStyle = "#ffffff";
      ctx.fill(ellipse(mark.x, mark.y, 0.9 * mark.k, 0.5 * mark.k));
      // Tonearm resting in the groove.
      const pivot = this.p3(cx + 19, TABLE + 7, 16);
      const stylus = this.p3(cx + 8, TABLE + 6, 40);
      ctx.strokeStyle = "#c9c6d4";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(stylus.x, stylus.y);
      ctx.stroke();
    }
    // The mixer: EQ knobs, channel faders, crossfader and level meters.
    ctx.fillStyle = pal.deck;
    ctx.fill(this.quad([v3(-17, TABLE + 5, 12), v3(17, TABLE + 5, 12), v3(17, TABLE + 5, 62), v3(-17, TABLE + 5, 62)]));
    ctx.fill(this.quad([v3(-17, TABLE + 5, 12), v3(17, TABLE + 5, 12), v3(17, TABLE, 12), v3(-17, TABLE, 12)]));
    for (const x of [-9, -3, 3, 9]) {
      for (let row = 0; row < 3; row++) {
        const k = this.p3(x, TABLE + 6, 18 + row * 6);
        ctx.fillStyle = "#3a3846";
        ctx.fill(ellipse(k.x, k.y, 1.6 * k.k, 1 * k.k));
        ctx.fillStyle = "#e8e6f0";
        ctx.fill(ellipse(k.x, k.y - 0.2 * k.k, 0.3 * k.k, 0.3 * k.k));
      }
    }
    const kick = this.kick && !muted ? pulse(this.kick, frame.t, 0.2) : 0;
    for (const x of [-12.5, 12.5]) {
      for (let i = 0; i < 8; i++) {
        const on = !muted && i < 3 + kick * 5;
        const k = this.p3(x, TABLE + 6, 50 - i * 3.6);
        ctx.fillStyle = on ? (i > 6 ? "#ff5a5a" : i > 4 ? "#ffd23d" : "#5cff9d") : "#1a1a22";
        ctx.fillRect(k.x - 0.7 * k.k, k.y - 0.5 * k.k, 1.4 * k.k, 1 * k.k);
      }
    }
    for (const x of [-5, 5]) {
      const a = this.p3(x, TABLE + 6, 40);
      const b = this.p3(x, TABLE + 6, 54);
      ctx.strokeStyle = "#08080c";
      ctx.lineWidth = 0.5 * a.k;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const cf0 = this.p3(-7, TABLE + 6, 59);
    const cf1 = this.p3(7, TABLE + 6, 59);
    ctx.beginPath();
    ctx.moveTo(cf0.x, cf0.y);
    ctx.lineTo(cf1.x, cf1.y);
    ctx.stroke();
  }

  private padIndex(hit: { pitch: number } | undefined) {
    if (!hit) return 0;
    const piece = kitPiece(hit.pitch);
    return piece ? (PAD_FOR[piece] ?? 7) : PAD_FOR.dhut;
  }

  /** Centre of pad i on the controller, which sits right of the crossfader, nearest the DJ. */
  private padAt(i: number) {
    return this.p3(25 + (i % 4) * 5, TABLE + 3, 56 + Math.floor(i / 4) * 6);
  }

  private padController(p: Painter, frame: FrameInfo, muted: boolean) {
    const { ctx } = p;
    ctx.fillStyle = "#1c1b24";
    ctx.fill(this.quad([v3(21, TABLE + 2, 52), v3(44, TABLE + 2, 52), v3(44, TABLE + 2, 66), v3(21, TABLE + 2, 66)]));
    const last = !muted && this.pads ? this.pads.around(frame.t).prev : undefined;
    const lit = last ? this.padIndex(last) : -1;
    const glow = last ? Math.exp(-(frame.t - last.t) / 0.18) : 0;
    for (let i = 0; i < 8; i++) {
      const c = this.padAt(i);
      ctx.fillStyle = i === lit ? `rgba(255, 122, 46, ${0.4 + glow * 0.6})` : "#3a3846";
      ctx.fill(roundRect(c.x - 2 * c.k, c.y - 1.6 * c.k, 4 * c.k, 3 * c.k, 0.6 * c.k));
    }
  }

  private boothFront(p: Painter, frame: FrameInfo, pal: Palette, muted: boolean) {
    const { ctx } = p;
    ctx.fillStyle = pal.booth;
    ctx.fill(this.quad([v3(-120, 0, 0), v3(120, 0, 0), v3(120, TABLE, 0), v3(-120, TABLE, 0)]));
    // Angled panels and an LED strip that flashes with the kick.
    ctx.strokeStyle = pal.boothLit;
    ctx.lineWidth = 0.6;
    for (let x = -120; x < 120; x += 30) {
      const a = this.p3(x, 0, 0);
      const b = this.p3(x + 30, TABLE - 8, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const kick = this.kick && !muted && !frame.reduced ? pulse(this.kick, frame.t, 0.22) : 0;
    const s0 = this.p3(-120, TABLE - 4, 0);
    const s1 = this.p3(120, TABLE - 4, 0);
    ctx.save();
    ctx.globalAlpha = 0.45 + kick * 0.55;
    ctx.strokeStyle = pal.strip;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();
    ctx.restore();
  }

  /** Heads and hands of the crowd, jumping on the beat. */
  private crowd(p: Painter, frame: FrameInfo, pal: Palette, muted: boolean) {
    const { ctx } = p;
    const v = this.camera.view;
    const r = seededRandom(31);
    const bottom = v.y1 + 4;
    const playing = !muted;
    for (let i = 0; i < 26; i++) {
      const x = v.x0 + (i + r() * 0.6) * ((v.x1 - v.x0) / 25);
      const lag = r() * 0.25;
      const jump = playing && !frame.reduced ? Math.max(0, Math.sin((frame.beat - lag) * Math.PI)) ** 2 * 4 : 0;
      const y = bottom - 10 - r() * 8 - jump;
      const tone = frame.theme === "dark" ? pal.crowd : ["#5a3a6a", "#2a5a7a", "#8a3a3a", "#3a6a4a", "#7a6a3a"][i % 5];
      ctx.fillStyle = tone;
      ctx.fill(ellipse(x, y, 7, 8));
      ctx.fill(ellipse(x, y + 16, 14, 10));
      if (r() < 0.35) {
        const hand = add(pt(x + (r() - 0.5) * 10, y - 18 - jump * 1.5), pt(0, 0));
        ctx.strokeStyle = tone;
        ctx.lineWidth = 3.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 8);
        ctx.lineTo(hand.x, hand.y);
        ctx.stroke();
        ctx.fill(ellipse(hand.x, hand.y - 1, 2.6, 3));
      }
      if (frame.theme === "dark") {
        ctx.strokeStyle = pal.crowdRim;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 7, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  regions(): Region[] {
    const a = this.p3(-90, TABLE, 0);
    const b = this.p3(90, 200, DJ_Z);
    return [this.region(this.ids, "the DJ (the whole set)", a.x, b.y, b.x, a.y)];
  }
}
