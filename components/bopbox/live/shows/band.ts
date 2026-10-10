import { cast, type Role } from "@/lib/music/perform/cast";
import type { Performance, TrackCues } from "@/lib/music/perform/cues";
import type { Look } from "../figure";
import { castLook, type Wardrobe } from "../looks";
import { hash, seededRandom, type Painter } from "../paint";
import { drawSeated, type Player, type Seat } from "../players";
import { playerFor, widthOf } from "../roster";
import { Scene, type FrameInfo, type Region, type World } from "../stage";

/*
 * A band on a stage: soloists and strings up front, drums and keyboards on
 * a riser behind. Each venue (pop stage, jazz club, dangdut stage) paints
 * its own room and light and says who stands where; the band, the drawing
 * order and the click targets are shared here.
 */

export type Slot = { row: 0 | 1; order: number };

/** A place on the stage and how to make the player who takes it. */
export type Booking = { slot: Slot; width: number; make: (seat: Seat) => Player | undefined };

const RISER = -42;
const BACK_SCALE = 0.84;
/** Band players stand further apart than an orchestra's, so each one reads. */
const SPREAD = 1.3;

export abstract class BandStage extends Scene {
  protected players: Player[] = [];
  protected abstract readonly wardrobe: Wardrobe;
  /** A grand piano for the pianist (a jazz club) rather than a stage keyboard. */
  protected readonly grand: boolean = false;
  /** Where a track's player stands; undefined leaves it off the stage. */
  protected abstract slot(cues: TrackCues, role: Role): Slot | undefined;
  /** The venue's own players for tracks it treats specially, and the track ids they take. */
  protected special?(perf: Performance, look: (id: string) => Look): { bookings: Booking[]; claimed: Set<string> };
  /** Lights, beams and sparkle drawn behind the band. */
  protected effects?(p: Painter, frame: FrameInfo): void;

  protected book(perf: Performance) {
    const look = (id: string) => castLook(hash(`${perf.arrangement.songId}/${this.constructor.name}/${id}`), this.wardrobe);
    const { bookings, claimed } = this.special?.(perf, look) ?? { bookings: [], claimed: new Set<string>() };
    for (const cues of perf.tracks) {
      if (claimed.has(cues.track.id)) continue;
      const role = cast(cues.track).role;
      const slot = this.slot(cues, role);
      if (slot) bookings.push({ slot, width: widthOf(role), make: (seat) => playerFor([cues], look(cues.track.id), seat, { kind: "band", grand: this.grand }) });
    }
    for (const row of [0, 1] as const) {
      const inRow = bookings.filter((b) => b.slot.row === row).sort((a, b) => a.slot.order - b.slot.order);
      // The riser is wider than the front line, so the players on it show between and beside those in front.
      const spread = row ? SPREAD * 1.3 : SPREAD;
      const width = inRow.reduce((w, b) => w + b.width * spread, 0);
      let x = -width / 2;
      for (const booking of inRow) {
        const step = booking.width * spread;
        const cx = x + step / 2;
        // Players turn a little in towards the middle of the stage; a grand on the left is drawn mirrored to face in.
        const seat: Seat = { x: cx, y: row ? RISER : 0, scale: row ? BACK_SCALE : 1, face: Math.max(-0.4, Math.min(0.4, -cx / 220)), phase: seededRandom(hash(`${row}/${cx}`))(), mirror: booking.width >= 100 && cx < 0 };
        const player = booking.make(seat);
        if (player) this.players.push(player);
        x += step;
      }
    }
  }

  /** The riser the back line stands on: its top and its front face, as wide as the line. */
  protected paintRiser(ctx: CanvasRenderingContext2D, top: string, face: string) {
    const back = this.players.filter((p) => p.seat.y === RISER).map((p) => p.seat.x);
    if (!back.length) return;
    const x0 = Math.min(...back) - 50;
    const x1 = Math.max(...back) + 50;
    ctx.fillStyle = top;
    ctx.fillRect(x0, RISER - 4, x1 - x0, 6);
    ctx.fillStyle = face;
    ctx.fillRect(x0, RISER + 2, x1 - x0, -RISER - 6);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x0, RISER + 2, x1 - x0, 1.2);
  }

  protected world(): World {
    const xs = this.players.map((p) => p.seat.x);
    return { x0: Math.min(-100, ...xs) - 60, x1: Math.max(100, ...xs) + 60, y0: -150, y1: 20 };
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    this.effects?.(p, frame);
    for (const player of [...this.players].sort((a, b) => a.seat.y - b.seat.y)) {
      const muted = player.ids.every((id) => frame.muted.has(id));
      p.contactShadow(player.seat.x, player.seat.y + 1, 26 * player.seat.scale, 4 * player.seat.scale, "#000000", frame.theme === "dark" ? 0.45 : 0.25);
      const before = p.ctx.globalAlpha;
      if (muted) p.ctx.globalAlpha = 0.45;
      drawSeated(p, player, frame, muted, player.floor);
      p.ctx.globalAlpha = before;
    }
  }

  regions(): Region[] {
    return this.players.map((player) => {
      const { seat, floor } = player;
      const box = seat.mirror ? { ...player.box, x0: -player.box.x1, x1: -player.box.x0 } : player.box;
      return this.region(player.ids, player.label, seat.x + box.x0 * seat.scale, seat.y + (box.y0 - floor) * seat.scale, seat.x + box.x1 * seat.scale, seat.y + (box.y1 - floor) * seat.scale);
    });
  }
}
