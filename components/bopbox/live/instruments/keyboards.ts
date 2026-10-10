import { Lane, type TrackCues } from "@/lib/music/perform/cues";
import { handAt, planHand, type HandNow, type HandPlan } from "@/lib/music/perform/fingering";
import { splitKeys } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import { Figure, type Look } from "../figure";
import { add, blob, clamp, ellipse, lerp, poly, pt, roundRect, type Painter, type Pt } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { seatedLegs, SEATED_FLOOR } from "./strings";

/*
 * Keyboard players in a band. A pianist at a grand is seen from the
 * audience's left, turned towards the keys: the keyboard runs away from us
 * on a slant, treble nearest, and each hand slides along it to the notes it
 * plays (planned by `planHand`, so a hand stays put while the notes fit
 * under it). A keyboardist at a stage keyboard faces the audience across
 * it, so the low notes are on the player's left, our right.
 *
 * One player can carry two tracks: the Original Score writes some piano
 * parts as a right-hand and a left-hand track.
 */

const KEY_STEP = 0.62;
const LACQUER = "#121016";
const LACQUER_LIT = "#5a5466";

type Hands = { left: HandPlan; right: HandPlan };

/** Shares one or two tracks between the hands: a "left hand" track goes left, the rest are split by register. */
function handsFor(tracks: TrackCues[], keyU: (pitch: number) => number): Hands {
  const left: Lane["hits"] = [];
  const right: Lane["hits"] = [];
  for (const cues of tracks) {
    if (/left hand/i.test(cues.track.name)) left.push(...cues.lane.hits);
    else if (/right hand/i.test(cues.track.name) || tracks.length > 1) right.push(...cues.lane.hits);
    else {
      const split = splitKeys(cues.lane, { melodyOnly: cues.track.role === "melody" });
      left.push(...split.left.hits);
      right.push(...split.right.hits);
    }
  }
  return { left: planHand(new Lane(left), keyU, KEY_STEP, keyU(48)), right: planHand(new Lane(right), keyU, KEY_STEP, keyU(67)) };
}

const playingNow = (hand: HandNow, t: number) => hand.down.length > 0 || (!!hand.next && hand.next.t - t < 2.5);

/** A pianist at a grand piano, lid up, seen from the audience's left. */
export class GrandPianist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -24, y0: -86, x1: 78, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
  private fig?: Figure;
  private hands: Hands;

  constructor(
    tracks: TrackCues[],
    private look: Look,
    seat: Seat,
  ) {
    this.ids = tracks.map((c) => c.track.id);
    this.label = tracks.length > 1 ? "Piano" : tracks[0].track.name;
    this.seat = seat;
    this.hands = handsFor(tracks, (p) => (p - 21) * KEY_STEP);
  }

  /** A key on the slanted keyboard: bass far up the slant, treble near the player's right. */
  private key(u: number): Pt {
    const k = clamp(u / ((108 - 21) * KEY_STEP));
    return lerp(pt(26, -22), pt(8, -9), k);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const shape = { rebound: 0.08, prep: 0.1, fullGap: 0.5, rest: 0.5 };
    const right = handAt(this.hands.right, t, shape);
    const left = handAt(this.hands.left, t, shape);
    const reach = (hand: HandNow, rest: Pt) => (!muted && playingNow(hand, t) ? add(this.key(hand.centre), pt(-2, -2 - hand.lift * 4)) : rest);
    const r = reach(right, pt(4, -8));
    const l = reach(left, pt(6, -10));
    fig.set({
      lean: 0.14 + (muted ? 0 : Math.sin(wall * 0.8 + this.seat.phase) * 0.02),
      face: 0.62,
      head: { tilt: 0.05, nod: 0.35, eyes: blinking(wall, this.seat.phase) ? "closed" : "half", mouth: 0 },
      arms: { left: { hand: l, elbow: "down", grip: "relaxed" }, right: { hand: r, elbow: "down", grip: "relaxed" } },
      legs: seatedLegs(0.62),
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    // Bench, the far arm, the body, then the piano, then the near arm over the keys.
    p.part(roundRect(-14, 1, 28, 4, 1.4), LACQUER);
    fig.arm("left");
    fig.legs();
    fig.torso();
    fig.head();
    this.piano(p, muted ? [] : [...right.down, ...left.down].map((d) => d.x));
    fig.arm("right");
  }

  private piano(p: Painter, pressed: number[]) {
    // The case: a long black body with its curved tail, on three legs; the lid propped open above it.
    p.part(poly([pt(26, -26), pt(78, -34), pt(80, -46), pt(30, -60)]), LACQUER, { shade: false });
    p.line(poly([pt(30, -59), pt(78, -45)]), LACQUER_LIT, 0.6, 0.6);
    p.line(poly([pt(58, -30), pt(60, -50)]), LACQUER, 0.8);
    p.part(blob([pt(6, -12), pt(26, -26), pt(60, -32), pt(82, -28), pt(84, -18), pt(64, -10), pt(20, -2)], 0.6), LACQUER);
    for (const x of [14, 46, 74]) p.part(roundRect(x - 1.6, -8, 3.2, SEATED_FLOOR + 8, 1), LACQUER, { rim: false });
    p.line(poly([pt(20, -2.6), pt(64, -10.6)]), LACQUER_LIT, 0.5, 0.5);
    // Music desk with a page.
    p.part(poly([pt(16, -30), pt(30, -36), pt(30, -27), pt(16, -21)]), LACQUER, { inkScale: 0.6 });
    p.part(poly([pt(18, -28.5), pt(27, -32.5), pt(27, -27.5), pt(18, -23.5)]), "#f4eee2", { rim: false, inkScale: 0.4 });
    // The keyboard on its slant: a white band with black keys over it, pressed keys darker.
    p.part(poly([pt(7, -8), pt(26, -21), pt(28, -20), pt(9, -6.6)]), "#f4efe4", { inkScale: 0.6 });
    for (let i = 0; i < 26; i++) {
      if ([2, 6, 9, 13, 16, 20, 23].includes(i)) continue;
      const a = lerp(pt(7.6, -7.6), pt(26, -20.6), i / 26);
      p.part(poly([a, add(a, pt(0.5, -0.3)), add(a, pt(1.4, 0.6)), add(a, pt(0.9, 0.9))]), LACQUER, { shade: false, rim: false, ink: false });
    }
    for (const x of pressed) {
      const k = this.key(x);
      p.flat(ellipse(k.x + 1, k.y + 0.6, 1.2, 0.5), "#c9b9a0", 0.9);
    }
  }
}

/** A keyboardist standing at a stage keyboard on an X stand, facing the audience. */
export class Keyboardist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -36, y0: -84, x1: 36, y1: 37.5 };
  readonly floor = 37.5;
  private fig?: Figure;
  private hands: Hands;
  private lo: number;
  private hi: number;

  constructor(
    tracks: TrackCues[],
    private look: Look,
    seat: Seat,
    private model: "stage" | "synth" | "organ" = "stage",
  ) {
    this.ids = tracks.map((c) => c.track.id);
    this.label = tracks.map((c) => c.track.name).join(" and ");
    this.seat = seat;
    this.lo = Math.min(...tracks.map((c) => c.lo));
    this.hi = Math.max(...tracks.map((c) => c.hi));
    this.hands = handsFor(tracks, (p) => p * KEY_STEP);
  }

  /** Seen from the audience, the low end is on the player's left: our right. */
  private keyX(u: number) {
    const lo = Math.min(this.lo, 48) * KEY_STEP;
    const hi = Math.max(this.hi, 84) * KEY_STEP;
    return 26 - ((u - lo) / (hi - lo)) * 52;
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const shape = { rebound: 0.07, prep: 0.09, fullGap: 0.4, rest: 0.5 };
    const right = handAt(this.hands.right, t, shape);
    const left = handAt(this.hands.left, t, shape);
    const reach = (hand: HandNow, rest: Pt) => (!muted && playingNow(hand, t) ? pt(this.keyX(hand.centre), -5 - hand.lift * 4) : rest);
    const groove = muted ? 0 : Math.abs(Math.sin(beat * Math.PI));
    fig.set({
      lean: 0.06 + Math.sin(beat * Math.PI * 0.5) * (muted ? 0 : 0.03),
      face: this.seat.face * 0.5,
      pelvis: pt(0, -groove),
      head: { tilt: Math.sin(beat * Math.PI * 0.5) * 0.05, nod: 0.3 + groove * 0.3, eyes: blinking(wall, this.seat.phase) ? "closed" : "open", mouth: 0 },
      arms: { left: { hand: reach(left, pt(-14, -3)), elbow: "out", grip: "flat", depth: 0.4 }, right: { hand: reach(right, pt(14, -3)), elbow: "out", grip: "flat", depth: 0.4 } },
      legs: { left: { foot: pt(9, 37) }, right: { foot: pt(-9, 37) } },
      breath: (Math.sin(wall * 1.4) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("left", { hand: false });
    fig.arm("right", { hand: false });
    fig.hand("left");
    fig.hand("right");
    this.keyboard(p, frame, muted);
  }

  private keyboard(p: Painter, frame: FrameInfo, muted: boolean) {
    const body = this.model === "organ" ? "#6a2a1e" : this.model === "synth" ? "#22222c" : "#2a2a30";
    // X stand.
    p.line(poly([pt(-18, 0), pt(16, 37)]), "#3a3a44", 1.2);
    p.line(poly([pt(18, 0), pt(-16, 37)]), "#3a3a44", 1.2);
    // The back of the keyboard faces us; its keys show over the top edge.
    p.part(roundRect(-30, -6, 60, 3, 1), "#f2ede2", { inkScale: 0.6 });
    p.part(roundRect(-31, -3.6, 62, 6, 1.6), body);
    if (this.model === "synth") {
      // A little screen and a row of lights that follow the music.
      p.part(roundRect(-6, -2, 12, 3, 0.6), "#1a3a4a", { rim: false, inkScale: 0.4 });
      for (let i = 0; i < 8; i++) {
        const on = !muted && (Math.floor(frame.beat * 2) % 8 === i);
        p.part(ellipse(-24 + i * 2.4, -0.6, 0.6, 0.6), on ? "#5cf2ff" : "#2a3a44", { rim: false, ink: false });
      }
    }
    p.line(poly([pt(-29, 2.2), pt(29, 2.2)]), mix(body, "#ffffff", 0.2), 0.4, 0.6);
  }
}
