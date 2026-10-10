import { bowStrokes, type BowState } from "@/lib/music/perform/hands";
import { strike, type Lane, type TrackCues } from "@/lib/music/perform/cues";
import { mix } from "@/lib/kit/color";
import { Figure, type Look, type Pose } from "../figure";
import { add, blob, capsule, clamp, curve, ellipse, norm, perp, poly, pt, rotate, scale, sub, type Painter, type Pt } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";

/*
 * The bowed strings. A violin sits under the player's chin on the left
 * shoulder and points away towards the audience's right, foreshortened; the
 * bow crosses it near the bridge. Bow direction, speed and position come
 * from `bowStrokes`, so a long note gets a slow whole bow and quick notes
 * small strokes in the middle, and a section bows together. The left hand
 * slides up the neck for high notes and shakes in vibrato on long ones.
 * Pizzicato players keep the violin up and pluck with the right forefinger.
 */

export const SEATED_FLOOR = 29.5;
const BOW_LEN = 50;

/**
 * Seated legs for a player turned by `face`: the thighs run forward the way
 * the body faces, so the lap reads even from the front, and the shins drop to
 * the floor.
 */
export function seatedLegs(face: number): Pose["legs"] {
  const fwd = Math.sign(face || 1) * (6 + Math.abs(face) * 14);
  return {
    left: { knee: pt(9 + fwd, 2.5), foot: pt(10 + fwd * 1.05, 31), toe: Math.sign(face || 1) * 0.7 },
    right: { knee: pt(-9 + fwd * 0.8, 3.5), foot: pt(-10 + fwd * 0.85, 31), toe: Math.sign(face || 1) * 0.7 },
  };
}

/** Open strings, low to high. */
const VIOLIN_STRINGS = [55, 62, 69, 76];
const VIOLA_STRINGS = [48, 55, 62, 69];

const VARNISH = "#b4561e";
const VARNISH_LIT = "#e48a3c";
const EBONY = "#1a1418";

type Frame2 = { o: Pt; ax: Pt; ay: Pt; fs: number; size: number };

const at = (f: Frame2, u: number, v: number): Pt => add(f.o, add(scale(f.ax, u * f.fs * f.size), scale(f.ay, v * f.size)));

/** Half-widths of a violin-family body along its length (0 at the tail, 23 at the shoulders). */
const BODY: [number, number][] = [
  [0, 3.6],
  [1.4, 5.8],
  [4.5, 6.8],
  [8.2, 5.9],
  [10.2, 4.2],
  [12, 3.8],
  [13.8, 4.3],
  [16, 5.4],
  [18.6, 5.5],
  [21.4, 4.4],
  [23, 1.8],
];

function bodyPath(f: Frame2, inset = 0): Path2D {
  const right = BODY.map(([u, w]) => at(f, u, w - inset));
  const left = BODY.map(([u, w]) => at(f, u, -(w - inset))).reverse();
  return blob([...right, ...left], 0.9);
}

/** A violin or viola (or, scaled, a cello or bass) drawn along its frame. */
export function drawFiddle(p: Painter, f: Frame2, options: { strings: number; contact?: { u: number; s: number }; light: boolean; chinrest?: boolean }) {
  const body = bodyPath(f);
  p.part(body, VARNISH);
  // A warm glow in the middle of the belly, darker at the edges like old varnish.
  const centre = at(f, 9, 0);
  const g = p.ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, 9 * f.size);
  g.addColorStop(0, VARNISH_LIT);
  g.addColorStop(1, "rgba(228,138,60,0)");
  p.flat(body, g, options.light ? 0.6 : 0.8);
  p.line(bodyPath(f, 0.7), "#3a160a", 0.35 * f.size, 0.55);
  // F-holes.
  for (const side of [-1, 1]) {
    p.line(curve([at(f, 7.2, side * 2.6), at(f, 8.8, side * 2.2), at(f, 10.6, side * 2.8), at(f, 12.2, side * 2.3)]), "#2a0f06", 0.45 * f.size);
  }
  // Fingerboard, neck, pegbox and scroll.
  p.part(poly([at(f, 12.5, -1.4), at(f, 12.5, 1.4), at(f, 36, 1), at(f, 36, -1)]), EBONY, { inkScale: 0.7 });
  p.part(poly([at(f, 36, -0.9), at(f, 36, 0.9), at(f, 39.5, 0.8), at(f, 39.5, -0.8)]), VARNISH, { inkScale: 0.7 });
  const scroll = at(f, 41, 0);
  p.part(ellipse(scroll.x, scroll.y, 1.5 * f.size, 1.5 * f.size), VARNISH, { inkScale: 0.7 });
  p.line(curve([at(f, 41, 0.9), at(f, 41.8, 0), at(f, 41, -0.6), at(f, 40.4, 0)]), "#3a160a", 0.3 * f.size, 0.7);
  for (const side of [-1, 1]) {
    const peg = at(f, 37.5, side * 1.3);
    p.part(ellipse(peg.x, peg.y, 0.9 * f.size, 0.6 * f.size), EBONY, { inkScale: 0.6, rim: false });
  }
  // Tailpiece, and on a violin or viola the chinrest beside it.
  p.part(poly([at(f, 0.8, -0.9), at(f, 0.8, 0.9), at(f, 6.2, 1.5), at(f, 6.2, -1.5)]), EBONY, { inkScale: 0.7 });
  if (options.chinrest !== false) p.part(blob([at(f, -0.6, 1.2), at(f, 0.4, 4.8), at(f, 3.4, 5.4), at(f, 3.4, 1.6)], 0.8), EBONY, { inkScale: 0.7, rim: false });
  // Bridge.
  p.line(curve([at(f, 8.4, -2.4), at(f, 8.7, 0), at(f, 8.4, 2.4)]), "#f0d7a8", 0.6 * f.size, 0.95);
  // Strings, catching the light where the bow touches them.
  for (let s = 0; s < options.strings; s++) {
    const v = (s - (options.strings - 1) / 2) * 0.62;
    const lit = options.contact?.s === s;
    p.line(poly([at(f, 5.8, v * 1.4), at(f, 36, v * 0.8)]), lit ? "#fff6dc" : "#d8d2c8", (lit ? 0.32 : 0.2) * f.size, lit ? 1 : 0.85);
  }
}

/** Which string a pitch is played on, and how far up the neck the hand must go (0 first position, 1 high). */
export function fingering(pitch: number, strings: number[]) {
  let s = 0;
  for (let i = 0; i < strings.length; i++) if (pitch >= strings[i]) s = i;
  const semis = pitch - strings[s];
  return { s, semis, shift: clamp((semis - 7) / 10) };
}

const restLook = (look: Look) => look;

export type StringOptions = { section: number; pizzicato: boolean; viola?: boolean; standing?: boolean };

/** A violinist (or violist) seated, playing with the bow or pizzicato. */
export class Violinist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box;
  readonly floor: number;
  private fig?: Figure;
  private bow: (t: number) => BowState;
  private lane: Lane;
  private strings: number[];
  private size: number;

  constructor(
    private cues: TrackCues,
    private look: Look,
    seat: Seat,
    private options: StringOptions,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
    this.bow = bowStrokes(cues.lane);
    this.strings = options.viola ? VIOLA_STRINGS : VIOLIN_STRINGS;
    this.size = options.viola ? 1.3 : 1.16;
    // A soloist stands; an orchestra player sits.
    this.floor = options.standing ? 37.5 : SEATED_FLOOR;
    this.box = { x0: -26, y0: -82, x1: 46, y1: this.floor };
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, restLook(this.look)));
    const { t, wall } = frame;
    const ph = this.seat.phase;
    const playing = !muted;
    const bow = playing ? this.bow(t) : { pos: 0.45, dir: 1, lift: 1 };
    const sounding = playing ? this.lane.sounding(t).sort((a, b) => b.pitch - a.pitch)[0] : undefined;
    const upcoming = this.lane.around(t).next;
    const note = sounding ?? (playing ? upcoming : undefined);
    const { s, shift, semis } = fingering(note?.pitch ?? this.strings[2] + 2, this.strings);
    const face = this.seat.face;

    // The body leans into a down-bow and breathes with the phrase.
    const lean = -0.05 + (playing ? (bow.pos - 0.5) * -0.05 : 0) + Math.sin(wall * 0.7 + ph * 3) * 0.012;
    const base: Pose = {
      lean,
      face,
      head: { tilt: 0.26, nod: 0.15, eyes: "open", mouth: 0 },
      arms: { left: { hand: pt(20, -44) }, right: { hand: pt(-16, -30) } },
      legs: this.options.standing ? { left: { foot: pt(10, 37), toe: 0.4 }, right: { foot: pt(-9, 37), toe: -0.2 } } : seatedLegs(face),
      breath: (Math.sin(wall * 1.3 + ph * 5) + 1) / 2,
    };
    fig.set(base);
    const sk = fig.sk;
    // The violin hangs off the left collarbone, under the jaw.
    const theta = 0.42 + (playing ? 0 : 0.18) + Math.sin(wall * 0.7 + ph * 3) * 0.02;
    const ax = pt(Math.cos(theta), Math.sin(theta));
    const chin = (shoulder: Pt) => add(shoulder, pt(-7.5, -4.5));
    const f: Frame2 = { o: chin(sk.shoulder.left), ax, ay: perp(ax), fs: 0.78, size: this.size };

    // Left hand: on the neck, further up for high notes, shaking on held notes.
    const longNote = sounding && sounding.end - sounding.t > 0.45 && t - sounding.t > 0.12;
    const vibrato = longNote ? Math.sin(wall * Math.PI * 2 * 5.6) * 0.55 : 0;
    const handU = 34.5 - shift * 11 + vibrato;
    const neckHand = add(at(f, handU, 2.6), pt(0, 1.5));
    // Right hand: on the bow (or plucking near the end of the fingerboard).
    const contact = at(f, 11.2 - (playing && sounding ? (sounding.vel / 127) * 1.2 : 0), (s - 1.5) * 0.62);
    let rightHand: Pt;
    let bowFrom: Pt | undefined;
    if (this.options.pizzicato) {
      const pluck = playing ? strike(this.lane, t, { rebound: 0.07, prep: 0.1, fullGap: 0.4, rest: 0.6 }) : { lift: 1 };
      rightHand = add(at(f, 16, (s - 1.5) * 0.62), pt(-3 - pluck.lift * 5, 3 + pluck.lift * 7));
    } else {
      // The bow runs from the strings down towards the player's right side, flatter for the low strings.
      const tilt = 0.32 - (3 - s) * 0.09;
      const toFrog = rotate(pt(-1, 0), -tilt);
      const lift = bow.lift * 2.5;
      bowFrom = add(contact, pt(0, -lift));
      rightHand = add(bowFrom, scale(toFrog, bow.pos * BOW_LEN * 0.92 + 3));
    }
    const pose: Pose = {
      ...base,
      head: {
        tilt: 0.3,
        nod: 0.2,
        eyes: blinking(wall, ph) ? "closed" : longNote ? "half" : "open",
        mouth: 0,
        brows: longNote ? 0.3 : 0,
      },
      arms: {
        left: { hand: add(neckHand, pt(2.5, 3)), elbow: "down", grip: "hold", angle: theta - 1.9 },
        right: { hand: add(rightHand, pt(1.5, 2.5)), elbow: "down", grip: this.options.pizzicato ? "point" : "pinch", angle: this.options.pizzicato ? -1.2 : -0.4 },
      },
    };
    fig.set(pose);

    if (!this.options.standing) this.chair(p);
    fig.legs();
    fig.torso();
    fig.arm("left", { hand: false });
    drawFiddle(p, { ...f, o: chin(fig.sk.shoulder.left) }, { strings: 4, contact: !this.options.pizzicato && playing && sounding ? { u: 11, s } : undefined, light: frame.theme === "light" });
    fig.head();
    fig.hand("left");
    // A fingertip on the string being stopped.
    if (sounding && semis > 0) {
      const tip = at(f, handU - 2 - Math.min(4, semis % 7) * 0.9, (s - 1.5) * 0.62);
      p.part(ellipse(tip.x, tip.y, 1, 0.9), this.look.skin, { inkScale: 0.7, rim: false });
    }
    fig.arm("right", { hand: false });
    if (bowFrom) {
      const frog = fig.grip("right", 2.6);
      const along = norm(sub(bowFrom, frog));
      const tip = add(frog, scale(along, BOW_LEN));
      const hairOffset = scale(perp(along), 0.9);
      p.line(poly([add(frog, hairOffset), add(tip, hairOffset)]), "#f3ead6", 0.55, 0.95);
      p.line(curve([frog, add(scale(add(frog, tip), 0.5), scale(perp(along), -0.5)), tip]), "#5a2e16", 0.8);
      p.part(capsule(add(frog, scale(along, -1.4)), add(frog, scale(along, 2.2)), 1.2, 1), EBONY, { inkScale: 0.6, rim: false });
    } else {
      // The bow waits in the plucking hand, tip down and out of the way.
      const grip = fig.grip("right", 2);
      p.line(poly([add(grip, pt(2, -3)), add(grip, pt(-22, 40))]), "#5a2e16", 0.8);
    }
    fig.hand("right");
  }

  private chair(p: Painter) {
    const c = "#1a1620";
    p.part(capsule(pt(-13, 4), pt(-13, SEATED_FLOOR), 1, 1), c, { rim: false });
    p.part(capsule(pt(13, 4), pt(13, SEATED_FLOOR), 1, 1), c, { rim: false });
    p.part(blob([pt(-15, -28), pt(15, -28), pt(15.5, -4), pt(-15.5, -4)], 0.4), c);
    p.part(blob([pt(-15, 1), pt(15, 1), pt(16, 5), pt(-16, 5)], 0.5), mix(c, "#000000", 0.2));
  }
}

/** A double bass player standing behind the bass, bowing near the bridge or plucking. */
export class Bassist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -22, y0: -100, x1: 40, y1: 38 };
  readonly floor = 37.5;
  private fig?: Figure;
  private bow: (t: number) => BowState;
  private lane: Lane;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
    private pizzicato: boolean,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
    this.bow = bowStrokes(cues.lane);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const ph = this.seat.phase;
    const playing = !muted;
    const sounding = playing ? this.lane.sounding(t)[0] : undefined;
    const note = sounding ?? (playing ? this.lane.around(t).next : undefined);
    const { s, shift } = fingering(note?.pitch ?? 33, [28, 33, 38, 43]);
    // The bass stands on its endpin, leaning back against the player's left side.
    const theta = -Math.PI / 2 + 0.16;
    const ax = pt(Math.cos(theta), Math.sin(theta));
    const f: Frame2 = { o: pt(9, 9), ax, ay: perp(ax), fs: 1, size: 2.7 };
    const bow = playing ? this.bow(t) : { pos: 0.4, dir: 1, lift: 1 };
    const contact = at(f, 9.5, (s - 1.5) * 0.62);
    let right: Pt;
    if (this.pizzicato) {
      const pluck = playing ? strike(this.lane, t, { rebound: 0.08, prep: 0.12, rest: 0.6 }) : { lift: 1 };
      right = add(at(f, 15, (s - 1.5) * 0.62), pt(-4 - pluck.lift * 4, 2 + pluck.lift * 5));
    } else {
      right = add(contact, scale(pt(-1, 0.18), bow.pos * 30 + 3));
    }
    const vibrato = sounding && sounding.end - sounding.t > 0.5 && t - sounding.t > 0.15 ? Math.sin(wall * 32) * 0.4 : 0;
    const neckHand = at(f, 35 - shift * 9 + vibrato, 1.8);
    fig.set({
      lean: -0.04 + Math.sin(wall * 0.6 + ph) * 0.01,
      face: this.seat.face,
      head: { tilt: 0.08, nod: 0.1, eyes: blinking(wall, ph) ? "closed" : "open", mouth: 0 },
      arms: {
        left: { hand: add(neckHand, pt(2, 2)), elbow: "out", grip: "hold" },
        right: { hand: add(right, pt(1, 2)), elbow: "down", grip: this.pizzicato ? "point" : "fist" },
      },
      legs: { left: { foot: pt(10, 37) }, right: { foot: pt(-10, 37) } },
      breath: (Math.sin(wall * 1.2 + ph * 5) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    // The endpin.
    p.line(poly([pt(9, 9), pt(8.4, 37)]), "#8f8a96", 0.8);
    drawFiddle(p, f, { strings: 4, contact: !this.pizzicato && sounding ? { u: 9.5, s } : undefined, light: frame.theme === "light", chinrest: false });
    fig.arm("left");
    fig.arm("right", { hand: false });
    if (!this.pizzicato) {
      const frog = fig.grip("right", 2.6);
      const along = norm(sub(contact, frog));
      const tip = add(frog, scale(along, 46));
      p.line(poly([add(frog, scale(perp(along), 0.9)), add(tip, scale(perp(along), 0.9))]), "#f3ead6", 0.55, 0.95);
      p.line(poly([frog, tip]), "#5a2e16", 0.85);
      p.part(capsule(add(frog, scale(along, -1.6)), add(frog, scale(along, 2.4)), 1.4, 1.2), EBONY, { inkScale: 0.6, rim: false });
    }
    fig.hand("right");
  }
}
