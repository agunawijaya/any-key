/*
 * Proves the numbers behind Don't Crater:
 *   - 1979 mode reproduces the original's arithmetic (known flights, quirks, verdicts);
 *   - every world, mission and Daily Drop can be landed, with fuel to spare,
 *     by a simple autopilot flying the same physics the game uses.
 *
 * Run: npx tsx scripts/check-lander.ts
 */
import { gradeFor } from "../lib/lander/grades";
import { dailyDrop, dailySetup, DAILY_MARGIN, fuelMargin, MISSIONS, missionSetup } from "../lib/lander/missions";
import { newOriginalGame, ORIGINAL_WORLDS, playTurn, verdict, type OriginalGame } from "../lib/lander/original";
import { advance, gravityAt, hoverThrottle, isLost, makeSetup, startState, type FlightState, type Setup } from "../lib/lander/physics";
import { FlightSim, predictTurn } from "../components/dontcrater/sim";
import { approachAdvice, ASSIST_THROTTLE, idealPlan, landingLines, stopPoint, type Approach, type StopPoint } from "../lib/lander/solver";
import { DRY_MASS, worldById, WORLDS, type World } from "../lib/lander/worlds";
import { withDifficulty } from "../lib/lander/difficulty";
import { BUDGET_MARGIN, DRIFT, FAIR_MARGIN, FINAL_ALT, FINAL_SPEED, freeFlight, NAMED_SITES, onTarget, TANK, tankFor, targetAt, type FreeFlight, type FreeStart } from "../lib/lander/freeflight";
import { FreeSim } from "../components/dontcrater/freesim";
import type { Difficulty } from "../lib/lander/difficulty";
import { advance2d, judgeTouchdown, start2d, STAND_DRIFT, STAND_SLOPE, STAND_TILT_OFF, type Contact } from "../lib/lander/physics2d";
import { flatTarget, flyAutopilot, type AutoOptions } from "../lib/lander/solver2d";
import { buildSite, footSlope, heightAt, landingSpots, SITE_HALF, type Site } from "../lib/lander/terrain";

let failures = 0;
let verbose = false;
function check(ok: boolean, label: string) {
  if (!ok) {
    failures++;
    console.log(`  ✗ ${label}`);
  } else if (verbose) console.log(`  ✓ ${label}`);
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/* ---------- 1979 mode ---------- */

console.log("1979 mode");

function fly1979(worldKey: number, burns: number[], clock = 0) {
  let g: OriginalGame = newOriginalGame(ORIGINAL_WORLDS[worldKey - 1], clock);
  for (const b of burns) {
    const r = playTurn(g, b);
    if (r.kind === "end") return { end: r.end, turns: burns.indexOf(b) + 1, game: r.game };
    if (r.kind === "flying") g = r.game;
  }
  return { end: null, game: g, turns: burns.length };
}

// The starting numbers the listing derives from gravity.
const earth79 = newOriginalGame(ORIGINAL_WORLDS[0], 0);
check(earth79.alt === 521 && earth79.fuel === 28_655 && near(earth79.thrust, 19_869.16, 0.01), "Earth starts at 521 km with 28,655 fuel");
const asteroid79 = newOriginalGame(ORIGINAL_WORLDS[3], 0);
check(asteroid79.alt === 175 && asteroid79.fuel === 10_000, "The asteroid hits both floors: 175 km and 10,000 fuel");

// Burn nothing at all: you strike oil on every world.
const doNothing = [10_670, 5_562, 6_773, 5_046];
for (const w of ORIGINAL_WORLDS) {
  const r = fly1979(w.key, Array(200).fill(0));
  check(!!r.end && r.end.reason === "touchdown" && near(r.end.speed, doNothing[w.key - 1], 1) && verdict(r.end.speed).headline.includes("OIL"), `${w.name}: no burns → oil at ~${doNothing[w.key - 1]} km/h (got ${r.end?.speed.toFixed(0)})`);
}

// Flights found by search during design: all four worlds can be landed.
const earthPath = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 99.5, 100, 100, 100, 100, 85.5, 100, 65.71, 43.61, 37.09, 34.04, 32.1, 30.71, 29.64, 28.8, 28.1, 27.51, 27, 26.54, 27, 0];
const earthFlight = fly1979(1, earthPath);
check(!!earthFlight.end && earthFlight.end.speed < 2, `Earth can be landed perfectly in 1979 mode (got ${earthFlight.end?.speed.toFixed(3)} km/h)`);
// The clock is never reset: a second game starts where the first one ended.
const second = newOriginalGame(ORIGINAL_WORLDS[1], earthFlight.end!.clock);
check(second.clock === earthFlight.end!.clock && second.clock > 400, "The mission clock carries over into the next game");

// Out of range burns are refused, fractions are fine.
check(playTurn(earth79, -5).kind === "illegal" && playTurn(earth79, 101).kind === "illegal" && playTurn(earth79, 37.5).kind === "flying", "Burns outside 0–100 are refused");

// Verdicts and their two different cut-offs.
check(verdict(19.5).animation === "wreck" && verdict(19.5).headline === "YOU'RE DOWN!!", "19.5 km/h: a wreck on screen, a landing in the text");
check(verdict(1.9).flag && verdict(5).flag && !verdict(5.1).flag, "The flag comes out at 5 km/h or less");
check(verdict(46).animation === "boom" && verdict(45).animation === "wreck", "Explosions start above 45 km/h");
check(verdict(5000).headline.includes("OIL") && verdict(4999).headline.includes("CRATER"), "Oil from 5000 km/h");

/* ---------- The integrator against exact formulas ---------- */

console.log("Physics against exact formulas");
verbose = true;
{
  // Constant gravity (a huge radius), no engine: v = v0 + g·t, h = h0 − (v0·t + g·t²/2) / 3200.
  const flat = { ...worldById("moon"), radius: 1e12 };
  const setup = makeSetup(flat, { alt: 50, speed: 300 });
  const g = flat.g2;
  const r = advance(setup, startState(setup), 0, 60);
  const v = 300 + g * 60;
  const h = 50 - (300 * 60 + (g * 60 * 60) / 2) / 3200;
  check(near(r.state.speed, v, 1e-6) && near(r.state.alt, h, 1e-6), `free fall matches v = v0 + g·t and h = h0 − (v0·t + ½g·t²)/3200 (got ${r.state.speed.toFixed(4)} vs ${v.toFixed(4)})`);

  // Impact: the moment and speed of contact, solved exactly.
  const tHit = (-300 + Math.sqrt(300 * 300 + 2 * g * 3200 * 50)) / g;
  const hit = advance(setup, startState(setup), 0, 1000);
  check(!!hit.touchdown && near(hit.touchdown.t, tHit, 1e-6) && near(hit.touchdown.speed, 300 + g * tHit, 1e-6), `touchdown time and speed match the exact solution (${hit.touchdown?.t.toFixed(4)} s vs ${tHit.toFixed(4)} s)`);

  // No gravity, full power until the tank is empty: the rocket equation, Δv = engine × ln(full mass / empty mass).
  const space = { ...worldById("moon"), g2: 0, radius: 1e12 };
  const rocket = makeSetup(space, { alt: 1e6, speed: 9000 });
  const burnt = advance(rocket, startState(rocket), 100, rocket.fuel / 100 + 1);
  const dv = space.thrust * Math.log((DRY_MASS + rocket.fuel) / DRY_MASS);
  check(burnt.state.fuel === 0 && near(9000 - burnt.state.speed, dv, dv * 1e-5), `a full tank gives the rocket-equation Δv (${(9000 - burnt.state.speed).toFixed(2)} vs ${dv.toFixed(2)} km/h)`);

  // Hover: the throttle hoverThrottle() returns holds the speed for a second.
  const moon = makeSetup(worldById("moon"), { alt: 0.5, speed: 10 });
  const hov = advance(moon, startState(moon), hoverThrottle(moon, startState(moon)), 1);
  check(near(hov.state.speed, 10, 0.02), `the hover throttle holds the speed steady (${hov.state.speed.toFixed(4)} km/h)`);

  // Halving the step size changes a whole flight by almost nothing.
  const earth = makeSetup(worldById("earth"));
  const coarse = advance(earth, startState(earth), 60, 300, 0.04).state;
  const fine = advance(earth, startState(earth), 60, 300, 0.01).state;
  check(near(coarse.alt, fine.alt, 1e-4) && near(coarse.speed, fine.speed, 1e-3), `step size doesn't matter (after 300 s: Δh ${(1000 * Math.abs(coarse.alt - fine.alt)).toFixed(4)} m, Δv ${Math.abs(coarse.speed - fine.speed).toExponential(1)} km/h)`);
}

/* ---------- Full power from the start: what a first-time pilot often does ---------- */

console.log("Full power from the start");
{
  const expected: Record<string, { stop: number; end: string }> = { moon: { stop: 135.9, end: "crater" }, mars: { stop: 231.3, end: "oil" }, earth: { stop: 375.4, end: "oil" }, psyche: { stop: 100.0, end: "lost" } };
  const fromOriginal: Record<string, number> = { moon: 2, mars: 3, earth: 1 };
  for (const w of WORLDS) {
    const setup = makeSetup(w);
    let s = startState(setup);
    let stopAt = NaN;
    let end = "";
    let impact = 0;
    for (let i = 0; i < 400_000 && !end; i++) {
      const r = advance(setup, s, 100, 0.05);
      if (Number.isNaN(stopAt) && s.speed > 0 && r.state.speed <= 0) stopAt = r.state.alt;
      s = r.state;
      if (r.touchdown) {
        impact = r.touchdown.speed;
        end = gradeFor(impact);
      } else if (isLost(setup, s)) end = "lost";
    }
    const e = expected[w.id];
    check(near(stopAt, e.stop, 0.2) && end === e.end, `${w.name}: stops ${stopAt.toFixed(1)} km up, climbs, runs dry and ends as "${end}"`);
    // The 1979 program jumps straight to the fall when the tank runs dry; our full flight must agree.
    const key = fromOriginal[w.id];
    if (key) {
      let g: OriginalGame = newOriginalGame(ORIGINAL_WORLDS[key - 1], 0);
      let judged = 0;
      for (;;) {
        const r = playTurn(g, 100);
        if (r.kind === "end") {
          judged = r.end.speed;
          break;
        }
        if (r.kind === "flying") g = r.game;
      }
      check(Math.abs(impact - judged) / judged < 0.04, `${w.name}: our simulated fall (${impact.toFixed(0)} km/h) agrees with the 1979 shortcut (${judged.toFixed(0)} km/h)`);
    }
  }
}

verbose = false;

/* ---------- The modern game ---------- */

/**
 * A plain autopilot: fall until a full burn would stop you about 2 km up,
 * burn until then, then ease down along a target speed that shrinks with height.
 */
function autopilot(setup: Setup, s: FlightState, burning: boolean) {
  if (s.alt > 3) {
    const p = stopPoint(setup, s, 0.1);
    if (!p.stops || p.alt < 1.5) return 100;
    if (burning && p.alt < 2.5) return 100;
    return 0;
  }
  const target = Math.max(0.8, Math.min(150, 120 * Math.sqrt(s.alt) - 3));
  const mass = hoverThrottle(setup, s) / Math.max(1e-9, setup.world.g2);
  const needed = setup.world.g2 + (s.speed - target) / 1.2;
  return Math.max(0, Math.min(100, needed * mass));
}

function autoLand(setup: Setup) {
  let s = startState(setup);
  let throttle = 0;
  for (let i = 0; i < 200_000; i++) {
    throttle = autopilot(setup, s, throttle > 50);
    const r = advance(setup, s, throttle, 0.25);
    s = r.state;
    if (r.touchdown) return { speed: r.touchdown.speed, fuel: r.touchdown.fuel / setup.fuel, t: r.touchdown.t };
  }
  return { speed: Infinity, fuel: 0, t: s.t };
}

console.log("Worlds");
for (const world of WORLDS) {
  const setup = makeSetup(world);
  const plan = idealPlan(setup, startState(setup));
  const flight = autoLand(setup);
  console.log(
    `  ${world.name.padEnd(7)} start ${world.startAlt} km · tank ${world.fuel} · engine ${world.thrust.toFixed(0)} · perfect hoverslam: burn at ${plan.burnStartAlt.toFixed(1)} km, ${((100 * plan.fuelLeft) / setup.fuel).toFixed(1)}% left, ${plan.duration.toFixed(0)} s · autopilot: ${flight.speed.toFixed(2)} km/h, ${(100 * flight.fuel).toFixed(1)}% left`,
  );
  check(plan.possible && plan.fuelLeft / setup.fuel > 0.08, `${world.name}: a perfect hoverslam leaves over 8% of the tank`);
  check(flight.speed < 2, `${world.name}: the autopilot lands under 2 km/h`);
  // Doing nothing strikes oil here too.
  let s = startState(setup);
  for (let i = 0; i < 10_000; i++) {
    const r = advance(setup, s, 0, 1);
    s = r.state;
    if (r.touchdown) {
      check(gradeFor(r.touchdown.speed) === "oil", `${world.name}: a flight without burning strikes oil (${r.touchdown.speed.toFixed(0)} km/h)`);
      break;
    }
  }
}

console.log("Missions");
for (const m of MISSIONS) {
  const setup = missionSetup(m);
  const margin = fuelMargin(setup);
  const flight = autoLand(setup);
  console.log(`  ${String(m.id).padStart(2)} ${m.name.padEnd(18)} margin ${(100 * margin).toFixed(1)}% · autopilot ${flight.speed.toFixed(2)} km/h, ${(100 * flight.fuel).toFixed(1)}% left`);
  check(margin >= 0.05, `Mission ${m.id}: at least 5% of the tank to spare`);
  check(flight.speed < (m.clearBelow ?? 20), `Mission ${m.id}: the autopilot clears it`);
}

/*
 * The landing assist. The green line: a pilot who only keeps the lander just
 * above it (braking at the planned 85% there, harder below it) must land under
 * 5 km/h. The amber line: a full burn started exactly on it must touch down at
 * 20 km/h, and one started a little below it must be too fast.
 */
function flyByGreenLine(setup: Setup) {
  let s = startState(setup);
  for (let i = 0; i < 400_000; i++) {
    const L = landingLines(setup, s);
    const throttle = L.five === null || s.alt < L.five ? 100 : s.alt < L.five * 1.04 && s.speed > 5 ? ASSIST_THROTTLE : 0;
    const r = advance(setup, s, throttle, 0.05);
    s = r.state;
    if (r.touchdown) return { speed: r.touchdown.speed, fuel: r.touchdown.fuel / setup.fuel };
  }
  return { speed: Infinity, fuel: 0 };
}

function fullBurnFrom(setup: Setup, state: FlightState) {
  let s = state;
  for (let i = 0; i < 400_000; i++) {
    const r = advance(setup, s, 100, 0.02);
    s = r.state;
    if (r.touchdown) return r.touchdown.speed;
    if (s.speed <= 0) return 0;
  }
  return Infinity;
}

console.log("Landing assist");
const labelOf = (m?: { name: string }) => (m ? `mission "${m.name}"` : "standard");
for (const [setup, label] of [...WORLDS.map((w) => [makeSetup(w), labelOf()] as const), ...MISSIONS.filter((m) => !m.noGuide).map((m) => [missionSetup(m), labelOf(m)] as const)]) {
  const soft = flyByGreenLine(setup);
  check(soft.speed < 5, `${setup.world.name}, ${label}: keeping above the green line lands under 5 km/h (${soft.speed.toFixed(2)})`);
  for (const speed of [4800, 1500, 300, 80, 35]) {
    const probe = { t: 0, alt: 50, speed, fuel: setup.fuel * 0.5 };
    const L = landingLines(setup, probe);
    if (L.twenty === null) continue;
    const on = fullBurnFrom(setup, { ...probe, alt: L.twenty });
    const under = fullBurnFrom(setup, { ...probe, alt: L.twenty * 0.98 });
    // Landing speed is very sensitive to where the burn starts: 0.1% of the braking distance
    // is worth 1.5 km/h at 300 km/h but 50 km/h at 4800. So the line must be right to 0.05%.
    const distanceError = Math.abs(on * on - 400) / (speed * speed);
    check(distanceError < 0.0005 && under > 20, `${setup.world.name}, ${label}: from ${speed} km/h, a full burn from the amber line lands at ${on.toFixed(1)} km/h (line within ${(100 * distanceError).toFixed(3)}%); 2% lower, ${under.toFixed(0)} km/h`);
  }
}
for (const w of WORLDS) {
  const soft = flyByGreenLine(makeSetup(w));
  console.log(`  ${w.name.padEnd(7)} flying only by the green line: ${soft.speed.toFixed(2)} km/h, ${(100 * soft.fuel).toFixed(1)}% fuel left`);
}

/*
 * Human pilots. The same FlightSim the game runs, stepped at 60 frames a second
 * with its time warp, flown by a pilot who sees everything 0.8 s late (a slow
 * human reaction plus a key press), uses whole-number throttle settings, and
 * does only what the screen shows:
 *   - "assist": follows the landing assist's lines and advice;
 *   - "guide": follows the burn guide (the default helper);
 *   - "expert": no helpers on screen, but knows the lines by heart from earlier
 *     flights, and while the speedometer is dark (mission 8) brakes from the
 *     height remembered from the same world, easing off if the altitude rises.
 * Every world, mission and Daily Drop must be survivable this way.
 */
type Seen = { alt: number; speed: number; fuel: number; t: number; lines: FlightSim["lines"]; stop: FlightSim["stop"]; burnIn: number; advice: Approach; dark: boolean };
type Style = "assist" | "guide" | "expert";

function humanPilot(setup: Setup, style: Style, reference: Setup = makeSetup(setup.world)) {
  let key = 0;
  let lastAlt = Infinity;
  const remembered = idealPlan(reference, startState(reference)).burnStartAlt * 1.08;
  return (v: Seen) => {
    const climbing = v.alt > lastAlt + 1e-4;
    lastAlt = v.alt;
    if (v.dark) return (key = climbing ? 0 : v.alt <= remembered ? 100 : 0);
    const L = style === "expert" ? landingLines(setup, v) : v.lines;
    if (v.speed < -5) return (key = 0);
    if (v.alt < 2 && (v.alt < 0.06 || v.speed < 40)) {
      if (L && L.twenty !== null && v.alt < L.twenty && v.speed > 20) return (key = 100);
      if (v.advice.verdict === "fast") return (key = v.advice.brake);
      if (v.advice.verdict === "slow") return (key = 0);
      return key;
    }
    if (style !== "guide") {
      if (!L) return (key = 0);
      if (L.twenty === null || v.alt < L.twenty || L.five === null || v.alt < L.five) return (key = 100);
      if (v.alt < L.five * 1.08 + 0.0003) return (key = 90);
      return (key = 0);
    }
    const stop = v.stop;
    if (!stop || !stop.stops || v.burnIn < 2) return (key = 100);
    if (key === 100 && stop.alt < Math.max(1.5, v.alt * 0.3)) return key;
    return (key = 0);
  };
}

function flyLikeAHuman(setup: Setup, style: Style, speedDarkAbove?: number, reference?: Setup) {
  const sim = new FlightSim(setup, "live", style === "guide");
  sim.assist = style === "assist";
  const pilot = humanPilot(setup, style, reference);
  const history: Seen[] = [];
  for (let frame = 0; frame < 60 * 60 * 20; frame++) {
    const st = sim.state;
    const dark = speedDarkAbove !== undefined && st.alt > speedDarkAbove;
    history.push({ ...st, lines: sim.lines, stop: sim.stop, burnIn: sim.burnIn, advice: approachAdvice(setup, st), dark });
    sim.lever = pilot(history[Math.max(0, history.length - 48)]);
    for (const e of sim.update(1 / 60)) {
      if (e.kind === "touchdown") return e.speed;
      if (e.kind === "lost") return Infinity;
    }
  }
  return Infinity;
}

console.log("Human pilots (0.8 s reaction, whole-number throttle)");
for (const w of WORLDS) {
  const [assist, guide, expert] = (["assist", "guide", "expert"] as const).map((style) => flyLikeAHuman(makeSetup(w), style));
  console.log(`  ${w.name.padEnd(7)} landing assist ${assist.toFixed(1)} · burn guide ${guide.toFixed(1)} · no helpers ${expert.toFixed(1)} km/h`);
  check(assist < 20 && guide < 20 && expert < 20, `${w.name}: a slow human survives with the assist, with the guide, and with no helpers`);
}
for (const m of MISSIONS) {
  const v = flyLikeAHuman(missionSetup(m), m.noGuide ? "expert" : "guide", m.speedDarkAbove);
  check(v < (m.clearBelow ?? 20), `Mission ${m.id}: a slow human clears it (${v.toFixed(1)} km/h)`);
  if (m.noGuide) console.log(`  mission ${m.id} ${m.name}, no helpers: ${v.toFixed(1)} km/h`);
}
{
  let flights = 0;
  let worst = 0;
  for (let d = 0; d < 365; d += 30) {
    const setup = dailySetup(dailyDrop(new Date(2026, 0, 1 + d)));
    for (const style of ["assist", "guide"] as const) {
      const v = flyLikeAHuman(setup, style);
      flights++;
      worst = Math.max(worst, v);
      check(v < 20, `Daily ${d}: a slow human lands with the ${style} (${v.toFixed(1)} km/h)`);
    }
  }
  console.log(`  ${flights} Daily Drop flights, slowest touchdown ${worst.toFixed(1)} km/h`);
}

/* Ten-Second mode with whole-number burns, deciding only from the prediction panel. */
console.log("Ten-Second, whole-number burns");
function tenSecondPilot(setup: Setup) {
  let s = startState(setup);
  for (let turns = 1; turns < 400; turns++) {
    const options = Array.from({ length: 101 }, (_, b) => ({ b, p: predictTurn(setup, s, b) }));
    const gentle = options.filter((o) => o.p.touchdown !== null && Math.abs(o.p.touchdown) < 5).sort((a, b) => Math.abs(a.p.touchdown!) - Math.abs(b.p.touchdown!))[0];
    const safe = options.find((o) => o.p.touchdown === null && o.p.stop?.stops && o.p.stop.alt > Math.min(0.3, s.alt * 0.02));
    const lowAndSlow = s.alt < 1 ? options.find((o) => o.p.touchdown === null && o.p.after.speed >= 0 && o.p.after.speed < 10 && o.p.after.alt < s.alt) : undefined;
    const r = advance(setup, s, (gentle ?? lowAndSlow ?? safe ?? options[100]).b, 10);
    s = r.state;
    if (r.touchdown) return r.touchdown.speed;
  }
  return Infinity;
}
for (const w of WORLDS.filter((x) => x.id !== "earth")) {
  const v = tenSecondPilot(makeSetup(w));
  check(v < 5, `${w.name}: landed under 5 km/h in Ten-Second mode with whole burns (${v.toFixed(2)})`);
}
{
  // Earth needs a little more planning at the end; this flight was found by search.
  const earth = makeSetup(worldById("earth"));
  let s = startState(earth);
  let v = Infinity;
  for (const b of [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 99, 100, 30, 28, 39]) {
    const r = advance(earth, s, b, 10);
    s = r.state;
    if (r.touchdown) v = r.touchdown.speed;
  }
  check(v < 2, `Earth: a whole-burn Ten-Second flight lands at ${v.toFixed(2)} km/h`);
}

/* 1979 mode with whole-number burns: flights found by search, one per world. */
console.log("1979 mode, whole-number burns");
{
  const flights: [number, number[]][] = [
    [1, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 43, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 91, 100, 100, 100, 100, 33, 29, 5]],
    [2, [0, 0, 0, 0, 0, 0, 0, 12, 100, 100, 100, 100, 100, 100, 100, 100, 99, 23, 20, 1, 0]],
    [3, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 94, 100, 100, 100, 100, 99, 100, 100, 100, 100, 100, 100, 39, 25, 16, 2]],
    [4, [0, 0, 0, 0, 0, 0, 58, 100, 100, 100, 99, 100, 100, 100, 100, 2, 13, 7, 1, 0]],
  ];
  for (const [key, burns] of flights) {
    const r = fly1979(key, burns);
    check(!!r.end && r.end.reason === "touchdown" && Math.abs(r.end.speed) < 5, `${ORIGINAL_WORLDS[key - 1].name}: whole burns only, landed at ${r.end ? Math.abs(r.end.speed).toFixed(2) : "?"} km/h`);
  }
}

console.log("Daily Drop (every day of 2026)");
let worst = 1;
const worldsSeen = new Set<string>();
for (let d = 0; d < 365; d++) {
  const date = new Date(2026, 0, 1 + d);
  const drop = dailyDrop(date);
  worldsSeen.add(drop.world);
  const setup = dailySetup(drop);
  const margin = fuelMargin(setup);
  worst = Math.min(worst, margin);
  check(margin >= DAILY_MARGIN, `Daily ${drop.key}: fair`);
  if (d % 7 === 0) {
    const flight = autoLand(setup);
    check(flight.speed < 20, `Daily ${drop.key}: the autopilot lands (${flight.speed.toFixed(1)} km/h)`);
  }
  check(dailyDrop(date).speed === drop.speed, `Daily ${drop.key}: same drop every time`);
}
console.log(`  worst margin ${(100 * worst).toFixed(1)}%, worlds used: ${[...worldsSeen].join(", ")}`);
check(worldsSeen.size === 4, "The Daily visits all four worlds");

/**
 * Ten-Second mode planned from the prediction panel only, as a patient player
 * would: at each turn try whole-number burns, keep the ten most promising
 * (fuel kept, and low down a speed that can still finish softly), and only
 * those after which a full burn still stops you above the ground. Looks for a
 * touchdown under 5 km/h and returns the best found.
 */
function tenSecondPlanner(setup: Setup, beam = 10) {
  type Node = { s: FlightState; burns: number[] };
  let frontier: Node[] = [{ s: startState(setup), burns: [] }];
  let best = { v: Infinity, burns: [] as number[] };
  for (let turn = 0; turn < 80 && frontier.length; turn++) {
    const next: (Node & { score: number })[] = [];
    for (const n of frontier) {
      const options = n.s.alt < 3 ? Array.from({ length: 101 }, (_, b) => b) : Array.from({ length: 21 }, (_, b) => b * 5);
      for (const b of options) {
        const p = predictTurn(setup, n.s, b);
        if (p.touchdown !== null) {
          if (Math.abs(p.touchdown) < best.v) best = { v: Math.abs(p.touchdown), burns: [...n.burns, b] };
          continue;
        }
        if (!p.stop || !p.stop.stops || p.stop.alt <= 0 || p.after.speed < -40) continue;
        const late = p.after.alt < 3 ? Math.max(0, p.after.speed - (2 + 300 * p.after.alt)) : 0;
        next.push({ s: p.after, burns: [...n.burns, b], score: p.after.fuel / setup.fuel - late * 0.01 });
      }
    }
    if (best.v < 5) break;
    next.sort((a, b) => b.score - a.score);
    const kept: Node[] = [];
    for (const c of next) {
      if (kept.length >= beam) break;
      if (kept.some((k) => Math.abs(k.s.alt - c.s.alt) < Math.max(0.002, c.s.alt * 0.01) && Math.abs(k.s.speed - c.s.speed) < 1)) continue;
      kept.push(c);
    }
    frontier = kept;
  }
  return best;
}

/*
 * Fuel difficulty. Generous and Tight change only the tank; every mode but
 * 1979 mode must stay winnable for the same slow human pilots at both.
 */
console.log("Fuel difficulty (Generous and Tight)");
for (const d of ["generous", "tight"] as const) {
  for (const w of WORLDS) {
    const setup = withDifficulty(makeSetup(w), d);
    const [assist, guide, expert] = (["assist", "guide", "expert"] as const).map((style) => flyLikeAHuman(setup, style));
    console.log(`  ${d.padEnd(8)} ${w.name.padEnd(7)} tank ${setup.fuel} (${((100 * setup.fuel) / makeSetup(w).fuel).toFixed(0)}%), perfect run keeps ${(100 * fuelMargin(setup)).toFixed(1)}% · human: assist ${assist.toFixed(1)} · guide ${guide.toFixed(1)} · no helpers ${expert.toFixed(1)} km/h`);
    check(assist < 20 && guide < 20 && expert < 20, `${w.name}, ${d} fuel: a slow human survives with the assist, the guide and no helpers`);
  }
  let worstMission = 0;
  for (const m of MISSIONS) {
    // With the speedometer dark, the pilot remembers where to brake from the same world at the same difficulty.
    const v = flyLikeAHuman(withDifficulty(missionSetup(m), d), m.noGuide ? "expert" : "guide", m.speedDarkAbove, withDifficulty(makeSetup(worldById(m.world)), d));
    worstMission = Math.max(worstMission, v);
    check(v < (m.clearBelow ?? 20), `Mission ${m.id}, ${d} fuel: a slow human clears it (${v.toFixed(1)} km/h)`);
  }
  let worstDaily = 0;
  for (let day = 0; day < 365; day += 45) {
    const setup = withDifficulty(dailySetup(dailyDrop(new Date(2026, 0, 1 + day))), d);
    for (const style of ["assist", "guide"] as const) {
      const v = flyLikeAHuman(setup, style);
      worstDaily = Math.max(worstDaily, v);
      check(v < 20, `Daily ${day}, ${d} fuel: a slow human lands with the ${style} (${v.toFixed(1)} km/h)`);
    }
  }
  const tens = WORLDS.map((w) => tenSecondPlanner(withDifficulty(makeSetup(w), d)).v);
  tens.forEach((v, i) => check(v < 20, `${WORLDS[i].name}, ${d} fuel: a Ten-Second flight planned from the prediction panel lands (${v.toFixed(1)} km/h)`));
  console.log(`  ${d.padEnd(8)} missions: slowest ${worstMission.toFixed(1)} km/h · Daily Drops: slowest ${worstDaily.toFixed(1)} km/h · Ten-Second: ${tens.map((v) => v.toFixed(1)).join(", ")} km/h`);
}

console.log("Grades");
check(gradeFor(1.99) === "butter" && gradeFor(2) === "smooth" && gradeFor(19.9) === "bumpy" && gradeFor(20) === "dented", "Landing bands follow 2 / 5 / 20 km/h");
check(gradeFor(99) === "scrap" && gradeFor(100) === "confetti" && gradeFor(250) === "crater" && gradeFor(5000) === "oil", "Crash bands follow 45 / 100 / 250 / 5000 km/h");

/* ---------- Free Flight ---------- */

console.log("Free Flight: upright is the 1979 model");
verbose = true;
{
  // Held upright over flat ground, the 2D step must reproduce advance() exactly: the same heights,
  // speeds, fuel and touchdown on every world, through coasts, burns and an empty tank.
  let worst = 0;
  let touchdowns = 0;
  for (const w of WORLDS) {
    for (const plan of [
      [0, 0, 0, 100, 100, 100, 60, 20, 0],
      [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]) {
      const setup = makeSetup(w, { alt: 40, speed: 900 });
      let a = startState(setup);
      let b = start2d(setup);
      for (let i = 0; i < 400; i++) {
        const th = plan[Math.min(plan.length - 1, Math.floor(i / 10))];
        const ra = advance(setup, a, th, 1);
        const rb = advance2d(setup, b, { throttle: th }, 1);
        a = ra.state;
        b = rb.state;
        worst = Math.max(worst, Math.abs(a.t - b.t), Math.abs(a.alt - b.alt), Math.abs(a.speed - b.speed), Math.abs(a.fuel - b.fuel), Math.abs(b.x), Math.abs(b.vx));
        if (ra.touchdown || rb.touchdown) {
          touchdowns++;
          const same = !!ra.touchdown && !!rb.touchdown && Math.abs(ra.touchdown.t - rb.touchdown.t) < 1e-9 && Math.abs(ra.touchdown.speed - rb.touchdown.speed) < 1e-9 && Math.abs(ra.touchdown.fuel - rb.touchdown.fuel) < 1e-9;
          if (!same) worst = Infinity;
          break;
        }
      }
    }
  }
  check(worst < 1e-9 && touchdowns >= 6, `upright 2D flights match advance() on every world, ${touchdowns} touchdowns included (largest difference ${worst.toExponential(1)})`);

  // Sideways: with gravity off, a full tank burnt at a steady lean gives the rocket-equation Δv, split by the lean.
  const space = { ...worldById("moon"), g2: 0, radius: 1e12 };
  const rocket = makeSetup(space, { alt: 1e6, speed: 0 });
  const lean = 30;
  const burnt = advance2d(rocket, start2d(rocket, { tilt: lean }), { throttle: 100 }, rocket.fuel / 100 + 1);
  const dv = space.thrust * Math.log((DRY_MASS + rocket.fuel) / DRY_MASS);
  const side = dv * Math.sin((lean * Math.PI) / 180);
  const up = dv * Math.cos((lean * Math.PI) / 180);
  check(near(burnt.state.vx, side, side * 1e-5) && near(-burnt.state.speed, up, up * 1e-5), `leaning 30°, a full tank gives ${burnt.state.vx.toFixed(1)} km/h sideways and ${(-burnt.state.speed).toFixed(1)} up (rocket equation: ${side.toFixed(1)} and ${up.toFixed(1)})`);
  // Sideways distance uses the same 3200 conversion as height.
  const cruise = advance2d(rocket, { ...start2d(rocket), vx: 320, fuel: 0 }, { throttle: 0 }, 10);
  check(near(cruise.state.x, 1, 1e-12), "320 km/h sideways for 10 s covers 1 km, just as 320 km/h down covers 1 km of height");
  // Rotation: 60°/s, 20°/s fine, a hard stop at 75°, and levelling in about half a second.
  const turned = (c: { turn?: number; level?: boolean }, from: number, secs: number) => advance2d(rocket, { ...start2d(rocket), tilt: from, fuel: 0 }, { throttle: 0, ...c }, secs).state.tilt;
  check(near(turned({ turn: 60 }, 0, 0.5), 30, 1e-9) && near(turned({ turn: -20 }, 0, 0.5), -10, 1e-9) && turned({ turn: 60 }, 0, 3) === 75, "rotation runs at 60°/s (20°/s fine) and stops at 75°");
  const levelled = [75, 40, 10].map((from) => {
    let t = 0;
    while (turned({ level: true }, from, t) !== 0) t += 0.01;
    return t;
  });
  check(levelled.every((t) => t <= 0.7), `U levels the lander from 75°, 40° and 10° in ${levelled.map((t) => t.toFixed(2)).join(", ")} s`);
}

console.log("Free Flight: terrain");
{
  // The same seed always gives the same ground; another seed, other ground.
  let same = true;
  let differs = 0;
  for (const w of WORLDS) {
    for (const seed of [1, 77, 4242]) {
      const a = buildSite(w.id, seed);
      const b = buildSite(w.id, seed);
      const c = buildSite(w.id, seed + 1);
      for (let x = -9; x <= 9; x += 0.0137) {
        if (heightAt(a, x, 3.3) !== heightAt(b, x, 3.3)) same = false;
        if (heightAt(a, x, 3.3) !== heightAt(c, x, 3.3)) differs++;
      }
    }
  }
  check(same && differs > 1000, "terrain is deterministic: the same seed gives the same heights, another seed other heights");

  // Every site: 3 to 6 flats of 12 to 60 m sloping 4° or less (2 to 4 barges at sea), and nowhere else to stand.
  let sites = 0;
  let flats = 0;
  let bad = 0;
  let hidden = 0;
  for (const w of WORLDS) {
    for (let seed = 1; seed <= 50; seed++) {
      const site = buildSite(w.id, seed);
      sites++;
      const spots = landingSpots(site, 0);
      flats += spots.length;
      if (spots.length < (site.kind === "sea" ? 2 : 3) || spots.length > 6) bad++;
      for (const f of spots) {
        const width = (f.x1 - f.x0) * 1000;
        if (width < 12 - 1e-6 || width > 60 + 1e-6 || Math.abs(f.slope) > 4) bad++;
        if (site.kind !== "sea" && footSlope(site, (f.x0 + f.x1) / 2) > 4.05) bad++;
      }
      if (site.kind === "sea") continue;
      // Walk the site a metre at a time: wherever both feet would be on gentle ground, that must be a flat.
      for (let x = -SITE_HALF - 1; x <= SITE_HALF + 1; x += 0.001) {
        const l = footSlope(site, x - 0.004);
        const r = footSlope(site, x + 0.004);
        if (l <= STAND_SLOPE && r <= STAND_SLOPE && !site.flats.some((f) => x - 0.0045 >= f.x0 - 0.0008 && x + 0.0045 <= f.x1 + 0.0008)) hidden++;
      }
    }
  }
  console.log(`  ${sites} sites, ${flats} flats and barges`);
  check(bad === 0, "every site has 3–6 flats (2–4 barges at sea), 12–60 m wide, sloping 4° or less");
  check(hidden === 0, `rough ground never lets a lander stand: no spot off the flats has gentle ground under both feet (${hidden} found)`);
}

console.log("Free Flight: touchdown rules");
{
  // A plane at a chosen angle, to test each rule on both sides of its boundary.
  const plane = (deg: number): Site => {
    const k = Math.tan((deg * Math.PI) / 180) * 1000;
    return { seed: 0, world: "moon", kind: "boulders", xs: new Float64Array([-1, 1]), hs: new Float64Array([-k, k]), boulders: [], reach: 0, flats: [{ x0: -1, x1: 1, slope: deg }], barges: [] };
  };
  const touch = (site: Site, c: Partial<Contact>) => judgeTouchdown(site, { t: 0, speed: 3, vx: 0, fuel: 100, x: 0, alt: 0, tilt: 0, by: "left", ...c });
  const e = 0.05;
  check(touch(plane(STAND_SLOPE - e), { tilt: STAND_SLOPE - e }).stands && touch(plane(STAND_SLOPE + e), { tilt: STAND_SLOPE + e }).grade === "tipped", `ground slope: ${STAND_SLOPE - e}° stands, ${STAND_SLOPE + e}° tips over`);
  check(touch(plane(2), { tilt: 2 + STAND_TILT_OFF - e }).stands && touch(plane(2), { tilt: 2 + STAND_TILT_OFF + e }).grade === "tipped" && touch(plane(2), { tilt: 2 - STAND_TILT_OFF - e }).grade === "tipped", `lean: ${STAND_TILT_OFF - e}° off the ground stands, ${STAND_TILT_OFF + e}° either way tips over`);
  check(touch(plane(0), { vx: STAND_DRIFT - e }).stands && touch(plane(0), { vx: -(STAND_DRIFT + e) }).grade === "tipped", `sideways: ${STAND_DRIFT - e} km/h stands, ${STAND_DRIFT + e} km/h tips over`);
  check(touch(plane(0), { speed: 1.5 }).grade === "butter" && touch(plane(0), { speed: 19.5 }).grade === "bumpy" && touch(plane(0), { speed: 20.5 }).grade === "dented", "standing landings keep the usual speed bands; 20 km/h and up is a crash");
  check(touch(plane(20), { speed: 300 }).grade === "crater" && touch(plane(20), { speed: 2 }).grade === "tipped", "a fast landing on a slope is still a crater; a soft one tips over");
  // At sea: a barge deck is a landing, the water is a splash, a hard hit is still a crater.
  const sea = buildSite("earth", 3);
  const b = sea.barges[0];
  const deck = judgeTouchdown(sea, { t: 0, speed: 2, vx: b.drift, fuel: 100, x: b.x, alt: heightAt(sea, b.x) / 1000, tilt: 0, by: "left" });
  const water = judgeTouchdown(sea, { t: 0, speed: 8, vx: 0, fuel: 100, x: b.x + 0.3, alt: 0, tilt: 0, by: "left" });
  const hard = judgeTouchdown(sea, { t: 0, speed: 300, vx: 0, fuel: 100, x: b.x + 0.3, alt: 0, tilt: 0, by: "left" });
  check(deck.stands && water.grade === "splash" && hard.grade === "crater", "at sea: a deck landing stands, the water is a splash, a hard hit is still a crater");
}
verbose = false;

console.log("Free Flight: fuel budget");
{
  // The budget case: the largest drift, then 1 km (final approach) or 3 km (full descent) sideways
  // to flat ground, flown by the perfect pilot (the autopilot, best of two settings). It must keep 8%.
  const flatSite = (w: World): Site => ({ seed: 0, world: w.id, kind: "boulders", xs: new Float64Array([-300, 300]), hs: new Float64Array([0, 0]), boulders: [], reach: 0, flats: [{ x0: -300, x1: 300, slope: 0 }], barges: [] });
  const PERFECT: Record<FreeStart, AutoOptions[]> = { final: [{}, { perMetre: 0.35 }], full: [{ gate: 0.4 }, {}] };
  const fuelUsed = (w: World, start: FreeStart, xT: number) => {
    const base = start === "final" ? makeSetup(w, { alt: FINAL_ALT, speed: FINAL_SPEED[w.id] }) : makeSetup(w);
    const setup = { ...base, fuel: tankFor(w, start) };
    let best = Infinity;
    for (const o of PERFECT[start]) {
      const r = flyAutopilot(setup, flatSite(w), start2d(setup, { vx: DRIFT[start][1] }), flatTarget({ x0: xT - 0.02, x1: xT + 0.02, slope: 0 }), o);
      if (r.verdict?.stands) best = Math.min(best, setup.fuel - r.fuelLeft);
    }
    return best;
  };
  for (const start of ["final", "full"] as const) {
    for (const w of WORLDS) {
      // Where the drift naturally takes you: the cheapest place to come down, searched on a grid.
      const est = start === "final" ? 1.5 : (DRIFT.full[1] * idealPlan(makeSetup(w), startState(makeSetup(w))).duration * 0.6) / 3200;
      const span = start === "final" ? 2.5 : 20;
      const step = start === "final" ? 0.25 : 1;
      let natural = est;
      let cheapest = Infinity;
      for (let x = est - span; x <= est + span + 1e-9; x += step) {
        const u = fuelUsed(w, start, x);
        if (u < cheapest) {
          cheapest = u;
          natural = x;
        }
      }
      const away = start === "final" ? 1 : 3;
      const need = Math.max(fuelUsed(w, start, natural - away), fuelUsed(w, start, natural + away));
      const tank = tankFor(w, start);
      const kept = 1 - need / tank;
      console.log(`  ${start.padEnd(5)} ${w.name.padEnd(7)} tank ${tank} (${start === "full" ? `${TANK.full[w.id]}× the world's` : `${Math.round((100 * tank) / w.fuel)}% of the world's`}) · perfect pilot uses ${need.toFixed(0)}, keeps ${(100 * kept).toFixed(1)}% · ${(need / (1 - BUDGET_MARGIN)).toFixed(0)} would leave exactly 8%`);
      check(kept >= BUDGET_MARGIN, `${w.name} ${start}: the perfect pilot keeps at least 8% in the budget case`);
    }
  }
}

console.log("Free Flight: fairness (1,000 seeds per world and start, at Standard and at Tight fuel)");
for (const d of ["standard", "tight"] as const) {
  for (const start of ["final", "full"] as const) {
    for (const w of WORLDS) {
      let rerolled = 0;
      let most = 0;
      let unfair = 0;
      let slimmest = 1;
      for (let seed = 1; seed <= 1000; seed++) {
        const f = freeFlight(w.id, start, { seed }, d);
        if (!f.plan.verdict?.stands || f.plan.fuelLeft < FAIR_MARGIN[start] * f.setup.fuel) unfair++;
        else slimmest = Math.min(slimmest, f.plan.fuelLeft / f.setup.fuel);
        if (f.rerolls) rerolled++;
        most = Math.max(most, f.rerolls);
      }
      console.log(`  ${d.padEnd(8)} ${start.padEnd(5)} ${w.name.padEnd(7)} ${1000 - rerolled} fair at once, ${rerolled} re-rolled (at most ${most} times) · the planner's slimmest fuel ${(100 * slimmest).toFixed(1)}%`);
      check(unfair === 0, `${w.name} ${start}, ${d}: every seed ends on a site the planner lands on with ${100 * FAIR_MARGIN[start]}% of the tank to spare`);
    }
  }
}
{
  // Named sites keep their ground at every fuel setting (only the start may be tried again) and are fair.
  let starts = 0;
  for (const n of NAMED_SITES) {
    for (const start of ["final", "full"] as const) {
      for (const d of ["generous", "standard", "tight"] as const) {
        const f = freeFlight(n.world, start, { named: n.id }, d);
        const same = buildSite(n.world, n.seed, n.kind);
        const ground = [-3, -1, 0, 1.3, 2.7].every((x) => heightAt(same, x) === heightAt(f.site, x));
        starts += f.rerolls;
        check(ground && !!f.plan.verdict?.stands && f.plan.fuelLeft >= FAIR_MARGIN[start] * f.setup.fuel, `${n.name} (${start}, ${d}): same ground, fair (${f.plan.verdict?.grade}, ${((100 * f.plan.fuelLeft) / f.setup.fuel).toFixed(0)}% left)`);
      }
    }
  }
  console.log(`  named sites: fair at every setting; ${starts} of 36 needed another start`);
}


/*
 * Free Flight human pilots. The real FreeSim at 60 frames a second with its
 * time warp, flown by a pilot who sees the screen 0.8 s late, sets whole
 * throttle numbers, and holds or taps the rotate keys like a person (knowing
 * how long they held them). It flies to the target marked on screen, judges
 * the rocks on the way only within the view, and reads the HUD's advice.
 */
type FreeSeen = { t: number; agl: number; alt: number; x: number; speed: number; vx: number; tilt: number; fuel: number; stop: StopPoint | null; burnIn: number; advice: Approach; driftStop: number | null; mid: number; half: number };

function flyFreeHuman(flight: FreeFlight, scan = false) {
  const sim = new FreeSim(flight, true);
  sim.scan = scan;
  const setup = flight.setup;
  const DEG = Math.PI / 180;
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  const upright = (tilt: number) => ({ ...setup, world: { ...setup.world, thrust: setup.world.thrust * Math.max(0.05, Math.cos(tilt * DEG)) } });
  const history: FreeSeen[] = [];
  const own: number[] = [];
  let lever = 0;
  let braking = false;
  let overMode = false;
  let keyFrames = 0;
  let keyDir = 0;
  let keyFine = false;
  for (let frame = 0; frame < 60 * 60 * 25; frame++) {
    const s = sim.state;
    const g = targetAt(flight, s.t);
    const agl = sim.above;
    history.push({ t: s.t, agl, alt: s.alt, x: s.x, speed: s.speed, vx: s.vx, tilt: s.tilt, fuel: s.fuel, stop: sim.stop, burnIn: sim.burnIn, advice: approachAdvice(upright(s.tilt), { t: s.t, alt: agl, speed: s.speed, fuel: s.fuel }), driftStop: sim.driftStop, mid: (g.x0 + g.x1) / 2, half: ((g.x1 - g.x0) * 1000) / 2 });
    const v = history[Math.max(0, history.length - 1 - 48)];
    // The target's own motion (a drifting barge), judged from how it moved on screen over a second.
    const earlier = history[Math.max(0, history.length - 1 - 48 - 60)];
    const tDrift = v.t - earlier.t > 0.2 ? ((v.mid - earlier.mid) * 3200) / (v.t - earlier.t) : 0;
    // What my own key presses have done since that picture.
    const tiltNow = clamp(v.tilt + own.slice(-48).reduce((a, b) => a + b, 0), -75, 75);
    const grav = gravityAt(setup.world, v.alt);
    const a1 = setup.world.thrust / (DRY_MASS + setup.cargo + v.fuel);
    const dxm = (v.mid - v.x) * 1000;
    let wantTilt = 0;
    let throttle = lever;
    let level = false;
    let band = 1.5;
    if (v.agl > 2.5 && v.speed > 60) {
      // High up: the burn guide, and while braking a lean against the drift, adjusted so the
      // "drift stops" point on the strip lands on the target.
      const stop = v.stop;
      if (!stop || !stop.stops || v.burnIn < 2) braking = true;
      else if (braking && stop.alt > Math.max(1.5, v.agl * 0.3)) braking = false;
      throttle = braking ? 100 : 0;
      const retro = -Math.atan2(v.vx, Math.max(1, v.speed)) / DEG;
      wantTilt = braking && v.driftStop !== null ? clamp(retro + clamp((v.mid - (v.x + v.driftStop)) * 8, -10, 10), -30, 30) : clamp(retro, -30, 30);
    } else {
      braking = false;
      const rel = v.vx - tDrift;
      // Over the target: once there and low, stay committed unless it slides right off.
      if (Math.abs(dxm) < Math.max(1.5, v.half - 5.5)) overMode = true;
      else if (Math.abs(dxm) > Math.max(2.5, v.half - 4.5) || v.agl > 0.05) overMode = false;
      const over = overMode;
      // Height: straight down only when centred with the drift killed; else hold it, or keep clear of the rocks.
      let vWant: number;
      // Ready to go down: centred, and the drift left won't carry me off the flat before I reach it.
      // (Only where gravity is weak, in the last 50 m: there sideways corrections are too feeble
      // to fix it on the way down. Elsewhere the engine can trim the drift as it descends.)
      const drift = v.agl < 0.05 && grav < 2 ? (Math.abs(rel) * v.agl * 1000) / Math.max(2, v.speed) : 0;
      const ready = over && Math.abs(rel) < 2.5 && Math.abs(dxm) < Math.max(1, v.half - 5) && drift < Math.max(1, v.half - 5.5 - Math.abs(dxm));
      if (ready) vWant = v.advice.target;
      else if (over) vWant = v.agl < 0.012 ? -0.6 : 0;
      else {
        const view = Math.max(2 * v.agl, 0.15);
        const to = v.x + clamp(v.mid - v.x, -view, view);
        let top = -Infinity;
        for (let k = 0; k <= 30; k++) top = Math.max(top, heightAt(flight.site, v.x + ((to - v.x) * k) / 30, v.t) / 1000);
        const clearM = (v.alt - top) * 1000;
        const cruise = clamp(Math.abs(dxm) * 0.3, 12, 300);
        vWant = clearM > cruise ? Math.min(v.advice.target, 5 + (clearM - cruise) * 0.4) : -(cruise - clearM) * 0.3;
      }
      // Gentle low down: small corrections, never pushing up once it has started to rise.
      const soft = v.agl < 0.03;
      let aUp = Math.max(0, grav + (v.speed - (soft && ready ? Math.max(vWant, 2.5) : vWant)) / (soft ? 2.5 : 1.5));
      if (soft && ready && v.speed < 0.5) aUp = Math.min(aUp, grav * 0.9);
      // Where gravity is weak, lean far over to push sideways without shooting upwards.
      const lowG = grav < 2;
      const lean = v.agl > 0.2 ? (lowG ? 65 : 60) : v.agl > 0.06 ? (lowG ? 45 : 35) : v.agl > 0.015 ? 20 : v.agl > 0.006 ? (lowG ? 20 : 10) : lowG ? 10 : 4;
      const aPlan = 0.5 * Math.max(grav, 1.2) * Math.tan(35 * DEG);
      const vmax = clamp(v.agl * 1000 * 0.5, 12, 160);
      const vxWant = over ? tDrift + clamp(0.5 * dxm, -4, 4) : tDrift + Math.sign(dxm) * Math.min(vmax, 0.25 * Math.abs(dxm), 0.8 * Math.sqrt(2 * aPlan * (Math.abs(dxm) / 1000) * 3200));
      // Sideways only as hard as the lean allows while holding the height, not shooting upwards.
      const sideMax = lowG ? 3 : Math.min(30, 1.1 * Math.max(aUp, grav) * Math.tan(lean * DEG));
      let aH = clamp((vxWant - v.vx) / 2.5, -sideMax, sideMax);
      if (!over && Math.abs(dxm) < Math.max(3, v.half - 6) && Math.abs(rel) < 2) aH = 0;
      if (v.speed < -2 && vWant > 0) {
        aUp = 0;
        if (Math.abs(aH) < 1.5) aH = 0;
      }
      // Coasting where gravity is strong, stay near upright: the next burn is mostly upwards.
      wantTilt = Math.round(clamp(Math.atan2(aH, Math.max(aUp, lowG ? 0.05 : grav)) / DEG, -lean, lean));
      // Push along the axis as it is now: the best fit to the push I want.
      throttle = Math.max(0, aH * Math.sin(tiltNow * DEG) + aUp * Math.cos(tiltNow * DEG)) / a1;
      if (soft && ready && Math.abs(v.speed - Math.max(vWant, 2.5)) < 1.2 && Math.abs(throttle - lever) < 4) throttle = lever;
      if (v.stop && !v.stop.stops && v.speed > 0) throttle = 100;
      // The last metres: small trims only, and upright for the touchdown.
      if (v.agl < 0.012 && ready) wantTilt = Math.abs(dxm) < 1.5 && Math.abs(rel) < 1 ? 0 : clamp(wantTilt, -4, 4);
      if (v.agl < 0.003) {
        wantTilt = 0;
        level = Math.abs(tiltNow) > 3;
      }
      // Coming down onto the spot, even a small lean is worth correcting: it slowly pushes me off.
      if (soft && ready) band = 0.7;
    }
    lever = clamp(Math.round(throttle), 0, 100);
    sim.lever = lever;
    // Rotate keys: hold towards the wanted lean, Shift for fine near it, at least a short tap.
    const diff = wantTilt - tiltNow;
    if (keyFrames > 0) keyFrames--;
    else if (level || Math.abs(diff) <= band) keyDir = 0;
    else {
      keyDir = Math.sign(diff);
      keyFine = Math.abs(diff) < 8;
      keyFrames = 4;
    }
    sim.level = level;
    sim.turn = level ? 0 : keyDir;
    sim.fine = keyFine;
    const before = sim.state.tilt;
    const events = sim.update(1 / 60);
    own.push(sim.state.tilt - before);
    for (const e of events) {
      if (e.kind === "touchdown") return { verdict: e.verdict, onTarget: e.verdict.stands && onTarget(flight, sim.state.x, sim.state.t), fuel: e.fuel / setup.fuel };
      if (e.kind === "lost") return { verdict: null, onTarget: false, fuel: 0 };
    }
  }
  return { verdict: null, onTarget: false, fuel: 0 };
}

console.log("Free Flight: human pilots (0.8 s reaction, whole-number throttle, rotate keys)");
{
  const full = process.argv.includes("--full");
  // Every named site, from both starts, at every difficulty, with the scan assist on and off.
  for (const n of NAMED_SITES) {
    const line: string[] = [];
    for (const start of ["final", "full"] as const) {
      for (const d of ["generous", "standard", "tight"] as const) {
        const f = freeFlight(n.world, start, { named: n.id }, d);
        for (const scan of d === "standard" ? [false, true] : [false]) {
          const r = flyFreeHuman(f, scan);
          check(r.onTarget, `${n.name}, ${start}, ${d}${scan ? ", scan" : ""}: a slow human stands on the target (${r.verdict?.grade ?? "no landing"})`);
          if (!scan) line.push(`${start === "final" ? "final" : "full"}/${d[0]} ${r.onTarget ? `${r.verdict!.grade} ${Math.round(100 * r.fuel)}%` : r.verdict?.grade ?? "—"}`);
        }
      }
    }
    console.log(`  ${n.name.padEnd(16)} ${line.join(" · ")}`);
  }
  // Random sites: a sample every run; 200 per world and start with --full.
  const plan: [Difficulty, number, number][] = full
    ? [
        ["standard", 200, 200],
        ["generous", 100, 100],
        ["tight", 100, 100],
      ]
    : [
        ["standard", 10, 6],
        ["generous", 4, 3],
        ["tight", 4, 3],
      ];
  for (const [d, nFinal, nFull] of plan) {
    for (const start of ["final", "full"] as const) {
      const n = start === "final" ? nFinal : nFull;
      const rows: string[] = [];
      for (const w of WORLDS) {
        let hit = 0;
        let fuel = 0;
        const misses: string[] = [];
        for (let seed = 1; seed <= n; seed++) {
          const r = flyFreeHuman(freeFlight(w.id, start, { seed }, d), seed % 2 === 0);
          if (r.onTarget) {
            hit++;
            fuel += r.fuel;
          } else misses.push(`${seed}:${r.verdict?.grade ?? "none"}`);
        }
        rows.push(`${w.name} ${hit}/${n} (${((100 * hit) / n).toFixed(0)}%, ${Math.round((100 * fuel) / Math.max(1, hit))}% fuel left)${misses.length ? ` misses ${misses.slice(0, 6).join(" ")}` : ""}`);
        check(hit / n >= (full ? 0.95 : 1), `${w.name}, ${start}, ${d}: a slow human stands on the target in ${hit} of ${n} random sites`);
      }
      console.log(`  ${d.padEnd(8)} ${start.padEnd(5)} ${rows.join(" · ")}`);
    }
  }
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
