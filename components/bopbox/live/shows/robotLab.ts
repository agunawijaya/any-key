import { remixInfo } from "@/lib/music/arrange";
import { pulse, strike, Lane, type Performance, type TrackCues } from "@/lib/music/perform/cues";
import { splitKit, splitMallets } from "@/lib/music/perform/hands";
import { mix } from "@/lib/kit/color";
import { reach } from "../figure";
import { Lens, v3, type V3 } from "../lens";
import { add, blob, capsule, clamp, curve, ellipse, lerp, poly, pt, roundRect, seededRandom, type Light, type Painter, type Pt } from "../paint";
import { blinking } from "../players";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * AI Remix: a robot producer at a laptop. Every note of the remix's lead
 * is a key tap (the lower notes with the left hand, the higher with the
 * right), the antenna blinks on each kick, the chest ring breathes with the
 * bass, and above the laptop floats the remix itself: a piano roll of every
 * part, scrolling past a playhead, in each part's colour.
 *
 * Night (dark) is a studio lit by its screens; day (light) a bright room
 * with a big window and a plant on the sill.
 */

type Palette = { wall: string; wallLow: string; desk: string; deskEdge: string; shell: string; shellDark: string; joint: string; visor: string; laptop: string; window: string; plant: string };

const PALETTES: Record<Theme, Palette> = {
  dark: { wall: "#0e1020", wallLow: "#171a30", desk: "#2a2c3e", deskEdge: "#14151f", shell: "#e6e9f2", shellDark: "#9aa0b4", joint: "#5a6078", visor: "#0b0d16", laptop: "#4a4e60", window: "#12162a", plant: "#2a5a3a" },
  light: { wall: "#dff2ec", wallLow: "#cfe6e0", desk: "#c9b79c", deskEdge: "#8a7656", shell: "#fbfcff", shellDark: "#b4bccc", joint: "#7a8296", visor: "#1a1d2a", laptop: "#9aa0b0", window: "#cfeaff", plant: "#4a9a5a" },
};

const EYE = "#5cf2ff";

export class RobotLab extends Scene {
  readonly caption: string;
  private lens = new Lens(v3(40, 190, -300), v3(30, 112, 30), 620);
  private hands: { left: Lane; right: Lane };
  private kick?: Lane;
  private bass?: Lane;
  private parts: TrackCues[];
  private ids: string[];

  constructor(perf: Performance) {
    super(perf);
    const lead = perf.tracks.find((c) => c.track.role === "melody" && !c.track.patch.drums) ?? perf.tracks[0];
    this.hands = splitMallets(lead.lane, lead.lo, lead.hi);
    const drums = perf.tracks.find((c) => c.track.patch.drums);
    if (drums) this.kick = splitKit(drums.lane).rightFoot;
    this.bass = perf.tracks.find((c) => c.track.role === "bass")?.lane;
    this.parts = perf.tracks.filter((c) => !c.track.patch.drums);
    this.ids = perf.tracks.map((c) => c.track.id);
    const genre = remixInfo(perf.arrangement.songId)?.genre;
    this.caption = `The robot producer${genre ? ` making ${genre}` : ""}: a tap for every note of the lead.`;
  }

  private p3 = (x: number, y: number, z: number) => this.lens.project(v3(x, y, z));
  private quad = (pts: V3[]) => poly(pts.map((q) => this.lens.project(q)));

  protected world(): World {
    const a = this.p3(-46, 75, 10);
    const b = this.p3(112, 75, 10);
    return { x0: a.x, x1: b.x, y0: this.p3(0, 206, 46).y, y1: this.p3(0, 58, 0).y };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: 0.6, y: -0.8 }, shadow: "#0a0c1c", shadeAmount: 0.45, shadeDepth: 2.6, rim: { color: EYE, width: 0.8, alpha: 0.9 }, ink: 0.6, inkTone: "#0a0c1c" }
      : { dir: { x: -0.6, y: -0.8 }, shadow: "#5a6480", shadeAmount: 0.22, shadeDepth: 2.4, rim: { color: "#ffffff", width: 0.6, alpha: 0.6 }, ink: 0.55, inkTone: "#2a3042" };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    const wall = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    wall.addColorStop(0, pal.wall);
    wall.addColorStop(1, pal.wallLow);
    ctx.fillStyle = wall;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // A big window on the back wall, with a plant on its sill.
    const win = [v3(-150, 120, 160), v3(-30, 120, 160), v3(-30, 240, 160), v3(-150, 240, 160)];
    ctx.fillStyle = pal.window;
    ctx.fill(this.quad(win));
    ctx.strokeStyle = mix(pal.wall, "#000000", 0.25);
    ctx.lineWidth = 1.4;
    ctx.stroke(this.quad(win));
    ctx.beginPath();
    const m0 = this.p3(-90, 120, 160);
    const m1 = this.p3(-90, 240, 160);
    ctx.moveTo(m0.x, m0.y);
    ctx.lineTo(m1.x, m1.y);
    ctx.stroke();
    if (theme === "dark") {
      const r = seededRandom(4);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 18; i++) {
        const s = this.p3(-148 + r() * 116, 124 + r() * 112, 160);
        ctx.fillRect(s.x, s.y, 0.6, 0.6);
      }
    }
    const pot = this.p3(-60, 120, 150);
    ctx.fillStyle = "#c06a3a";
    ctx.fill(poly([pt(pot.x - 6, pot.y - 9), pt(pot.x + 6, pot.y - 9), pt(pot.x + 4.5, pot.y), pt(pot.x - 4.5, pot.y)]));
    ctx.fillStyle = pal.plant;
    for (let i = 0; i < 6; i++) ctx.fill(ellipse(pot.x + (i - 2.5) * 3, pot.y - 13 - (i % 2) * 4, 2.6, 6, (i - 2.5) * 0.3));
    if (theme === "dark") {
      // Coloured light from the screens washes the back wall: cyan from the hologram, magenta from the right.
      for (const [x, y, c] of [
        [40, 170, "rgba(92, 242, 255, 0.16)"],
        [120, 120, "rgba(255, 79, 160, 0.14)"],
      ] as const) {
        const at = this.p3(x, y, 150);
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 90);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(at.x - 90, at.y - 90, 180, 180);
      }
    }
    // The desk.
    ctx.fillStyle = pal.desk;
    ctx.fill(this.quad([v3(-40, 75, 0), v3(130, 75, 0), v3(130, 75, 75), v3(-40, 75, 75)]));
    ctx.fillStyle = pal.deskEdge;
    ctx.fill(this.quad([v3(-40, 75, 0), v3(130, 75, 0), v3(130, 71, 0), v3(-40, 71, 0)]));
    for (const x of [-36, 126]) ctx.fill(this.quad([v3(x, 71, 0), v3(x + 4, 71, 0), v3(x + 4, 0, 0), v3(x, 0, 0)]));
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    const pal = PALETTES[frame.theme];
    const muted = this.ids.every((id) => frame.muted.has(id));
    // The body sits behind the laptop; the arms reach over its keys.
    const arms = this.robot(p, frame, pal, muted);
    this.laptop(p, frame, pal, muted);
    this.speaker(p, frame, muted);
    arms();
    this.hologram(p.ctx, frame, muted);
  }

  /** Laptop on the desk, turned towards the robot and us: keys in front, the screen glowing. */
  private laptop(p: Painter, frame: FrameInfo, pal: Palette, muted: boolean) {
    const { ctx } = p;
    const base = [v3(10, 76, 12), v3(56, 76, 12), v3(60, 76, 44), v3(14, 76, 44)];
    ctx.fillStyle = pal.laptop;
    ctx.fill(this.quad(base));
    ctx.fillStyle = mix(pal.laptop, "#000000", 0.35);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 12; i++) {
      const x = 15 + i * 3.4 + row * 0.3;
      const z = 30 + row * 3.1;
      ctx.fill(this.quad([v3(x, 76.4, z), v3(x + 2.7, 76.4, z), v3(x + 2.7, 76.4, z + 2.3), v3(x, 76.4, z + 2.3)]));
    }
    const lid = [v3(14, 76, 44), v3(60, 76, 44), v3(64, 106, 50), v3(18, 106, 50)];
    ctx.fillStyle = mix(pal.laptop, "#000000", 0.15);
    ctx.fill(this.quad(lid));
    const glow = muted ? 0.25 : 0.75 + (this.kick ? pulse(this.kick, frame.t, 0.2) * 0.25 : 0);
    const screen = [v3(16, 78, 44.4), v3(58, 78, 44.4), v3(61.5, 104, 49.6), v3(19.5, 104, 49.6)];
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = "#1a2a5a";
    ctx.fill(this.quad(screen));
    ctx.restore();
  }

  /** A studio monitor at the end of the desk, its woofer pushing with the kick. */
  private speaker(p: Painter, frame: FrameInfo, muted: boolean) {
    const { ctx } = p;
    ctx.fillStyle = "#1c1d26";
    ctx.fill(this.quad([v3(82, 75, 30), v3(102, 75, 30), v3(102, 107, 30), v3(82, 107, 30)]));
    ctx.fillStyle = "#2c2e3a";
    ctx.fill(this.quad([v3(102, 75, 30), v3(106, 75, 50), v3(106, 107, 50), v3(102, 107, 30)]));
    const thump = !muted && this.kick ? pulse(this.kick, frame.t, 0.14) : 0;
    const woofer = this.p3(92, 85, 30);
    const tweeter = this.p3(92, 99, 30);
    ctx.fillStyle = "#0c0c12";
    ctx.fill(ellipse(woofer.x, woofer.y, 7 * woofer.k, 7 * woofer.k));
    ctx.fillStyle = mix("#3a3c4a", "#6a6c80", thump);
    ctx.fill(ellipse(woofer.x, woofer.y, (5 + thump) * woofer.k, (5 + thump) * woofer.k));
    ctx.fillStyle = "#5cf2ff";
    ctx.globalAlpha = 0.6;
    ctx.fill(ellipse(tweeter.x, tweeter.y, 2.2 * tweeter.k, 2.2 * tweeter.k));
    ctx.globalAlpha = 1;
  }

  /** The remix as a floating piano roll: each part in its colour, the playhead in the middle. */
  private hologram(ctx: CanvasRenderingContext2D, frame: FrameInfo, muted: boolean) {
    const tl = this.p3(6, 200, 46);
    const br = this.p3(96, 126, 46);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const src = this.p3(38, 106, 48);
    ctx.save();
    ctx.globalCompositeOperation = frame.theme === "dark" ? "screen" : "source-over";
    // The beam from the laptop up to the panel.
    const beam = ctx.createLinearGradient(0, src.y, 0, br.y);
    beam.addColorStop(0, "rgba(92, 242, 255, 0.35)");
    beam.addColorStop(1, "rgba(92, 242, 255, 0.04)");
    ctx.fillStyle = beam;
    ctx.fill(poly([pt(src.x - 2, src.y), pt(src.x + 2, src.y), pt(br.x - 4, br.y), pt(tl.x + 4, br.y)]));
    ctx.fillStyle = frame.theme === "dark" ? "rgba(40, 120, 200, 0.16)" : "rgba(30, 60, 120, 0.82)";
    ctx.fill(roundRect(tl.x, tl.y, w, h, 3));
    ctx.strokeStyle = "rgba(92, 242, 255, 0.7)";
    ctx.lineWidth = 0.6;
    ctx.stroke(roundRect(tl.x, tl.y, w, h, 3));
    ctx.save();
    ctx.clip(roundRect(tl.x, tl.y, w, h, 3));
    const span = 6;
    const pitches = this.parts.flatMap((c) => [c.lo, c.hi]);
    const lo = Math.min(...pitches) - 3;
    const hi = Math.max(...pitches) + 3;
    const x = (t: number) => tl.x + w / 2 + ((t - frame.t) / span) * w;
    const y = (pitch: number) => br.y - ((pitch - lo) / (hi - lo)) * h;
    const bar = Math.max(2, (h / (hi - lo)) * 0.9);
    // Bar lines drift past behind the notes.
    ctx.strokeStyle = "rgba(92, 242, 255, 0.18)";
    ctx.lineWidth = 0.4;
    for (const bl of this.perf.arrangement.grid) {
      const bt = this.perf.seconds(bl.at);
      if (bt < frame.t - span / 2 || bt > frame.t + span / 2) continue;
      ctx.beginPath();
      ctx.moveTo(x(bt), tl.y);
      ctx.lineTo(x(bt), br.y);
      ctx.stroke();
    }
    for (const cues of this.parts) {
      if (muted || frame.muted.has(cues.track.id)) continue;
      ctx.fillStyle = cues.track.color;
      const from = cues.lane.lastIndex(frame.t - span / 2) - 8;
      for (let i = Math.max(0, from); i < cues.lane.hits.length; i++) {
        const hit = cues.lane.hits[i];
        if (hit.t > frame.t + span / 2) break;
        const x0 = x(hit.t);
        const x1 = x(hit.end);
        const on = hit.t <= frame.t && hit.end > frame.t;
        ctx.globalAlpha = on ? 1 : 0.6;
        ctx.fill(roundRect(x0, y(hit.pitch) - bar / 2, Math.max(1, x1 - x0 - 0.4), bar, bar / 2));
        if (on) {
          ctx.globalAlpha = 0.35;
          ctx.fill(roundRect(x0 - 1, y(hit.pitch) - bar, Math.max(2, x1 - x0 + 1.6), bar * 2, bar));
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(tl.x + w / 2 - 0.2, tl.y, 0.4, h);
    ctx.restore();
    ctx.restore();
  }

  /** Draws the robot's body and returns a function that draws its arms, for after the laptop. */
  private robot(p: Painter, frame: FrameInfo, pal: Palette, muted: boolean): () => void {
    const { t, wall, beat } = frame;
    // The robot sits on a stool left of the laptop; its model space is centimetres from the seat.
    const seat = this.p3(-14, 62, 34);
    const k = seat.k;
    const at = (x: number, y: number): Pt => pt(seat.x + x * k, seat.y - y * k);
    const playing = !muted;
    const bob = playing ? Math.exp(-((beat % 1) * 5)) * 1.2 : 0;
    // Stool.
    p.part(capsule(at(-2, 0), at(-2, -60), 1.4 * k, 1.4 * k), pal.joint, { rim: false });
    p.part(ellipse(at(0, 1).x, at(0, 1).y, 14 * k, 3.5 * k), pal.joint);
    // Legs, bent at the knee, feet on the stool's ring.
    for (const side of [-1, 1]) {
      const hip = at(side * 5, 6);
      const knee = at(18 + side * 2, 4);
      const foot = at(20 + side * 3, -38);
      p.part(capsule(knee, foot, 3.6 * k, 3 * k), pal.shellDark);
      p.part(capsule(hip, knee, 5 * k, 4.2 * k), pal.shell);
      p.part(roundRect(foot.x - 2 * k, foot.y - 2 * k, 10 * k, 5 * k, 2 * k), pal.joint);
    }
    // Torso: a rounded shell, the chest ring breathing with the bass.
    const hips = at(0, 8 - bob * 0.3);
    const chest = at(3, 44 - bob);
    const torso = blob([add(hips, pt(-12 * k, 0)), add(hips, pt(12 * k, 0)), add(chest, pt(15 * k, -2 * k)), add(chest, pt(11 * k, -10 * k)), add(chest, pt(-11 * k, -10 * k)), add(chest, pt(-15 * k, -2 * k))], 0.8);
    p.part(torso, pal.shell);
    const ringC = add(lerp(hips, chest, 0.62), pt(4 * k, 0));
    const throb = playing && this.bass ? pulse(this.bass, t, 0.3) : 0;
    p.part(ellipse(ringC.x, ringC.y, 5 * k, 5 * k), pal.visor, { rim: false });
    p.line(ellipse(ringC.x, ringC.y, 3.4 * k, 3.4 * k), EYE, (0.8 + throb * 1.2) * k, 0.5 + throb * 0.5);
    // Head: a rounded box with a dark visor, two eyes looking at the hologram.
    const neck = at(3, 46 - bob);
    const head = at(5 + (playing ? Math.sin(beat * Math.PI * 0.5) * 0.8 : 0), 62 - bob * 1.6);
    p.part(capsule(neck, head, 3 * k, 3 * k), pal.joint, { rim: false });
    const hw = 15 * k;
    const hh = 12 * k;
    p.part(roundRect(head.x - hw, head.y - hh, hw * 2, hh * 2, 6 * k), pal.shell);
    p.part(roundRect(head.x - hw + 3.2 * k, head.y - hh + 4.6 * k, hw * 2 - 4.4 * k, hh * 2 - 8.6 * k, 4 * k), pal.visor, { rim: false });
    const lookX = 3 * k;
    const blink = blinking(wall, 0.6);
    for (const s of [-1, 1]) {
      const e = pt(head.x + lookX + s * 6 * k, head.y - 0.6 * k);
      if (blink) p.line(curve([pt(e.x - 2.6 * k, e.y), pt(e.x + 2.6 * k, e.y)]), EYE, 1.2 * k);
      else {
        p.flat(ellipse(e.x, e.y, 3 * k, 3.6 * k), "rgba(92,242,255,0.25)");
        p.flat(ellipse(e.x, e.y, 2 * k, 2.6 * k), EYE);
      }
    }
    p.line(curve([pt(head.x + lookX - 3 * k, head.y + 4.4 * k), pt(head.x + lookX, head.y + 5.6 * k), pt(head.x + lookX + 3 * k, head.y + 4.4 * k)]), EYE, 0.9 * k, 0.9);
    // Antenna, its tip flashing on the kick.
    const tip = pt(head.x - 6 * k, head.y - hh - 9 * k);
    p.line(curve([pt(head.x - 5 * k, head.y - hh), tip]), pal.joint, 1 * k);
    const flash = playing && this.kick ? pulse(this.kick, t, 0.15) : 0;
    p.flat(ellipse(tip.x, tip.y, (2 + flash * 3) * k, (2 + flash * 3) * k), "rgba(255,90,140,0.35)", flash);
    p.part(ellipse(tip.x, tip.y, 1.8 * k, 1.8 * k), mix("#8a3050", "#ff5a8c", flash), { rim: false });
    // Arms reach to the laptop's keys: a tap for every note of the lead.
    const keyRow = (u: number) => this.p3(16 + u * 26, 77.5, 33 + u * 2);
    return () => {
      for (const side of ["left", "right"] as const) {
        const lane = this.hands[side];
        const s = playing ? strike(lane, t, { rebound: 0.07, prep: 0.09, fullGap: 0.35, rest: 0.6 }) : { lift: 0.8, prev: undefined, next: undefined, travel: 0 };
        const target = s.next ?? s.prev;
        const u = target ? clamp((target.pitch - 48) / 40) : side === "left" ? 0.25 : 0.75;
        const base = keyRow(side === "left" ? u * 0.55 : 0.45 + u * 0.55);
        const hand = pt(base.x, base.y - s.lift * 6 * k);
        const shoulder = add(chest, pt((side === "left" ? -4 : 9) * k, -4 * k));
        const ik = reach(shoulder, hand, 21 * k, 21 * k);
        const elbow = ik.mids[0].y > ik.mids[1].y ? ik.mids[0] : ik.mids[1];
        p.part(capsule(elbow, ik.end, 2.6 * k, 2.4 * k), pal.shellDark);
        p.part(capsule(shoulder, elbow, 3.2 * k, 2.8 * k), pal.shell);
        p.part(ellipse(elbow.x, elbow.y, 2.6 * k, 2.6 * k), pal.joint, { rim: false });
        // A mitten hand with a pointing finger.
        p.part(roundRect(ik.end.x - 3 * k, ik.end.y - 2.4 * k, 6 * k, 4.4 * k, 2 * k), pal.shell);
        p.part(capsule(pt(ik.end.x + 2 * k, ik.end.y), pt(ik.end.x + 4.4 * k, ik.end.y + 2 * k), 0.9 * k, 0.8 * k), pal.shell);
      }
    };
  }

  regions(): Region[] {
    const a = this.p3(-50, 40, 34);
    const b = this.p3(90, 220, 34);
    return [this.region(this.ids, "the robot producer (the whole remix)", a.x, b.y, b.x, a.y)];
  }
}
