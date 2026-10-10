import type { Role } from "@/lib/music/perform/cast";
import type { Performance, TrackCues } from "@/lib/music/perform/cues";
import { mix } from "@/lib/kit/color";
import type { Look } from "../figure";
import { GendangPlayer, TambourinePlayer } from "../instruments/kendang";
import type { Wardrobe } from "../looks";
import { poly, seededRandom, type Light, type Painter } from "../paint";
import type { FrameInfo, Theme } from "../stage";
import { BandStage, type Booking, type Slot } from "./band";

/*
 * A dangdut stage. Behind the band hangs the curtain every orkes brings: a
 * fringe of foil strips in gold, silver and pink that glitters whenever a
 * light moves. At night (dark) a truss of coloured lamps throws beams that
 * pulse with the kendang; in the afternoon (light) the same band plays a
 * wedding under a tent of draped satin.
 */

const BAND: Wardrobe = {
  outfits: ["shirt", "shirt", "vest"],
  tops: ["#b0203a", "#1f5f8b", "#7a2a8a", "#c0702a"],
  trims: ["#ffd98a", "#f6efe2", "#ffc2d6"],
  bottoms: ["#1d1a24", "#2b2a33"],
  shoes: ["#151217"],
  hair: ["short", "crop", "waves", "curly"],
  beard: 0.2,
  glasses: 0.1,
  skins: ["#e0a97f", "#cf9a6e", "#c98d63", "#b47b52", "#a96e48"],
  hairs: ["#16110f", "#1e1714", "#2b1a17"],
};

const FOIL = ["#f2c14e", "#e9e6f2", "#ff5aa5", "#f2c14e", "#7fe0e8", "#e9e6f2", "#ff8a3d"];
const LAMPS = ["#ff3d7f", "#ffd23d", "#3dd6ff", "#a95cff", "#ff8a3d", "#5cff9d"];

type Palette = { sky: string; skyLow: string; carpet: string; carpetEdge: string; skirt: string; truss: string; drape: string[]; dim: number };

const PALETTES: Record<Theme, Palette> = {
  dark: { sky: "#07040c", skyLow: "#1a0b22", carpet: "#6a1426", carpetEdge: "#2a0610", skirt: "#3a0a1e", truss: "#2a2833", drape: ["#3a0a2a", "#2a0a3a"], dim: 0.55 },
  light: { sky: "#fbe6c4", skyLow: "#f6c98f", carpet: "#b3243c", carpetEdge: "#6a1224", skirt: "#d94a76", truss: "#8a8696", drape: ["#ff9ec4", "#ffe08a", "#ffffff"], dim: 1 },
};

export class DangdutStage extends BandStage {
  readonly caption = "The dangdut band: the gendang leads, the rest follow. Tap a player to mute them.";
  protected readonly wardrobe = BAND;
  private beats?: TrackCues;

  constructor(perf: Performance) {
    super(perf);
    this.beats = perf.tracks.find((c) => c.track.id === "kendang");
    this.book(perf);
  }

  /** One gendang player takes both kendang tracks; the tambourine part gets a player of its own. */
  protected special(perf: Performance, look: (id: string) => Look) {
    const kendang = perf.tracks.find((c) => c.track.id === "kendang");
    const hand = perf.tracks.find((c) => c.track.patch.drums);
    const bookings: Booking[] = [];
    const claimed = new Set<string>();
    if (kendang) {
      claimed.add(kendang.track.id);
      if (hand) claimed.add(hand.track.id);
      bookings.push({ slot: { row: 0, order: 1 }, width: 90, make: (seat) => new GendangPlayer(kendang, hand, { ...look("gendang"), pattern: "batik", top: "#7a1f2b", trim: "#f2c14e", outfit: "shirt", hairStyle: "short" }, seat) });
    }
    if (hand && hand.lane.hits.some((h) => h.pitch === 54)) {
      bookings.push({ slot: { row: 1, order: 0 }, width: 52, make: (seat) => new TambourinePlayer(hand, { ...look("tambourine"), pattern: "sequins", top: "#1f4f8b", trim: "#cfe6ff" }, { ...seat, face: -0.3 }) });
    }
    return { bookings, claimed };
  }

  /** The suling out front on the left, the mandolin on the right; guitar, bass and keyboard on the riser. */
  protected slot(cues: TrackCues, role: Role): Slot | undefined {
    if (role === "suling" || cues.track.role === "melody") return { row: 0, order: 0 };
    if (role === "plucked") return { row: 0, order: 2 };
    if (role === "guitar") return { row: 1, order: 1 };
    if (role === "bassGuitar") return { row: 1, order: 2 };
    if (role === "synth" || role === "piano" || role === "organ") return { row: 1, order: 3 };
    return undefined;
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: 0.4, y: -0.92 }, shadow: "#1c0a20", shadeAmount: 0.45, shadeDepth: 3, rim: { color: "#ff9fd0", width: 0.9, alpha: 0.9 }, ink: 0.8, inkTone: "#1a0a1c" }
      : { dir: { x: -0.55, y: -0.83 }, shadow: "#6a4a6a", shadeAmount: 0.22, shadeDepth: 3, rim: { color: "#fff6e8", width: 0.7, alpha: 0.6 }, ink: 0.75, inkTone: "#3a2a3a" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    const sky = ctx.createLinearGradient(0, v.y0, 0, 0);
    sky.addColorStop(0, pal.sky);
    sky.addColorStop(1, pal.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    const r = seededRandom(11);
    // The foil fringe: hundreds of thin strips, each catching the light differently.
    for (let x = v.x0; x < v.x1; x += 1.6) {
      const c = FOIL[Math.floor(r() * FOIL.length)];
      ctx.globalAlpha = (0.55 + r() * 0.45) * (theme === "dark" ? 0.75 : 0.95);
      const g = ctx.createLinearGradient(0, -128, 0, -6);
      g.addColorStop(0, mix(c, "#ffffff", r() * 0.4));
      g.addColorStop(0.5 + r() * 0.3, c);
      g.addColorStop(1, mix(c, "#000000", 0.35));
      ctx.fillStyle = g;
      ctx.fillRect(x, -128, 1.1, 122 + r() * 4);
    }
    ctx.globalAlpha = 1;
    if (theme === "light") {
      // The tent above: swags of satin, scalloped, in the wedding's colours.
      for (let row = 0; row < 3; row++) {
        const c = pal.drape[row % pal.drape.length];
        ctx.fillStyle = c;
        const y = v.y0 + row * 6;
        ctx.beginPath();
        ctx.moveTo(v.x0, y);
        for (let x = v.x0; x <= v.x1; x += 28) ctx.quadraticCurveTo(x + 14, y + 22 - row * 3, x + 28, y);
        ctx.lineTo(v.x1, v.y0 - 4);
        ctx.lineTo(v.x0, v.y0 - 4);
        ctx.fill();
      }
      // Bunting strung across.
      for (let x = v.x0 + 4; x < v.x1; x += 9) {
        ctx.fillStyle = LAMPS[Math.floor(r() * LAMPS.length)];
        ctx.fill(poly([{ x, y: v.y0 + 26 }, { x: x + 7, y: v.y0 + 27 }, { x: x + 3.4, y: v.y0 + 34 }]));
      }
    } else {
      // The lighting truss: a lattice bar with its lamps.
      ctx.fillStyle = pal.truss;
      ctx.fillRect(v.x0, -128, v.x1 - v.x0, 5);
      ctx.strokeStyle = mix(pal.truss, "#ffffff", 0.2);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = v.x0; x < v.x1; x += 5) {
        ctx.moveTo(x, -128);
        ctx.lineTo(x + 5, -123);
      }
      ctx.stroke();
    }
    this.paintRiser(ctx, mix(pal.carpet, "#ffffff", 0.08), mix(pal.skirt, "#000000", 0.2));
    // Stage floor: carpet, and the skirt hanging off the front edge.
    ctx.fillStyle = pal.carpet;
    ctx.fillRect(v.x0, -6, v.x1 - v.x0, 18);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#ffd98a";
    ctx.lineWidth = 0.5;
    for (let x = v.x0; x < v.x1; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 4, 4);
      ctx.lineTo(x + 8, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = pal.carpetEdge;
    ctx.fillRect(v.x0, 11, v.x1 - v.x0, 1.5);
    ctx.fillStyle = pal.skirt;
    ctx.fillRect(v.x0, 12.5, v.x1 - v.x0, v.y1 - 12.5);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    for (let x = v.x0; x < v.x1; x += 6) ctx.fillRect(x, 12.5, 2.2, v.y1 - 12.5);
  }

  protected effects(p: Painter, frame: FrameInfo) {
    if (frame.theme === "dark") this.lamps(p.ctx, frame);
    this.glints(p.ctx, frame);
  }

  /** Coloured beams from the truss, flaring on every dhut. */
  private lamps(ctx: CanvasRenderingContext2D, frame: FrameInfo) {
    const v = this.camera.view;
    const kick = this.beats && !frame.reduced ? Math.exp(-Math.max(0, frame.t - (this.beats.lane.around(frame.t).prev?.t ?? -9)) / 0.25) : 0;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const count = 6;
    for (let i = 0; i < count; i++) {
      const x = v.x0 + ((i + 0.5) / count) * (v.x1 - v.x0);
      const c = LAMPS[(i + Math.floor(frame.beat / 4)) % LAMPS.length];
      const sweep = frame.reduced ? 0 : Math.sin(frame.beat * Math.PI * 0.25 + i) * 30;
      const g = ctx.createLinearGradient(x, -124, x + sweep, 10);
      g.addColorStop(0, mix(c, "#000000", 0.1));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.16 + kick * 0.18;
      ctx.fillStyle = g;
      ctx.fill(poly([{ x: x - 2, y: -124 }, { x: x + 2, y: -124 }, { x: x + sweep + 22, y: 10 }, { x: x + sweep - 22, y: 10 }]));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, -122, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Points of light running down the foil as it stirs. */
  private glints(ctx: CanvasRenderingContext2D, frame: FrameInfo) {
    if (frame.reduced) return;
    const v = this.camera.view;
    const r = seededRandom(23);
    ctx.save();
    ctx.globalCompositeOperation = frame.theme === "dark" ? "screen" : "source-over";
    for (let i = 0; i < 70; i++) {
      const x = v.x0 + r() * (v.x1 - v.x0);
      const speed = 0.4 + r();
      const y = -128 + ((frame.wall * 18 * speed + r() * 200) % 124);
      const a = Math.max(0, Math.sin(frame.wall * 3 * speed + i));
      ctx.globalAlpha = a * (frame.theme === "dark" ? 0.9 : 0.7);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 0.9, 2.6);
    }
    ctx.restore();
  }
}
