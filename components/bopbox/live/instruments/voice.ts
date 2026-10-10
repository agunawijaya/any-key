import type { Lane, TrackCues } from "@/lib/music/perform/cues";
import { Figure, type Look } from "../figure";
import { add, clamp, poly, pt, roundRect, type Painter } from "../paint";
import { blinking, type Box, type Player, type Seat } from "../players";
import type { FrameInfo } from "../stage";

/*
 * Singers. A choir part seats a few voices, each holding a black folder;
 * mouths open as wide as the note is loud and close in the rests, heads
 * lift for a long high note, bodies sway together on the beat.
 */

export class Singer implements Player {
  readonly ids: string[];
  readonly label: string;
  readonly seat: Seat;
  readonly box: Box = { x0: -22, y0: -84, x1: 24, y1: 37.5 };
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
    const singing = muted ? [] : this.lane.sounding(t);
    const top = singing.reduce((m, h) => Math.max(m, h.pitch), 0);
    const loud = singing.reduce((m, h) => Math.max(m, h.vel / 127), 0);
    const height = singing.length ? clamp((top - this.lo) / Math.max(1, this.hi - this.lo)) : 0.3;
    // The first instant of a note opens the mouth widest, then it settles on the vowel.
    const onset = singing.length ? Math.exp(-(t - Math.max(...singing.map((h) => h.t))) / 0.2) : 0;
    const mouth = singing.length ? 0.35 + loud * 0.45 + onset * 0.2 : 0;
    const swayX = Math.sin((beat + this.seat.phase) * Math.PI * 0.5) * 1.2;
    fig.set({
      lean: Math.sin((beat + this.seat.phase) * Math.PI * 0.5) * 0.02,
      face: this.seat.face,
      pelvis: pt(swayX * 0.4, 0),
      head: { tilt: Math.sin((beat + this.seat.phase) * Math.PI * 0.5) * 0.05, nod: 0.1 - height * 0.4, eyes: blinking(wall, this.seat.phase) ? "closed" : mouth > 0.6 ? "half" : "open", mouth, brows: height * 0.8 },
      arms: { left: { hand: pt(8, -30), elbow: "down", grip: "hold" }, right: { hand: pt(-8, -30), elbow: "down", grip: "hold" } },
      legs: { left: { foot: pt(8, 37) }, right: { foot: pt(-8, 37) } },
      breath: singing.length ? 0.2 : clamp((Math.sin(wall * 2) + 1) / 2),
    });
    fig.legs();
    fig.torso();
    fig.head();
    fig.arm("left", { hand: false });
    fig.arm("right", { hand: false });
    // The folder, open, held at chest height.
    const c = add(fig.sk.chest, pt(0, 13));
    p.part(roundRect(c.x - 10, c.y - 6, 20, 11, 1), "#1c1a22");
    p.part(poly([pt(c.x - 9, c.y - 5), pt(c.x - 0.4, c.y - 4), pt(c.x - 0.4, c.y + 4), pt(c.x - 9, c.y + 3.4)]), "#f4eee2", { rim: false, inkScale: 0.4 });
    p.part(poly([pt(c.x + 9, c.y - 5), pt(c.x + 0.4, c.y - 4), pt(c.x + 0.4, c.y + 4), pt(c.x + 9, c.y + 3.4)]), "#f4eee2", { rim: false, inkScale: 0.4 });
    fig.hand("left");
    fig.hand("right");
  }
}
