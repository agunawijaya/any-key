import { describe, expect, it } from "vitest";
import { Cloth } from "@/lib/sol-y-sombra/rig/cloth";
import { comfortableReach, softReach, solveTwoBone } from "@/lib/sol-y-sombra/rig/ik";
import { Ring, type BeatRequest } from "@/lib/sol-y-sombra/rig/ring";
import { distance, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";

const PROGRAM: BeatRequest[] = [
  { kind: "pass", pass: "veronica", side: 1, paw: true },
  { kind: "pass", pass: "veronica", side: -1 },
  { kind: "pass", pass: "outside", side: 1 },
  { kind: "pass", pass: "swirl", side: -1 },
  { kind: "walk-off", distance: 5 },
];

/** Plays the program once and gathers what the tests judge. */
function perform(seconds: number) {
  const ring = new Ring({ program: PROGRAM, loop: false });
  const ticks = Math.round(seconds * 240);
  let footSlide = 0;
  let hoofSlide = 0;
  let torsoClearance = Infinity;
  let peakJointAccel = 0;
  let fastestCloth = 0;
  let nonFinite = false;
  let previousFeet: { toe: Vec3; heel: Vec3; planted: boolean }[] | null = null;
  let previousHooves: ReturnType<typeof ring.bull.plantedHooves> | null = null;
  const history: Vec3[][] = [];
  for (let t = 0; t < ticks; t++) {
    ring.step();
    const s = ring.skeleton;
    const feetNow = ring.feet.pose(ring.time);
    const feet = [
      {
        toe: s.footL.toe,
        heel: s.footL.heel,
        planted: feetNow.steppingL === null,
      },
      {
        toe: s.footR.toe,
        heel: s.footR.heel,
        planted: feetNow.steppingR === null,
      },
    ];
    if (previousFeet) {
      feet.forEach((f, i) => {
        if (f.planted && previousFeet![i].planted)
          footSlide = Math.max(footSlide, distance(f.toe, previousFeet![i].toe), distance(f.heel, previousFeet![i].heel));
      });
    }
    previousFeet = feet.map((f) => ({
      toe: { ...f.toe },
      heel: { ...f.heel },
      planted: f.planted,
    }));

    const hooves = ring.bull.plantedHooves();
    if (previousHooves)
      hooves.forEach((h, i) => h.planted && previousHooves![i].planted && (hoofSlide = Math.max(hoofSlide, distance(h.hoof, previousHooves![i].hoof))));
    previousHooves = hooves;

    // The horns against the matador's trunk: a line from pelvis to neck, 16 cm thick.
    for (const horn of ring.bullPose.horns) {
      for (const p of horn) {
        const a = s.pelvis;
        const b = s.neckBase;
        const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const k = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / (ab.x ** 2 + ab.y ** 2 + ab.z ** 2)));
        torsoClearance = Math.min(
          torsoClearance,
          distance(p, {
            x: a.x + ab.x * k,
            y: a.y + ab.y * k,
            z: a.z + ab.z * k,
          }) - 0.16,
        );
      }
    }

    const joints = [s.pelvis, s.head, s.wristL, s.wristR, s.kneeL, s.kneeR, s.elbowL, s.elbowR];
    history.push(joints.map((j) => ({ ...j })));
    if (history.length > 3) history.shift();
    if (history.length === 3) {
      joints.forEach((_, i) => {
        const [p0, p1, p2] = history.map((h) => h[i]);
        const accel = Math.hypot(p2.x - 2 * p1.x + p0.x, p2.y - 2 * p1.y + p0.y, p2.z - 2 * p1.z + p0.z) * 240 * 240;
        peakJointAccel = Math.max(peakJointAccel, accel);
        if (!Number.isFinite(accel)) nonFinite = true;
      });
    }

    const { pos, prev, count } = ring.cape;
    for (let i = 0; i < count * 3; i += 3) {
      const v = Math.hypot(pos[i] - prev[i], pos[i + 1] - prev[i + 1], pos[i + 2] - prev[i + 2]) * 240;
      if (!Number.isFinite(v)) nonFinite = true;
      fastestCloth = Math.max(fastestCloth, v);
    }
  }
  return {
    ring,
    footSlide,
    hoofSlide,
    torsoClearance,
    peakJointAccel,
    fastestCloth,
    nonFinite,
  };
}

const run = perform(40);

describe("Sol y Sombra rig: two-bone IK", () => {
  const root = { x: 0, y: 1, z: 0 };
  const pole = { x: 1, y: 0, z: 0 };

  it("reaches every target inside its reach exactly, with both bones kept at length", () => {
    for (let k = 0; k < 200; k++) {
      const a = (k / 200) * Math.PI * 2;
      const r = 0.15 + (k % 7) * 0.08;
      const target = {
        x: Math.cos(a) * r * 0.6,
        y: 1 - Math.sin(a) * r,
        z: Math.sin(a * 3) * r * 0.5,
      };
      if (distance(root, target) > comfortableReach(0.45, 0.43)) continue;
      const { mid, end } = solveTwoBone(root, target, 0.45, 0.43, pole);
      expect(distance(end, target)).toBeLessThan(1e-6);
      expect(distance(root, mid)).toBeCloseTo(0.45, 6);
      expect(distance(mid, end)).toBeCloseTo(0.43, 6);
    }
  });

  it("straightens smoothly out of reach instead of snapping", () => {
    let last = 0;
    for (let wanted = 0.7; wanted < 1.2; wanted += 0.005) {
      const span = softReach(wanted, 0.45, 0.43);
      expect(span).toBeLessThanOrEqual(0.88);
      expect(span).toBeGreaterThanOrEqual(last);
      // No jump bigger than the step asked for.
      if (last) expect(span - last).toBeLessThanOrEqual(0.0051);
      last = span;
    }
  });

  it("moves the elbow smoothly as a hand sweeps a cape across the body, folding close to the shoulder", () => {
    // A right shoulder; the hand sweeps from out front, in close to the chest, and out behind at waist height.
    const shoulder = { x: 0, y: 1.35, z: 0.17 };
    const elbowOut = { x: 0, y: -0.88, z: 0.48 };
    const fallback = { x: -0.82, y: 0, z: 0.57 };
    let previous: Vec3 | null = null;
    for (let k = 0; k <= 400; k++) {
      const a = -1.2 + (k / 400) * 2.6;
      const r = 0.18 + 0.35 * Math.abs(Math.sin(a * 1.3));
      const target = {
        x: Math.cos(a) * r,
        y: 1.0 + 0.08 * Math.sin(a),
        z: 0.17 + Math.sin(a) * r,
      };
      const { mid } = solveTwoBone(shoulder, target, 0.29, 0.255, elbowOut, fallback);
      if (previous) expect(distance(mid, previous)).toBeLessThan(0.02);
      previous = mid;
    }
  });
});

describe("Sol y Sombra rig: the ring in motion", () => {
  it("never lets a planted foot or hoof slide", () => {
    expect(run.footSlide).toBe(0);
    expect(run.hoofSlide).toBe(0);
  });

  it("moves the matador without pops: no joint jolts harder than a quick human movement", () => {
    expect(run.nonFinite).toBe(false);
    expect(run.peakJointAccel).toBeLessThan(150);
  });

  it("keeps the horns off the matador's body on every clean pass", () => {
    expect(run.torsoClearance).toBeGreaterThan(0.2);
  });

  it("is deterministic", () => {
    const again = new Ring({ program: PROGRAM, loop: false });
    again.advance(6);
    const first = new Ring({ program: PROGRAM, loop: false });
    first.advance(6);
    expect(again.skeleton.wristR).toEqual(first.skeleton.wristR);
    expect(Array.from(again.cape.pos)).toEqual(Array.from(first.cape.pos));
  });
});

describe("Sol y Sombra rig: the cloth", () => {
  it("stays stable through every pass: no runaway particles", () => {
    expect(run.fastestCloth).toBeLessThan(25);
  });

  it("holds its shape: links stay close to their rest lengths once it has settled", () => {
    const cloth = new Cloth({
      columns: 9,
      rows: 7,
      topWidth: 1.2,
      bottomWidth: 1.8,
      height: 1,
      mass: 2,
    });
    const left = { x: -0.4, y: 1, z: 0 };
    const right = { x: 0.4, y: 1, z: 0 };
    cloth.hangBetween(left, right, 0.1, 0.9);
    for (let t = 0; t < 480; t++) {
      cloth.setPins([
        { index: cloth.topIndex(0.1), target: left, weight: 1 },
        { index: cloth.topIndex(0.9), target: right, weight: 1 },
      ]);
      cloth.step(1 / 240, {
        gravity: 9.8,
        wind: { x: 0.5, y: 0, z: 0 },
        airDrag: 1,
      });
    }
    // Neighbours along a row and down a column, compared with the flat cloth.
    const { columns, rows } = cloth.shape;
    let worst = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns - 1; c++) {
        const i = r * columns + c;
        const rest = (1.2 + (0.6 * r) / (rows - 1)) / (columns - 1);
        worst = Math.max(worst, distance(cloth.particle(i), cloth.particle(i + 1)) / rest);
      }
    }
    expect(worst).toBeLessThan(1.08);
    expect(distance(cloth.particle(cloth.topIndex(0.1)), left)).toBeLessThan(1e-9);
  });

  it("follows the hands that hold it", () => {
    const s = run.ring.skeleton;
    const { columns } = run.ring.cape.shape;
    const grip = run.ring.grip;
    if (grip.rightHold >= 1) expect(distance(run.ring.cape.particle(Math.round(grip.right * (columns - 1))), s.gripR)).toBeLessThan(0.03);
  });
});
