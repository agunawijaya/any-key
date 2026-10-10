import { cast, type Role } from "@/lib/music/perform/cast";
import type { Performance, TrackCues } from "@/lib/music/perform/cues";
import { mix } from "@/lib/kit/color";
import { playerFor, widthOf } from "../roster";
import { castLook, CONCERT } from "../looks";
import { hash, poly, seededRandom, type Light, type Painter } from "../paint";
import { drawSeated, type Player, type Seat } from "../players";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * The concert stage: an orchestra seated the way orchestras sit, strings in
 * a curve at the front (violins on the audience's left, low strings on the
 * right), winds behind them, brass and timpani on the back risers. Each
 * track is a desk of players; a section part seats two or three who bow
 * and breathe together.
 *
 * Light is the matinee: daylight from high windows over pale wood. Dark is
 * the evening: the hall goes black and warm pools of light fall on the
 * players.
 */

type Placed = { player: Player; row: number };

/** Where each kind of player sits: row (0 front) and a left-to-right order. */
const PLACES: Partial<Record<Role, { row: number; order: number }>> = {
  piano: { row: 0, order: 0 },
  koto: { row: 0, order: 0.5 },
  violin: { row: 0, order: 1 },
  viola: { row: 0, order: 2 },
  cello: { row: 0, order: 3 },
  guitar: { row: 0, order: 3.5 },
  plucked: { row: 0, order: 3.6 },
  bass: { row: 0, order: 4 },
  tambourine: { row: 0, order: 5 },
  harp: { row: 1, order: 0 },
  flute: { row: 1, order: 1 },
  piccolo: { row: 1, order: 1 },
  suling: { row: 1, order: 1.5 },
  oboe: { row: 1, order: 2 },
  clarinet: { row: 1, order: 3 },
  sax: { row: 1, order: 3.5 },
  bassoon: { row: 1, order: 4 },
  horn: { row: 2, order: 0 },
  trumpet: { row: 2, order: 1 },
  trombone: { row: 2, order: 2 },
  tuba: { row: 2, order: 3 },
  timpani: { row: 2, order: 4 },
  drumkit: { row: 2, order: 5 },
  mallets: { row: 2, order: 6 },
  voice: { row: 2, order: 7 },
};

/** The widest a row may get before sections give up players. */
const MAX_ROW = 440;
const ROW_FLOOR = [0, -36, -64];
const ROW_SCALE = [1, 0.82, 0.68];

type Palette = { wallTop: string; wall: string; slat: string; floor: string; floorEdge: string; riser: string; pipe: string; pipeLit: string; pool: string; audience: string };

const PALETTES: Record<Theme, Palette> = {
  dark: {
    wallTop: "#0c080d",
    wall: "#2a1712",
    slat: "#4a2a1c",
    floor: "#4a2c1d",
    floorEdge: "#140b0a",
    riser: "#2f1c15",
    pipe: "#3a2a22",
    pipeLit: "#b48a52",
    pool: "rgba(255, 205, 140, 0.28)",
    audience: "#070508",
  },
  light: {
    wallTop: "#efe2cf",
    wall: "#d9b88f",
    slat: "#c39a6b",
    floor: "#d7ae7c",
    floorEdge: "#7a5236",
    riser: "#c49867",
    pipe: "#c9b9a2",
    pipeLit: "#fff2d8",
    pool: "rgba(255, 245, 220, 0.0)",
    audience: "#5a4636",
  },
};

export class Concert extends Scene {
  readonly caption = "The orchestra: every player moves with their own part. Tap one to mute them.";
  private placed: Placed[] = [];

  constructor(perf: Performance) {
    super(perf);
    this.seat(perf);
  }

  private seat(perf: Performance) {
    type Desk = { cues: TrackCues[]; role: Role; players: number; row: number; order: number };
    const desks: Desk[] = [];
    for (const cues of perf.tracks) {
      const c = cast(cues.track);
      const place = PLACES[c.role] ?? (c.role === "handDrums" ? PLACES.tambourine : undefined);
      if (!place) continue;
      // A piano written as a right-hand and a left-hand part is one pianist.
      const sharing = c.role === "piano" ? desks.find((d) => d.role === "piano") : undefined;
      if (sharing) {
        sharing.cues.push(cues);
        continue;
      }
      const players = /metronome/i.test(cues.track.name) || ["piano", "harp", "timpani", "drumkit", "mallets", "koto"].includes(c.role) ? 1 : c.players;
      desks.push({ cues: [cues], role: c.role, players, row: place.row, order: place.order + (c.pizzicato ? 0.5 : 0) });
    }
    desks.sort((a, b) => a.row - b.row || a.order - b.order);
    // A small ensemble fills the front: with no one behind, everyone moves forward a row.
    const used = [...new Set(desks.map((d) => d.row))].sort();
    for (const d of desks) d.row = used.indexOf(d.row);
    let front = 0;
    [0, 1, 2].forEach((r) => {
      const row = desks.filter((d) => d.row === r);
      const rowWidth = () => row.reduce((w, d) => w + d.players * widthOf(d.role), 0);
      // A big orchestra seats fewer players per section rather than shrinking everyone to dots.
      while (rowWidth() > MAX_ROW && row.some((d) => d.players > 1)) {
        const widest = row.reduce((a, b) => (b.players > a.players ? b : a));
        widest.players--;
      }
      const width = rowWidth();
      if (r === 0) front = width;
      // Back rows sit half a chair over, so their faces show between the players in front;
      // a short back row (a lone drummer) moves to one side so it isn't hidden.
      let x = r > 0 && width < front * 0.6 ? front / 2 - width + 12 : -width / 2 + (r % 2) * 18;
      for (const desk of row) {
        for (let i = 0; i < desk.players; i++) {
          const step = widthOf(desk.role);
          const seed = hash(`${perf.arrangement.songId}/${desk.cues[0].track.id}/${i}`);
          const look = castLook(seed, CONCERT);
          // Players turn a little towards the middle, where the conductor would stand.
          const face = Math.max(-0.5, Math.min(0.5, -(x + step / 2) / 200));
          const seat: Seat = { x: x + step / 2, y: ROW_FLOOR[r] + (i % 2) * 2, scale: ROW_SCALE[r], face, phase: seededRandom(seed)() };
          const player = playerFor(desk.cues, look, seat, { kind: "concert", grand: true });
          if (player) this.placed.push({ player, row: r });
          x += step;
        }
      }
    });
  }

  protected world(): World {
    const xs = this.placed.map((p) => p.player.seat.x);
    const lo = Math.min(...xs, -60) - 40;
    const hi = Math.max(...xs, 60) + 50;
    const rows = new Set(this.placed.map((p) => p.row));
    const top = ROW_FLOOR[Math.max(0, ...rows)] - 100 * ROW_SCALE[Math.max(0, ...rows)];
    return { x0: lo, x1: hi, y0: Math.min(-120, top), y1: 22 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: -0.45, y: -0.9 }, shadow: "#1b0e18", shadeAmount: 0.46, shadeDepth: 3.2, rim: { color: "#ffcf8a", width: 0.9, alpha: 0.9 }, ink: 0.8, inkTone: "#160b14" }
      : { dir: { x: -0.6, y: -0.8 }, shadow: "#5b4a6e", shadeAmount: 0.22, shadeDepth: 3, rim: { color: "#fffaf0", width: 0.7, alpha: 0.55 }, ink: 0.75, inkTone: "#3a2a3a" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    // The back wall: tall wooden slats rising into the dark (or the daylight).
    const wall = ctx.createLinearGradient(0, v.y0, 0, -50);
    wall.addColorStop(0, pal.wallTop);
    wall.addColorStop(1, pal.wall);
    ctx.fillStyle = wall;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, -50 - v.y0);
    const r = seededRandom(7);
    ctx.save();
    for (let x = Math.floor(v.x0 / 9) * 9; x < v.x1; x += 9) {
      ctx.globalAlpha = 0.35 + r() * 0.25;
      ctx.fillStyle = pal.slat;
      ctx.fillRect(x, v.y0, 4.2, -50 - v.y0);
    }
    ctx.restore();
    // Organ pipes behind the orchestra, catching the light at their mouths.
    for (let i = -9; i <= 9; i++) {
      const h = 120 - Math.abs(i) * 7 + (i % 2) * 6;
      const x = i * 10;
      const g = ctx.createLinearGradient(x - 3.5, 0, x + 3.5, 0);
      g.addColorStop(0, pal.pipe);
      g.addColorStop(0.45, pal.pipeLit);
      g.addColorStop(1, pal.pipe);
      ctx.fillStyle = g;
      ctx.globalAlpha = theme === "dark" ? 0.55 : 0.8;
      ctx.fillRect(x - 3.5, -60 - h, 7, h);
    }
    ctx.globalAlpha = 1;
    if (theme === "dark") {
      // Uplights wash the wall from below.
      for (let i = -3; i <= 3; i++) {
        const x = i * 70;
        const g = ctx.createRadialGradient(x, -50, 0, x, -50, 110);
        g.addColorStop(0, "rgba(255, 170, 90, 0.32)");
        g.addColorStop(1, "rgba(255, 170, 90, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 110, -160, 220, 110);
      }
    } else {
      // Daylight from high windows: long soft beams across the wall.
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(255, 250, 235, 0.9)";
      for (let i = 0; i < 4; i++) {
        const x = v.x0 + 40 + i * 70;
        ctx.fill(poly([{ x, y: v.y0 }, { x: x + 26, y: v.y0 }, { x: x + 120, y: -50 }, { x: x + 94, y: -50 }]));
      }
      ctx.restore();
    }
    // Risers, back to front, then the stage floor.
    for (let r2 = 2; r2 >= 0; r2--) {
      const top = r2 === 0 ? -14 : ROW_FLOOR[r2] - 8;
      const bottom = r2 === 0 ? v.y1 : ROW_FLOOR[r2 - 1] - 8;
      ctx.fillStyle = r2 === 0 ? pal.floor : pal.riser;
      ctx.fillRect(v.x0, top, v.x1 - v.x0, bottom - top);
      ctx.fillStyle = mix(r2 === 0 ? pal.floor : pal.riser, "#000000", 0.25);
      ctx.fillRect(v.x0, top, v.x1 - v.x0, 1.2);
      if (r2 > 0) {
        ctx.fillStyle = mix(pal.riser, "#000000", 0.35);
        ctx.fillRect(v.x0, bottom - 3, v.x1 - v.x0, 3);
      }
    }
    // Boards on the stage floor.
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = pal.floorEdge;
    ctx.lineWidth = 0.4;
    for (let y = -12; y < v.y1; y += 3.4) {
      ctx.beginPath();
      ctx.moveTo(v.x0, y);
      ctx.lineTo(v.x1, y);
      ctx.stroke();
    }
    ctx.restore();
    // The edge of the stage and the first heads in the hall.
    ctx.fillStyle = pal.floorEdge;
    ctx.fillRect(v.x0, 16, v.x1 - v.x0, v.y1 - 16);
    ctx.fillStyle = pal.audience;
    for (let x = v.x0 + 6; x < v.x1; x += 15) {
      const h = 4 + r() * 3;
      ctx.beginPath();
      ctx.ellipse(x + r() * 4, 24 - h * 0.2, 5.4, 6 + h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 8, 26, 16, 10);
    }
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    const pal = PALETTES[frame.theme];
    for (const { player } of [...this.placed].sort((a, b) => b.row - a.row || a.player.seat.y - b.player.seat.y)) {
      const muted = player.ids.every((id) => frame.muted.has(id));
      if (frame.theme === "dark") p.contactShadow(player.seat.x, player.seat.y + 2, 32 * player.seat.scale, 7 * player.seat.scale, pal.pool, 1);
      p.contactShadow(player.seat.x, player.seat.y + 1, 20 * player.seat.scale, 3.4 * player.seat.scale, "#000000", frame.theme === "dark" ? 0.5 : 0.22);
      const before = p.ctx.globalAlpha;
      if (muted) p.ctx.globalAlpha = 0.45;
      drawSeated(p, player, frame, muted, player.floor);
      p.ctx.globalAlpha = before;
    }
    if (frame.theme === "dark") this.haze(p.ctx);
  }

  /** Beams of light through a faint haze above the players. */
  private haze(ctx: CanvasRenderingContext2D) {
    const v = this.camera.view;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const { player } of this.placed) {
      const x = player.seat.x;
      const g = ctx.createLinearGradient(0, v.y0, 0, player.seat.y);
      g.addColorStop(0, "rgba(255, 200, 130, 0.0)");
      g.addColorStop(1, "rgba(255, 200, 130, 0.07)");
      ctx.fillStyle = g;
      ctx.fill(poly([{ x: x - 8, y: v.y0 }, { x: x + 8, y: v.y0 }, { x: x + 26, y: player.seat.y }, { x: x - 26, y: player.seat.y }]));
    }
    ctx.restore();
  }

  regions(): Region[] {
    return this.placed.map(({ player }) => {
      const { seat, box } = player;
      const floor = player.floor;
      return this.region(player.ids, player.label, seat.x + box.x0 * seat.scale, seat.y + (box.y0 - floor) * seat.scale, seat.x + box.x1 * seat.scale, seat.y + (box.y1 - floor) * seat.scale);
    });
  }
}

