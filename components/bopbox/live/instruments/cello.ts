import { bowStrokes, type BowState } from "@/lib/music/perform/hands";
import { strike, type Lane, type TrackCues } from "@/lib/music/perform/cues";
import { Figure, type Look } from "../figure";
import { add, blob, capsule, norm, perp, poly, pt, scale, sub, type Painter } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";
import { along, axisFrom } from "./frame";
import { drawFiddle, fingering, SEATED_FLOOR } from "./strings";

/*
 * A cellist: the cello stands on its spike between the knees, the neck by
 * the player's left ear, and the bow crosses low over the lap, flat to the
 * floor. The bow and the left hand work as the violin's do.
 */

const CELLO_STRINGS = [36, 43, 50, 57];

export class Cellist implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -40, y0: -86, x1: 30, y1: SEATED_FLOOR };
  readonly floor = SEATED_FLOOR;
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
    const sounding = playing ? this.lane.sounding(t).sort((a, b) => b.pitch - a.pitch)[0] : undefined;
    const note = sounding ?? (playing ? this.lane.around(t).next : undefined);
    const { s, shift } = fingering(note?.pitch ?? 50, CELLO_STRINGS);
    const f = axisFrom(pt(3, 12), pt(0.2, -1), 1, 1.75);
    const bow = playing ? this.bow(t) : { pos: 0.4, dir: 1, lift: 1 };
    const contact = along(f, 10.4, (s - 1.5) * 0.62);
    const right = this.pizzicato
      ? add(along(f, 15, (s - 1.5) * 0.62), pt(-3 - (playing ? strike(this.lane, t, { rebound: 0.08, prep: 0.1, rest: 0.6 }).lift : 1) * 4, 2))
      : add(contact, scale(pt(-1, 0.12), bow.pos * 40 * 0.92 + 3));
    const long = sounding && sounding.end - sounding.t > 0.45 && t - sounding.t > 0.12;
    const vibrato = long ? Math.sin(wall * 34) * 0.5 : 0;
    const neckHand = along(f, 34 - shift * 10 + vibrato, 1.6);
    fig.set({
      lean: 0.06 + (playing ? (bow.pos - 0.5) * -0.04 : 0) + Math.sin(wall * 0.7 + ph) * 0.012,
      face: this.seat.face,
      head: { tilt: -0.12, nod: 0.25, eyes: blinking(wall, ph) ? "closed" : long ? "half" : "open", mouth: 0 },
      arms: {
        left: { hand: add(neckHand, pt(2, 2)), elbow: "out", grip: "hold" },
        right: { hand: add(right, pt(1, 2)), elbow: "down", grip: this.pizzicato ? "point" : "pinch" },
      },
      legs: { left: { knee: pt(16, 1), foot: pt(17, 31), toe: 0.4 }, right: { knee: pt(-14, 1), foot: pt(-16, 31), toe: -0.4 } },
      breath: (Math.sin(wall * 1.2 + ph * 5) + 1) / 2,
    });
    p.part(blob([pt(-15, -28), pt(15, -28), pt(15.5, -4), pt(-15.5, -4)], 0.4), "#1a1620");
    p.part(blob([pt(-15, 1), pt(15, 1), pt(16, 5), pt(-16, 5)], 0.5), "#141018");
    fig.legs();
    fig.torso();
    fig.head();
    p.line(poly([pt(3, 12), pt(4, SEATED_FLOOR)]), "#8f8a96", 0.7);
    drawFiddle(p, f, { strings: 4, contact: !this.pizzicato && sounding ? { u: 10.4, s } : undefined, light: frame.theme === "light", chinrest: false });
    fig.arm("left");
    fig.arm("right", { hand: false });
    if (!this.pizzicato) {
      const frog = fig.grip("right", 2.6);
      const dir = norm(sub(contact, frog));
      const tip = add(frog, scale(dir, 44));
      p.line(poly([add(frog, scale(perp(dir), 0.9)), add(tip, scale(perp(dir), 0.9))]), "#f3ead6", 0.55, 0.95);
      p.line(poly([frog, tip]), "#5a2e16", 0.85);
      p.part(capsule(add(frog, scale(dir, -1.5)), add(frog, scale(dir, 2.3)), 1.3, 1.1), "#1a1418", { inkScale: 0.6, rim: false });
    }
    fig.hand("right");
  }
}
