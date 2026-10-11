import { around, PLAZA } from "@/lib/sol-y-sombra/plaza";
import type { Ring } from "@/lib/sol-y-sombra/rig/ring";
import { add, addScaled, flat, flatDistance, headingDir, headingOf, headingRight, lerp, normalize, scale, sub, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import type { Camera } from "../render/camera";

/*
 * Where the camera stands. Each beat gets its own composed shot, chosen
 * when the beat begins and held still while it plays, like a run of
 * printed posters: a pass seen three-quarters on from the side the bull
 * doesn't take, a fall from a little way off, the paseo coming towards us
 * from the gate. A cut between beats is a new poster. Only the lap of
 * honour pans, to keep the matador in front of the stands he salutes.
 *
 * A held camera is also what lets the style keep its painted stands and
 * crowd in a cache instead of repainting thousands of shapes every frame.
 */

export type View = { eye: Vec3; at: Vec3; fov: number };

/** The game asks for a framing; "ring" lets the beat decide. */
export type Framing = "ring" | "crowd" | "menu";

const up = (p: Vec3, y: number): Vec3 => ({ x: p.x, y, z: p.z });

/** Whether a camera spot on the sand is still inside the ring, clear of the barrier. */
const onSand = (p: Vec3) => Math.hypot(p.x, p.z) < PLAZA.ring - 1;

/**
 * Keeps the camera on the sand: a spot beyond the barrier would put the
 * lens among the front rows, their heads filling the picture. Pulled in,
 * it rises a little to keep the same ground in view.
 */
function onTheSand(view: View): View {
  const r = Math.hypot(view.eye.x, view.eye.z);
  const limit = PLAZA.ring - 1.4;
  if (r <= limit) return view;
  const k = limit / r;
  return { ...view, eye: { x: view.eye.x * k, y: view.eye.y + (r - limit) * 0.35, z: view.eye.z * k }, fov: Math.min(0.95, view.fov * (1 + (r - limit) / 25)) };
}

export class Director {
  private view: View | null = null;
  private key = "";

  /** Points the camera for this frame. */
  frame(ring: Ring, camera: Camera, framing: Framing) {
    const key = `${framing}/${ring.beatNumber}`;
    if (key !== this.key || !this.view) {
      this.view = onTheSand(this.choose(ring, framing) ?? this.view ?? wide(ring));
      this.key = key;
    }
    if (framing === "ring" && ring.beatKind === "lap") this.view = onTheSand(lapView(ring));
    camera.look(this.view.eye, this.view.at, this.view.fov);
  }

  /** The shot for a beat, or null to keep the one before (a fall and the getting up are one shot). */
  private choose(ring: Ring, framing: Framing): View | null {
    if (framing === "menu") return menuView(ring);
    if (framing === "crowd") return crowdView(ring);
    switch (ring.beatKind) {
      case "pass":
        return ring.passing?.passer === ring.matador ? passView(ring) : wide(ring, 15, 6.5);
      case "down":
        return fallView(ring);
      case "rise":
        return null;
      case "helped-off":
      case "leave":
        return helpedOffView(ring);
      case "paseo":
        return paseoView();
      case "bull-enters":
        return entranceView();
      case "crew-work":
        return wide(ring, 18, 7.5);
      case "salute":
      case "bow":
        return crowdView(ring);
      case "bull-leaves":
        return leavingView(ring);
      case "lap":
        return lapView(ring);
      default:
        return wide(ring);
    }
  }
}

/**
 * The pass three-quarters on, from a little above the horns, on the side
 * the bull doesn't take: the matador in front, the horns going into the
 * cape behind him, the shadow line across the sand beyond.
 */
function passView(ring: Ring): View {
  const pass = ring.passing!.pass;
  const m = pass.centrePoint();
  const f = normalize(sub(flat(ring.bull.front), m));
  const away = scale(headingRight(headingOf(f)), -pass.side);
  return {
    eye: up(addScaled(addScaled(m, f, 4.5), away, 6.3), 2.0),
    at: up(addScaled(addScaled(m, f, 0.35), away, -0.7), 1.55),
    fov: 0.56,
  };
}

/** Matador and bull together, from the side, a little above. */
function wide(ring: Ring, back = 13, height = 4.6): View {
  const m = ring.matador.feet.centre();
  const b = ring.bullPresent ? flat(ring.bull.front) : addScaled(m, headingDir(ring.matador.intent.heading), 6);
  const mid = lerp(m, b, 0.5);
  const along = normalize(sub(b, m));
  let across = { x: -along.z, y: 0, z: along.x };
  // From whichever side keeps the camera inside the ring.
  if (!onSand(addScaled(mid, across, back))) across = scale(across, -1);
  const span = flatDistance(m, b);
  return {
    eye: up(addScaled(mid, across, back + span * 0.35), height),
    at: up(mid, 0.9),
    fov: 0.62,
  };
}

/** A little way off, low: the matador on the sand, the crew running in, the bull beyond. */
function fallView(ring: Ring): View {
  const m = ring.matador.feet.centre();
  const b = flat(ring.bull.front);
  const along = normalize(sub(b, m));
  let across = { x: -along.z, y: 0, z: along.x };
  if (!onSand(addScaled(addScaled(m, across, 7.5), along, -2.5))) across = scale(across, -1);
  return {
    eye: up(addScaled(addScaled(m, across, 7.5), along, -2.5), 2.6),
    at: up(addScaled(m, along, 2.2), 0.7),
    fov: 0.66,
  };
}

/** Beside the hurt matador and his helpers, a little ahead, so they walk across and towards the picture. */
function helpedOffView(ring: Ring): View {
  const m = ring.matador.feet.centre();
  const heading = ring.route ? headingOf(sub(ring.route.to, ring.route.from)) : ring.matador.intent.heading;
  const ahead = headingDir(heading);
  let across = headingRight(heading);
  if (!onSand(addScaled(addScaled(m, across, 6.5), ahead, 3))) across = scale(across, -1);
  return {
    eye: up(addScaled(addScaled(m, across, 6.5), ahead, 3), 1.8),
    at: up(addScaled(m, ahead, 1.8), 1.0),
    fov: 0.62,
  };
}

/** From mid-ring towards the great gate: the three walk in towards us. */
function paseoView(): View {
  const gate = around(PLAZA.gateAzimuth, PLAZA.ring);
  const inward = normalize(sub({ x: 0, y: 0, z: 0 }, gate));
  const side = { x: -inward.z, y: 0, z: inward.x };
  return {
    eye: up(addScaled(addScaled(gate, inward, 17), side, 3.5), 1.9),
    at: up(addScaled(gate, inward, 7), 1.5),
    fov: 0.6,
  };
}

/** Looking at the bulls' door from out on the sand as it bursts through. */
function entranceView(): View {
  const az = PLAZA.torilAzimuth;
  return {
    eye: up(around(az - 0.75, 7.5), 1.6),
    at: up(around(az + 0.2, 13.5), 1.1),
    fov: 0.72,
  };
}

/**
 * Behind the matador and low, past his raised arms to the stands he faces:
 * the crowd on its feet. Taken from where he is and the way he faces.
 */
function crowdView(ring: Ring): View {
  const m = ring.matador.feet.centre();
  // The way he turns to salute; failing that, the stands nearest him.
  const out = ring.facing !== null ? headingDir(ring.facing) : Math.hypot(m.x, m.z) > 2 ? normalize(flat(m)) : headingDir(ring.matador.intent.heading);
  const right = { x: -out.z, y: 0, z: out.x };
  return {
    eye: up(addScaled(addScaled(m, out, -5.6), right, 1.6), 0.9),
    at: up(addScaled(m, out, 20), 5.2),
    fov: 0.92,
  };
}

/** The bull getting up and walking back to its door, seen from beside its way. */
function leavingView(ring: Ring): View {
  const door = around(PLAZA.torilAzimuth, PLAZA.ring);
  const b = flat(ring.bull.front);
  const mid = lerp(b, door, 0.4);
  const along = normalize(sub(door, b));
  const across = { x: -along.z, y: 0, z: along.x };
  const back = 8 + flatDistance(b, door) * 0.45;
  const side = onSand(addScaled(mid, across, back)) ? 1 : -1;
  return {
    eye: up(addScaled(mid, across, back * side), 2.2),
    at: up(mid, 1.0),
    fov: 0.68,
  };
}

/** From the middle of the ring, turning with the matador as he walks the lap, the stands behind him. */
function lapView(ring: Ring): View {
  const m = ring.matador.feet.centre();
  const out = normalize(flat(m), { x: 1, y: 0, z: 0 });
  return {
    eye: up(addScaled(m, out, -11), 1.6),
    at: add(up(m, 1.6), scale(out, 2)),
    fov: 0.72,
  };
}

/** The game menu's ring: the hero's angle, a little wider, the action on the right of the picture. */
function menuView(ring: Ring): View {
  const pass = ring.passing?.pass;
  const m = pass ? pass.centrePoint() : ring.matador.feet.centre();
  const toBull = ring.bullPresent ? normalize(sub(flat(ring.bull.front), m)) : headingDir(0);
  const side = pass ? pass.side : 1;
  const away = scale(headingRight(headingOf(toBull)), -side);
  return {
    eye: up(addScaled(addScaled(m, toBull, 5.5), away, 8.5), 2.3),
    at: up(addScaled(addScaled(m, toBull, -1.6), away, -0.4), 1.5),
    fov: 0.6,
  };
}
