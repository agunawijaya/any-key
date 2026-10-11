import { GRAVITY } from "./ballistics";
import { heightAt, type Terrain } from "./terrain";

/*
 * Field Artillery's flight model: a point mass with drag, flying through
 * air that moves with the wind, over real ground. It is the Campaign's air
 * model given a third dimension, so a wind across the line of fire carries
 * a round sideways the way a wind along it carries it long or short.
 *
 *   x  metres along the line of fire, from the gun's first position
 *   y  metres above the lowest ground (the terrain's own heights)
 *   z  metres across the line of fire, positive to the gunner's right
 *
 * The same fixed-step RK4 integrator as the Campaign flies every shell, and
 * a round comes down where its path first meets the ground: on the far side
 * of a crest, or on the crest itself if the barrel was laid too flat.
 */

/** Propellant charges a battery could load, as muzzle speeds in m/s: charge 1 is the gentlest. */
export type FieldGun = { charges: readonly number[]; drag: number };

/** The battery's field gun, four charges from a lob to its longest throw. */
export const FIELD_GUN: FieldGun = { charges: [190, 245, 300, 370], drag: 4e-5 };

/** What the gun crew sets: the charge (1 to the gun's count), elevation in degrees, line in mils (positive is right). */
export type Aim = { charge: number; elevation: number; line: number };

/** Wind in m/s: `along` blows from the gun towards the target (a tailwind), `across` blows towards the gunner's right. */
export type Wind = { along: number; across: number };

export type FieldSample = { t: number; x: number; y: number; z: number };

export type FieldFlight = {
  /** Where it came down. */
  burst: { x: number; y: number; z: number };
  /** Seconds in the air. */
  time: number;
  /** Highest point, metres above the lowest ground. */
  apex: number;
  /** The path every `SAMPLE_EVERY` seconds for drawing; the last sample is the burst. */
  path: FieldSample[];
  /** Came down while still climbing: the barrel was too flat for the crest in the way. */
  intoCrest: boolean;
};

/** Mils in a full circle, as the gun's dial has them. */
export const MILS = 6400;
export const milsToRadians = (mils: number) => (mils * 2 * Math.PI) / MILS;
/** The line, in mils, that moves a round `metres` sideways at `distance`. */
export const milsFor = (metres: number, distance: number) => (Math.atan2(metres, Math.max(1, distance)) * MILS) / (2 * Math.PI);

const STEP = 0.1;
const SAMPLE_EVERY = 0.2;
/** The muzzle stands this far above the ground the gun stands on. */
export const MUZZLE_HEIGHT = 1.2;
/** The first fraction of a second is spent leaving the gun pit: the ground there cannot stop the round. */
const CLEAR_OF_THE_PIT = 0.3;
const LONGEST_FLIGHT = 240;

type State = { x: number; y: number; z: number; vx: number; vy: number; vz: number };

function accelerate(drag: number, wind: Wind, s: State): [number, number, number] {
  // Drag acts on the shell's speed through the air, and the air moves with the wind.
  const rx = s.vx - wind.along;
  const rz = s.vz - wind.across;
  const speed = Math.hypot(rx, s.vy, rz);
  return [-drag * speed * rx, -GRAVITY - drag * speed * s.vy, -drag * speed * rz];
}

function rk4(drag: number, wind: Wind, s: State, dt: number): State {
  const f = (p: State): State => {
    const [ax, ay, az] = accelerate(drag, wind, p);
    return { x: p.vx, y: p.vy, z: p.vz, vx: ax, vy: ay, vz: az };
  };
  const add = (p: State, d: State, h: number): State => ({ x: p.x + d.x * h, y: p.y + d.y * h, z: p.z + d.z * h, vx: p.vx + d.vx * h, vy: p.vy + d.vy * h, vz: p.vz + d.vz * h });
  const k1 = f(s);
  const k2 = f(add(s, k1, dt / 2));
  const k3 = f(add(s, k2, dt / 2));
  const k4 = f(add(s, k3, dt));
  const mix = (key: keyof State) => s[key] + (dt / 6) * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key]);
  return { x: mix("x"), y: mix("y"), z: mix("z"), vx: mix("vx"), vy: mix("vy"), vz: mix("vz") };
}

/** Muzzle speed of a charge, counted from 1. */
export const muzzleSpeedOf = (gun: FieldGun, charge: number) => gun.charges[Math.min(gun.charges.length, Math.max(1, Math.round(charge))) - 1];

/**
 * Flies one round from a gun standing at `gunX` along the line of fire,
 * laid at `aim`, until it meets the ground.
 */
export function flyField(
  gun: FieldGun,
  aim: Aim,
  gunX: number,
  terrain: Terrain | ((x: number) => number),
  wind: Wind = { along: 0, across: 0 },
  options: { muzzle?: number; speed?: number } = {},
): FieldFlight {
  // `speed` scales the charge's muzzle speed: a worn barrel, or one round's powder a little stronger than the next.
  const v = muzzleSpeedOf(gun, aim.charge) * (options.speed ?? 1);
  const up = (aim.elevation * Math.PI) / 180;
  const across = milsToRadians(aim.line);
  // The ground as heights along this gun's line of fire: a terrain, or (for a gun firing the other way) a function.
  const ground = typeof terrain === "function" ? terrain : (x: number) => heightAt(terrain, x);
  let s: State = {
    x: gunX,
    y: ground(gunX) + (options.muzzle ?? MUZZLE_HEIGHT),
    z: 0,
    vx: v * Math.cos(up) * Math.cos(across),
    vy: v * Math.sin(up),
    vz: v * Math.cos(up) * Math.sin(across),
  };
  let t = 0;
  let apex = s.y;
  const path: FieldSample[] = [{ t: 0, x: s.x, y: s.y, z: s.z }];
  let nextSample = SAMPLE_EVERY;
  while (t < LONGEST_FLIGHT) {
    const next = rk4(gun.drag, wind, s, STEP);
    if (t + STEP > CLEAR_OF_THE_PIT && next.y <= ground(next.x)) {
      // Down through the ground somewhere in this step: halve the step until the meeting is found to a hair.
      let lo = 0;
      let hi = STEP;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const p = rk4(gun.drag, wind, s, mid);
        if (p.y <= ground(p.x)) hi = mid;
        else lo = mid;
      }
      const end = rk4(gun.drag, wind, s, hi);
      const burst = { x: end.x, y: ground(end.x), z: end.z };
      path.push({ t: t + hi, x: burst.x, y: burst.y, z: burst.z });
      return { burst, time: t + hi, apex, path, intoCrest: end.vy > 0 };
    }
    s = next;
    t += STEP;
    apex = Math.max(apex, s.y);
    if (t >= nextSample - 1e-9) {
      path.push({ t, x: s.x, y: s.y, z: s.z });
      nextSample += SAMPLE_EVERY;
    }
  }
  return { burst: { x: s.x, y: s.y, z: s.z }, time: t, apex, path, intoCrest: false };
}

/** Level ground at a height, for range tables and checks. */
export const levelGround = (height = 0): Terrain => ({ survey: [{ x: 0, height }], roughness: 0, seed: 0 });

/** The shell's position `t` seconds into a flight, between the samples. */
export function fieldPositionAt(flight: FieldFlight, t: number): FieldSample {
  const path = flight.path;
  if (t <= 0) return path[0];
  const last = path[path.length - 1];
  if (t >= last.t) return last;
  let i = Math.min(path.length - 2, Math.floor(t / SAMPLE_EVERY));
  while (i > 0 && path[i].t > t) i--;
  while (i < path.length - 2 && path[i + 1].t < t) i++;
  const a = path[i];
  const b = path[i + 1];
  const k = (t - a.t) / (b.t - a.t);
  return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

/** The elevations a printed table lists. */
export const TABLE_ELEVATIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70] as const;

export type FiringTableRow = {
  elevation: number;
  range: number;
  time: number;
  /** The highest point of the path above the gun. */
  apex: number;
  /** Metres a 1 m/s wind across the line carries the round sideways. */
  drift: number;
  /** Metres a 1 m/s wind behind the gun adds to the range (a wind in the gunners' faces takes them off). */
  tail: number;
};

const tables = new Map<string, FiringTableRow[]>();

/**
 * The firing table issued with the gun: for each charge and elevation, the
 * range over level ground in still air, the time of flight, the highest
 * point of the path, and the corrections for wind, rounded as a printed
 * table would be.
 */
export function firingTable(gun: FieldGun, charge: number, elevations: readonly number[] = TABLE_ELEVATIONS): FiringTableRow[] {
  const key = `${gun.charges.join(",")}/${gun.drag}/${charge}/${elevations.join(",")}`;
  const known = tables.get(key);
  if (known) return known;
  const level = levelGround();
  const fly = (elevation: number, wind: Wind) => flyField(gun, { charge, elevation, line: 0 }, 0, level, wind, { muzzle: 0 });
  const rows = elevations.map((elevation) => {
    const still = fly(elevation, { along: 0, across: 0 });
    const across = fly(elevation, { along: 0, across: 1 });
    const behind = fly(elevation, { along: 1, across: 0 });
    return {
      elevation,
      range: Math.round(still.burst.x / 10) * 10,
      time: Math.round(still.time * 10) / 10,
      apex: Math.round(still.apex / 10) * 10,
      drift: Math.round(across.burst.z * 10) / 10,
      tail: Math.round(behind.burst.x - still.burst.x),
    };
  });
  tables.set(key, rows);
  return rows;
}

