import { pulse, type Lane, type Performance } from "@/lib/music/perform/cues";
import { splitKit } from "@/lib/music/perform/hands";
import { barMap, dancePlan, type DanceMove, type DanceStep } from "@/lib/music/perform/plans";
import { mix } from "@/lib/kit/color";
import { Figure, type Look, type Pose } from "../figure";
import { castLook } from "../looks";
import { capsule, ease, ellipse, hash, lerp, poly, pt, roundRect, type Light, type Painter, type Pt } from "../paint";
import { blinking } from "../players";
import { Scene, type FrameInfo, type Region, type Theme, type World } from "../stage";

/*
 * Hip-hop: a breaker on a lino mat, the boombox beside him pumping with the
 * 808. The routine comes from dancePlan: toprock while the beat builds, a
 * drop on the last beat of the intro and a freeze on the tune's first
 * downbeat, footwork through the phrase, a freeze on the clap that ends it.
 * Every move is a pose worked out from where the dancer is in the beat, so
 * the steps land on the drums you hear.
 *
 * Night (dark) is a street corner under a sodium lamp; day (light) is a
 * basketball court with a painted wall.
 */

const FLOOR = 37;

type Key = { pelvis: Pt; lean: number; face: number; left: Pt; right: Pt; leftFoot: Pt; rightFoot: Pt; nod: number; grip: "fist" | "flat" | "open"; elbow: "out" | "down" | "up" };

const mixKey = (a: Key, b: Key, t: number): Key => ({
  pelvis: lerp(a.pelvis, b.pelvis, t),
  lean: a.lean + (b.lean - a.lean) * t,
  face: a.face + (b.face - a.face) * t,
  left: lerp(a.left, b.left, t),
  right: lerp(a.right, b.right, t),
  leftFoot: lerp(a.leftFoot, b.leftFoot, t),
  rightFoot: lerp(a.rightFoot, b.rightFoot, t),
  nod: a.nod + (b.nod - a.nod) * t,
  grip: t < 0.5 ? a.grip : b.grip,
  elbow: t < 0.5 ? a.elbow : b.elbow,
});

/** One pose per move, from the beats since the move began. */
function keyFor(move: DanceMove, b: number, reduced: boolean): Key {
  const f = b - Math.floor(b);
  const hitDown = Math.exp(-f * 4);
  switch (move) {
    case "toprock": {
      // Step forward on the beat and back, the other foot on the next; arms swing against the legs.
      const second = Math.floor(b) % 2 === 1;
      const step = Math.sin(Math.PI * f) * (reduced ? 0.4 : 1);
      const stepping = pt(6 + step * 9, FLOOR - step * 5);
      const planted = pt(-5, FLOOR);
      const swing = second ? -1 : 1;
      return {
        pelvis: pt(step * 2.5, 2 * hitDown - 2.4),
        lean: -0.03 + step * 0.07,
        face: 0.86,
        left: pt(10 + swing * 6, -40 + swing * 4),
        right: pt(-6 - swing * 8, -46 - swing * 3),
        leftFoot: second ? stepping : planted,
        rightFoot: second ? planted : stepping,
        nod: 0.2 + hitDown * 0.7,
        grip: "fist",
        elbow: "down",
      };
    }
    case "drop": {
      const t = ease(b);
      return {
        pelvis: pt(2 * t, 18 * t),
        lean: 0.62 * t,
        face: 0.7,
        left: lerp(pt(14, -44), pt(16, FLOOR - 1), t),
        right: lerp(pt(-10, -38), pt(3, FLOOR - 1), t),
        leftFoot: lerp(pt(-6, FLOOR), pt(10, FLOOR), t),
        rightFoot: lerp(pt(3, FLOOR), pt(-12, FLOOR), t),
        nod: 0.5,
        grip: "flat",
        elbow: "out",
      };
    }
    case "sixstep":
    case "kick": {
      // Low over both hands, legs walking round behind them: a full circle every two beats.
      const theta = Math.PI * b;
      const pelvis = pt(-8 + Math.cos(theta) * 4, 20 + Math.sin(theta) * 2);
      const kick = move === "kick" ? Math.exp(-f * 5) : 0;
      const lift = Math.sin(theta) > 0.55 ? 5 : 0;
      return {
        pelvis,
        lean: 0.95 + Math.sin(theta) * 0.1,
        face: 0.75,
        left: pt(22, FLOOR - 1),
        right: pt(12, FLOOR - 1 - lift),
        leftFoot: move === "kick" ? lerp(pt(pelvis.x - 8, FLOOR), pt(pelvis.x - 38, FLOOR - 12), kick) : pt(pelvis.x - 4 + Math.cos(theta) * 17, FLOOR - Math.max(0, Math.sin(theta)) * 4),
        rightFoot: pt(pelvis.x - 4 + Math.cos(theta + Math.PI) * 17, FLOOR - Math.max(0, Math.sin(theta + Math.PI)) * 4),
        nod: 0.4,
        grip: "flat",
        elbow: "out",
      };
    }
    case "freeze": {
      // A chair freeze: head near the floor, the right elbow tucked into the hip, legs folded in the air.
      const hold = Math.min(1, b / 0.12);
      return {
        pelvis: pt(12, 6 + 6 * (1 - hold)),
        lean: -2.1,
        face: 0.8,
        left: pt(16, -20),
        right: pt(-16, FLOOR - 1),
        leftFoot: pt(36, -16),
        rightFoot: pt(26, -32),
        nod: -0.3,
        grip: "flat",
        elbow: "up",
      };
    }
  }
}

type Palette = { sky: string; skyLow: string; wall: string; mortar: string; ground: string; mat: string; matStripe: string; lamp: string; mural: string[] };

const PALETTES: Record<Theme, Palette> = {
  dark: { sky: "#06060c", skyLow: "#141224", wall: "#3a2422", mortar: "#1c1110", ground: "#2a2830", mat: "#33313c", matStripe: "#4c4a58", lamp: "rgba(255, 170, 70, 0.55)", mural: ["#5a2a6a", "#2a5a6a", "#6a5a2a"] },
  light: { sky: "#7ec4f2", skyLow: "#d6efff", wall: "#d9d2c6", mortar: "#b8afa0", ground: "#b7b3ac", mat: "#5a5866", matStripe: "#7a7888", lamp: "rgba(0,0,0,0)", mural: ["#ff5a7a", "#3ddcf5", "#ffd23d", "#7a5cff"] },
};

export class Cypher extends Scene {
  readonly caption = "The breaker: toprock, down on the drop, freeze on the clap.";
  private plan: DanceStep[];
  private look: Look;
  private fig?: Figure;
  private ids: string[];
  private bass?: Lane;
  private kick?: Lane;

  constructor(perf: Performance) {
    super(perf);
    this.plan = dancePlan(barMap(perf));
    this.ids = perf.tracks.map((c) => c.track.id);
    const drums = perf.tracks.find((c) => c.track.patch.drums);
    if (drums) this.kick = splitKit(drums.lane).rightFoot;
    this.bass = perf.tracks.find((c) => c.track.role === "bass")?.lane;
    this.look = castLook(hash(`${perf.arrangement.songId}/bboy`), { outfits: ["tracksuit"], tops: ["#e2384f"], trims: ["#f6f1e8"], bottoms: ["#23232e"], shoes: ["#f6f1e8"], hair: ["cap"] }, { hairStyle: "cap", trim: "#f6f1e8", outfit: "tracksuit" });
  }

  protected world(): World {
    return { x0: -120, x1: 120, y0: -122, y1: 14 };
  }

  protected light(theme: Theme): Light {
    return theme === "dark"
      ? { dir: { x: -0.5, y: -0.86 }, shadow: "#14081c", shadeAmount: 0.5, shadeDepth: 3.4, rim: { color: "#ffb260", width: 1, alpha: 0.95 }, ink: 0.85, inkTone: "#140a18" }
      : { dir: { x: -0.6, y: -0.8 }, shadow: "#3a4a6a", shadeAmount: 0.24, shadeDepth: 3, rim: { color: "#fffbe8", width: 0.8, alpha: 0.6 }, ink: 0.8, inkTone: "#2a2a3a" };
  }

  /** The pose now, blended out of the previous move for the first third of a beat. */
  private keyAt(beat: number, reduced: boolean): Key {
    const index = this.plan.findIndex((s) => beat >= s.from - 1e-6 && beat < s.to);
    const step = this.plan[index] ?? this.plan[this.plan.length - 1] ?? { from: 0, to: 4, move: "toprock" as DanceMove };
    const now = keyFor(step.move, Math.max(0, beat - step.from), reduced);
    const prev = this.plan[index - 1];
    const into = beat - step.from;
    if (!prev || into > 0.35) return now;
    return mixKey(keyFor(prev.move, prev.to - prev.from, reduced), now, ease(into / 0.35));
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D, theme: Theme) {
    const pal = PALETTES[theme];
    const v = this.camera.view;
    const sky = ctx.createLinearGradient(0, v.y0, 0, -30);
    sky.addColorStop(0, pal.sky);
    sky.addColorStop(1, pal.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // A long wall behind the floor: bricks at night, a painted mural by day.
    const wallTop = -78;
    ctx.fillStyle = pal.wall;
    ctx.fillRect(v.x0, wallTop, v.x1 - v.x0, -6 - wallTop);
    if (theme === "dark") {
      ctx.strokeStyle = pal.mortar;
      ctx.lineWidth = 0.6;
      for (let y = wallTop; y < -6; y += 4.4) {
        ctx.beginPath();
        ctx.moveTo(v.x0, y);
        ctx.lineTo(v.x1, y);
        const offset = (Math.round((y - wallTop) / 4.4) % 2) * 5;
        for (let x = v.x0 + offset; x < v.x1; x += 10) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 4.4);
        }
        ctx.stroke();
      }
      // A rolled-down shop shutter.
      ctx.fillStyle = "#2a2a34";
      ctx.fillRect(40, -66, 60, 60);
      ctx.strokeStyle = "#3a3a46";
      for (let y = -66; y < -6; y += 2.4) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(100, y);
        ctx.stroke();
      }
    } else {
      // A mural with no words: a big setting sun behind bold diagonal bands, a scatter of dots.
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x0, wallTop, v.x1 - v.x0, -6 - wallTop);
      ctx.clip();
      ctx.fillStyle = "#ffb34a";
      ctx.beginPath();
      ctx.arc(-10, -10, 52, Math.PI, 0);
      ctx.fill();
      pal.mural.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.9;
        const x = -150 + i * 34;
        ctx.fill(poly([pt(x, -6), pt(x + 16, -6), pt(x + 76, wallTop), pt(x + 60, wallTop)]));
      });
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 40; i++) ctx.fill(ellipse(40 + (i % 8) * 6, -70 + Math.floor(i / 8) * 6, 1.2, 1.2));
      ctx.restore();
      ctx.globalAlpha = 1;
      // A basketball hoop on its pole.
      ctx.fillStyle = "#5a5a66";
      ctx.fillRect(98, -96, 2.4, 90);
      ctx.fillStyle = "#f6f6f2";
      ctx.fillRect(86, -96, 18, 12);
      ctx.strokeStyle = "#ff6a2a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(92, -84, 5, 1.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = pal.ground;
    ctx.fillRect(v.x0, -6, v.x1 - v.x0, v.y1 + 6);
    // The lino: a grey roll with a stripe along it.
    ctx.fillStyle = pal.mat;
    ctx.fill(poly([pt(-74, -4), pt(74, -4), pt(84, 8), pt(-84, 8)]));
    ctx.fillStyle = pal.matStripe;
    ctx.fill(poly([pt(-75, -1), pt(75, -1), pt(76.6, 1), pt(-76.6, 1)]));
    if (theme === "dark") {
      // The sodium lamp on its pole and the cone it throws.
      ctx.fillStyle = "#1a1a22";
      ctx.fillRect(-104, -96, 2.6, 92);
      ctx.fillRect(-104, -96, 24, 2.4);
      ctx.fillStyle = "#ffcf8a";
      ctx.fill(ellipse(-82, -92, 4, 1.6));
      const cone = ctx.createLinearGradient(0, -92, 0, 10);
      cone.addColorStop(0, pal.lamp);
      cone.addColorStop(1, "rgba(255, 170, 70, 0.08)");
      ctx.fillStyle = cone;
      ctx.fill(poly([pt(-86, -92), pt(-78, -92), pt(40, 10), pt(-110, 10)]));
    }
  }

  protected paintScene(p: Painter, frame: FrameInfo) {
    const muted = this.ids.every((id) => frame.muted.has(id));
    this.boombox(p, frame, muted);
    const fig = (this.fig ??= new Figure(p, this.look));
    const key = muted ? keyFor("toprock", 0.0, true) : this.keyAt(frame.beat, frame.reduced);
    const pose: Pose = {
      lean: key.lean,
      face: key.face,
      pelvis: key.pelvis,
      head: { tilt: 0, nod: key.nod, eyes: blinking(frame.wall, 0.2) ? "closed" : "open", mouth: 0, brows: 0.2 },
      arms: { left: { hand: key.left, elbow: key.elbow, grip: key.grip }, right: { hand: key.right, elbow: key.elbow, grip: key.grip } },
      legs: { left: { foot: key.leftFoot, toe: 1 }, right: { foot: key.rightFoot, toe: 1 } },
      breath: (Math.sin(frame.wall * 2.2) + 1) / 2,
    };
    fig.set(pose);
    p.contactShadow(fig.sk.pelvis.x, 1, 30, 4, "#000000", frame.theme === "dark" ? 0.5 : 0.25);
    p.ctx.save();
    p.ctx.translate(0, -FLOOR);
    // The far limbs first, then the body, then the near ones.
    fig.arm("left");
    fig.legs("left");
    fig.torso();
    fig.head();
    fig.legs("right");
    fig.arm("right");
    p.ctx.restore();
  }

  /** A boombox on the ground, its woofers pushing out with the 808 and the kick. */
  private boombox(p: Painter, frame: FrameInfo, muted: boolean) {
    const x = -96;
    const y = -2;
    const thump = muted ? 0 : Math.max(this.bass ? pulse(this.bass, frame.t, 0.15) : 0, this.kick ? pulse(this.kick, frame.t, 0.12) : 0);
    p.part(roundRect(x - 18, y - 22, 36, 22, 3), "#2a2a34");
    p.part(capsule(pt(x - 12, y - 24), pt(x + 12, y - 24), 1.2, 1.2), "#9a98a6", { rim: false });
    for (const side of [-1, 1]) {
      const c = pt(x + side * 9.5, y - 11);
      p.part(ellipse(c.x, c.y, 7.2, 7.2), "#16161c");
      p.part(ellipse(c.x, c.y, 5 + thump * 0.8, 5 + thump * 0.8), mix("#3a3a46", "#5a5a6a", thump));
      p.part(ellipse(c.x, c.y, 1.6, 1.6), "#9a98a6", { rim: false });
    }
    p.part(roundRect(x - 3, y - 19, 6, 4, 1), "#3ddcf5", { rim: false, shade: false });
  }

  regions(): Region[] {
    return [this.region(this.ids, "the breaker (the whole beat)", -60, -90, 60, 10)];
  }
}
