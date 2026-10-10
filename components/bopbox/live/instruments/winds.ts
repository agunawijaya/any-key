import type { Lane, TrackCues } from "@/lib/music/perform/cues";
import { closedHoles, slidePosition, valvesFor } from "@/lib/music/perform/winds";
import type { Track } from "@/lib/music/arrange/types";
import { mix } from "@/lib/kit/color";
import { Figure, type Grip, type Look, type Pose } from "../figure";
import { add, clamp, curve, ellipse, pt, rotate, scale, type Painter, type Pt } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { along, axisFrom, mouthOf, profile, tube, type Axis } from "./frame";
import { seatedLegs, SEATED_FLOOR } from "./strings";

/*
 * Everything blown: flutes, reeds, saxophones, brass, bamboo. One player
 * class holds them all; each instrument says where it sits against the lips,
 * where the hands go along it and how it is drawn. What the music gives
 * every one of them:
 *
 * - fingers: holes closed or keys and valves pressed for the pitch sounding
 *   (real valve combinations for trumpets, real slide positions for the
 *   trombone; for the woodwinds, more fingers down the lower the note);
 * - breath: in every rest the chest fills, and in a long one the
 *   instrument comes off the lips;
 * - dynamics: brass bells lift on loud notes, reeds lean into long ones.
 */

export type WindKind =
  | "flute"
  | "piccolo"
  | "fife"
  | "oboe"
  | "clarinet"
  | "bassoon"
  | "sax"
  | "tenorSax"
  | "sopranoSax"
  | "trumpet"
  | "cornet"
  | "trombone"
  | "horn"
  | "tuba"
  | "euphonium"
  | "suling"
  | "shakuhachi";

/** Which wind a track is, from its program and name. */
export function windKind(track: Track): WindKind {
  const n = track.name.toLowerCase();
  const program = track.patch.program;
  if (/shakuhachi/.test(n)) return "shakuhachi";
  if (/suling/.test(n) || program === 77) return "suling";
  if (/fife/.test(n)) return "fife";
  if (/piccolo/.test(n) || program === 72) return "piccolo";
  if (/euphonium/.test(n)) return "euphonium";
  if (/cornet/.test(n)) return "cornet";
  if (/oboe/.test(n) || program === 68) return "oboe";
  if (/clarinet/.test(n) || program === 71) return "clarinet";
  if (/bassoon/.test(n) || program === 70) return "bassoon";
  if (program === 64) return "sopranoSax";
  if (program === 66 || program === 67) return "tenorSax";
  if (/sax/.test(n) || program === 65) return "sax";
  if (/trombone/.test(n) || program === 57) return "trombone";
  if (/horn/.test(n) || program === 60) return "horn";
  if (/tuba|ophicleide/.test(n) || program === 58) return "tuba";
  if (program === 56 || program === 59 || program === 61 || /trumpet/.test(n)) return "trumpet";
  return "flute";
}

const SILVER = "#d9dde6";
const SILVER_DARK = "#8a90a0";
const BRASS = "#d9a640";
const BRASS_LIT = "#ffe39a";
const BLACKWOOD = "#211c22";
const BAMBOO = "#d8b46a";
const MAPLE = "#9a4a26";

type Hold = {
  /** Instrument frame from the lips. */
  axis: (mouth: Pt, lift: number) => Axis;
  /** Where each hand holds it, as (u, v) on the axis. */
  left: [number, number];
  right: [number, number];
  leftGrip: Grip;
  rightGrip: Grip;
  elbows: { left: "out" | "down" | "up" | "in"; right: "out" | "down" | "up" | "in" };
  headTilt: number;
  seated: boolean;
};

const HOLDS: Record<WindKind, Hold> = {
  // Side-blown: the flute runs off to the player's right, sloping down, elbows up.
  flute: { axis: (m, l) => axisFrom(add(m, pt(3, 0.5)), rotate(pt(-1, 0.16), -l * 0.06), 0.86), left: [11, 1.6], right: [27, 1.6], leftGrip: "hold", rightGrip: "hold", elbows: { left: "down", right: "out" }, headTilt: -0.14, seated: true },
  piccolo: { axis: (m, l) => axisFrom(add(m, pt(2, 0.5)), rotate(pt(-1, 0.14), -l * 0.06), 0.86), left: [6, 1.4], right: [13, 1.4], leftGrip: "hold", rightGrip: "hold", elbows: { left: "down", right: "out" }, headTilt: -0.14, seated: true },
  fife: { axis: (m, l) => axisFrom(add(m, pt(2, 0.5)), rotate(pt(-1, 0.14), -l * 0.06), 0.86), left: [8, 1.3], right: [17, 1.3], leftGrip: "hold", rightGrip: "hold", elbows: { left: "down", right: "out" }, headTilt: -0.12, seated: false },
  // Reeds and bamboo held down in front, pointing towards the audience.
  oboe: { axis: (m, l) => axisFrom(m, rotate(pt(0.2, 1), -l * 0.25), 0.72), left: [11, -2], right: [24, -2], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0.04, seated: true },
  clarinet: { axis: (m, l) => axisFrom(m, rotate(pt(0.18, 1), -l * 0.25), 0.72), left: [11, -2.2], right: [25, -2.2], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0.04, seated: true },
  sopranoSax: { axis: (m, l) => axisFrom(m, rotate(pt(0.22, 1), -l * 0.3), 0.74), left: [10, -2.4], right: [24, -2.6], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0.04, seated: false },
  suling: { axis: (m, l) => axisFrom(m, rotate(pt(0.3, 1), -l * 0.28), 0.8, 1.35), left: [9, -1.6], right: [19, -1.6], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0.06, seated: false },
  shakuhachi: { axis: (m, l) => axisFrom(m, rotate(pt(0.28, 1), -l * 0.25), 0.8, 1.25), left: [10, -2], right: [21, -2], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0.08, seated: true },
  // The saxophone hangs from its strap down the player's right side.
  sax: { axis: (m, l) => axisFrom(m, rotate(pt(-0.42, 1), -l * 0.2), 0.92, 1.25), left: [16, -1], right: [30, -1.6], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0, seated: false },
  tenorSax: { axis: (m, l) => axisFrom(m, rotate(pt(-0.42, 1), -l * 0.2), 0.92, 1.4), left: [16, -1], right: [30, -1.6], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "out" }, headTilt: 0, seated: false },
  // The bassoon crosses the body, its bocal reaching back to the lips.
  bassoon: { axis: (m) => axisFrom(add(m, pt(-10, 34)), pt(0.42, -1), 1), left: [30, -2.6], right: [8, 2.6], leftGrip: "hold", rightGrip: "hold", elbows: { left: "out", right: "down" }, headTilt: 0.05, seated: true },
  // Brass points out at the audience; a loud note lifts the bell.
  trumpet: { axis: (m, l) => axisFrom(m, rotate(pt(1, 0.12), -l * 0.22), 0.72, 1.3), left: [14, 3.2], right: [12, -1.8], leftGrip: "fist", rightGrip: "point", elbows: { left: "down", right: "down" }, headTilt: 0, seated: true },
  cornet: { axis: (m, l) => axisFrom(m, rotate(pt(1, 0.14), -l * 0.22), 0.72, 1.1), left: [13, 3.2], right: [11, -1.8], leftGrip: "fist", rightGrip: "point", elbows: { left: "down", right: "down" }, headTilt: 0, seated: true },
  trombone: { axis: (m, l) => axisFrom(m, rotate(pt(1, 0.32), -l * 0.18), 0.66), left: [6, -3], right: [22, 2.4], leftGrip: "fist", rightGrip: "pinch", elbows: { left: "down", right: "down" }, headTilt: 0, seated: true },
  // The horn rests on the right thigh, the right hand in its bell.
  horn: { axis: (m) => axisFrom(m, pt(-0.55, 1), 1), left: [12, 3.5], right: [26, -9], leftGrip: "hold", rightGrip: "flat", elbows: { left: "down", right: "out" }, headTilt: 0.04, seated: true },
  // Tuba and euphonium stand in the lap, bell up.
  tuba: { axis: (m) => axisFrom(add(m, pt(-4, 52)), pt(0.06, -1), 1, 1.3), left: [24, 9], right: [30, -4], leftGrip: "hold", rightGrip: "point", elbows: { left: "out", right: "out" }, headTilt: 0, seated: true },
  euphonium: { axis: (m) => axisFrom(add(m, pt(-3, 42)), pt(0.06, -1), 1, 1), left: [22, 8], right: [26, -4], leftGrip: "hold", rightGrip: "point", elbows: { left: "out", right: "out" }, headTilt: 0, seated: true },
};

/** Draws an instrument along its frame, showing the fingering for `pitch` (closed holes, pressed valves). */
function drawWind(p: Painter, kind: WindKind, f: Axis, pitch: number | undefined, skin: string) {
  const holes = pitch === undefined ? 0 : closedHoles(pitch);
  switch (kind) {
    case "flute":
    case "piccolo":
    case "fife": {
      const len = kind === "flute" ? 39 : kind === "piccolo" ? 18 : 24;
      const wood = kind === "fife" ? "#b07a3e" : kind === "piccolo" ? BLACKWOOD : SILVER;
      p.part(tube(f, -6, len, 1.05), wood);
      p.flat(tube(f, -5, len - 1, 0.35), "#ffffff", kind === "fife" ? 0.25 : 0.55);
      const lip = along(f, 0, -0.6);
      p.part(ellipse(lip.x, lip.y, 0.9, 0.55), "#1a1a22", { rim: false, inkScale: 0.4 });
      for (let i = 0; i < 6; i++) {
        const u = len * (0.3 + i * 0.1);
        const c = along(f, u, -0.4);
        const closed = i < holes;
        p.part(ellipse(c.x, c.y, closed ? 1 : 0.6, closed ? 0.85 : 0.5), closed ? skin : kind === "flute" ? SILVER_DARK : "#2a1a12", { rim: false, inkScale: 0.5 });
      }
      break;
    }
    case "oboe":
    case "clarinet":
    case "sopranoSax":
    case "suling":
    case "shakuhachi": {
      const len = kind === "suling" ? 30 : kind === "shakuhachi" ? 34 : kind === "sopranoSax" ? 40 : 42;
      const body = kind === "suling" || kind === "shakuhachi" ? BAMBOO : kind === "sopranoSax" ? BRASS : BLACKWOOD;
      const width = kind === "suling" ? 0.95 : kind === "shakuhachi" ? 1.5 : kind === "oboe" ? 1.1 : 1.3;
      const flare = kind === "clarinet" ? 3 : kind === "oboe" ? 1.9 : kind === "sopranoSax" ? 3.6 : kind === "shakuhachi" ? 2 : width;
      p.part(profile(f, [[0, width * 0.6], [3, width], [len * 0.8, width * 1.05], [len - 2, flare * 0.7], [len, flare]]), body);
      if (kind === "suling" || kind === "shakuhachi") for (const u of [6, 16, 26]) p.line(curve([along(f, u, -width), along(f, u, width)]), mix(BAMBOO, "#5a3a10", 0.5), 0.5, 0.8);
      else p.flat(tube(f, 2, len - 3, 0.3), "#ffffff", 0.35);
      p.part(mouthOf(f, len, flare, 0.4), mix(body, "#000000", 0.5), { rim: false, inkScale: 0.6 });
      for (let i = 0; i < 6; i++) {
        const u = 6 + i * ((len - 12) / 6) + (i >= 3 ? 2 : 0);
        const c = along(f, u, 0);
        const closed = i < holes;
        p.part(ellipse(c.x, c.y, closed ? 1.15 : 0.6, closed ? 1 : 0.5), closed ? skin : body === BLACKWOOD ? SILVER : "#3a2410", { rim: false, inkScale: 0.5 });
      }
      break;
    }
    case "sax":
    case "tenorSax": {
      // Neck curving down from the lips, a straight body, the U-bend and the bell turned up and out.
      p.part(tube(f, 0, 9, 0.7, 1), BRASS);
      const body = profile(f, [[8, 1.2], [20, 2], [36, 3.2], [42, 3.6]]);
      p.part(body, BRASS);
      const bend = along(f, 44);
      const bellBase = add(bend, scale(rotate(f.ax, 2.3), 4 * f.size));
      p.part(curve([along(f, 41), add(bend, scale(rotate(f.ax, 1.6), 3 * f.size)), bellBase]), BRASS);
      const bell = add(bellBase, scale(rotate(f.ax, Math.PI), 9 * f.size));
      p.line(curve([along(f, 40, 3), add(bend, pt(0, 3 * f.size)), bellBase, bell]), BRASS, 6 * f.size);
      p.part(ellipse(bell.x, bell.y, 4.4 * f.size, 1.8 * f.size, Math.atan2(f.ax.y, f.ax.x) + Math.PI / 2), mix(BRASS, "#000000", 0.45), { rim: false });
      p.line(curve([bell, add(bell, pt(1, -1))]), BRASS_LIT, 1.2, 0.5);
      for (let i = 0; i < 6; i++) {
        const c = along(f, 14 + i * 4.4, 0.4);
        const closed = i < holes;
        p.part(ellipse(c.x, c.y, 1.4, 1.2), closed ? mix(BRASS, "#ffffff", 0.35) : mix(BRASS, "#000000", 0.2), { rim: false, inkScale: 0.5 });
      }
      p.flat(profile(f, [[10, 0.3], [40, 0.9]]), BRASS_LIT, 0.45);
      break;
    }
    case "bassoon": {
      p.part(profile(f, [[-2, 2.2], [40, 2], [60, 1.8], [64, 2.3]]), MAPLE);
      p.part(tube(f, 60, 64, 2.5), "#f2ece0", { inkScale: 0.6 });
      const top = along(f, 30, -1);
      p.line(curve([top, along(f, 34, -6), add(top, pt(-4, -18))]), SILVER_DARK, 0.9);
      for (let i = 0; i < 6; i++) {
        const c = along(f, 10 + i * 4, 0);
        p.part(ellipse(c.x, c.y, 0.9, 0.8), i < holes ? skin : "#2a1408", { rim: false, inkScale: 0.4 });
      }
      break;
    }
    case "trumpet":
    case "cornet": {
      const len = kind === "trumpet" ? 30 : 24;
      p.part(tube(f, 0, 6, 0.55, 0.7), BRASS);
      p.part(tube(f, 6, len - 8, 0.85, 1.2), BRASS);
      p.part(profile(f, [[len - 9, 1.2], [len - 3, 2.8], [len, 4.6]]), BRASS);
      p.part(mouthOf(f, len, 4.6, 0.35), mix(BRASS, "#000000", 0.4), { rim: false });
      // The loop of tubing under the valves.
      p.line(curve([along(f, 8, 1), along(f, 10, 5), along(f, 18, 5), along(f, 20, 1)]), BRASS, 1.6);
      const down = pitch === undefined ? [] : valvesFor(pitch);
      for (let v = 1; v <= 3; v++) {
        const c = along(f, 10 + v * 2.2, -2 + (down.includes(v) ? 0.9 : 0));
        p.part(ellipse(c.x, c.y, 1, 0.7), down.includes(v) ? BRASS_LIT : SILVER, { rim: false, inkScale: 0.5 });
      }
      p.flat(tube(f, 6, len - 2, 0.25), BRASS_LIT, 0.6);
      break;
    }
    case "trombone": {
      const position = pitch === undefined ? 1 : slidePosition(pitch);
      const out = (position - 1) * 4.2;
      // The slide: two long tubes and the crook at the end, pushed out for low positions.
      for (const v of [-1.2, 1.2]) p.part(tube({ ...f, o: along(f, 0, v) }, 2, 26 + out, 0.5), BRASS, { inkScale: 0.7 });
      p.line(curve([along(f, 26 + out, -1.2), along(f, 28 + out, 0), along(f, 26 + out, 1.2)]), BRASS, 1);
      // The bell section above the slide, bell facing out.
      p.part(profile({ ...f, o: along(f, 0, -5) }, [[2, 0.9], [14, 1.4], [20, 3.4], [23, 6]]), BRASS);
      p.part(mouthOf({ ...f, o: along(f, 0, -5) }, 23, 6, 0.35), mix(BRASS, "#000000", 0.4), { rim: false });
      p.flat(tube({ ...f, o: along(f, 0, -5) }, 2, 20, 0.3), BRASS_LIT, 0.6);
      break;
    }
    case "horn": {
      // Coils round the valve block, bell resting on the thigh.
      const c = along(f, 14, 0);
      p.line(ellipse(c.x, c.y, 8, 7.4), BRASS, 1.8);
      p.line(ellipse(c.x, c.y, 5.4, 5), BRASS, 1.4);
      p.part(profile({ ...f, o: along(f, 16, -4), ax: rotate(f.ax, -0.8) }, [[0, 1.2], [6, 2], [12, 5], [15, 8.5]]), BRASS);
      p.part(mouthOf({ ...f, o: along(f, 16, -4), ax: rotate(f.ax, -0.8) }, 15, 8.5, 0.5), mix(BRASS, "#000000", 0.45), { rim: false });
      p.line(curve([along(f, 0), along(f, 4, 1), along(f, 8, 4)]), BRASS, 0.9);
      const down = pitch === undefined ? [] : valvesFor(pitch);
      for (let v = 1; v <= 3; v++) {
        const k = add(c, pt(-6 + v * 2.2, -7.6 - (down.includes(v) ? 0 : 0.8)));
        p.part(ellipse(k.x, k.y, 1, 0.7), SILVER, { rim: false, inkScale: 0.5 });
      }
      break;
    }
    case "tuba":
    case "euphonium": {
      const big = kind === "tuba";
      p.part(profile(f, [[0, 5], [8, 6], [24, 5.4], [32, 6.4], [40, big ? 11 : 9], [42, big ? 13 : 10]]), BRASS);
      p.part(mouthOf(f, 42, big ? 13 : 10, 0.32), mix(BRASS, "#000000", 0.45), { rim: false });
      p.flat(profile(f, [[2, 1.2], [38, 1.8]]), BRASS_LIT, 0.5);
      const down = pitch === undefined ? [] : valvesFor(pitch);
      for (let v = 1; v <= 3; v++) {
        const k = along(f, 26 + v * 2.4, -7.4);
        p.part(ellipse(k.x, k.y, 1.2, 0.8), down.includes(v) ? BRASS_LIT : SILVER, { rim: false, inkScale: 0.5 });
      }
      p.line(curve([along(f, 30, -5), along(f, 38, -12), along(f, 44, -14)]), BRASS, 1.4);
      break;
    }
  }
}

/** A wind or brass player, seated in an orchestra or standing in a band. */
export class WindPlayer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box;
  readonly kind: WindKind;
  readonly floor: number;
  private hold: Hold;
  private fig?: Figure;
  private lane: Lane;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
    options: { kind?: WindKind; standing?: boolean } = {},
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
    this.kind = options.kind ?? windKind(cues.track);
    this.hold = { ...HOLDS[this.kind], seated: options.standing === undefined ? HOLDS[this.kind].seated : !options.standing };
    this.floor = this.hold.seated ? SEATED_FLOOR : 37.5;
    this.box = { x0: -32, y0: this.hold.seated ? -82 : -82, x1: 34, y1: this.floor };
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const ph = this.seat.phase;
    const playing = !muted;
    const { prev, next } = this.lane.around(t);
    const sounding = playing && prev && t < prev.end ? prev : undefined;
    const gapEnd = next ? next.t : Infinity;
    const resting = !sounding;
    // In a rest the player breathes in; a long one takes the instrument off the lips.
    const restLength = resting ? gapEnd - (prev?.end ?? -Infinity) : 0;
    const away = !playing || (resting && restLength > 1.4 && t - (prev?.end ?? -9) > 0.3 && gapEnd - t > 0.45) ? 1 : 0;
    const breath = resting ? clamp(1 - (gapEnd - t) / 0.6) : 0.3;
    const loud = sounding ? sounding.vel / 127 : 0.5;
    const brass = ["trumpet", "cornet", "trombone", "horn", "tuba", "euphonium"].includes(this.kind);
    const lift = (brass ? Math.max(0, loud - 0.7) * 1.6 : 0) - away * 0.5;
    const hold = this.hold;
    const legs: Pose["legs"] = hold.seated ? seatedLegs(this.seat.face) : { left: { foot: pt(9, 37), toe: 0.3 }, right: { foot: pt(-9, 37), toe: -0.3 } };
    const groove = !hold.seated && playing ? Math.abs(Math.sin(beat * Math.PI)) : 0;
    const longNote = sounding && sounding.end - sounding.t > 0.6;
    // Flutes turn towards the side they play to, brass towards where the bell points, so the arms don't hide the face.
    const turn = ["flute", "piccolo", "fife"].includes(this.kind) ? -0.45 : ["trumpet", "cornet", "trombone"].includes(this.kind) ? 0.4 : 0;
    const base: Pose = {
      lean: (hold.seated ? -0.02 : 0) + (longNote && !brass ? -0.05 : 0) + Math.sin(wall * 0.6 + ph * 3) * 0.015,
      face: clamp(this.seat.face + turn, -0.8, 0.8),
      pelvis: pt(0, -groove * 0.8),
      head: {
        tilt: hold.headTilt + (brass ? -lift * 0.1 : 0),
        nod: away ? 0.15 : brass ? -lift * 0.25 : 0.1,
        eyes: blinking(wall, ph) ? "closed" : longNote ? "half" : "open",
        mouth: 0,
        brows: sounding && sounding.vel > 105 ? 0.6 : 0.1,
      },
      arms: { left: { hand: pt(12, -30) }, right: { hand: pt(-12, -30) } },
      legs,
      breath,
    };
    fig.set(base);
    const mouth = fig.mouth();
    const lowered = away ? add(mouth, pt(0, 9)) : mouth;
    const f = hold.axis(lowered, lift);
    const leftHand = along(f, hold.left[0], hold.left[1]);
    const rightHand = along(f, hold.right[0], hold.right[1]);
    fig.set({
      ...base,
      arms: {
        left: { hand: leftHand, elbow: hold.elbows.left, grip: hold.leftGrip },
        right: { hand: rightHand, elbow: hold.elbows.right, grip: hold.rightGrip },
      },
    });
    if (hold.seated) this.chair(p);
    fig.legs();
    fig.torso();
    fig.head();
    // Arms, then the instrument over the forearms, then the hands holding it.
    fig.arm("left", { hand: false });
    fig.arm("right", { hand: false });
    drawWind(p, this.kind, f, sounding?.pitch ?? (playing && next ? next.pitch : undefined), this.look.skin);
    fig.hand("left");
    fig.hand("right");
  }

  private chair(p: Painter) {
    const c = "#1a1620";
    p.part(blobChair(), c);
  }
}

/** The plain black orchestra chair: seat and backrest, legs hidden behind the player. */
function blobChair(): Path2D {
  const path = new Path2D();
  path.rect(-15, -28, 30, 24);
  path.rect(-16, 1, 32, 4);
  path.rect(-14, 4, 2, SEATED_FLOOR - 4);
  path.rect(12, 4, 2, SEATED_FLOOR - 4);
  return path;
}
