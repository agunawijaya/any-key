import type { Role } from "@/lib/music/perform/cast";
import type { Performance, TrackCues } from "@/lib/music/perform/cues";
import type { Wardrobe } from "../looks";
import { ellipse, poly, pt, seededRandom, type Light, type Painter } from "../paint";
import type { FrameInfo, Theme } from "../stage";
import { BandStage, type Slot } from "./band";

/*
 * Jazz: a quartet in a small club. The horn out front, the grand piano on
 * the left, the bass on the right, the drummer with brushes behind. Night is
 * the club itself, brick and lamplight, candles on the tables; day is a
 * Sunday session in a bright room full of plants.
 */

const JAZZ: Wardrobe = {
  outfits: ["suit", "vest", "jacket", "shirt", "sweater"],
  tops: ["#2a2430", "#3a2a22", "#1f2a3a", "#4a3a2a", "#6a2a2a"],
  trims: ["#f2e8d8", "#e8d8b8", "#c9a24a"],
  bottoms: ["#1f1c24", "#2a2420", "#2a3040"],
  shoes: ["#1a1410", "#3a2418"],
  hair: ["short", "crop", "bald", "waves", "curly", "bun", "afro"],
  beard: 0.3,
  glasses: 0.3,
};

export class JazzClub extends BandStage {
  readonly caption = "The jazz quartet: horn, piano, walking bass and brushes. Tap a player to mute them.";
  protected readonly wardrobe = JAZZ;
  protected readonly grand = true;

  constructor(perf: Performance) {
    super(perf);
    this.book(perf);
  }

  protected slot(cues: TrackCues, role: Role): Slot | undefined {
    if (role === "piano") return { row: 0, order: 0 };
    if (role === "drumkit") return { row: 1, order: 1 };
    if (role === "bass" || role === "bassGuitar") return { row: 0, order: 2 };
    if (cues.track.role === "melody") return { row: 0, order: 1 };
    return { row: 1, order: 0 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: -0.4, y: -0.92 }, shadow: "#1a0c10", shadeAmount: 0.5, shadeDepth: 3.2, rim: { color: "#ffc27a", width: 0.9, alpha: 0.9 }, ink: 0.8, inkTone: "#1a0c10" }
      : { dir: { x: -0.7, y: -0.7 }, shadow: "#5a4a40", shadeAmount: 0.22, shadeDepth: 3, rim: { color: "#fffaf0", width: 0.7, alpha: 0.6 }, ink: 0.75, inkTone: "#3a2a24" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const v = this.camera.view;
    const dark = theme === "dark";
    // The back wall: brick at night, a pale wall with tall windows and plants by day.
    ctx.fillStyle = dark ? "#3a1e18" : "#efe4d2";
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, -4 - v.y0);
    if (dark) {
      ctx.strokeStyle = "#22100c";
      ctx.lineWidth = 0.7;
      for (let y = v.y0; y < -4; y += 4.6) {
        ctx.beginPath();
        ctx.moveTo(v.x0, y);
        ctx.lineTo(v.x1, y);
        const offset = Math.round((y - v.y0) / 4.6) % 2 ? 5.5 : 0;
        for (let x = v.x0 + offset; x < v.x1; x += 11) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 4.6);
        }
        ctx.stroke();
      }
      // Wall lamps throwing warm cones up and down the brick.
      for (const x of [-130, 0, 130]) {
        const g = ctx.createRadialGradient(x, -96, 0, x, -96, 60);
        g.addColorStop(0, "rgba(255, 190, 110, 0.45)");
        g.addColorStop(1, "rgba(255, 190, 110, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 60, -156, 120, 120);
        ctx.fillStyle = "#e8b060";
        ctx.fill(poly([pt(x - 4, -98), pt(x + 4, -98), pt(x + 2.6, -92), pt(x - 2.6, -92)]));
      }
    } else {
      for (const x of [-150, -40, 70]) {
        ctx.fillStyle = "#cfe8f6";
        ctx.fillRect(x, -132, 70, 100);
        ctx.strokeStyle = "#b8a890";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x, -132, 70, 100);
        ctx.beginPath();
        ctx.moveTo(x + 35, -132);
        ctx.lineTo(x + 35, -32);
        ctx.stroke();
      }
      const r = seededRandom(19);
      for (const x of [-160, 150]) {
        ctx.fillStyle = "#b86a3a";
        ctx.fill(poly([pt(x - 8, -20), pt(x + 8, -20), pt(x + 6, -4), pt(x - 6, -4)]));
        ctx.fillStyle = "#4a8a4a";
        for (let i = 0; i < 9; i++) ctx.fill(ellipse(x + (r() - 0.5) * 20, -30 - r() * 30, 3, 9, (r() - 0.5) * 1.6));
      }
    }
    // Velvet curtains at the sides of the little stage.
    ctx.fillStyle = dark ? "#5a0f1c" : "#8a2a36";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 300, v.y0);
      ctx.lineTo(side * 168, v.y0);
      ctx.quadraticCurveTo(side * 182, -60, side * 172, -4);
      ctx.lineTo(side * 300, -4);
      ctx.fill();
    }
    this.paintRiser(ctx, dark ? "#3a2418" : "#c49a6a", dark ? "#1e120c" : "#8a6a48");
    // The stage: boards and a rug.
    ctx.fillStyle = dark ? "#2a1a12" : "#b88a5a";
    ctx.fillRect(v.x0, -6, v.x1 - v.x0, 16);
    ctx.fillStyle = dark ? "#5a1a22" : "#a8323a";
    ctx.fill(ellipse(0, 2, 120, 7));
    ctx.fillStyle = dark ? "#0e0806" : "#6a4a30";
    ctx.fillRect(v.x0, 10, v.x1 - v.x0, v.y1);
  }

  /** The band, then little round tables in front of the stage, each with a candle. */
  protected paintScene(p: Painter, frame: FrameInfo) {
    super.paintScene(p, frame);
    const v = this.camera.view;
    const { ctx } = p;
    const dark = frame.theme === "dark";
    for (const x of [-150, -60, 40, 140]) {
      ctx.fillStyle = dark ? "#0a0606" : "#5a3a28";
      ctx.fill(ellipse(x, v.y1 - 2, 22, 5));
      ctx.fillRect(x - 1.5, v.y1 - 2, 3, 10);
      if (dark) {
        const flicker = frame.reduced ? 1 : 0.85 + Math.sin(frame.wall * 9 + x) * 0.15;
        const g = ctx.createRadialGradient(x, v.y1 - 8, 0, x, v.y1 - 8, 18);
        g.addColorStop(0, `rgba(255, 190, 110, ${0.5 * flicker})`);
        g.addColorStop(1, "rgba(255, 190, 110, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 18, v.y1 - 26, 36, 36);
        ctx.fillStyle = "#ffd48a";
        ctx.fill(ellipse(x, v.y1 - 8, 1, 2 * flicker));
      }
    }
  }
}
