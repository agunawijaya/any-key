import type { Performance } from "@/lib/music/perform/cues";
import { handAt, planHand, type HandNow, type HandPlan } from "@/lib/music/perform/fingering";
import { splitKeys } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import { BLACK_LEN, BLACK_W, isBlack, KEYBOARD_W, KEYS, keyX, WHITE_LEN, WHITE_W } from "../instruments/keys88";
import { Lens, reach3, v3, vadd, vlerp, type V3 } from "../lens";
import { blob, capsule, clamp, ellipse, Painter, poly, type Light, type Pt } from "../paint";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * Solo piano, seen the way a pianist's own camera sees it: from high above
 * the bench, the whole keyboard running left (bass) to right (treble) under
 * the player's hands, the gold frame and the strings beyond. Each hand stays
 * put while the notes fall under its five fingers and shifts when they
 * don't; the finger on a note holds its key down for as long as it sounds.
 *
 * Everything is measured in centimetres on a grand with its lid off (as in a
 * recording session, so the strings show) and projected through a lens. The
 * case, frame and strings never move, so they are painted once into the
 * backdrop; only the pressed keys and the player are painted each frame.
 */

const KEYBED = 72.4;
const PRESS = 0.7;
const FINGER = WHITE_W;
const RIM_TOP = 99;
const PLATE_Y = 90;
const STRING_Y = 92;

type Palette = {
  floor: string;
  floorFar: string;
  boards: string;
  lacquer: string;
  lacquerLit: string;
  plate: string;
  plateLit: string;
  plateDark: string;
  soundboard: string;
  steel: string;
  copper: string;
  felt: string;
  ivory: string;
  ivoryShade: string;
  ebony: string;
  skin: string;
  hair: string;
  dress: string;
  dressLit: string;
  bench: string;
  benchTop: string;
  pages: string;
  pool: string;
};

const PALETTES: Record<Theme, Palette> = {
  dark: {
    floor: "#3a2a2c",
    floorFar: "#120d14",
    boards: "#0c080e",
    lacquer: "#0e0b12",
    lacquerLit: "#7d7488",
    plate: "#a87b33",
    plateLit: "#f6d88c",
    plateDark: "#6d4c1f",
    soundboard: "#9a6f3e",
    steel: "#f3ecdf",
    copper: "#d08a4a",
    felt: "#2c1f2b",
    ivory: "#f6efe2",
    ivoryShade: "#b4a794",
    ebony: "#16121b",
    skin: "#e2a982",
    hair: "#2b1a17",
    dress: "#1c5a4e",
    dressLit: "#5fd0b2",
    bench: "#140f15",
    benchTop: "#2a1c24",
    pages: "#f6efe2",
    pool: "rgba(255, 214, 160, 0.30)",
  },
  light: {
    floor: "#dcbd92",
    floorFar: "#c9a273",
    boards: "#8a6440",
    lacquer: "#17141c",
    lacquerLit: "#a29cae",
    plate: "#c39545",
    plateLit: "#f8dd9a",
    plateDark: "#8a6428",
    soundboard: "#c49660",
    steel: "#fbf7ef",
    copper: "#c27c3e",
    felt: "#3b2c38",
    ivory: "#fcf8ef",
    ivoryShade: "#cdc1ae",
    ebony: "#1c1922",
    skin: "#e2a982",
    hair: "#2b1a17",
    dress: "#1f6b5d",
    dressLit: "#7be0c5",
    bench: "#1e1820",
    benchTop: "#3a2a33",
    pages: "#fffaf0",
    pool: "rgba(255, 250, 235, 0.0)",
  },
};

/** The grand's outline from above (x across, z away from the player), in centimetres. */
const CASE_OUTLINE: [number, number][] = [
  [-74, -1],
  [74, -1],
  [74, 52],
  [67, 92],
  [48, 126],
  [26, 158],
  [4, 190],
  [-22, 210],
  [-52, 216],
  [-73, 205],
];

export class PianoCam extends Scene {
  readonly caption = "The soloist at the grand: each finger holds down the key you hear.";
  private lens = new Lens(v3(0, 640, -150), v3(0, 72, 0), 700);
  private right: HandPlan;
  private left: HandPlan;
  private trackId: string;

  constructor(perf: Performance) {
    super(perf);
    const cues = perf.tracks[0];
    this.trackId = cues.track.id;
    const hands = splitKeys(cues.lane, { melodyOnly: cues.track.role === "melody" });
    this.right = planHand(hands.right, keyX, FINGER);
    this.left = planHand(hands.left, keyX, FINGER, keyX(48));
  }

  protected world(): World {
    const a = this.lens.project(v3(-KEYBOARD_W / 2 - 16, KEYBED, 0));
    const b = this.lens.project(v3(KEYBOARD_W / 2 + 16, KEYBED, 0));
    const top = this.lens.project(v3(0, RIM_TOP, 58));
    const bottom = this.lens.project(v3(0, 56, -84));
    return { x0: a.x, x1: b.x, y0: top.y, y1: bottom.y };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: -0.3, y: -0.95 }, shadow: "#1a0d1c", shadeAmount: 0.5, shadeDepth: 2.2, rim: { color: "#ffd59a", width: 0.7, alpha: 0.9 }, ink: 0.55, inkTone: "#140a18" }
      : { dir: { x: -0.75, y: -0.66 }, shadow: "#4b4366", shadeAmount: 0.24, shadeDepth: 2, rim: { color: "#fffaf0", width: 0.55, alpha: 0.65 }, ink: 0.5, inkTone: "#2e2236" };
  }

  private p3 = (x: number, y: number, z: number) => this.lens.project(v3(x, y, z));
  private quad = (pts: V3[]) => poly(pts.map((q) => this.lens.project(q)));

  // ---------- Backdrop ----------

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const p = new Painter(ctx, this.light(theme));
    this.floor(ctx, pal, theme);
    this.caseShadow(ctx, theme);
    this.casework(ctx, pal);
    this.interior(ctx, pal);
    this.desk(ctx, pal);
    this.keyboard(p, pal, new Set());
    if (theme === "dark") this.vignette(ctx);
  }

  private floor(ctx: CanvasRenderingContext2D, pal: Palette, theme: Theme) {
    const v = this.camera.view;
    const g = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    g.addColorStop(0, pal.floorFar);
    g.addColorStop(1, pal.floor);
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // Boards run away from the player, butt joints staggered.
    ctx.save();
    ctx.strokeStyle = pal.boards;
    ctx.globalAlpha = theme === "dark" ? 0.5 : 0.18;
    ctx.lineWidth = 0.5;
    for (let x = -420; x <= 420; x += 12) {
      const a = this.p3(x, 0, -160);
      const b = this.p3(x, 0, 320);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      for (let z = -160 + ((x * 7) % 90 + 90) % 90; z < 320; z += 150) {
        const c = this.p3(x, 0, z);
        const d = this.p3(x + 12, 0, z);
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (theme === "dark") {
      // The spotlight's pool, warm, round the bench and the keys.
      const c = this.p3(0, 0, -20);
      const r = 150 * c.k;
      const pool = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      pool.addColorStop(0, pal.pool);
      pool.addColorStop(1, "rgba(255, 214, 160, 0)");
      ctx.fillStyle = pool;
      ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    } else {
      // Daylight from tall windows on the left falls across the boards.
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(255, 248, 228, 0.95)";
      for (let i = 0; i < 3; i++) {
        const z = -150 + i * 95;
        ctx.fill(this.quad([v3(-330, 0, z), v3(-210, 0, z + 18), v3(-120, 0, z + 78), v3(-240, 0, z + 60)]));
      }
      ctx.restore();
    }
  }

  private outline(y: number, inset = 0): Pt[] {
    return CASE_OUTLINE.map(([x, z]) => this.p3(x - Math.sign(x) * inset, y, z + (z < 10 ? inset : -inset * 0.8)));
  }

  private caseShadow(ctx: CanvasRenderingContext2D, theme: Theme) {
    ctx.save();
    ctx.globalAlpha = theme === "dark" ? 0.6 : 0.3;
    ctx.fillStyle = "#000000";
    ctx.filter = "blur(10px)";
    ctx.fill(blob(CASE_OUTLINE.map(([x, z]) => this.p3(x + 12, 0, z + 14)), 0.6));
    ctx.restore();
  }

  private casework(ctx: CanvasRenderingContext2D, pal: Palette) {
    const foot = this.outline(60);
    const top = this.outline(RIM_TOP);
    ctx.fillStyle = pal.lacquer;
    ctx.fill(blob(foot, 0.6));
    for (let i = 0; i < foot.length; i++) {
      const j = (i + 1) % foot.length;
      ctx.fill(poly([foot[i], foot[j], top[j], top[i]]));
    }
    ctx.fill(blob(top, 0.6));
    // Lacquer catches the light along the rim's top edge.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = pal.lacquerLit;
    ctx.lineWidth = 0.6;
    ctx.stroke(blob(top, 0.6));
    ctx.restore();
  }

  private interior(ctx: CanvasRenderingContext2D, pal: Palette) {
    const inner = blob(this.outline(RIM_TOP - 1, 4.5), 0.6);
    ctx.save();
    ctx.clip(inner);
    ctx.fillStyle = pal.soundboard;
    ctx.fill(inner);
    // Grain of the spruce soundboard, running diagonally.
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = mix(pal.soundboard, "#000000", 0.4);
    ctx.lineWidth = 0.3;
    for (let i = -20; i < 40; i++) {
      const a = this.p3(-80 + i * 6, 86, 30);
      const b = this.p3(-80 + i * 6 + 90, 86, 230);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // The cast-iron frame: a gold plate over the front, struts reaching back.
    const plateFront = [v3(-70, PLATE_Y, 18), v3(70, PLATE_Y, 18), v3(70, PLATE_Y, 62), v3(56, PLATE_Y, 66), v3(-70, PLATE_Y, 66)];
    const g = ctx.createLinearGradient(...xy(this.p3(-70, PLATE_Y, 20)), ...xy(this.p3(70, PLATE_Y, 60)));
    g.addColorStop(0, pal.plate);
    g.addColorStop(0.42, pal.plateLit);
    g.addColorStop(0.6, pal.plate);
    g.addColorStop(1, pal.plateDark);
    ctx.fillStyle = g;
    ctx.fill(this.quad(plateFront));
    for (const [x0, x1] of [
      [-70, -58],
      [-30, -22],
      [8, 15],
      [42, 48],
    ]) {
      ctx.fill(this.quad([v3(x0, PLATE_Y, 60), v3(x1, PLATE_Y, 60), v3(x1 * 0.4 - 30, PLATE_Y, 214), v3(x0 * 0.4 - 36, PLATE_Y, 214)]));
    }
    // Rim of the plate, all round the inside of the case.
    ctx.strokeStyle = g;
    ctx.lineWidth = 5 * this.p3(0, PLATE_Y, 60).k;
    ctx.stroke(blob(this.outline(PLATE_Y, 7), 0.6));
    // Round vents in the front bar of the frame.
    for (let i = 0; i < 6; i++) {
      const c = this.p3(-52 + i * 21, PLATE_Y, 50);
      ctx.fillStyle = pal.plateDark;
      ctx.fill(ellipse(c.x, c.y, 3.6 * c.k, 2.2 * c.k));
      ctx.fillStyle = mix(pal.soundboard, "#000000", 0.25);
      ctx.fill(ellipse(c.x, c.y + 0.25 * c.k, 3 * c.k, 1.7 * c.k));
    }
    // The pin field: a few hundred tuning pins near the keys.
    ctx.fillStyle = pal.steel;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 74; i++) {
        const c = this.p3(-66 + i * 1.8 + (row % 2) * 0.9, PLATE_Y + 0.8, 22 + row * 2.6);
        ctx.fillRect(c.x - 0.35 * c.k, c.y - 0.35 * c.k, 0.7 * c.k, 0.7 * c.k);
      }
    }
    // Strings: steel for the treble and middle, copper-wound bass crossing over them.
    ctx.lineWidth = 0.22 * this.p3(0, STRING_Y, 40).k;
    ctx.strokeStyle = pal.steel;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const x = -38 + u * 104;
      const back = 214 - Math.pow(u, 0.8) * 150;
      const a = this.p3(x, STRING_Y, 28);
      const b = this.p3(x - 10 - u * 8, STRING_Y, back);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.copper;
    ctx.lineWidth = 0.4 * this.p3(0, STRING_Y, 40).k;
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      const a = this.p3(-68 + u * 28, STRING_Y + 1.5, 28);
      const b = this.p3(-30 + u * 34, STRING_Y + 1.5, 214);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Dampers: a row of black felt wedges on the strings, behind the desk.
    ctx.fillStyle = pal.felt;
    for (let i = 0; i < 46; i++) {
      const x = -64 + i * 2.75;
      ctx.fill(this.quad([v3(x, STRING_Y + 2, 33), v3(x + 2.1, STRING_Y + 2, 33), v3(x + 2.1, STRING_Y + 2, 40), v3(x, STRING_Y + 2, 40)]));
    }
    ctx.restore();
    ctx.strokeStyle = mix(pal.lacquer, pal.lacquerLit, 0.4);
    ctx.lineWidth = 0.5;
    ctx.stroke(inner);
  }

  private desk(ctx: CanvasRenderingContext2D, pal: Palette) {
    // The music desk leans back on its rest; on it, two pages of music.
    const lean = 0.34;
    const at = (x: number, h: number) => v3(x, 92 + h, 21 + h * lean);
    ctx.fillStyle = pal.lacquer;
    ctx.fill(this.quad([at(-44, 0), at(44, 0), at(44, 29), at(-44, 29)]));
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = pal.lacquerLit;
    ctx.lineWidth = 0.4;
    ctx.stroke(this.quad([at(-44, 0), at(44, 0), at(44, 29), at(-44, 29)]));
    ctx.restore();
    for (const [x0, x1] of [
      [-31, -0.6],
      [0.6, 31],
    ]) {
      ctx.fillStyle = pal.pages;
      ctx.fill(this.quad([at(x0, 2.5), at(x1, 2.5), at(x1, 28), at(x0, 28)]));
      // Staves and a scatter of notes: music, but no words.
      ctx.strokeStyle = "#3a3340";
      ctx.lineWidth = 0.1;
      ctx.globalAlpha = 0.6;
      for (let s = 0; s < 6; s++) {
        for (let l = 0; l < 5; l++) {
          const h = 25.5 - s * 3.9 - l * 0.42;
          const a = this.lens.project(at(x0 + 1.6, h));
          const b = this.lens.project(at(x1 - 1.6, h));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.fillStyle = "#3a3340";
        for (let n = 0; n < 9; n++) {
          const c = this.lens.project(at(x0 + 3 + n * 3.1, 25.5 - s * 3.9 - ((n * 7 + s * 3) % 5) * 0.42));
          ctx.fill(ellipse(c.x, c.y, 0.32 * c.k, 0.22 * c.k));
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  private vignette(ctx: CanvasRenderingContext2D) {
    const v = this.camera.view;
    const c = this.p3(0, 80, -16);
    const r = Math.max(v.x1 - v.x0, v.y1 - v.y0) * 0.66;
    const g = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(6,3,9,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  // ---------- Keys ----------

  private keyTop(pitch: number, down: boolean): V3[] {
    const x = keyX(pitch);
    const black = isBlack(pitch);
    const w = (black ? BLACK_W : WHITE_W - 0.14) / 2;
    const lift = black ? 1.15 : 0;
    // A pressed key tips down at the front; its far end barely moves.
    const y = KEYBED + lift - (down ? PRESS : 0);
    const yFar = KEYBED + lift - (down ? PRESS * 0.15 : 0);
    const z0 = black ? WHITE_LEN - BLACK_LEN : 0;
    return [v3(x - w, y, z0), v3(x + w, y, z0), v3(x + w, yFar, WHITE_LEN), v3(x - w, yFar, WHITE_LEN)];
  }

  private keyboard(p: Painter, pal: Palette, down: Set<number>, only?: Set<number>) {
    const { ctx } = p;
    const half = KEYBOARD_W / 2;
    if (!only) {
      // Key bed, fallboard folded back behind the keys, cheek blocks at both ends.
      ctx.fillStyle = mix(pal.lacquer, "#000000", 0.4);
      ctx.fill(this.quad([v3(-half - 1, KEYBED - 1.6, WHITE_LEN), v3(half + 1, KEYBED - 1.6, WHITE_LEN), v3(half + 1, KEYBED - 1.6, -0.2), v3(-half - 1, KEYBED - 1.6, -0.2)]));
      ctx.fillStyle = pal.lacquer;
      ctx.fill(this.quad([v3(-half - 7, KEYBED + 1.4, WHITE_LEN), v3(half + 7, KEYBED + 1.4, WHITE_LEN), v3(half + 7, KEYBED + 7, WHITE_LEN + 5), v3(-half - 7, KEYBED + 7, WHITE_LEN + 5)]));
      ctx.fill(this.quad([v3(-half - 7, KEYBED + 7, WHITE_LEN + 5), v3(half + 7, KEYBED + 7, WHITE_LEN + 5), v3(half + 7, RIM_TOP - 4, 26), v3(-half - 7, RIM_TOP - 4, 26)]));
      ctx.save();
      ctx.strokeStyle = pal.lacquerLit;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.35;
      const e0 = this.p3(-half - 7, KEYBED + 7, WHITE_LEN + 5);
      const e1 = this.p3(half + 7, KEYBED + 7, WHITE_LEN + 5);
      ctx.beginPath();
      ctx.moveTo(e0.x, e0.y);
      ctx.lineTo(e1.x, e1.y);
      ctx.stroke();
      ctx.restore();
      for (const side of [-1, 1]) {
        const x = side * (half + 3.6);
        ctx.fillStyle = pal.lacquer;
        ctx.fill(this.quad([v3(x - 3.4, KEYBED + 4, -0.6), v3(x + 3.4, KEYBED + 4, -0.6), v3(x + 3.4, KEYBED + 4, WHITE_LEN + 5), v3(x - 3.4, KEYBED + 4, WHITE_LEN + 5)]));
        ctx.fillStyle = mix(pal.lacquer, pal.lacquerLit, 0.25);
        ctx.fill(this.quad([v3(x - 3.4, KEYBED + 4, -0.6), v3(x + 3.4, KEYBED + 4, -0.6), v3(x + 3.4, KEYBED - 3, -0.6), v3(x - 3.4, KEYBED - 3, -0.6)]));
      }
    }
    for (const k of KEYS) {
      if (isBlack(k) || (only && !only.has(k))) continue;
      const pressed = down.has(k);
      const x = keyX(k);
      const sink = pressed ? PRESS : 0;
      ctx.fillStyle = pal.ivoryShade;
      ctx.fill(this.quad([v3(x - WHITE_W / 2 + 0.07, KEYBED - sink, 0), v3(x + WHITE_W / 2 - 0.07, KEYBED - sink, 0), v3(x + WHITE_W / 2 - 0.07, KEYBED - 1.8, 0), v3(x - WHITE_W / 2 + 0.07, KEYBED - 1.8, 0)]));
      const top = this.quad(this.keyTop(k, pressed));
      ctx.fillStyle = pressed ? mix(pal.ivory, pal.ivoryShade, 0.55) : pal.ivory;
      ctx.fill(top);
      ctx.strokeStyle = "rgba(60, 48, 40, 0.45)";
      ctx.lineWidth = 0.08;
      ctx.stroke(top);
    }
    for (const k of KEYS) {
      if (!isBlack(k) || (only && !only.has(k) && !only.has(k - 1) && !only.has(k + 1))) continue;
      const pressed = down.has(k);
      const top = this.keyTop(k, pressed);
      const base = top.map((q) => v3(q.x, KEYBED - 0.2, q.z));
      ctx.fillStyle = mix(pal.ebony, "#000000", 0.35);
      ctx.fill(this.quad([base[0], base[1], top[1], top[0]]));
      const lit = this.quad(top);
      ctx.fillStyle = pressed ? mix(pal.ebony, "#000000", 0.45) : pal.ebony;
      ctx.fill(lit);
      ctx.save();
      ctx.strokeStyle = pal.lacquerLit;
      ctx.globalAlpha = pressed ? 0.12 : 0.45;
      ctx.lineWidth = 0.12;
      ctx.stroke(lit);
      ctx.restore();
    }
  }

  // ---------- The player ----------

  protected paintScene(p: Painter, frame: FrameInfo) {
    const pal = PALETTES[frame.theme];
    const muted = frame.muted.has(this.trackId);
    const shape = { rebound: 0.08, prep: 0.11, fullGap: 0.6, rest: 0.45 };
    const right = muted ? undefined : handAt(this.right, frame.t, shape);
    const left = muted ? undefined : handAt(this.left, frame.t, shape);
    const leftPlays = !!left && (left.down.length > 0 || (!!left.next && left.next.t - frame.t < 2.5));
    const rightPlays = !!right && (right.down.length > 0 || !!right.next);
    const down = new Set<number>([...(rightPlays ? right!.down : []), ...(leftPlays ? left!.down : [])].map((d) => d.pitch));
    if (down.size) this.keyboard(p, pal, down, down);

    // The body sways with the phrase and leans towards a hand that travels far.
    const rx = rightPlays ? right!.centre : 20;
    const lx = leftPlays ? left!.centre : -20;
    const lean = clamp(((rx + lx) / 2) / 160, -0.18, 0.18) + Math.sin(frame.wall * 0.8) * 0.01;
    const breath = (Math.sin(frame.wall * 1.5) + 1) / 2;
    const pelvis = v3(lean * 26, 56, -64);
    const chest = v3(lean * 64, 114 + breath * 0.5, -46);
    const shoulders = { left: vadd(chest, v3(-18.5, 0, -1)), right: vadd(chest, v3(18.5, 0, -1)) };
    const neck = vadd(chest, v3(0, 5, 2));
    const head = vadd(neck, v3(lean * 14, 14, 3));

    // A hand with nothing to play rests on the bench beside the hip.
    const restLeft = v3(-27, 52.5, -60);
    const restRight = v3(27, 52.5, -60);
    const rightWrist = rightPlays ? this.wrist(right!) : restRight;
    const leftWrist = leftPlays ? this.wrist(left!) : restLeft;
    const arm = (side: "left" | "right", wrist: V3) => reach3(shoulders[side], wrist, 29, 26, vadd(shoulders[side], v3(side === "left" ? -45 : 45, -35, -30)));
    const ra = arm("right", rightWrist);
    const la = arm("left", leftWrist);
    const skin = pal.skin;
    const proj = (q: V3) => this.lens.project(q);

    // Bench: a lacquered frame round a tufted top.
    p.part(this.quad([v3(-40, 50, -46), v3(40, 50, -46), v3(40, 50, -90), v3(-40, 50, -90)]), pal.bench, { shade: false });
    p.part(this.quad([v3(-37, 51, -48), v3(37, 51, -48), v3(37, 51, -88), v3(-37, 51, -88)]), pal.benchTop, { ink: false, rim: false });
    // The skirt over the thighs, knees forward under the keyboard.
    const lap = (x: number, z: number) => proj(vadd(pelvis, v3(x, 4 - Math.max(0, z - 30) * 0.06, z)));
    p.part(blob([lap(-21, -10), lap(-22, 18), lap(-19, 40), lap(-10, 46), lap(-2, 41), lap(2, 41), lap(10, 46), lap(19, 40), lap(22, 18), lap(21, -10)], 0.75), pal.dress);

    for (const [side, a, hand, plays] of [
      ["left", la, left, leftPlays],
      ["right", ra, right, rightPlays],
    ] as const) {
      const s = proj(shoulders[side]);
      const e = proj(a.mid);
      const w = proj(a.end);
      if (plays) this.hand(p, side, a.end, hand!, skin);
      p.part(capsule(e, w, 3.5 * e.k, 2.9 * w.k), skin);
      p.part(capsule(s, e, 4.6 * s.k, 3.7 * e.k), skin);
      if (!plays) this.restingHand(p, a.end, skin);
    }

    // The back from above: bare shoulders, the dress from the shoulder blades down.
    const at = (base: V3, x: number, y: number, z: number) => proj(vadd(base, v3(x, y, z)));
    const back = blob([proj(shoulders.left), at(neck, -6, 0, -2), at(neck, 6, 0, -2), proj(shoulders.right), at(chest, 16.5, -14, -7), at(pelvis, 14, 12, 2), at(pelvis, -14, 12, 2), at(chest, -16.5, -14, -7)], 0.8);
    p.part(back, skin);
    const dress = blob([at(chest, -16.6, -6, -5), at(chest, 0, -10, -7), at(chest, 16.6, -6, -5), at(chest, 17, -15, -8), at(pelvis, 15, 12, 2), at(pelvis, 0, 9, -6), at(pelvis, -15, 12, 2), at(chest, -17, -15, -8)], 0.8);
    p.part(dress, pal.dress);
    p.flat(blob([at(chest, -12, -11, -7), at(chest, 5, -10, -7), at(pelvis, -1, 13, -5), at(pelvis, -11, 12, -3)], 0.8), pal.dressLit, frame.theme === "dark" ? 0.22 : 0.16);
    for (const sx of [-9.5, 9.5]) p.line(poly([at(chest, sx, 1.2, 0.5), at(chest, sx * 1.04, -6.5, -5.5)]), mix(pal.dress, "#000000", 0.25), 1.2 * proj(chest).k);
    // Shoulder blades, a soft shadow each.
    for (const sx of [-8, 8]) {
      const c = at(chest, sx, -3, -4);
      p.flat(ellipse(c.x, c.y, 4 * c.k, 2.4 * c.k, sx < 0 ? 0.3 : -0.3), mix(skin, "#6a3b2a", 0.5), 0.18);
    }

    // Neck and head from behind, hair swept into a low bun with a gold pin.
    const hp = proj(head);
    const np = proj(neck);
    p.part(capsule(np, proj(vadd(head, v3(0, -8, -2))), 4.4 * np.k, 4.2 * hp.k), skin, { rim: false });
    const r = 10.6 * hp.k;
    for (const s of [-1, 1]) p.part(ellipse(hp.x + s * r * 0.96, hp.y + r * 0.12, r * 0.2, r * 0.3), skin);
    p.part(ellipse(hp.x, hp.y, r, r * 1.06), pal.hair);
    const bun = proj(vadd(head, v3(0, -3, -10)));
    p.part(ellipse(bun.x, bun.y, r * 0.52, r * 0.46), pal.hair);
    const strands = new Path2D();
    for (let i = -4; i <= 4; i++) {
      strands.moveTo(hp.x + i * r * 0.18, hp.y - r * 0.9);
      strands.quadraticCurveTo(hp.x + i * r * 0.16, hp.y - r * 0.1, bun.x + i * r * 0.07, bun.y - r * 0.3);
    }
    p.line(strands, mix(pal.hair, "#ffffff", 0.28), 0.18 * hp.k, frame.theme === "dark" ? 0.5 : 0.4);
    p.line(poly([{ x: bun.x - r * 0.5, y: bun.y - r * 0.12 }, { x: bun.x + r * 0.55, y: bun.y + r * 0.1 }]), "#e8c472", 0.7 * hp.k, 0.95);
  }

  /** Where the wrist sits for a hand: behind the knuckles, a little lower, lifted between notes. */
  private wrist(hand: HandNow): V3 {
    const black = hand.down.some((d) => isBlack(d.pitch));
    const lift = hand.lift * (hand.down.length ? 1.2 : 2.6);
    return v3(hand.centre, KEYBED + 4.6 + lift, (black ? 6.5 : 3) - 13);
  }

  private hand(p: Painter, side: "left" | "right", wrist: V3, hand: HandNow, skin: string) {
    const proj = (q: V3) => this.lens.project(q);
    const knuckle = vadd(wrist, v3(0, 1.2, 7.5));
    const palm = [vadd(wrist, v3(-3.4, 0, 0)), vadd(wrist, v3(3.4, 0, 0)), vadd(knuckle, v3(4.2, 0, 0)), vadd(knuckle, v3(-4.2, 0, 0))].map(proj);
    // Fingers first, so the back of the hand covers their roots. Pressed fingers sink into their key; the rest hover.
    for (let finger = 0; finger < 5; finger++) {
      const isThumb = (side === "right" && finger === 0) || (side === "left" && finger === 4);
      const press = hand.down.find((d) => d.finger === finger);
      const x = press ? press.x : hand.centre + (finger - 2) * FINGER;
      const black = press ? isBlack(press.pitch) : false;
      const hover = press ? 0 : 1.2 + hand.lift * 1.8;
      const tipY = KEYBED + (black ? 1.15 : 0) - (press ? PRESS : 0) + hover + 0.6;
      const tipZ = black ? WHITE_LEN - BLACK_LEN + 2.4 : isThumb ? 1.8 : 3.4;
      const base = vadd(knuckle, v3((finger - 2) * 1.75, 0, isThumb ? -4.5 : 0));
      const tip = v3(x, tipY, tipZ);
      const mid = vadd(vlerp(base, tip, 0.5), v3(0, 1.6, 0));
      const b = proj(base);
      const m = proj(mid);
      const t = proj(tip);
      p.part(capsule(b, m, 0.98 * b.k, 0.88 * m.k), skin, { inkScale: 0.75, rim: false });
      p.part(capsule(m, t, 0.88 * m.k, 0.78 * t.k), skin, { inkScale: 0.75 });
    }
    p.part(blob(palm, 0.75), skin);
  }

  private restingHand(p: Painter, wrist: V3, skin: string) {
    const proj = (q: V3) => this.lens.project(q);
    for (let f = 0; f < 4; f++) {
      const base = vadd(wrist, v3(-2.6 + f * 1.75, 0.6, 7));
      const tip = vadd(base, v3((f - 1.5) * 0.4, -0.6, 5.5));
      const b = proj(base);
      const t = proj(tip);
      p.part(capsule(b, t, 0.95 * b.k, 0.8 * t.k), skin, { inkScale: 0.75, rim: false });
    }
    p.part(blob([vadd(wrist, v3(-3.2, 0, 0)), vadd(wrist, v3(3.2, 0, 0)), vadd(wrist, v3(3.8, 0.6, 7.5)), vadd(wrist, v3(-3.8, 0.6, 7.5))].map(proj), 0.75), skin);
  }

  regions(): Region[] {
    const a = this.p3(-KEYBOARD_W / 2, KEYBED, -92);
    const b = this.p3(KEYBOARD_W / 2, KEYBED, 16);
    return [this.region([this.trackId], "the pianist", a.x, b.y, b.x, a.y)];
  }
}

const xy = (q: Pt): [number, number] => [q.x, q.y];
