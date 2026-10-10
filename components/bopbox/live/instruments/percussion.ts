import { Lane, pulse, strike, type Hit, type TrackCues } from "@/lib/music/perform/cues";
import { kitPiece, pieceOf, splitKit, splitMallets, type KitLimbs, type KitPiece } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import { isBlackKey } from "@/lib/music/theory";
import { Figure, type Look, type Pose } from "../figure";
import { add, blob, capsule, clamp, ellipse, lerp, norm, poly, pt, roundRect, scale, sub, type Painter, type Pt } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { seatedLegs, SEATED_FLOOR } from "./strings";

/*
 * Percussion. Every hit lands where it sounds: the drummer's four limbs
 * share the kit as `splitKit` deals them out (kick on the right foot, time
 * on the right hand, backbeat on the left, fast runs hand to hand); a stick
 * comes down exactly on the note and bounces off. Cymbals swing after a
 * crash, drum heads ripple, hi-hats close on the pedal. Timpani and
 * mallet instruments put each mallet on the right drum or bar for the pitch.
 */

const CHROME = "#cfd3dc";
const BRONZE = "#d6a74a";
const BRONZE_LIT = "#ffe6a0";
const HEAD = "#f4efe4";

type Piece = { at: Pt; kind: "drum" | "cymbal" | "kick"; r: number; shell?: number };

/** Where each piece sits round a seated drummer, seen from the audience (the player's right is screen left). */
const KIT: Partial<Record<KitPiece, Piece>> = {
  kick: { at: pt(0, 15), kind: "kick", r: 15 },
  snare: { at: pt(15, -4), kind: "drum", r: 8.5, shell: 5 },
  rim: { at: pt(15, -4), kind: "drum", r: 8.5, shell: 5 },
  clap: { at: pt(15, -4), kind: "drum", r: 8.5, shell: 5 },
  hat: { at: pt(26, -14), kind: "cymbal", r: 7.5 },
  hatOpen: { at: pt(26, -14), kind: "cymbal", r: 7.5 },
  pedalHat: { at: pt(26, -14), kind: "cymbal", r: 7.5 },
  tomHigh: { at: pt(6, -10), kind: "drum", r: 6.4, shell: 6 },
  tomMid: { at: pt(-7, -10), kind: "drum", r: 7, shell: 6.5 },
  tomLow: { at: pt(-20, 3), kind: "drum", r: 8.6, shell: 13 },
  ride: { at: pt(-26, -20), kind: "cymbal", r: 11 },
  bell: { at: pt(-26, -20), kind: "cymbal", r: 11 },
  crash: { at: pt(18, -32), kind: "cymbal", r: 10 },
  splash: { at: pt(-8, -34), kind: "cymbal", r: 6.5 },
  china: { at: pt(18, -32), kind: "cymbal", r: 10 },
  cowbell: { at: pt(-2, -18), kind: "drum", r: 3, shell: 4 },
  tambourine: { at: pt(26, -14), kind: "cymbal", r: 7.5 },
  shaker: { at: pt(26, -14), kind: "cymbal", r: 7.5 },
};

const pieceAt = (piece: KitPiece | undefined, fallback: KitPiece): Piece => (piece && KIT[piece]) || KIT[fallback]!;

/** The top of a drum head or the edge of a cymbal: where a stick lands. */
const contact = (p: Piece) => (p.kind === "cymbal" ? add(p.at, pt(p.r * 0.45 * Math.sign(p.at.x || 1) * -1, 0)) : p.kind === "kick" ? p.at : add(p.at, pt(0, 0)));

export type KitStyle = "sticks" | "brushes" | "rods";

/** A drummer at a full kit. */
export class Drummer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -40, y0: -84, x1: 40, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
  private fig?: Figure;
  private limbs: KitLimbs;
  private all: Lane;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
    private style: KitStyle = "sticks",
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.limbs = splitKit(cues.lane);
    this.all = cues.lane;
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const ph = this.seat.phase;
    const playing = !muted;
    const shape = { rebound: 0.09, prep: 0.1, fullGap: 0.4, rest: 0.45 };
    const hand = (lane: Lane, fallback: KitPiece) => {
      const s = playing ? strike(lane, t, shape) : { lift: 0.4, travel: 0, prev: undefined, next: undefined };
      const from = contact(pieceAt(pieceOf(s.prev), fallback));
      const to = contact(pieceAt(pieceOf(s.next ?? s.prev), fallback));
      const tip = add(lerp(from, to, s.travel), pt(0, -s.lift * 11));
      return { tip, lift: s.lift };
    };
    const right = hand(this.limbs.rightHand, "hat");
    const left = hand(this.limbs.leftHand, "snare");
    const kick = playing ? strike(this.limbs.rightFoot, t, { rebound: 0.07, prep: 0.08, fullGap: 0.3, rest: 0.3 }) : { lift: 0.3 };
    const hatFoot = playing ? strike(this.limbs.leftFoot, t, { rebound: 0.08, prep: 0.1, fullGap: 0.4, rest: 0.6 }) : { lift: 0.6 };
    // The hand sits behind the stick's far end; the stick points down and out at what it hits.
    const handFor = (tip: Pt, side: number) => add(tip, pt(side * 9, -9));
    const legs = seatedLegs(0.0);
    legs.right.foot = add(legs.right.foot, pt(0, -kick.lift * 3));
    legs.left.foot = add(legs.left.foot, pt(0, -hatFoot.lift * 3));
    const groove = playing ? Math.exp(-((beat % 1) * 4)) : 0;
    const pose: Pose = {
      lean: Math.sin(beat * Math.PI * 0.5) * (playing ? 0.03 : 0),
      face: this.seat.face * 0.4,
      pelvis: pt(0, -1),
      head: { tilt: Math.sin(beat * Math.PI * 0.5) * 0.06, nod: 0.2 + groove * 0.6, eyes: blinking(wall, ph) ? "closed" : "open", mouth: 0, brows: 0.2 },
      arms: {
        right: { hand: handFor(right.tip, -1), elbow: "out", grip: "fist" },
        left: { hand: handFor(left.tip, 1), elbow: "out", grip: "fist" },
      },
      legs,
      breath: (Math.sin(wall * 1.6) + 1) / 2,
    };
    fig.set(pose);
    // Throne, the drummer, then the kit in front, then arms and sticks over it.
    p.part(capsule(pt(0, 4), pt(0, SEATED_FLOOR), 1.4, 1.4), "#2a2a30", { rim: false });
    p.part(ellipse(0, 3, 13, 3.2), "#1a1a20");
    fig.legs();
    fig.torso();
    fig.head();
    this.kit(p, frame, playing, hatFoot.lift);
    fig.arm("left");
    fig.arm("right");
    this.stick(p, fig.grip("left", 2.2), left.tip);
    this.stick(p, fig.grip("right", 2.2), right.tip);
  }

  private stick(p: Painter, from: Pt, to: Pt) {
    if (this.style === "brushes") {
      p.line(poly([from, lerp(from, to, 0.6)]), "#2a2a30", 0.9);
      const dir = norm(sub(to, from));
      for (let i = -2; i <= 2; i++) {
        const tip = add(to, scale(pt(-dir.y, dir.x), i * 0.9));
        p.line(poly([lerp(from, to, 0.6), tip]), "#c9c4b8", 0.25, 0.9);
      }
      return;
    }
    p.line(poly([from, to]), this.style === "rods" ? "#d8b46a" : "#e8cf9a", 0.9);
    p.part(ellipse(to.x, to.y, 0.7, 0.7), "#e8cf9a", { rim: false, inkScale: 0.4 });
  }

  private kit(p: Painter, frame: FrameInfo, playing: boolean, hatFoot: number) {
    const t = frame.t;
    const ring = (piece: KitPiece) => {
      if (!playing) return 0;
      const lanes = [this.limbs.rightHand, this.limbs.leftHand, this.limbs.rightFoot];
      let best = 0;
      for (const lane of lanes) {
        const prev = lane.around(t).prev;
        if (prev && pieceOf(prev) === piece) best = Math.max(best, Math.exp(-(t - prev.t) / (KIT[piece]?.kind === "cymbal" ? 0.6 : 0.15)));
      }
      return best;
    };
    // Stands first.
    for (const name of ["hat", "ride", "crash"] as KitPiece[]) {
      if (!this.limbs.pieces.has(name) && !(name === "hat" && (this.limbs.pieces.has("pedalHat") || this.limbs.pieces.has("hatOpen")))) continue;
      const piece = KIT[name]!;
      p.line(poly([piece.at, pt(piece.at.x, SEATED_FLOOR)]), CHROME, 0.8, 0.9);
    }
    // Bass drum, its front head rippling on the kick.
    const kick = KIT.kick!;
    p.part(ellipse(kick.at.x, kick.at.y, kick.r, kick.r), "#7a1f2b");
    p.part(ellipse(kick.at.x, kick.at.y, kick.r - 1.6, kick.r - 1.6), HEAD, { rim: false });
    const thump = ring("kick");
    if (thump > 0.05) p.line(ellipse(kick.at.x, kick.at.y, (kick.r - 4) * (0.6 + thump * 0.4), (kick.r - 4) * (0.6 + thump * 0.4)), "#c9b9a0", 0.6, thump);
    p.part(ellipse(kick.at.x, kick.at.y, 4, 4), mix(HEAD, "#7a1f2b", 0.25), { rim: false, ink: false });
    // Drums: shell, then the head as a flat ellipse.
    for (const name of ["tomLow", "tomMid", "tomHigh", "snare"] as KitPiece[]) {
      if (name !== "snare" && !this.limbs.pieces.has(name)) continue;
      const piece = KIT[name]!;
      const shell = piece.shell ?? 5;
      p.part(roundRect(piece.at.x - piece.r, piece.at.y, piece.r * 2, shell, 1.2), name === "snare" ? CHROME : "#7a1f2b");
      const r = ring(name);
      p.part(ellipse(piece.at.x, piece.at.y, piece.r, piece.r * 0.3), mix(HEAD, "#ffffff", r * 0.6), { rim: false });
      if (name === "tomLow") p.line(poly([pt(piece.at.x - piece.r + 1, piece.at.y + shell), pt(piece.at.x - piece.r - 1, SEATED_FLOOR)]), CHROME, 0.6);
    }
    // Cymbals swing after they're hit; the hi-hat closes on the pedal.
    for (const name of ["hat", "ride", "crash", "splash"] as KitPiece[]) {
      const has = name === "hat" ? ["hat", "hatOpen", "pedalHat", "tambourine", "shaker"].some((n) => this.limbs.pieces.has(n as KitPiece)) : this.limbs.pieces.has(name) || (name === "ride" && this.limbs.pieces.has("bell"));
      if (!has && name !== "hat") continue;
      const piece = KIT[name]!;
      const r = Math.max(ring(name), name === "hat" ? ring("hatOpen") : 0);
      const tilt = Math.sin(frame.wall * 14) * r * 0.25 + (name === "ride" ? -0.08 : 0.08);
      const gap = name === "hat" ? 1 + hatFoot * 1.4 : 0;
      p.part(ellipse(piece.at.x, piece.at.y - gap, piece.r, piece.r * 0.2, tilt), BRONZE);
      p.line(ellipse(piece.at.x, piece.at.y - gap - 0.3, piece.r * 0.7, piece.r * 0.12, tilt), BRONZE_LIT, 0.4, 0.6);
      if (name === "hat") p.part(ellipse(piece.at.x, piece.at.y + 0.6, piece.r, piece.r * 0.18, tilt), BRONZE);
    }
  }
}

/** Timpani: two or four copper kettles, the largest on the player's left; two mallets, rolls alternating. */
export class Timpanist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -46, y0: -84, x1: 46, y1: 37.5 };
  readonly floor = 37.5;
  private fig?: Figure;
  private hands: { left: Lane; right: Lane };
  private drums: { pitch: number; at: Pt; r: number }[];

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.hands = splitMallets(cues.lane, cues.lo, cues.hi);
    // One kettle per pitch used (up to four), tuned low to high from the player's left (screen right) to right.
    const pitches = [...new Set(cues.lane.hits.map((h) => h.pitch))].sort((a, b) => a - b).slice(0, 4);
    const count = Math.max(2, pitches.length);
    this.drums = Array.from({ length: count }, (_, i) => {
      const r = 15 - i * 1.6;
      return { pitch: pitches[i] ?? pitches[pitches.length - 1] ?? 45, at: pt(30 - i * (60 / (count - 1 || 1)) + (count === 2 ? 0 : 0), -8), r };
    });
  }

  private drumFor(hit: Hit | undefined) {
    if (!hit) return this.drums[0];
    return this.drums.reduce((best, d) => (Math.abs(d.pitch - hit.pitch) < Math.abs(best.pitch - hit.pitch) ? d : best), this.drums[0]);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const playing = !muted;
    const mallet = (lane: Lane, side: number) => {
      const s = playing ? strike(lane, t, { rebound: 0.12, prep: 0.14, fullGap: 0.6, rest: 0.5 }) : { lift: 0.5, travel: 0, prev: undefined, next: undefined };
      const from = this.drumFor(s.prev).at;
      const to = this.drumFor(s.next ?? s.prev).at;
      return add(lerp(from, to, s.travel), pt(side * 4, -1 - s.lift * 14));
    };
    const left = mallet(this.hands.left, 1);
    const right = mallet(this.hands.right, -1);
    fig.set({
      lean: 0.12,
      face: this.seat.face * 0.5,
      head: { tilt: 0, nod: 0.45, eyes: blinking(wall, this.seat.phase) ? "closed" : "open", mouth: 0, brows: 0.2 },
      arms: { left: { hand: add(left, pt(4, -8)), elbow: "out", grip: "fist" }, right: { hand: add(right, pt(-4, -8)), elbow: "out", grip: "fist" } },
      legs: { left: { foot: pt(9, 37) }, right: { foot: pt(-9, 37) } },
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    for (const drum of this.drums) {
      const lastHit = [this.hands.left, this.hands.right].map((l) => l.around(t).prev).filter((h) => h && this.drumFor(h) === drum);
      const ring = playing ? Math.max(0, ...lastHit.map((h) => Math.exp(-(t - h!.t) / 0.5))) : 0;
      // A copper bowl on three legs, the head on top.
      p.line(poly([add(drum.at, pt(-drum.r * 0.6, drum.r)), pt(drum.at.x - drum.r * 0.8, 37)]), CHROME, 0.7);
      p.line(poly([add(drum.at, pt(drum.r * 0.6, drum.r)), pt(drum.at.x + drum.r * 0.8, 37)]), CHROME, 0.7);
      p.part(blob([add(drum.at, pt(-drum.r, 0)), add(drum.at, pt(drum.r, 0)), add(drum.at, pt(drum.r * 0.7, drum.r * 0.9)), add(drum.at, pt(0, drum.r * 1.2)), add(drum.at, pt(-drum.r * 0.7, drum.r * 0.9))], 0.8), "#c46a3a");
      p.part(ellipse(drum.at.x, drum.at.y, drum.r, drum.r * 0.28), mix(HEAD, "#ffffff", ring * 0.5));
      if (ring > 0.05) p.line(ellipse(drum.at.x, drum.at.y, drum.r * (0.3 + (1 - ring) * 0.6), drum.r * 0.28 * (0.3 + (1 - ring) * 0.6)), "#a89878", 0.5, ring);
    }
    fig.arm("left");
    fig.arm("right");
    for (const [hand, tip] of [
      [fig.grip("left", 2), left],
      [fig.grip("right", 2), right],
    ] as const) {
      p.line(poly([hand, tip]), "#d8c39a", 0.8);
      p.part(ellipse(tip.x, tip.y, 1.8, 1.6), "#f2ece0", { rim: false });
    }
  }
}

export type MalletKind = "glockenspiel" | "marimba" | "vibraphone" | "steelDrums" | "xylophone";

/** A mallet player behind a row of bars (or the pan of a steel drum): each mallet lands on the bar for its note. */
export class MalletPlayer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -50, y0: -84, x1: 50, y1: 37.5 };
  readonly floor = 37.5;
  private fig?: Figure;
  private hands: { left: Lane; right: Lane };
  private lo: number;
  private hi: number;
  private all: Lane;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
    private kind: MalletKind,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.all = cues.lane;
    this.hands = splitMallets(cues.lane, cues.lo, cues.hi);
    // The keyboard covers the part's range, whole octaves either side.
    this.lo = Math.floor(cues.lo / 12) * 12;
    this.hi = Math.max(this.lo + 23, Math.ceil((cues.hi + 1) / 12) * 12 - 1);
  }

  private get width() {
    return this.kind === "marimba" ? 84 : this.kind === "glockenspiel" ? 44 : this.kind === "steelDrums" ? 36 : 70;
  }

  /** Where a pitch sits: seen from the audience, low notes are on the player's left (screen right). */
  private barAt(pitch: number): Pt {
    if (this.kind === "steelDrums") {
      // Notes round the pan in a circle of fifths, octaves inside.
      const pc = ((pitch % 12) * 7) % 12;
      const ring = pitch - this.lo < 12 ? 1 : 0.55;
      const a = (pc / 12) * Math.PI * 2 - Math.PI / 2;
      return pt(Math.cos(a) * 15 * ring, -6 + Math.sin(a) * 4.4 * ring);
    }
    const u = clamp((pitch - this.lo) / (this.hi - this.lo));
    const x = this.width / 2 - u * this.width;
    return pt(x, isBlackKey(pitch) ? -10 : -6);
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const playing = !muted;
    const mallet = (lane: Lane, side: number) => {
      const s = playing ? strike(lane, t, { rebound: 0.08, prep: 0.1, fullGap: 0.35, rest: 0.5 }) : { lift: 0.5, travel: 0, prev: undefined, next: undefined };
      const from = s.prev ? this.barAt(s.prev.pitch) : pt(side * 10, -6);
      const to = s.next ?? s.prev ? this.barAt((s.next ?? s.prev)!.pitch) : from;
      return add(lerp(from, to, s.travel), pt(0, -s.lift * 10));
    };
    const left = mallet(this.hands.left, 1);
    const right = mallet(this.hands.right, -1);
    fig.set({
      lean: 0.14 + Math.sin(beat * Math.PI * 0.5) * (playing ? 0.02 : 0),
      face: this.seat.face * 0.4,
      head: { tilt: 0, nod: 0.5, eyes: blinking(wall, this.seat.phase) ? "closed" : "open", mouth: 0 },
      arms: { left: { hand: add(left, pt(3, -9)), elbow: "out", grip: "fist" }, right: { hand: add(right, pt(-3, -9)), elbow: "out", grip: "fist" } },
      legs: { left: { foot: pt(9, 37) }, right: { foot: pt(-9, 37) } },
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    this.instrument(p, t, playing);
    fig.arm("left");
    fig.arm("right");
    for (const [hand, tip] of [
      [fig.grip("left", 2), left],
      [fig.grip("right", 2), right],
    ] as const) {
      p.line(poly([hand, tip]), "#d8c39a", 0.6);
      p.part(ellipse(tip.x, tip.y, 1.5, 1.4), this.kind === "glockenspiel" ? "#3a3440" : this.kind === "vibraphone" ? "#6a7ab0" : "#e8a85a", { rim: false });
    }
  }

  private instrument(p: Painter, t: number, playing: boolean) {
    const ringing = new Map<number, number>();
    if (playing) for (const hit of this.all.sounding(t)) ringing.set(hit.pitch, Math.max(ringing.get(hit.pitch) ?? 0, Math.exp(-(t - hit.t) / 0.4)));
    if (this.kind === "steelDrums") {
      p.line(poly([pt(-14, 0), pt(-16, 37)]), CHROME, 0.8);
      p.line(poly([pt(14, 0), pt(16, 37)]), CHROME, 0.8);
      p.part(ellipse(0, -6, 19, 7), "#c9ced8");
      p.part(ellipse(0, -6, 17, 5.8), "#9aa2b2", { rim: false });
      for (let k = 0; k < 12; k++) {
        const pitch = this.lo + k;
        const c = this.barAt(pitch);
        const lit = ringing.get(pitch) ?? 0;
        p.part(ellipse(c.x, c.y, 2.6, 1.1), mix("#b8c0ce", "#ffffff", lit), { rim: false, inkScale: 0.4 });
      }
      return;
    }
    const wood = this.kind === "marimba" || this.kind === "xylophone";
    const bar = wood ? "#b5652e" : "#d9dde6";
    // Frame and resonator tubes under the bars.
    p.part(roundRect(-this.width / 2 - 3, -4, this.width + 6, 4, 1), "#3a2a24");
    if (this.kind !== "glockenspiel") {
      for (let x = -this.width / 2 + 2; x < this.width / 2; x += 3.2) p.line(poly([pt(x, 0), pt(x, 8 + ((x + 60) % 10))]), this.kind === "vibraphone" ? "#c9ced8" : "#6a4a3a", 1.2, 0.85);
    }
    p.line(poly([pt(-this.width / 2, 0), pt(-this.width / 2, 37)]), "#2a2a30", 1);
    p.line(poly([pt(this.width / 2, 0), pt(this.width / 2, 37)]), "#2a2a30", 1);
    for (let pitch = this.lo; pitch <= this.hi; pitch++) {
      const c = this.barAt(pitch);
      const w = (this.width / ((this.hi - this.lo + 1) * 0.6)) * 0.86;
      const lit = ringing.get(pitch) ?? 0;
      p.part(roundRect(c.x - w / 2, c.y - 2, w, 4.2, 0.8), mix(bar, wood ? "#ffd8a8" : "#ffffff", lit * 0.8), { rim: false, inkScale: 0.4 });
    }
  }
}

/** A hand percussionist: triangle and wood block, or a tambourine, or a metronome ticking on a piano. */
export class SmallPercussion implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -26, y0: -84, x1: 30, y1: 37.5 };
  readonly floor = 37.5;
  private fig?: Figure;
  private lane: Lane;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall } = frame;
    const playing = !muted;
    const s = playing ? strike(this.lane, t, { rebound: 0.08, prep: 0.1, fullGap: 0.4, rest: 0.5 }) : { lift: 0.6, next: undefined, prev: undefined };
    const target = s.next ?? s.prev;
    const piece = target ? kitPiece(target.pitch) : "triangle";
    const triangle = pt(14, -38);
    const block = pt(-8, -22);
    const aim = piece === "wood" || piece === "claves" ? block : add(triangle, pt(0, 3));
    const beater = add(aim, pt(-3, -2 - s.lift * 8));
    fig.set({
      lean: 0.02,
      face: this.seat.face * 0.5,
      head: { tilt: 0, nod: 0.25, eyes: blinking(wall, this.seat.phase) ? "closed" : "open", mouth: 0 },
      arms: { left: { hand: add(triangle, pt(1, -9)), elbow: "out", grip: "pinch" }, right: { hand: add(beater, pt(-4, 2)), elbow: "down", grip: "fist" } },
      legs: { left: { foot: pt(9, 37) }, right: { foot: pt(-9, 37) } },
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("left", { hand: true });
    // The triangle hangs from the left hand on a loop of string; the block sits on a little stand.
    const ring = playing ? pulse(this.lane, t, 0.5) : 0;
    p.line(poly([add(triangle, pt(1, -8)), add(triangle, pt(0, -5))]), "#e8e2d4", 0.3);
    p.line(poly([add(triangle, pt(-5, 4)), add(triangle, pt(0, -5)), add(triangle, pt(5, 4)), add(triangle, pt(-3, 4))]), mix(CHROME, "#ffffff", ring), 0.8);
    p.part(roundRect(block.x - 5, block.y, 10, 3.6, 1), "#8a4a22");
    p.line(poly([pt(block.x, block.y + 3.6), pt(block.x, 37)]), "#2a2a30", 0.7);
    fig.arm("right");
    p.line(poly([fig.grip("right", 2), beater]), "#cfd3dc", 0.5);
  }
}
