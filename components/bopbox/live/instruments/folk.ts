import { pulse, strike, type Hit, type Lane, type TrackCues } from "@/lib/music/perform/cues";
import { Figure, type Look } from "../figure";
import { add, blob, capsule, clamp, curve, ellipse, lerp, poly, pt, roundRect, type Painter } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { seatedLegs, SEATED_FLOOR } from "./strings";

/*
 * The instruments with one player and their own way of moving: the
 * accordion's bellows, the koto's thirteen strings, the kalimba's tines,
 * the music box's crank, and the metronome that keeps time for Scales.
 */

/** Phrases: runs of notes with no rest longer than this many seconds. */
const PHRASE_GAP = 0.35;

function phraseOf(lane: Lane, t: number) {
  const hits = lane.hits;
  const i = Math.max(0, lane.lastIndex(t));
  let start = i;
  while (start > 0 && hits[start].t - hits[start - 1].end < PHRASE_GAP) start--;
  let end = i;
  while (end + 1 < hits.length && hits[end + 1].t - hits[end].end < PHRASE_GAP) end++;
  // Phrase number: count phrase starts before this one.
  let number = 0;
  for (let k = 1; k <= start; k++) if (hits[k].t - hits[k - 1].end >= PHRASE_GAP) number++;
  return { number, from: hits[start]?.t ?? 0, to: hits[end]?.end ?? 1 };
}

/** An accordionist: bellows pulled open through one phrase and pushed closed through the next. */
export class Accordionist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -34, y0: -84, x1: 34, y1: 37.5 };
  readonly floor = 37.5;
  private fig?: Figure;
  private lane: Lane;
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
    this.lane = cues.lane;
    this.lo = cues.lo;
    this.hi = cues.hi;
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const playing = !muted;
    const phrase = phraseOf(this.lane, t);
    const u = clamp((t - phrase.from) / Math.max(0.2, phrase.to - phrase.from));
    const open = playing ? (phrase.number % 2 === 0 ? 0.25 + u * 0.6 : 0.85 - u * 0.6) : 0.3;
    const sounding = playing ? this.lane.sounding(t).sort((a, b) => b.pitch - a.pitch)[0] : undefined;
    // The treble keyboard runs down the right side, low notes at the top.
    const keyY = (pitch: number) => -38 + clamp((pitch - this.lo) / Math.max(1, this.hi - this.lo)) * 22;
    const s = playing ? strike(this.lane, t, { rebound: 0.06, prep: 0.08, fullGap: 0.3, rest: 0.4 }) : { lift: 0.5 };
    const keyHand = pt(-13 - s.lift * 2, keyY(sounding?.pitch ?? this.lane.around(t).next?.pitch ?? this.lo) + 2);
    const bellowsX = 4 + open * 14;
    const groove = playing ? Math.abs(Math.sin(beat * Math.PI)) : 0;
    fig.set({
      lean: -0.04 + (open - 0.5) * 0.06,
      face: this.seat.face,
      pelvis: pt(0, -groove * 0.8),
      head: { tilt: 0.12 + Math.sin(beat * Math.PI * 0.5) * 0.04, nod: 0.3, eyes: blinking(wall, this.seat.phase) ? "closed" : "half", mouth: 0 },
      arms: { right: { hand: keyHand, elbow: "out", grip: "point" }, left: { hand: pt(bellowsX + 7, -26), elbow: "out", grip: "flat" } },
      legs: { left: { foot: pt(9, 37) }, right: { foot: pt(-9, 37) } },
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("left", { hand: false });
    // Treble side with its keys, the pleated bellows, the bass side with its buttons.
    p.part(roundRect(-18, -42, 10, 30, 1.6), "#b8202e");
    for (let i = 0; i < 9; i++) {
      p.part(roundRect(-17, -40 + i * 2.9, 5, 2.4, 0.4), "#f4efe4", { rim: false, inkScale: 0.4 });
    }
    if (sounding) p.flat(roundRect(-17, keyY(sounding.pitch) - 1, 5, 2.4, 0.4), "#c9b9a0", 0.9);
    const folds = 7;
    for (let i = 0; i < folds; i++) {
      const x0 = -8 + (i / folds) * (bellowsX + 8);
      const x1 = -8 + ((i + 1) / folds) * (bellowsX + 8);
      p.part(poly([pt(x0, -42), pt(x1, -43), pt(x1, -11), pt(x0, -12)]), i % 2 ? "#2a2a34" : "#e8e2d4", { inkScale: 0.5, rim: false });
    }
    p.part(roundRect(bellowsX, -42, 9, 30, 1.6), "#b8202e");
    for (let i = 0; i < 12; i++) p.part(ellipse(bellowsX + 3 + (i % 2) * 3, -38 + Math.floor(i / 2) * 4.4, 0.9, 0.9), "#f4efe4", { rim: false, inkScale: 0.4 });
    fig.hand("left");
    fig.arm("right");
  }
}

/** A koto player kneeling behind the long zither: the right hand plucks each note's string, the left presses beyond the bridges. */
export class KotoPlayer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -60, y0: -70, x1: 60, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
  private fig?: Figure;
  private lane: Lane;
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
    this.lane = cues.lane;
    this.lo = cues.lo;
    this.hi = Math.max(cues.hi, cues.lo + 12);
  }

  /** String n (0 farthest, low; 12 nearest, high) across the koto's face. */
  private stringY(n: number) {
    return 12 + n * 0.75;
  }

  private stringFor(pitch: number) {
    return Math.round(clamp((pitch - this.lo) / (this.hi - this.lo)) * 12);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const playing = !muted;
    const s = playing ? strike(this.lane, t, { rebound: 0.08, prep: 0.1, fullGap: 0.4, rest: 0.5 }) : { lift: 0.6, travel: 0, prev: undefined, next: undefined };
    const from = s.prev ? this.stringFor(s.prev.pitch) : 6;
    const to = s.next ?? s.prev ? this.stringFor((s.next ?? s.prev)!.pitch) : from;
    const string = from + (to - from) * s.travel;
    const pluck = pt(-34 + s.lift * 2, this.stringY(string) - 1 - s.lift * 6);
    const ringing = playing ? this.lane.sounding(t).map((h) => this.stringFor(h.pitch)) : [];
    fig.set({
      lean: 0.18,
      face: this.seat.face * 0.4,
      pelvis: pt(-30, 4),
      head: { tilt: 0.05, nod: 0.5, eyes: blinking(wall, this.seat.phase) ? "closed" : "half", mouth: 0 },
      arms: { right: { hand: pluck, elbow: "out", grip: "pinch" }, left: { hand: pt(6, this.stringY(Math.min(12, string + 1)) - 2), elbow: "out", grip: "flat" } },
      // Kneeling: knees on the floor in front, feet tucked under.
      legs: { left: { knee: pt(-22, 22), foot: pt(-34, 27), toe: -1 }, right: { knee: pt(-38, 22), foot: pt(-44, 27), toe: -1 } },
      breath: (Math.sin(wall * 1.2) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    // The koto: a long paulownia body across the stage, thirteen strings and their bridges.
    p.part(blob([pt(-58, 10), pt(58, 9), pt(60, 13), pt(58, 22), pt(-58, 23), pt(-60, 16)], 0.5), "#c9955a");
    p.part(roundRect(-58, 20, 116, 3, 1), "#8a5a30", { rim: false });
    for (let n = 0; n < 13; n++) {
      const y = this.stringY(n);
      const shake = ringing.includes(n) ? Math.sin(wall * 80 + n) * 0.25 : 0;
      p.line(curve([pt(-54, y), pt(0, y + shake), pt(54, y)]), "#f6f0e2", 0.22, 0.95);
      const bridge = pt(-18 + n * 3.4, y);
      p.part(poly([add(bridge, pt(-0.9, 0.6)), add(bridge, pt(0, -1.2)), add(bridge, pt(0.9, 0.6))]), "#f4efe4", { rim: false, inkScale: 0.4 });
    }
    fig.arm("left");
    fig.arm("right");
  }
}

/** A kalimba in both hands: the tines splay out from the middle, low in the centre, high at the edges, each thumb on its side. */
export class KalimbaPlayer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -26, y0: -84, x1: 26, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
  private fig?: Figure;
  private lane: Lane;
  private lo: number;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
    this.lo = cues.lo;
  }

  /** Tine for a pitch: 17 tines, the lowest in the middle, each step up alternating sides. */
  private tine(pitch: number) {
    const step = clamp(Math.round(((pitch - this.lo) / 12) * 7), 0, 16);
    const side = step % 2 === 0 ? 1 : -1;
    return { x: side * Math.ceil(step / 2) * 1.5, length: 10 - Math.ceil(step / 2) * 0.8, side };
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const playing = !muted;
    const s = playing ? strike(this.lane, t, { rebound: 0.07, prep: 0.09, fullGap: 0.35, rest: 0.6 }) : { lift: 0.6, next: undefined, prev: undefined };
    const target = (s.next ?? s.prev) as Hit | undefined;
    const tine = target ? this.tine(target.pitch) : { x: 0, length: 10, side: 1 };
    const box = pt(0, -30);
    const thumb = (side: number) => (tine.side === side ? add(box, pt(tine.x, -tine.length + 3 - s.lift * 3)) : add(box, pt(side * 8, -4)));
    fig.set({
      lean: 0.1,
      face: this.seat.face * 0.4,
      head: { tilt: 0.06, nod: 0.6, eyes: blinking(wall, this.seat.phase) ? "closed" : "half", mouth: 0 },
      arms: { left: { hand: add(thumb(1), pt(3, 6)), elbow: "out", grip: "hold" }, right: { hand: add(thumb(-1), pt(-3, 6)), elbow: "out", grip: "hold" } },
      legs: seatedLegs(this.seat.face * 0.5),
      breath: (Math.sin(wall * 1.2) + 1) / 2,
    });
    p.part(roundRect(-14, 1, 28, 4, 1.4), "#3a2a24");
    fig.legs();
    fig.torso();
    fig.head();
    p.part(roundRect(box.x - 13, box.y - 12, 26, 18, 3), "#b5753e");
    p.part(ellipse(box.x, box.y + 1, 2.4, 2.4), "#3a2414", { rim: false, inkScale: 0.4 });
    const ringing = playing ? this.lane.sounding(t) : [];
    for (let step = 0; step < 17; step++) {
      const side = step % 2 === 0 ? 1 : -1;
      const x = side * Math.ceil(step / 2) * 1.5;
      const len = 10 - Math.ceil(step / 2) * 0.8;
      const lit = ringing.some((h) => this.tine(h.pitch).x === x);
      p.line(poly([add(box, pt(x, -2)), add(box, pt(x + (lit ? Math.sin(wall * 90) * 0.2 : 0), -2 - len))]), lit ? "#ffffff" : "#c9ced8", 0.8);
    }
    p.line(poly([add(box, pt(-12, -2)), add(box, pt(12, -2))]), "#5a5a66", 1);
    fig.arm("left");
    fig.arm("right");
  }
}

/** A music box on a little table: the player turns its crank, the pinned drum rolls and the comb's teeth sparkle as they sound. */
export class MusicBoxPlayer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -30, y0: -84, x1: 40, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
  private fig?: Figure;
  private lane: Lane;
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
    this.lane = cues.lane;
    this.lo = cues.lo;
    this.hi = Math.max(cues.hi, cues.lo + 12);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const playing = !muted;
    // One turn of the crank every two beats.
    const turn = playing ? beat * Math.PI : 0;
    const box = pt(18, -18);
    const crank = add(box, pt(12 + Math.cos(turn) * 4, -2 + Math.sin(turn) * 4));
    fig.set({
      lean: 0.16,
      face: 0.45,
      head: { tilt: 0.1, nod: 0.6, eyes: blinking(wall, this.seat.phase) ? "closed" : "half", mouth: 0 },
      arms: { right: { hand: add(box, pt(-6, -3)), elbow: "down", grip: "flat" }, left: { hand: crank, elbow: "down", grip: "fist" } },
      legs: seatedLegs(0.45),
      breath: (Math.sin(wall * 1.2) + 1) / 2,
    });
    p.part(roundRect(-14, 1, 28, 4, 1.4), "#3a2a24");
    fig.arm("right");
    fig.legs();
    fig.torso();
    fig.head();
    // The table, then the box with its lid up and the works inside.
    p.part(roundRect(box.x - 16, box.y + 4, 32, 3, 1), "#6a4a30");
    p.part(capsule(pt(box.x, box.y + 7), pt(box.x, SEATED_FLOOR), 1.4, 1.4), "#6a4a30", { rim: false });
    p.part(poly([add(box, pt(-10, -3)), add(box, pt(10, -3)), add(box, pt(12, -16)), add(box, pt(-8, -16))]), "#7a3a2a");
    p.part(roundRect(box.x - 10, box.y - 3, 20, 7, 1), "#8a4a30");
    p.part(roundRect(box.x - 8, box.y - 2.6, 16, 3, 0.8), "#d9b56a", { rim: false, inkScale: 0.5 });
    const ringing = playing ? this.lane.sounding(t) : [];
    for (let k = 0; k < 14; k++) {
      const lit = ringing.some((h) => Math.round(((h.pitch - this.lo) / (this.hi - this.lo)) * 13) === k);
      p.line(poly([add(box, pt(-7 + k * 1.05, -2.4)), add(box, pt(-7 + k * 1.05, -0.4))]), lit ? "#ffffff" : "#c9ced8", 0.4);
    }
    p.line(poly([add(box, pt(10, -1)), crank]), "#c9ced8", 0.7);
    fig.arm("left");
  }
}

/** The pyramid metronome that ticks through Scales: its pendulum reaches each side on a beat. */
export class Metronome implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -12, y0: -30, x1: 12, y1: 37.5 };
  readonly floor = 37.5;

  constructor(cues: TrackCues, seat: Seat) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
  }

  private lane: Lane;

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const swing = muted ? 0 : Math.sin(frame.beat * Math.PI - Math.PI / 2) * 0.45;
    p.part(roundRect(-10, -2, 20, 3, 1), "#5a3a26");
    p.part(capsule(pt(0, 1), pt(0, 37.5), 1.2, 1.2), "#5a3a26", { rim: false });
    p.part(poly([pt(-8, -2), pt(8, -2), pt(3, -28), pt(-3, -28)]), "#7a4a2a");
    p.part(poly([pt(-3.6, -6), pt(3.6, -6), pt(1.6, -24), pt(-1.6, -24)]), "#e8dcc4", { rim: false, inkScale: 0.4 });
    const pivot = pt(0, -7);
    const tip = add(pivot, pt(Math.sin(swing) * 18, -Math.cos(swing) * 18));
    p.line(poly([pivot, tip]), "#3a3440", 0.6);
    const weight = lerp(pivot, tip, 0.65);
    p.part(roundRect(weight.x - 1.4, weight.y - 1, 2.8, 2, 0.4), "#c9a24a", { rim: false, inkScale: 0.4 });
    const tick = muted ? 0 : pulse(this.lane, frame.t, 0.12);
    if (tick > 0.1) p.line(curve([pt(-9, -30), pt(0, -33), pt(9, -30)]), "#c9a24a", 0.5, tick);
  }
}
