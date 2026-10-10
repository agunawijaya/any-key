import type { Role } from "@/lib/music/perform/cast";
import { pulse, type Lane, type Performance, type TrackCues } from "@/lib/music/perform/cues";
import { splitKit } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import type { Wardrobe } from "../looks";
import { ellipse, poly, pt, seededRandom, type Light, type Painter } from "../paint";
import type { FrameInfo, Theme } from "../stage";
import { BandStage, type Slot } from "./band";

/*
 * Pop: a band on a big stage. The lead synth out front, the pianist beside
 * it, the bass on the right; drums and the two keyboard players on the
 * riser. Behind them, arches of lights that run with the beat. Night is an
 * arena with moving beams in the haze; day is an open-air festival.
 */

const POP: Wardrobe = {
  outfits: ["tee", "hoodie", "jacket", "tank", "shirt"],
  tops: ["#ff5ca3", "#4f6bff", "#2fd3b0", "#ffcc3d", "#f4f1ea", "#1c1a24"],
  trims: ["#ffffff", "#1c1a24", "#ffd0e4"],
  bottoms: ["#1c1a24", "#2a3556", "#3a2a4a", "#e8e2d4"],
  shoes: ["#f4f1ea", "#1c1a24", "#ff5ca3"],
  hair: ["short", "bob", "ponytail", "curly", "spiky", "afro", "braids", "beanie"],
  shortSleeves: 0.6,
  glasses: 0.15,
};

const ARCH_COLORS = ["#ff5ca3", "#4f6bff", "#2fd3b0", "#ffcc3d"];

export class PopStage extends BandStage {
  readonly caption = "The pop band: lead synth out front, the beat on the riser. Tap a player to mute them.";
  protected readonly wardrobe = POP;
  private kick?: Lane;

  constructor(perf: Performance) {
    super(perf);
    const drums = perf.tracks.find((c) => c.track.patch.drums);
    if (drums) this.kick = splitKit(drums.lane).rightFoot;
    this.book(perf);
  }

  protected slot(cues: TrackCues, role: Role): Slot | undefined {
    if (role === "drumkit") return { row: 1, order: 1 };
    if (cues.track.role === "melody") return { row: 0, order: 1 };
    if (cues.track.role === "counter") return { row: 0, order: 0 };
    if (role === "bassGuitar" || role === "bass") return { row: 0, order: 2 };
    if (cues.track.role === "chords") return { row: 1, order: 0 };
    return { row: 1, order: 2 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: 0.2, y: -0.98 }, shadow: "#140a26", shadeAmount: 0.48, shadeDepth: 3.2, rim: { color: "#ff9fd8", width: 0.9, alpha: 0.95 }, ink: 0.8, inkTone: "#140a20" }
      : { dir: { x: -0.6, y: -0.8 }, shadow: "#4a4a7a", shadeAmount: 0.22, shadeDepth: 3, rim: { color: "#fffbe8", width: 0.7, alpha: 0.6 }, ink: 0.75, inkTone: "#2a2a44" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const v = this.camera.view;
    const sky = ctx.createLinearGradient(0, v.y0, 0, 0);
    if (theme === "dark") {
      sky.addColorStop(0, "#07050e");
      sky.addColorStop(1, "#1a0c2a");
    } else {
      sky.addColorStop(0, "#4a9ae6");
      sky.addColorStop(1, "#cfeaff");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    if (theme === "light") {
      const r = seededRandom(13);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 6; i++) {
        const x = v.x0 + r() * (v.x1 - v.x0);
        const y = v.y0 + 6 + r() * 22;
        for (let k = 0; k < 4; k++) ctx.fill(ellipse(x + k * 7, y + (k % 2) * 2, 9, 4.5));
      }
    }
    // Arches of the stage roof: the frames here, their lights each frame.
    ctx.strokeStyle = theme === "dark" ? "#2a2440" : "#8a88a0";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const r = 110 + i * 22;
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 1.25, r, 0, Math.PI, 0);
      ctx.stroke();
    }
    // The stage deck and its front edge.
    ctx.fillStyle = theme === "dark" ? "#15121e" : "#3a3848";
    ctx.fillRect(v.x0, -8, v.x1 - v.x0, v.y1 + 8);
    this.paintRiser(ctx, theme === "dark" ? "#2a2440" : "#5a5870", theme === "dark" ? "#18141f" : "#3a3848");
    ctx.fillStyle = theme === "dark" ? "#0c0a12" : "#2a2834";
    ctx.fillRect(v.x0, 12, v.x1 - v.x0, v.y1);
  }

  protected effects(p: Painter, frame: FrameInfo) {
    const { ctx } = p;
    const kick = this.kick && !frame.reduced ? pulse(this.kick, frame.t, 0.22) : 0;
    // The arch lights chase round on the beat.
    const chase = Math.floor(frame.beat * 2);
    for (let i = 0; i < 4; i++) {
      const r = 110 + i * 22;
      for (let k = 0; k <= 18; k++) {
        const a = Math.PI + (k / 18) * Math.PI;
        const on = frame.reduced ? k % 3 === 0 : (k + chase + i) % 4 === 0;
        ctx.fillStyle = on ? ARCH_COLORS[i] : mix(ARCH_COLORS[i], "#000000", 0.7);
        ctx.globalAlpha = on ? 0.9 : 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.25, 4 + Math.sin(a) * r, on ? 1.6 + kick : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (frame.theme !== "dark") return;
    // Moving beams in the haze, flaring with the kick.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 5; i++) {
      const x = -120 + i * 60;
      const sweep = frame.reduced ? 0 : Math.sin(frame.beat * Math.PI * 0.25 + i * 1.3) * 40;
      const g = ctx.createLinearGradient(x, -140, x + sweep, 10);
      const c = ARCH_COLORS[i % ARCH_COLORS.length];
      g.addColorStop(0, mix(c, "#ffffff", 0.2));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.14 + kick * 0.16;
      ctx.fill(poly([pt(x - 2, -140), pt(x + 2, -140), pt(x + sweep + 24, 10), pt(x + sweep - 24, 10)]));
    }
    ctx.restore();
  }
}
