import type { Lane, Performance } from "@/lib/music/perform/cues";
import { mix } from "@/lib/kit/color";
import { isBlackKey } from "@/lib/music/theory";
import { songById } from "@/lib/music/songs";
import { ellipse, poly, pt, roundRect, seededRandom, type Light, type Painter } from "../paint";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * PC Speaker ’81: the performer is the machine. A 1981 personal computer on
 * a desk (drawn plain, no maker's badge): the system unit with its two
 * full-height floppy drives and the big red switch on its side, a colour
 * monitor and the long keyboard. The monitor shows what the 1981 program
 * showed in its own way: a 40-column colour text screen, blue, with a red
 * frame round a keyboard and a marker on the key that is sounding.
 *
 * A cutaway in the front panel shows the 2¼-inch speaker. Its cone moves
 * with every note (slowed down so the eye can follow: the real cone moves a
 * few hundred times a second) and rings of sound leave the grille, closer
 * together for higher notes.
 */

/** The 1981 screen's keyboard: B3 to C6, 26 keys. */
const LOW = 59;
const HIGH = 84;

type Palette = { wall: string; wallLow: string; desk: string; deskEdge: string; beige: string; beigeLit: string; beigeDark: string; slot: string; window: string; glow: string };

const PALETTES: Record<Theme, Palette> = {
  dark: { wall: "#141a2c", wallLow: "#0c0f1a", desk: "#3a2a20", deskEdge: "#20160f", beige: "#b9ae94", beigeLit: "#d8cdb0", beigeDark: "#7a705c", slot: "#2a2620", window: "#1a2440", glow: "rgba(70, 90, 255, 0.22)" },
  light: { wall: "#e8dcc4", wallLow: "#d6c6a6", desk: "#8a6440", deskEdge: "#5a3f28", beige: "#d9cfb6", beigeLit: "#f1e8d0", beigeDark: "#a49a80", slot: "#3a352c", window: "#bfe0f6", glow: "rgba(70, 90, 255, 0.0)" },
};

const CGA = { blue: "#0000aa", red: "#aa0000", white: "#ffffff", grey: "#aaaaaa", yellow: "#ffff55", black: "#000000", cyan: "#55ffff" };

export class Pc5150 extends Scene {
  readonly caption = "The 1981 machine itself: the screen marks each key, the little speaker beeps it.";
  private lane: Lane;
  private trackId: string;
  private title: string;

  constructor(perf: Performance) {
    super(perf);
    const cues = perf.tracks[0];
    this.lane = cues.lane;
    this.trackId = cues.track.id;
    this.title = songById(perf.arrangement.songId).title.toUpperCase();
  }

  protected world(): World {
    return { x0: -95, x1: 95, y0: -62, y1: 26 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: 0.1, y: -0.99 }, shadow: "#0a0c1c", shadeAmount: 0.5, shadeDepth: 1.2, rim: { color: "#8a9cff", width: 0.4, alpha: 0.8 }, ink: 0.35, inkTone: "#0a0c1c" }
      : { dir: { x: -0.7, y: -0.7 }, shadow: "#5a5040", shadeAmount: 0.25, shadeDepth: 1.1, rim: { color: "#fffaf0", width: 0.35, alpha: 0.6 }, ink: 0.32, inkTone: "#3a3328" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    const wall = ctx.createLinearGradient(0, v.y0, 0, 0);
    wall.addColorStop(0, pal.wall);
    wall.addColorStop(1, pal.wallLow);
    ctx.fillStyle = wall;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // A window with blinds behind the desk: daylight by day, the city's dark by night.
    ctx.fillStyle = pal.window;
    ctx.fillRect(48, -58, 40, 44);
    ctx.fillStyle = theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)";
    for (let y = -58; y < -14; y += 2.6) ctx.fillRect(48, y, 40, 1.3);
    ctx.strokeStyle = mix(pal.wall, "#000000", 0.3);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(48, -58, 40, 44);
    if (theme === "dark") {
      const r = seededRandom(9);
      ctx.fillStyle = "#ffd98a";
      for (let i = 0; i < 12; i++) ctx.fillRect(50 + r() * 36, -30 + r() * 14, 0.8, 0.8);
    }
    // The desk.
    ctx.fillStyle = pal.desk;
    ctx.fillRect(v.x0, 0, v.x1 - v.x0, 8);
    ctx.fillStyle = pal.deskEdge;
    ctx.fillRect(v.x0, 8, v.x1 - v.x0, v.y1 - 8);
    // A floppy disk in its paper sleeve, and a ring binder of the era, lying by the machine.
    ctx.fillStyle = "#f2ecdc";
    ctx.fill(poly([pt(-86, 1.5), pt(-66, 0.6), pt(-63, 5), pt(-83, 6.4)]));
    ctx.fillStyle = "#1a1a1e";
    ctx.fill(poly([pt(-84, 1.2), pt(-67, 0.5), pt(-65, 3.2), pt(-82, 4)]));
    ctx.fillStyle = theme === "dark" ? "#6a2a2a" : "#9a3a3a";
    ctx.fillRect(60, -7, 26, 7);
    ctx.fillStyle = "#e8e2d0";
    ctx.fillRect(61, -6.4, 24, 1.2);
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    const pal = PALETTES[frame.theme];
    const muted = frame.muted.has(this.trackId);
    const sounding = muted ? undefined : this.lane.sounding(frame.t)[0];
    // The marker stays on the last key through the one-tick gap after each note, as the 1981 screen's did.
    const marked = muted ? undefined : this.lane.around(frame.t).prev;
    if (frame.theme === "dark") {
      // The tube's blue light spills over the desk and the wall.
      const g = p.ctx.createRadialGradient(0, -32, 0, 0, -32, 90);
      g.addColorStop(0, pal.glow);
      g.addColorStop(1, "rgba(70, 90, 255, 0)");
      p.ctx.fillStyle = g;
      p.ctx.fillRect(-95, -95, 190, 130);
    }
    this.systemUnit(p, frame, pal, sounding?.pitch);
    this.monitor(p, frame, pal, marked && frame.t - marked.end < 0.2 ? marked.pitch : undefined);
    this.keyboard(p, pal);
  }

  private systemUnit(p: Painter, frame: FrameInfo, pal: Palette, pitch: number | undefined) {
    // Shadow, body, front bezel.
    p.contactShadow(0, 0.5, 58, 3, "#000000", frame.theme === "dark" ? 0.6 : 0.3);
    p.part(poly([pt(-50, 0), pt(50, 0), pt(50, -15), pt(-50, -15)]), pal.beige);
    p.part(poly([pt(-50, -15), pt(50, -15), pt(46, -19), pt(-46, -19)]), pal.beigeLit, { inkScale: 0.8 });
    p.part(poly([pt(50, 0), pt(56, -3), pt(56, -17), pt(50, -15)]), pal.beigeDark);
    // The big red switch on the side.
    p.part(roundRect(52, -12, 3, 4, 0.6), "#c8302a", { inkScale: 0.6 });
    // Two full-height floppy drives on the right.
    for (const x of [8, 29]) {
      p.part(roundRect(x, -13.5, 19, 12, 0.6), mix(pal.beige, "#000000", 0.08), { inkScale: 0.7 });
      p.part(roundRect(x + 2, -8.6, 15, 1.6, 0.6), pal.slot, { rim: false, inkScale: 0.5 });
      p.part(roundRect(x + 8, -11.8, 3, 7, 0.8), mix(pal.beige, "#000000", 0.18), { inkScale: 0.6 });
      // The drive's light: on only when the disk is read, so dark while the music plays.
      p.part(ellipse(x + 3, -3.4, 0.7, 0.7), "#3a2a20", { rim: false, inkScale: 0.4 });
    }
    // Vent slots on the left of the front panel, and behind them, cut away, the speaker.
    for (let i = 0; i < 9; i++) p.part(roundRect(-46 + i * 2.4, -11, 1.1, 8, 0.5), mix(pal.beige, "#000000", 0.25), { rim: false, shade: false, ink: false });
    const c = pt(-12, -7.5);
    p.part(ellipse(c.x, c.y, 6.6, 6.6), "#1a1612");
    const amp = pitch ? 1 : 0;
    const visHz = pitch ? 5 + (pitch - LOW) * 0.35 : 0;
    const swing = amp * Math.sin(frame.wall * Math.PI * 2 * visHz) * 0.9 * (frame.reduced ? 0.3 : 1);
    // Frame, paper cone, dust cap, moving in and out.
    p.part(ellipse(c.x, c.y, 5.6, 5.6), "#3a3430", { rim: false });
    p.part(ellipse(c.x, c.y, 4.6 + swing * 0.25, 4.6 + swing * 0.25), "#5a5048", { rim: false });
    p.part(ellipse(c.x, c.y + swing * 0.2, 1.8 + swing * 0.35, 1.8 + swing * 0.35), "#8a8070", { rim: false });
    p.line(ellipse(c.x, c.y, 6.6, 6.6), "#d8cdb0", 0.5, 0.9);
    // Rings of sound out of the grille: close for high notes, wide for low ones.
    if (pitch && !frame.reduced) {
      const spacing = 6 - (pitch - LOW) * 0.12;
      for (let i = 0; i < 4; i++) {
        const r = 8 + ((frame.wall * 30) % spacing) + i * spacing;
        p.line(ellipse(c.x, c.y, r, r * 0.8), frame.theme === "dark" ? "#8a9cff" : "#5a6aa0", 0.5, Math.max(0, 0.6 - i * 0.15));
      }
    }
  }

  private monitor(p: Painter, frame: FrameInfo, pal: Palette, pitch: number | undefined) {
    // The colour monitor sits on the system unit: a deep beige case round a curved tube.
    p.part(roundRect(-26, -59, 52, 40, 2.4), pal.beige);
    p.part(poly([pt(-14, -19), pt(14, -19), pt(16, -21), pt(-16, -21)]), pal.beigeDark, { inkScale: 0.6 });
    p.part(roundRect(-22, -55.5, 44, 33, 3.4), "#26241f", { rim: false });
    const screen = roundRect(-20, -54, 40, 30, 3);
    const { ctx } = p;
    ctx.save();
    ctx.clip(screen);
    ctx.fillStyle = CGA.blue;
    ctx.fillRect(-20, -54, 40, 30);
    // 40 columns by 25 rows: each cell is one unit wide and 1.2 tall.
    const cw = 1;
    const chh = 1.2;
    const x0 = -20;
    const y0 = -54;
    const cell = (col: number, row: number, color: string, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + col * cw, y0 + row * chh, w * cw, h * chh);
    };
    // The 1981 screen's layout (ORIGINAL-ARCHITECTURE.md): a red frame on rows 4 and 13 from column 4 to 37,
    // sixteen white keys two columns wide from column 5, black keys a cell and a half wide on the seams.
    for (let col = 4; col <= 37; col++) {
      cell(col, 4, CGA.red);
      cell(col, 13, CGA.red);
    }
    for (let row = 4; row <= 13; row++) {
      cell(4, row, CGA.red, 0.5);
      cell(37.5, row, CGA.red, 0.5);
    }
    // Each white key is a full block then a left half-block, white on black: the black half is the seam.
    cell(5, 5, CGA.black, 32, 8);
    const keyCol = new Map<number, number>();
    let white = 0;
    for (let k = LOW; k <= HIGH; k++) {
      if (isBlackKey(k)) {
        keyCol.set(k, 5 + 2 * white - 1);
        continue;
      }
      const col = 5 + 2 * white;
      keyCol.set(k, col);
      for (let row = 5; row <= 12; row++) cell(col, row, CGA.white, 1.5, 1);
      white++;
    }
    for (let k = LOW; k <= HIGH; k++) if (isBlackKey(k)) for (let row = 5; row <= 9; row++) cell(keyCol.get(k)!, row, CGA.black, 1.5, 1);
    if (pitch !== undefined && pitch >= LOW && pitch <= HIGH) {
      // The marker: black on grey low on a white key, white on black high on a black one.
      const black = isBlackKey(pitch);
      const col = keyCol.get(pitch)! + (black ? 0.25 : 0);
      const row = black ? 7 : 11;
      if (!black) cell(col, row, CGA.grey, 1, 1);
      const ink = black ? CGA.white : CGA.black;
      cell(col + 0.15, row + 0.55, ink, 0.3, 0.3);
      cell(col + 0.6, row + 0.45, ink, 0.3, 0.3);
      cell(col + 0.38, row + 0.1, ink, 0.08, 0.5);
      cell(col + 0.83, row, ink, 0.08, 0.5);
      cell(col + 0.38, row, ink, 0.53, 0.12);
    }
    // The tune's title, white on red, centred on row 23.
    const title = this.perf.arrangement.songId ? this.title : "";
    if (title) {
      const width = Math.min(36, title.length + 2);
      cell(20 - width / 2, 23, CGA.red, width, 1);
      ctx.fillStyle = CGA.white;
      ctx.font = `${chh * 0.82}px ${monoFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, x0 + 20 * cw, y0 + 23.5 * chh, 34);
    }
    // Scanlines and the glass's curve.
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000000";
    for (let y = -54; y < -24; y += 0.6) ctx.fillRect(-20, y, 40, 0.25);
    ctx.globalAlpha = 1;
    const glass = ctx.createRadialGradient(-6, -46, 2, 0, -39, 30);
    glass.addColorStop(0, "rgba(255,255,255,0.14)");
    glass.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = glass;
    ctx.fillRect(-20, -54, 40, 30);
    ctx.restore();
  }

  private keyboard(p: Painter, pal: Palette) {
    // The long keyboard lies in front, its keys in rows; function keys in two columns on the left.
    p.part(poly([pt(-44, 3), pt(44, 3), pt(48, 14), pt(-48, 14)]), pal.beige);
    p.part(poly([pt(-48, 14), pt(48, 14), pt(48, 16), pt(-48, 16)]), pal.beigeDark, { inkScale: 0.6 });
    for (let row = 0; row < 5; row++) {
      const y = 4.2 + row * 1.9;
      const inset = 4 * (1 - row / 5);
      for (let i = 0; i < 20; i++) {
        const x0 = -42 - row * 0.8 + inset * 0 + i * 4.2;
        const w = i < 2 ? 3.4 : 3.6;
        p.part(roundRect(x0 + row * 0.2, y, w, 1.5, 0.3), i < 2 ? pal.beigeDark : pal.beigeLit, { rim: false, inkScale: 0.4, shade: false });
      }
    }
    // The coiled cable back to the system unit.
    const coil = new Path2D();
    for (let i = 0; i <= 16; i++) coil.lineTo(-30 + i * 0.6 + Math.sin(i * 1.4) * 0.6, 3 - i * 0.18);
    p.line(coil, "#2a2622", 0.5);
  }

  regions(): Region[] {
    return [this.region([this.trackId], "the PC speaker", -56, -60, 56, 16)];
  }
}

/** The app's monospace face for the 40-column screen's title, with the system's as a fallback. */
function monoFont() {
  const family = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  return family ? `${family}, monospace` : "monospace";
}
