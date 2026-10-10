import { Lane, pulse, strike, type TrackCues } from "@/lib/music/perform/cues";
import { kitPiece, pieceOf, type KitHit } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import { Figure, type Look, type Pose } from "../figure";
import { add, blob, capsule, clamp, curve, ellipse, lerp, pt, type Painter, type Pt } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";

/*
 * The gendang player, the heart of a dangdut band. The big kendang lies
 * across the lap, its large head to the player's right; the right palm
 * slaps it for the deep "dhut" and stays on the skin, the heel of the hand
 * pressing in, while the note sags in pitch (the arrangement bends every
 * dhut down the same way). The little ketipung stands by the left knee: an
 * open "tung" lets the fingers bounce off, a damped "tak" keeps them on the
 * skin. The tambourine part goes to a second player with a jingle ring.
 */

export const STOOL_FLOOR = 27;

const WOOD = "#8a4a22";
const WOOD_LIT = "#c47a3e";
const SKIN = "#efdcb4";
const LACE = "#e9cf94";

const OPEN = new Set(["congaOpen", "congaLow", "bongoLow"]);

/** The kendang's big head (centre) and the ketipung's top (centre), in the player's model space. */
const BIG_HEAD = pt(-23, -2);
const KETIPUNG_TOP = pt(29, -13);

export class GendangPlayer implements Player {
  readonly ids: string[];
  readonly label = "Gendang: kendang and ketipung";
  readonly seat: Seat;
  readonly box: Box = { x0: -42, y0: -82, x1: 44, y1: STOOL_FLOOR };
  readonly floor = STOOL_FLOOR;
  private fig?: Figure;
  private dhut: Lane;
  private ketipung: Lane;

  constructor(
    dhut: TrackCues,
    ketipung: TrackCues | undefined,
    private look: Look,
    seat: Seat,
  ) {
    this.ids = [dhut.track.id, ...(ketipung ? [ketipung.track.id] : [])];
    this.seat = seat;
    this.dhut = dhut.lane;
    const hand = ketipung ? ketipung.lane.hits.flatMap((h) => {
      const piece = kitPiece(h.pitch);
      return piece && piece !== "tambourine" && piece !== "splash" ? [{ ...h, piece } as KitHit] : [];
    }) : [];
    this.ketipung = new Lane(hand);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const ph = this.seat.phase;
    const playing = !muted;

    // Right hand: the dhut. On the skin from the slap until the note dies, pressing in.
    const big = strike(this.dhut, t, { rebound: 0.1, prep: 0.12, fullGap: 0.45, rest: 0.55 });
    const held = playing && big.prev && t < big.prev.end ? clamp((t - big.prev.t) / 0.09) : 0;
    const bigLift = playing ? (held > 0 ? 0 : big.lift) : 0.7;
    const rightHand = add(lerp(BIG_HEAD, pt(-36, -16), bigLift), pt(-3 + held * 1.6, 1 - held * 1.2));

    // Left hand: the ketipung, fingers bouncing off an open stroke, staying down on a damped one.
    const small = strike(this.ketipung, t, { rebound: 0.08, prep: 0.1, fullGap: 0.35, rest: 0.6 });
    const damped = small.prev && !OPEN.has(pieceOf(small.prev) ?? "") && small.since < 0.12;
    const smallLift = playing ? (damped ? 0 : small.lift) : 0.8;
    const edge = small.next && pieceOf(small.next) === "bongoHigh" ? 4 : 0;
    const leftHand = add(KETIPUNG_TOP, pt(-1 + edge - smallLift * 2, -3 - smallLift * 12));

    // The whole body rides the groove: a bounce on every beat, a nod on the offbeat.
    const groove = playing ? Math.abs(Math.sin(beat * Math.PI)) : 0;
    const pose: Pose = {
      lean: 0.06 + Math.sin(beat * Math.PI * 0.5) * (playing ? 0.025 : 0),
      face: this.seat.face,
      pelvis: pt(0, -groove * 0.8),
      head: {
        tilt: -0.08 + Math.sin(beat * Math.PI * 0.5 + ph) * (playing ? 0.07 : 0.02),
        nod: playing ? 0.35 + groove * 0.5 : 0.1,
        eyes: blinking(wall, ph) ? "closed" : playing && frame.beat % 8 > 6 ? "closed" : "open",
        mouth: 0,
        brows: playing ? 0.2 : 0,
      },
      arms: {
        right: { hand: add(rightHand, pt(-2, 2)), elbow: "out", grip: "flat", angle: held > 0 ? -0.2 : 0.35 },
        left: { hand: add(leftHand, pt(1, -1)), elbow: "out", grip: damped ? "flat" : "open", angle: 1.35 },
      },
      legs: {
        left: { knee: pt(15, -3), foot: pt(17, 25), toe: 0.4 },
        right: { knee: pt(-15, -3), foot: pt(-17, 25), toe: -0.4 },
      },
      breath: (Math.sin(wall * 1.4 + ph * 4) + 1) / 2,
    };
    fig.set(pose);

    this.stool(p);
    fig.legs();
    this.ketipungDrum(p, playing ? pulse(this.ketipung, t, 0.12) : 0);
    fig.torso();
    fig.head();
    this.kendang(p, playing ? pulse(this.dhut, t, 0.2) : 0, held);
    fig.arm("left");
    fig.arm("right");
  }

  private stool(p: Painter) {
    const wood = "#3a2418";
    p.part(capsule(pt(-11, 5), pt(-13, STOOL_FLOOR), 1.3, 1.3), wood, { rim: false });
    p.part(capsule(pt(11, 5), pt(13, STOOL_FLOOR), 1.3, 1.3), wood, { rim: false });
    p.part(blob([pt(-14, 2), pt(14, 2), pt(14.5, 6), pt(-14.5, 6)], 0.5), mix(wood, "#000000", 0.1));
  }

  /** The kendang across the lap: a barrel of jackfruit wood laced head to head with leather. */
  private kendang(p: Painter, ring: number, press: number) {
    const bigR = 11;
    const smallR = 8;
    const smallC = pt(17, 2);
    const top = [add(BIG_HEAD, pt(0, -bigR)), pt(-10, -12.6), pt(4, -11.4), add(smallC, pt(0, -smallR))];
    const bottom = [add(smallC, pt(0, smallR)), pt(4, 13.8), pt(-10, 13.4), add(BIG_HEAD, pt(0, bigR))];
    const body = blob([...top, ...bottom], 0.7);
    p.part(body, WOOD);
    const g = p.ctx.createLinearGradient(0, -12, 0, 13);
    g.addColorStop(0, WOOD_LIT);
    g.addColorStop(0.45, "rgba(196,122,62,0)");
    p.flat(body, g, 0.8);
    // Leather lacing zig-zags from rim to rim.
    const lace = new Path2D();
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const a = Math.PI * (0.12 + u * 0.76);
      const bigRim = add(BIG_HEAD, pt(Math.cos(a) * 3, -Math.cos(Math.PI * u) * bigR * 0.96));
      const smallRim = add(smallC, pt(Math.cos(a) * 2, -Math.cos(Math.PI * (u + 0.05)) * smallR * 0.96));
      if (i % 2) {
        lace.moveTo(bigRim.x, bigRim.y);
        lace.lineTo(smallRim.x, smallRim.y);
      } else {
        lace.moveTo(smallRim.x, smallRim.y);
        lace.lineTo(bigRim.x + 1, bigRim.y);
      }
    }
    p.line(lace, LACE, 0.55, 0.85);
    // Rings binding the lacing round the waist of the drum.
    for (let i = 0; i < 5; i++) p.line(curve([pt(-6 + i * 2.2, -11.6), pt(-5.6 + i * 2.2, 0.8), pt(-6 + i * 2.2, 13.2)]), mix(LACE, "#000000", 0.25), 0.9, 0.7);
    // The small head on the far end, the big head towards the right hand.
    p.part(ellipse(smallC.x + 1.5, smallC.y, 2.6, smallR), SKIN);
    p.part(ellipse(BIG_HEAD.x, BIG_HEAD.y, 3.8 + press * 0.4, bigR), SKIN);
    if (ring > 0.05) p.line(ellipse(BIG_HEAD.x - 1.5, BIG_HEAD.y, 2.6 + ring * 2, bigR * (0.5 + ring * 0.4)), "#ffffff", 0.5, ring * 0.7);
  }

  /** The ketipung by the left knee, tilted so its head faces the player. */
  private ketipungDrum(p: Painter, ring: number) {
    const c = KETIPUNG_TOP;
    const body = blob([add(c, pt(-7, 0)), add(c, pt(-6.2, 10)), add(c, pt(-4.6, 22)), add(c, pt(4.6, 22)), add(c, pt(6.2, 10)), add(c, pt(7, 0))], 0.7);
    p.part(body, WOOD);
    // Lacing in a run of narrow Vs, gathered by a ring near the foot.
    const lace = new Path2D();
    for (let i = 0; i < 7; i++) {
      const x = -6 + i * 2;
      lace.moveTo(c.x + x, c.y + 2.6);
      lace.lineTo(c.x + x * 0.7 + 0.7, c.y + 17);
      lace.lineTo(c.x + x + 2, c.y + 2.6);
    }
    p.line(lace, LACE, 0.45, 0.75);
    p.line(curve([add(c, pt(-5.2, 17)), add(c, pt(0, 18)), add(c, pt(5.2, 17))]), mix(LACE, "#000000", 0.2), 1.2, 0.8);
    p.part(ellipse(c.x, c.y, 7, 2.8), SKIN);
    if (ring > 0.05) p.line(ellipse(c.x, c.y, 3 + ring * 3.5, 1 + ring * 1.4), "#ffffff", 0.45, ring * 0.8);
  }
}

/** The tambourine player: a ring of jingles struck against the palm, shaken on the offbeats. */
export class TambourinePlayer implements Player {
  readonly ids: string[];
  readonly label = "Tambourine";
  readonly seat: Seat;
  readonly box: Box = { x0: -24, y0: -86, x1: 26, y1: 38 };
  readonly floor = 37.5;
  private fig?: Figure;
  private lane: Lane;

  constructor(
    track: TrackCues,
    private look: Look,
    seat: Seat,
  ) {
    this.ids = [track.track.id];
    this.seat = seat;
    this.lane = new Lane(track.lane.hits.filter((h) => kitPiece(h.pitch) === "tambourine"));
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const playing = !muted;
    const s = strike(this.lane, t, { rebound: 0.07, prep: 0.09, fullGap: 0.3, rest: 0.5 });
    const lift = playing ? s.lift : 0.6;
    const ring: Pt = pt(15, -40 + lift * -6);
    const groove = playing ? Math.abs(Math.sin(beat * Math.PI)) : 0;
    fig.set({
      lean: Math.sin(beat * Math.PI * 0.5) * (playing ? 0.05 : 0),
      face: this.seat.face,
      pelvis: pt(Math.sin(beat * Math.PI) * (playing ? 1.5 : 0), -groove),
      head: { tilt: Math.sin(beat * Math.PI * 0.5) * 0.08, nod: 0.2 + groove * 0.3, eyes: blinking(wall, this.seat.phase) ? "closed" : "open", mouth: playing ? 0.1 : 0 },
      arms: {
        left: { hand: add(ring, pt(3, 3)), elbow: "out", grip: "fist" },
        right: { hand: add(ring, pt(-9, 5 + lift * 8)), elbow: "down", grip: "flat", angle: -0.2 },
      },
      legs: { left: { foot: pt(9, 37), toe: 0.3 }, right: { foot: pt(-9, 37), toe: -0.3 } },
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("right", { hand: false });
    // The frame and its pairs of jingles, quivering after each strike.
    const shake = playing ? pulse(this.lane, t, 0.15) : 0;
    const at = fig.grip("left", 2);
    const centre = pt(at.x + 5, at.y - 5);
    p.part(ellipse(centre.x, centre.y, 12, 8.5, -0.35), "#c98a3c");
    p.part(ellipse(centre.x, centre.y, 10, 6.8, -0.35), "#f2e4c4", { ink: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = { x: Math.cos(a) * 11, y: Math.sin(a) * 7.7 };
      const tilt = -0.35;
      const j = pt(centre.x + r.x * Math.cos(tilt) - r.y * Math.sin(tilt) + Math.sin(wall * 60 + i) * shake, centre.y + r.x * Math.sin(tilt) + r.y * Math.cos(tilt));
      p.part(ellipse(j.x, j.y, 2.2, 1.2, a), "#ece6d8", { rim: false, inkScale: 0.6 });
    }
    fig.arm("left");
    fig.hand("right");
  }
}
