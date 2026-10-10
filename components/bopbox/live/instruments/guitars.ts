import { strike, type Hit, type Lane, type TrackCues } from "@/lib/music/perform/cues";
import type { Track } from "@/lib/music/arrange/types";
import { mix } from "@/lib/kit/color";
import { Figure, type Look } from "../figure";
import { add, blob, clamp, curve, ellipse, poly, pt, type Painter } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { along, axisFrom, profile, type Axis } from "./frame";
import { seatedLegs, SEATED_FLOOR } from "./strings";

/*
 * Guitars and their cousins: acoustic, electric, bass, mandolin, banjo,
 * the Mexican vihuela and guitarrón. The instrument lies across the body,
 * neck rising to the player's left. The fretting hand moves to the fret for
 * the note (or the chord's lowest note); the picking hand strums down on a
 * chord, picks a single note, flutters in a mandolin's tremolo. Strings
 * shiver while they sound.
 */

export type GuitarKind = "acoustic" | "classical" | "electric" | "bass" | "mandolin" | "banjo" | "vihuela" | "guitarron" | "sitar" | "koto";

export function guitarKind(track: Track): GuitarKind {
  const n = track.name.toLowerCase();
  if (/guitarr[oó]n/.test(n)) return "guitarron";
  if (/vihuela/.test(n)) return "vihuela";
  if (/mandolin/.test(n)) return "mandolin";
  if (/banjo/.test(n)) return "banjo";
  if (/sitar/.test(n)) return "sitar";
  if (track.patch.program === 33 || /bass/.test(n)) return "bass";
  if (track.patch.program === 24) return "classical";
  if (track.patch.program >= 26 && track.patch.program <= 28) return "electric";
  return "acoustic";
}

type Spec = { strings: number[]; body: number; neck: number; color: string; scale: number; shape: "guitar" | "electric" | "pear" | "round" | "big" };

const SPECS: Record<GuitarKind, Spec> = {
  acoustic: { strings: [40, 45, 50, 55, 59, 64], body: 20, neck: 26, color: "#c98a4a", scale: 1, shape: "guitar" },
  classical: { strings: [40, 45, 50, 55, 59, 64], body: 20, neck: 24, color: "#d9a060", scale: 1, shape: "guitar" },
  electric: { strings: [40, 45, 50, 55, 59, 64], body: 18, neck: 27, color: "#c8302a", scale: 1, shape: "electric" },
  bass: { strings: [28, 33, 38, 43], body: 19, neck: 36, color: "#2a4a8a", scale: 1, shape: "electric" },
  mandolin: { strings: [55, 62, 69, 76], body: 12, neck: 15, color: "#a8582a", scale: 1, shape: "pear" },
  banjo: { strings: [50, 55, 59, 62], body: 14, neck: 28, color: "#e8e2d0", scale: 1, shape: "round" },
  vihuela: { strings: [57, 62, 67, 71, 76], body: 15, neck: 14, color: "#b86a30", scale: 1, shape: "guitar" },
  guitarron: { strings: [33, 38, 43, 48, 52, 45], body: 26, neck: 20, color: "#9a5226", scale: 1.15, shape: "big" },
  sitar: { strings: [48, 55, 60, 67], body: 16, neck: 40, color: "#a85a2a", scale: 1, shape: "round" },
  koto: { strings: [50, 55, 57, 62, 67], body: 40, neck: 0, color: "#c9a060", scale: 1, shape: "big" },
};

/** The fret for a note: the highest open string at or below it, so the hand stays low on the neck. */
function fretFor(pitch: number, strings: number[]) {
  const open = [...strings].sort((a, b) => a - b);
  let s = 0;
  for (let i = 0; i < open.length; i++) if (pitch >= open[i]) s = i;
  return { string: s, fret: clamp(pitch - open[s], 0, 14) };
}

export class Guitarist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box;
  readonly floor: number;
  readonly kind: GuitarKind;
  private spec: Spec;
  private fig?: Figure;
  private lane: Lane;
  private tremolo: boolean;

  constructor(
    cues: TrackCues,
    private look: Look,
    seat: Seat,
    private seated = false,
    kind?: GuitarKind,
  ) {
    this.ids = [cues.track.id];
    this.label = cues.track.name;
    this.seat = seat;
    this.lane = cues.lane;
    this.kind = kind ?? guitarKind(cues.track);
    this.spec = SPECS[this.kind];
    this.floor = seated ? SEATED_FLOOR : 37.5;
    this.box = { x0: -36, y0: -84, x1: 40, y1: this.floor };
    // Notes repeated faster than a tenth of a second are a mandolin's tremolo, not separate strokes.
    const fast = cues.lane.hits.filter((h, i, all) => i > 0 && h.pitch === all[i - 1].pitch && h.t - all[i - 1].t < 0.1).length;
    this.tremolo = fast > cues.lane.hits.length * 0.3;
  }

  draw(p: Painter, frame: FrameInfo, muted: boolean) {
    const fig = (this.fig ??= new Figure(p, this.look));
    const { t, wall, beat } = frame;
    const playing = !muted;
    const { prev, next } = this.lane.around(t);
    const chord = (anchor: Hit | undefined) => (anchor ? this.lane.hits.filter((h) => Math.abs(h.t - anchor.t) < 0.02) : []);
    const now = playing && prev && t < prev.end + 0.05 ? chord(prev) : playing && next ? chord(next) : [];
    const low = now.length ? Math.min(...now.map((h) => h.pitch)) : this.spec.strings[1] + 3;
    const { fret } = fretFor(low, this.spec.strings);
    const s = playing ? strike(this.lane, t, { rebound: 0.06, prep: 0.08, fullGap: 0.3, rest: 0.5 }) : { lift: 0.6, prev: undefined, since: Infinity };
    const sounding = playing && prev && t < prev.end;
    const flutter = sounding && this.tremolo ? Math.sin(wall * 70) * 0.5 + 0.5 : 0;
    // Down on the beat, up on the offbeat, the way a strummer's arm swings.
    const downstroke = Math.floor(beat * 2) % 2 === 0;
    const sweep = this.tremolo ? flutter * 2 : (downstroke ? 1 - s.lift : s.lift) * 6 - 3;
    const standing = !this.seated;
    const f = this.frame(standing);
    const fretU = this.spec.body + this.spec.neck * (1 - Math.pow(2, -fret / 12)) * 1.55;
    const leftHand = along(f, Math.min(this.spec.body + this.spec.neck - 2, fretU + 1), 3.4);
    const rightHand = along(f, this.spec.body * 0.45, -2 + sweep);
    const groove = playing && standing ? Math.abs(Math.sin(beat * Math.PI)) : 0;
    fig.set({
      lean: 0.03 + Math.sin(beat * Math.PI * 0.5) * (playing ? 0.025 : 0),
      face: this.seat.face,
      pelvis: pt(0, -groove * 0.8),
      head: { tilt: 0.1, nod: 0.35 + groove * 0.3, eyes: blinking(wall, this.seat.phase) ? "closed" : "open", mouth: 0, brows: 0.15 },
      arms: { left: { hand: leftHand, elbow: "down", grip: "hold" }, right: { hand: add(rightHand, pt(-1, 1)), elbow: "out", grip: this.kind === "bass" ? "point" : "pinch" } },
      legs: this.seated ? seatedLegs(this.seat.face) : { left: { foot: pt(10, 37), toe: 0.3 }, right: { foot: pt(-10, 37), toe: -0.3 } },
      breath: (Math.sin(wall * 1.3) + 1) / 2,
    });
    if (this.seated) p.part(blob([pt(-15, 1), pt(15, 1), pt(16, 5), pt(-16, 5)], 0.5), "#1a1620");
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("left", { hand: false });
    this.instrument(p, f, now.length && sounding ? now.length : 0, t, standing);
    fig.hand("left");
    fig.arm("right");
  }

  /** Body on the right hip, neck rising to the player's left. */
  private frame(standing: boolean): Axis {
    // Body centred on the right hip, whatever the instrument's size.
    const size = this.spec.scale * 1.4;
    const half = (this.spec.body * size) / 2;
    const centre = standing ? pt(-10, -14) : pt(-9, -17);
    return axisFrom(pt(centre.x - 0.93 * half, centre.y + 0.38 * half), pt(0.93, -0.38), 1, size);
  }

  private instrument(p: Painter, f: Axis, ringing: number, t: number, standing: boolean) {
    const { spec } = this;
    const b = spec.body;
    const top = b + spec.neck;
    const wood = spec.color;
    if (standing) p.line(curve([along(f, 2, -6), add(along(f, b * 0.5, -14), pt(6, -30)), along(f, top - 4, -2)]), "#2a2028", 1.2, 0.8);
    // The body.
    switch (spec.shape) {
      case "guitar":
      case "big":
        p.part(profile(f, [[0, b * 0.32], [b * 0.18, b * 0.47], [b * 0.4, b * 0.4], [b * 0.55, b * 0.3], [b * 0.75, b * 0.38], [b * 0.95, b * 0.32], [b, b * 0.12]]), wood);
        break;
      case "electric":
        p.part(profile(f, [[0, b * 0.3], [b * 0.25, b * 0.45], [b * 0.55, b * 0.33], [b * 0.8, b * 0.38], [b * 0.95, b * 0.1], [b, 0.6]]), wood);
        break;
      case "pear":
        p.part(profile(f, [[0, b * 0.25], [b * 0.3, b * 0.45], [b * 0.7, b * 0.35], [b, b * 0.12]]), wood);
        break;
      case "round": {
        const c = along(f, b * 0.5);
        p.part(ellipse(c.x, c.y, b * 0.5 * f.size, b * 0.5 * f.size), "#8a6a3a");
        p.part(ellipse(c.x, c.y, b * 0.44 * f.size, b * 0.44 * f.size), wood, { rim: false });
        break;
      }
    }
    if (spec.shape !== "electric" && spec.shape !== "round") {
      const hole = along(f, b * 0.62);
      p.part(ellipse(hole.x, hole.y, b * 0.12 * f.size, b * 0.12 * f.size), "#1a120c", { rim: false, inkScale: 0.5 });
    } else if (spec.shape === "electric") {
      for (const u of [0.35, 0.6]) {
        const c = along(f, b * u);
        p.part(ellipse(c.x, c.y, 2.2 * f.size, 0.9 * f.size, Math.atan2(f.ay.y, f.ay.x)), "#e8e2d8", { rim: false, inkScale: 0.4 });
      }
    }
    // Neck, frets and headstock.
    p.part(poly([along(f, b * 0.85, -1.3), along(f, b * 0.85, 1.3), along(f, top, 1.05), along(f, top, -1.05)]), "#4a2e1a", { inkScale: 0.6 });
    for (let k = 1; k <= 12; k++) {
      const u = b + spec.neck * (1 - Math.pow(2, -k / 12)) * 1.55;
      if (u > top - 1) break;
      p.line(poly([along(f, u, -1.2), along(f, u, 1.2)]), "#c9c4b8", 0.25, 0.8);
    }
    p.part(poly([along(f, top, -1.3), along(f, top, 1.3), along(f, top + 6, 1.6), along(f, top + 6, -1.6)]), mix(wood, "#000000", 0.3), { inkScale: 0.6 });
    // Strings, shivering while the chord rings.
    const count = Math.min(spec.strings.length, 6);
    for (let i = 0; i < count; i++) {
      const v = (i - (count - 1) / 2) * 0.42;
      const shake = ringing ? Math.sin(t * 120 + i) * 0.18 : 0;
      p.line(curve([along(f, b * 0.2, v * 1.6), add(along(f, b * 0.7, v * 1.3), pt(shake, shake)), along(f, top, v)]), "#efe8d8", 0.18, 0.9);
    }
  }
}
