import { strike, type Lane, type TrackCues } from "@/lib/music/perform/cues";
import { splitMallets } from "@/lib/music/perform/hands";
import { Figure, type Look } from "../figure";
import { add, blob, clamp, curve, ellipse, lerp, poly, pt, type Painter, type Pt } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { SEATED_FLOOR } from "./strings";

/*
 * The concert harp, seen from the audience with its strings facing us: the
 * column at the far side, the soundboard leaning back on the player's right
 * shoulder, the curved neck across the top. Treble strings are the short
 * ones by the shoulder, bass the long ones by the column. Each hand plucks
 * the string for its note, and the string shivers after it.
 */

const GOLD = "#d9b05a";
const GOLD_LIT = "#ffe6a0";
const WOOD = "#8a4f26";

const STRINGS = 36;
const BOARD_FOOT = pt(40, 26);
const BOARD_TOP = pt(4, -44);
const COLUMN = pt(46, -96);

export class Harpist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -26, y0: -100, x1: 52, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
  private fig?: Figure;
  private hands: { left: Lane; right: Lane };
  private all: Lane;
  private lo: number;
  private hi: number;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.all = cues.lane;
    this.hands = splitMallets(cues.lane, cues.lo, cues.hi);
    this.lo = Math.min(cues.lo, 36);
    this.hi = Math.max(cues.hi, this.lo + 40);
  }

  /** String i (0 treble by the shoulder, the last bass by the column): its foot on the soundboard and its top under the neck. */
  private string(i: number): [Pt, Pt] {
    const u = i / (STRINGS - 1);
    const foot = lerp(BOARD_TOP, BOARD_FOOT, u);
    return [foot, pt(foot.x, -50 - u * 42 + Math.sin(u * Math.PI) * 6)];
  }

  private stringFor(pitch: number) {
    return Math.round((1 - clamp((pitch - this.lo) / (this.hi - this.lo))) * (STRINGS - 1));
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const playing = !muted;
    const pluckAt = (lane: Lane, rest: number) => {
      const s = playing ? strike(lane, t, { rebound: 0.1, prep: 0.12, fullGap: 0.5, rest: 0.4 }) : { lift: 0.5, travel: 0, prev: undefined, next: undefined };
      const a = s.prev ? this.stringFor(s.prev.pitch) : rest;
      const b = s.next ?? s.prev ? this.stringFor((s.next ?? s.prev)!.pitch) : a;
      const [foot, top] = this.string(Math.round(a + (b - a) * s.travel));
      // Fingers close on the string, then the hand opens away from it.
      return add(lerp(foot, top, 0.55), pt(-2 - s.lift * 5, s.lift * 2));
    };
    const left = pluckAt(this.hands.left, 24);
    const right = pluckAt(this.hands.right, 8);
    fig.set({
      lean: 0.12,
      face: 0.35,
      pelvis: pt(-14, 0),
      head: { tilt: 0.1, nod: 0.2, eyes: blinking(wall, this.seat.phase) ? "closed" : "half", mouth: 0 },
      arms: { left: { hand: left, elbow: "down", grip: "open" }, right: { hand: right, elbow: "down", grip: "open" } },
      legs: { left: { knee: pt(-2, 2), foot: pt(0, 31), toe: 0.4 }, right: { knee: pt(-20, 3), foot: pt(-18, 31), toe: 0.2 } },
      breath: (Math.sin(wall * 1.2) + 1) / 2,
    });
    p.part(blob([pt(-28, 1), pt(-2, 1), pt(-1, 5), pt(-29, 5)], 0.5), "#141018");
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("right");
    this.harp(p, t, playing);
    fig.arm("left");
  }

  private harp(p: Painter, t: number, playing: boolean) {
    // The column, its crown, the base and the soundboard.
    p.part(blob([pt(COLUMN.x - 2.6, COLUMN.y + 4), pt(COLUMN.x + 2.6, COLUMN.y + 4), pt(BOARD_FOOT.x + 8, BOARD_FOOT.y), pt(BOARD_FOOT.x + 3, BOARD_FOOT.y)], 0.4), GOLD);
    p.part(ellipse(COLUMN.x, COLUMN.y, 4.4, 4), GOLD_LIT, { inkScale: 0.7 });
    p.part(poly([pt(BOARD_FOOT.x - 8, SEATED_FLOOR - 4), pt(BOARD_FOOT.x + 12, SEATED_FLOOR - 4), pt(BOARD_FOOT.x + 12, SEATED_FLOOR), pt(BOARD_FOOT.x - 8, SEATED_FLOOR)]), GOLD);
    p.part(blob([add(BOARD_TOP, pt(-3, -2)), add(BOARD_TOP, pt(3, -3)), add(BOARD_FOOT, pt(5, 2)), add(BOARD_FOOT, pt(-4, 3))], 0.5), WOOD);
    // Strings: every C red and every F dark blue, the way harpists mark them.
    const shaking = new Map<number, number>();
    if (playing) for (const hit of this.all.sounding(t)) shaking.set(this.stringFor(hit.pitch), Math.exp(-(t - hit.t) / 0.5));
    for (let i = 0; i < STRINGS; i++) {
      const [foot, top] = this.string(i);
      const amp = shaking.get(i) ?? 0;
      const mid = add(lerp(foot, top, 0.5), pt(Math.sin(t * 90 + i) * amp * 0.7, 0));
      const color = i % 7 === 0 ? "#c8402a" : i % 7 === 3 ? "#2a3a7a" : "#efe6d2";
      p.line(curve([foot, mid, top]), color, 0.32, 0.95);
    }
    // The neck, sweeping from the shoulder up to the column's crown.
    const neck = [add(BOARD_TOP, pt(-2, -6)), pt(14, -60), pt(30, -84), add(COLUMN, pt(0, 2))];
    p.line(curve(neck), GOLD, 4);
    p.line(curve(neck.map((q) => add(q, pt(0, -1.4)))), GOLD_LIT, 1, 0.6);
  }
}
