import type { SoloInstrumentId } from "@/lib/music/arrange/patches";
import type { Performance } from "@/lib/music/perform/cues";
import { Singer } from "../instruments/voice";
import { Violinist } from "../instruments/strings";
import { castLook, type Wardrobe } from "../looks";
import { ellipse, hash, poly, pt, type Light, type Painter } from "../paint";
import { drawSeated, type Player, type Seat } from "../players";
import { playerFor } from "../roster";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * Solo: one musician, the instrument the player picked, alone on a stage.
 * Night is a spotlight on a black stage; day is a recital room with a tall
 * window and a wooden floor. (The piano has its own show: PianoCam.) The
 * organist plays in front of the pipes, and the choir is three voices.
 */

const RECITAL: Wardrobe = {
  outfits: ["gown", "suit", "jacket", "shirt"],
  tops: ["#2a1f3a", "#1f2a3a", "#5a1f2a", "#1c1a22"],
  trims: ["#f2e8d8", "#e8c76b"],
  bottoms: ["#1c1a22", "#2a1f3a"],
  shoes: ["#141218"],
  hair: ["bun", "short", "waves", "bob", "curly", "ponytail"],
  glasses: 0.15,
};

export class Recital extends Scene {
  readonly caption: string;
  private players: Player[] = [];
  private instrument: SoloInstrumentId;

  constructor(perf: Performance, instrument: SoloInstrumentId) {
    super(perf);
    this.instrument = instrument;
    const cues = perf.tracks[0];
    const look = (k: number) => castLook(hash(`${perf.arrangement.songId}/solo/${instrument}/${k}`), RECITAL);
    const seat = (x: number, scale = 1): Seat => ({ x, y: 0, scale, face: 0.1, phase: x * 0.01 + 0.3 });
    if (instrument === "choir") {
      this.players = [-40, 0, 40].map((x, k) => new Singer(cues, look(k), { ...seat(x), face: -x / 160 }));
    } else if (instrument === "violin") {
      this.players = [new Violinist(cues, look(0), seat(-6), { section: 0, pizzicato: false, standing: true })];
    } else {
      const player = playerFor([cues], look(0), seat(0), { kind: "solo" });
      if (player) this.players = [player];
    }
    this.caption = `${cues.track.patch.name}, alone on the stage: every movement is a note you hear.`;
  }

  protected world(): World {
    return { x0: -80, x1: 80, y0: -128, y1: 12 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: -0.15, y: -0.99 }, shadow: "#14081c", shadeAmount: 0.55, shadeDepth: 3.4, rim: { color: "#ffe2b0", width: 1, alpha: 0.95 }, ink: 0.8, inkTone: "#120a16" }
      : { dir: { x: -0.75, y: -0.66 }, shadow: "#5a4a6a", shadeAmount: 0.24, shadeDepth: 3, rim: { color: "#fffaf0", width: 0.8, alpha: 0.65 }, ink: 0.75, inkTone: "#3a2a3a" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const v = this.camera.view;
    const dark = theme === "dark";
    ctx.fillStyle = dark ? "#0b0810" : "#efe2cc";
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    if (dark) {
      // Heavy curtains in the dark, folds just catching the light.
      for (let x = Math.floor(v.x0 / 12) * 12; x < v.x1; x += 12) {
        const g = ctx.createLinearGradient(x, 0, x + 12, 0);
        g.addColorStop(0, "#1a0a12");
        g.addColorStop(0.5, "#3a1422");
        g.addColorStop(1, "#1a0a12");
        ctx.fillStyle = g;
        ctx.fillRect(x, v.y0, 12, -4 - v.y0);
      }
    } else {
      // Panelled walls, a tall arched window and its patch of sun on the floor.
      ctx.fillStyle = "#e2cfae";
      ctx.fillRect(v.x0, -40, v.x1 - v.x0, 36);
      ctx.strokeStyle = "#c9b08a";
      ctx.lineWidth = 0.8;
      for (let x = Math.floor(v.x0 / 30) * 30; x < v.x1; x += 30) ctx.strokeRect(x + 3, -36, 24, 28);
      ctx.fillStyle = "#cfe6f6";
      ctx.beginPath();
      ctx.moveTo(-150, -44);
      ctx.lineTo(-150, -110);
      ctx.arc(-125, -110, 25, Math.PI, 0);
      ctx.lineTo(-100, -44);
      ctx.fill();
      ctx.strokeStyle = "#b89a70";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    if (this.instrument === "organ") {
      // The organ's pipes rise behind its player.
      for (let i = -8; i <= 8; i++) {
        const h = 70 + (8 - Math.abs(i)) * 6;
        const g = ctx.createLinearGradient(i * 8 - 3, 0, i * 8 + 3, 0);
        g.addColorStop(0, dark ? "#6a5a4a" : "#a89880");
        g.addColorStop(0.5, dark ? "#d8c39a" : "#f2e6c8");
        g.addColorStop(1, dark ? "#6a5a4a" : "#a89880");
        ctx.fillStyle = g;
        ctx.fillRect(i * 8 - 3, -40 - h, 6, h);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(i * 8 - 1.6, -40 - h * 0.28, 3.2, 1.4);
      }
    }
    // The stage floor.
    ctx.fillStyle = dark ? "#1a1216" : "#c9a274";
    ctx.fillRect(v.x0, -4, v.x1 - v.x0, v.y1 + 4);
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.04)" : "rgba(90,60,30,0.2)";
    ctx.lineWidth = 0.5;
    for (let y = 0; y < v.y1; y += 3.2) {
      ctx.beginPath();
      ctx.moveTo(v.x0, y);
      ctx.lineTo(v.x1, y);
      ctx.stroke();
    }
    if (dark) {
      // The spotlight's cone and its pool on the boards.
      const cone = ctx.createLinearGradient(0, v.y0, 0, 4);
      cone.addColorStop(0, "rgba(255, 226, 176, 0.05)");
      cone.addColorStop(1, "rgba(255, 226, 176, 0.16)");
      ctx.fillStyle = cone;
      ctx.fill(poly([pt(-16, v.y0), pt(16, v.y0), pt(70, 6), pt(-70, 6)]));
      const pool = ctx.createRadialGradient(0, 4, 0, 0, 4, 70);
      pool.addColorStop(0, "rgba(255, 226, 176, 0.4)");
      pool.addColorStop(1, "rgba(255, 226, 176, 0)");
      ctx.fillStyle = pool;
      ctx.fill(ellipse(0, 4, 70, 12));
    } else {
      ctx.fillStyle = "rgba(255, 250, 230, 0.5)";
      ctx.fill(poly([pt(-150, 2), pt(-104, 2), pt(-80, 14), pt(-130, 14)]));
    }
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    for (const player of this.players) {
      const muted = player.ids.every((id) => frame.muted.has(id));
      p.contactShadow(player.seat.x, player.seat.y + 1, 26 * player.seat.scale, 4, "#000000", frame.theme === "dark" ? 0.5 : 0.25);
      const before = p.ctx.globalAlpha;
      if (muted) p.ctx.globalAlpha = 0.45;
      drawSeated(p, player, frame, muted, player.floor);
      p.ctx.globalAlpha = before;
    }
  }

  regions(): Region[] {
    return this.players.map((player) => {
      const { seat, box, floor } = player;
      return this.region(player.ids, player.label, seat.x + box.x0 * seat.scale, seat.y + (box.y0 - floor) * seat.scale, seat.x + box.x1 * seat.scale, seat.y + (box.y1 - floor) * seat.scale);
    });
  }
}
