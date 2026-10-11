/*
 * Over / Short: the 1973 programs, the ballistic models and the Campaign,
 * by simulation.
 *
 *   npx tsx scripts/check-over-short.ts           the checks (exits 1 if one fails)
 *   npx tsx scripts/check-over-short.ts --n=1000  more attempts per mission
 *
 * The originals: their quirks as NOTES.md records them, and how players of
 * different habits fare at the drill (the 18-round standard). The models:
 * the vacuum model is the 1973 formula, complementary angles meet in a
 * vacuum and part in air, and drag brings the best angle below 45°. The
 * Campaign: a sensible gunner wins every mission within its ammunition on
 * every seed, and each chapter's twist really matters.
 *
 * Field Artillery: the drag-and-wind model against the formula, the
 * Campaign's model and the lag rule; every mission on every difficulty won
 * by a player who knows the physics (so none was dealt unwinnable), most
 * by a skilled gunner and by a player at the screen, and each twist shown
 * to matter. The duel's commanders beatable but not pushovers; every Daily
 * Barrage winnable; the 1970s terminals step for step with the unmodified
 * programs as a GW-BASIC interpreter ran them (tests/fixtures).
 *
 *   --field=200   more attempts per Field Artillery mission
 *   --days=365    more Daily Barrages
 */

import { asOriginalPlayer, bracketBot, calculatorBot, gunnerBot, halvingBot, naiveBot, playOut, type Bot, type Seen } from "../lib/over-short/bots";
import terminalGolden from "../tests/fixtures/over-short-1970s.json";
import { vacuumRange } from "../lib/over-short/ballistics";
import { buildDaily, dailyOn } from "../lib/over-short/daily";
import { actDuel, commander, createDuel, duelSeen, type DuelOrder } from "../lib/over-short/duel";
import { actField, type Difficulty, type FieldEngagement } from "../lib/over-short/field";
import { fieldGunnerBot, fieldHumanBot, fieldOracle, playField, type FieldBot, type FieldSeen } from "../lib/over-short/fieldBots";
import { buildFieldMission, FIELD_MISSIONS, fieldMissionById, type FieldMissionSpec } from "../lib/over-short/fieldMissions";
import { FIELD_GUN, firingTable, flyField, levelGround, muzzleSpeedOf } from "../lib/over-short/fieldModel";
import { bootTerminal, typeLine, type Program, type TerminalEvent } from "../lib/over-short/terminal";
import { heightAt, type Terrain } from "../lib/over-short/terrain";
import { CLASSIC, classicEngagement, classicScore } from "../lib/over-short/classic";
import { act, observe } from "../lib/over-short/engagement";
import { AIR_DRAG, BATTERY_GUN, buildMission, CHAPTERS, medalFor, missionById, MISSIONS, type MissionSpec } from "../lib/over-short/missions";
import { bestRange, fly } from "../lib/over-short/models";
import { judge, playOriginal, rollMaxRange, rollTarget, type Scale } from "../lib/over-short/original";
import { mulberry32 } from "../lib/kit/rng";

const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 300);
const GAMES = 1000;
let failures = 0;
const fail = (message: string) => {
  failures++;
  console.log(`FAIL ${message}`);
};
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const expect = (ok: boolean, message: string) => (ok ? undefined : fail(message));

/* ---------- The originals ---------- */

console.log("The 1973 programs\n");

// A round exactly 100 short is reported as over; 99.5 short is a hit, 99.5 over is a miss.
{
  const R = 30000;
  const B = 20;
  const impact = R * Math.sin((2 * B) / 57.3);
  const exactlyShort = judge(R, Math.ceil(impact + 100), B);
  const truncation = Math.ceil(impact + 100) - impact;
  expect(truncation >= 100 && truncation < 101 && exactlyShort.kind === "over", `a round 100 short should be called over, got ${exactlyShort.kind}`);
  console.log(`short by ${truncation.toFixed(2)} (INT gives 100): called ${exactlyShort.kind}`);
  const t1 = Math.floor(impact) + 99;
  const t2 = Math.floor(impact) - 99;
  console.log(`short by ${(t1 - impact).toFixed(2)}: ${judge(R, t1, B).kind}; over by ${(impact - t2).toFixed(2)}: ${judge(R, t2, B).kind}`);
  expect(judge(R, t1, B).kind === "hit", "just under 100 short should hit");
  expect(impact - t2 > 99 ? judge(R, t2, B).kind === "over" : true, "more than 99 over should miss (INT rounds towards minus infinity)");
}

// Elevations outside 1–89 are refused, 1 and 89 themselves are not.
expect(judge(20000, 5000, 0.99).kind === "too-low" && judge(20000, 5000, 89.01).kind === "too-high", "elevations outside 1–89 should be refused");
expect(judge(20000, 5000, 1).kind !== "too-low" && judge(20000, 5000, 89).kind !== "too-high", "1 and 89 should be accepted");

// The dice: gun ranges and target distances.
for (const scale of ["gunner", "cannon"] as Scale[]) {
  const rnd = mulberry32(7);
  let lo = Infinity;
  let hi = -Infinity;
  let share = [Infinity, -Infinity];
  for (let i = 0; i < 100000; i++) {
    const R = rollMaxRange(scale, rnd);
    const T = rollTarget(R, rnd);
    lo = Math.min(lo, R);
    hi = Math.max(hi, R);
    share = [Math.min(share[0], T / R), Math.max(share[1], T / R)];
  }
  console.log(`${scale}: greatest range ${lo}–${hi}, targets at ${pct(share[0])}–${pct(share[1])} of it`);
  const [wantLo, wantHi] = scale === "gunner" ? [20000, 59999] : [10000, 13999];
  expect(lo >= wantLo && hi <= wantHi && hi - lo > (wantHi - wantLo) * 0.99, `${scale} range ${lo}–${hi} should fill ${wantLo}–${wantHi}`);
  expect(share[0] >= 0.0999 && share[1] < 0.9, `${scale} targets should sit at 10–90%`);
}

// Six rounds at one target and the enemy wins, whatever the sixth would have done.
{
  const game = playOriginal("cannon", mulberry32(3), () => 1);
  expect(game.ending === "destroyed" && game.rounds[0] === 5, `five misses then destroyed, got ${game.ending} after ${game.rounds[0]}`);
}

// 57.3 for 180/π: how far that moves a round.
{
  let worst = 0;
  for (let b = 1; b <= 89; b += 0.01) worst = Math.max(worst, Math.abs(60000 * Math.sin((2 * b) / 57.3) - 60000 * Math.sin((2 * b * Math.PI) / 180)));
  console.log(`57.3 instead of 180/π moves a round at most ${worst.toFixed(1)} yards on the longest Gunner range`);
}

/* ---------- Players at the drill ---------- */

console.log(`\nPlayers at the drill, ${GAMES} games each: all five targets · 18 rounds or fewer · rounds per target destroyed\n`);

const PLAYERS: Record<string, () => Bot> = {
  calculator: () => calculatorBot,
  reader: () => gunnerBot(),
  halving: () => halvingBot,
  bracketer: () => bracketBot(),
  naive: () => naiveBot,
};

type DrillResult = { five: number; standard: number; perTarget: number };

function drillOriginal(scale: Scale, make: () => Bot): DrillResult {
  let five = 0;
  let standard = 0;
  let destroyed = 0;
  let rounds = 0;
  for (let i = 0; i < GAMES; i++) {
    const game = playOriginal(scale, mulberry32(i + 1), asOriginalPlayer(make()));
    if (game.ending === "complete") five++;
    if (game.nice) standard++;
    const hits = game.ending === "complete" ? game.rounds : game.rounds.slice(0, -1);
    destroyed += hits.length;
    rounds += hits.reduce((a, b) => a + b, 0);
  }
  return { five: five / GAMES, standard: standard / GAMES, perTarget: destroyed ? rounds / destroyed : 0 };
}

function drillClassic(make: () => Bot): DrillResult {
  let five = 0;
  let standard = 0;
  let destroyed = 0;
  let rounds = 0;
  for (let i = 0; i < GAMES; i++) {
    const end = playOut(classicEngagement(`drill/${i}`), make(), act);
    const score = classicScore(end);
    if (end.outcome === "won") five++;
    if (score.metStandard) standard++;
    destroyed += score.destroyed;
    rounds += score.perTarget.reduce((a, b) => a + b, 0);
  }
  return { five: five / GAMES, standard: standard / GAMES, perTarget: destroyed ? rounds / destroyed : 0 };
}

/** What NOTES.md records, with room for the dice: [all five, 18 or fewer] as lowest and highest shares. */
const DRILL_BANDS: Record<string, { five: [number, number]; standard: [number, number] }> = {
  calculator: { five: [1, 1], standard: [1, 1] },
  reader: { five: [0.97, 1], standard: [0.97, 1] },
  halving: { five: [0, 0.05], standard: [0, 0.03] },
  bracketer: { five: [0, 0.05], standard: [0, 0.03] },
  naive: { five: [0, 0.01], standard: [0, 0.01] },
};

for (const [label, run] of [
  ["Gunner (yards)", (make: () => Bot) => drillOriginal("gunner", make)],
  ["Cannoneer (metres)", (make: () => Bot) => drillOriginal("cannon", make)],
  ["Classic (ours)", drillClassic],
] as const) {
  for (const [name, make] of Object.entries(PLAYERS)) {
    const r = run(make);
    console.log(`${label.padEnd(19)} ${name.padEnd(10)} ${pct(r.five).padStart(6)} · ${pct(r.standard).padStart(6)} · ${r.perTarget.toFixed(2)}`);
    const band = DRILL_BANDS[name];
    if (r.five < band.five[0] || r.five > band.five[1] || r.standard < band.standard[0] || r.standard > band.standard[1]) fail(`${label} ${name}: ${pct(r.five)} / ${pct(r.standard)} outside the recorded bands`);
  }
}

/* ---------- The models ---------- */

console.log("\nThe models\n");

{
  let worst = 0;
  let pair = 0;
  for (const R of [10000, 12345, 13999]) {
    for (let e = 1; e <= 89; e += 0.25) {
      const level = { distance: R, height: 0 };
      const landed = fly("vacuum", { vacuumRange: R, drag: 0 }, e, level).landed;
      worst = Math.max(worst, Math.abs(landed - R * Math.sin((2 * e * Math.PI) / 180)));
      pair = Math.max(pair, Math.abs(landed - fly("vacuum", { vacuumRange: R, drag: 0 }, 90 - e, level).landed));
    }
  }
  console.log(`vacuum against R · sin 2θ: worst ${worst.toFixed(3)} m; complementary angles apart by at most ${pair.toFixed(3)} m`);
  expect(worst < 0.5, `the vacuum model strays ${worst.toFixed(2)} m from the formula`);
  expect(pair < 0.5, `complementary angles land ${pair.toFixed(2)} m apart in a vacuum`);
}

{
  for (const R of [12500, BATTERY_GUN, 15500]) {
    const gun = { vacuumRange: R, drag: AIR_DRAG };
    const best = bestRange("air", gun);
    const level = { distance: R, height: 0 };
    const apart = fly("air", gun, 30, level).landed - fly("air", gun, 60, level).landed;
    console.log(`air, ${R} m gun: best ${best.range.toFixed(0)} m at ${best.elevation.toFixed(2)}°; 30° lands ${apart.toFixed(0)} m beyond 60°`);
    expect(best.elevation < 44, `drag should bring the best angle below 45°, got ${best.elevation.toFixed(2)}°`);
    expect(apart > 300, "complementary angles should part in air");
  }
}

// Classic's honest observer against the 1973 judge: they differ only at the 100 m edge.
{
  const rnd = mulberry32(11);
  let differ = 0;
  let unexplained = 0;
  for (let i = 0; i < 20000; i++) {
    const R = rollMaxRange("cannon", rnd);
    const T = rollTarget(R, rnd);
    const B = 1 + rnd() * 88;
    const old = judge(R, T, B);
    const miss = fly("vacuum", { vacuumRange: R, drag: 0 }, B, { distance: T, height: 0 }).landed - T;
    const ours = observe(miss, CLASSIC.radius, { reports: "distance", rounding: 1 });
    const oldCall = old.kind === "hit" ? "hit" : old.kind;
    if (oldCall !== ours.call) {
      differ++;
      if (Math.abs(Math.abs(miss) - 100) > 4) unexplained++;
    }
  }
  console.log(`Classic's observer against the 1973 judge: ${differ} of 20,000 calls differ, all within 4 m of the 100 m edge`);
  expect(unexplained === 0, `${unexplained} calls differ away from the 100 m edge`);
}

/* ---------- The Campaign ---------- */

console.log(`\nThe Campaign: a sensible gunner, ${N} attempts per mission\n`);

type Tally = { won: number; rounds: number[]; outcomes: Record<string, number>; medals: Record<string, number>; relocated: number };

function attempt(spec: MissionSpec, bot: () => Bot, n = N): Tally {
  const tally: Tally = { won: 0, rounds: [], outcomes: {}, medals: { gold: 0, silver: 0, bronze: 0 }, relocated: 0 };
  for (let i = 0; i < n; i++) {
    const end = playOut(buildMission(spec, `check/${i}`), bot(), act);
    const outcome = end.outcome ?? "unfinished";
    tally.outcomes[outcome] = (tally.outcomes[outcome] ?? 0) + 1;
    if (end.relocationsLeft < end.rules.relocations.count) tally.relocated++;
    if (outcome !== "won") continue;
    tally.won++;
    tally.rounds.push(end.shots.length);
    tally.medals[medalFor(spec, end.shots.length)]++;
  }
  return tally;
}

const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] ?? 0;

for (const chapter of CHAPTERS) {
  console.log(`Chapter ${chapter.chapter}: ${chapter.title}`);
  for (const spec of MISSIONS.filter((m) => m.chapter === chapter.chapter)) {
    const t = attempt(spec, () => gunnerBot());
    const m = t.medals;
    const extra = spec.relocations ? ` · moved the gun in ${pct(t.relocated / N)}` : "";
    console.log(`  ${spec.id} ${spec.title.padEnd(22)} won ${pct(t.won / N).padStart(6)} · rounds median ${quantile(t.rounds, 0.5)}, worst ${Math.max(...t.rounds)} of ${spec.ammo} · gold ${pct(m.gold / N)}, silver ${pct(m.silver / N)}, bronze ${pct(m.bronze / N)}${extra}`);
    if (t.won < N) fail(`${spec.id} lost ${N - t.won} of ${N}: ${JSON.stringify(t.outcomes)}`);
    if (chapter.chapter === 1) {
      const pure = attempt(spec, () => bracketBot());
      console.log(`       pure bracketing: won ${pct(pure.won / N)}, worst ${Math.max(...pure.rounds)} of ${spec.ammo}`);
      if (pure.won < N) fail(`${spec.id}: bracketing on directions alone should always win the Drill`);
    }
  }
}

/* ---------- Each twist matters ---------- */

console.log("\nEach twist matters\n");

/** A player who ignores one thing the briefing says. */
const blindTo = (forget: (v: Seen) => Seen): (() => Bot) => () => {
  const bot = gunnerBot({ relocateInside: 0 });
  return (v) => bot(forget(v));
};

const twists: { id: string; what: string; bot: () => Bot; most: number }[] = [
  { id: "5-1", what: "firing at where the convoy is, not where it will be", bot: blindTo((v) => ({ ...v, target: { ...v.target, speed: 0 } })), most: 0.85 },
  { id: "5-3", what: "taking the high road against the clock", bot: blindTo((v) => ({ ...v, elevation: { min: 46, max: 89 } })), most: 0.2 },
  { id: "5-4", what: "never moving the gun", bot: () => gunnerBot({ relocateInside: 0 }), most: 0.9 },
];
for (const twist of twists) {
  const spec = missionById(twist.id)!;
  const t = attempt(spec, twist.bot);
  console.log(`  ${twist.id} ${twist.what}: won ${pct(t.won / N)} (at most ${pct(twist.most)} expected)`);
  if (t.won / N > twist.most) fail(`${twist.id}: ${twist.what} still wins ${pct(t.won / N)}`);
}

/* ---------- Field Artillery: the model ---------- */

console.log("\nField Artillery: drag, wind and the ground\n");
{
  const level = levelGround();
  const still = { along: 0, across: 0 };
  // With no air the 3D model is the 1973 formula; with air it is the Campaign's model, to the centimetre.
  for (const elevation of [10, 30, 45, 60]) {
    const v = 300;
    const vac = flyField({ charges: [v], drag: 0 }, { charge: 1, elevation, line: 0 }, 0, level, still, { muzzle: 0 });
    const formula = vacuumRange((v * v) / 9.81, elevation);
    expect(Math.abs(vac.burst.x - formula) < 0.05, `vacuum at ${elevation}°: ${vac.burst.x.toFixed(2)} against the formula's ${formula.toFixed(2)}`);
    const air = flyField({ charges: [v], drag: AIR_DRAG }, { charge: 1, elevation, line: 0 }, 0, level, still, { muzzle: 0 });
    const campaign = fly("air", { vacuumRange: (v * v) / 9.81, drag: AIR_DRAG }, elevation, { distance: 1, height: 0 });
    expect(Math.abs(air.burst.x - campaign.landed) < 0.05, `air at ${elevation}°: ${air.burst.x.toFixed(2)} against the Campaign model's ${campaign.landed.toFixed(2)}`);
  }
  console.log("No air: the 1973 formula exactly. Air: the Campaign's model exactly, at 10°, 30°, 45° and 60°");
  // A wind across the line carries a round sideways by the wind times the shell's lag behind a vacuum flight (Didion's lag rule).
  let worst = 0;
  for (const charge of [1, 2, 3, 4]) {
    for (const elevation of [10, 25, 40, 60]) {
      const f = flyField(FIELD_GUN, { charge, elevation, line: 0 }, 0, level, { along: 0, across: 6 }, { muzzle: 0 });
      const lag = 6 * (f.time - f.burst.x / (muzzleSpeedOf(FIELD_GUN, charge) * Math.cos((elevation * Math.PI) / 180)));
      worst = Math.max(worst, Math.abs(f.burst.z - lag) / Math.max(1, Math.abs(lag)));
    }
  }
  console.log(`Crosswind drift against the lag rule: worst difference ${pct(worst)} over 16 cases`);
  expect(worst < 0.03, `crosswind drift strays ${pct(worst)} from the lag rule`);
  // A tailwind lengthens, a headwind shortens; a crosswind from either side carries a round equally far.
  const at = (wind: { along: number; across: number }) => flyField(FIELD_GUN, { charge: 3, elevation: 30, line: 0 }, 0, level, wind, { muzzle: 0 }).burst;
  const base = at(still).x;
  const tail = at({ along: 5, across: 0 }).x;
  const head = at({ along: -5, across: 0 }).x;
  const left = at({ along: 0, across: -5 }).z;
  const right = at({ along: 0, across: 5 }).z;
  console.log(`Charge 3 at 30°: ${base.toFixed(0)} m still, ${tail.toFixed(0)} m with a 5 m/s tailwind, ${head.toFixed(0)} m into a 5 m/s headwind; ${right.toFixed(1)} m of drift either way`);
  expect(tail > base && head < base, "a tailwind should lengthen and a headwind shorten");
  expect(Math.abs(left + right) < 0.01, "crosswinds from either side should drift a round equally");
  // The printed table's wind columns agree with flying the round in that wind.
  const row = firingTable(FIELD_GUN, 2).find((r) => r.elevation === 30)!;
  const windy = flyField(FIELD_GUN, { charge: 2, elevation: 30, line: 0 }, 0, level, { along: 4, across: 4 }, { muzzle: 0 });
  const fromTable = { x: row.range + 4 * row.tail, z: 4 * row.drift };
  console.log(`Charge 2 at 30° in 4 m/s behind and across: the table says ${fromTable.x.toFixed(0)} m and ${fromTable.z.toFixed(1)} m right, the flight ${windy.burst.x.toFixed(0)} m and ${windy.burst.z.toFixed(1)} m`);
  expect(Math.abs(fromTable.x - windy.burst.x) < 25 && Math.abs(fromTable.z - windy.burst.z) < 2, "the table's wind corrections should match a flight in that wind");
  // A round laid too flat at a crest comes down on the rising ground.
  const ridge: Terrain = { survey: [{ x: 0, height: 0 }, { x: 1500, height: 150 }, { x: 2000, height: 100 }], roughness: 0, seed: 1 };
  const flat = flyField(FIELD_GUN, { charge: 4, elevation: 6, line: 0 }, 0, ridge);
  console.log(`Charge 4 at 6° at a ridge 150 m high: down ${flat.burst.x.toFixed(0)} m out on the slope, still climbing`);
  expect(flat.intoCrest && flat.burst.x < 1500 && heightAt(ridge, flat.burst.x) > 20, "a flat round should strike the rising ground before the crest");
}

/* ---------- Field Artillery: the missions ---------- */

const FIELD_N = Number(process.argv.find((a) => a.startsWith("--field="))?.slice(8) ?? 60);
console.log(`\nField Artillery: ${FIELD_N} attempts per mission and difficulty\n`);

type FieldTally = { won: number; rounds: number[]; seconds: number[]; outcomes: Record<string, number> };

function fieldAttempts(spec: FieldMissionSpec, difficulty: Difficulty, play: (start: FieldEngagement) => FieldEngagement, n = FIELD_N): FieldTally {
  const tally: FieldTally = { won: 0, rounds: [], seconds: [], outcomes: {} };
  for (let i = 0; i < n; i++) {
    const end = play(buildFieldMission(spec, `check/${i}`, difficulty));
    const outcome = end.outcome ?? "unfinished";
    tally.outcomes[outcome] = (tally.outcomes[outcome] ?? 0) + 1;
    if (outcome !== "won") continue;
    tally.won++;
    tally.rounds.push(end.shots.length);
    tally.seconds.push(end.time);
  }
  return tally;
}

const byBot = (make: () => FieldBot) => (start: FieldEngagement) => playField(start, make(), actField);
const byOracle = (start: FieldEngagement) => {
  let e = start;
  for (let k = 0; k < 40 && !e.outcome; k++) e = actField(e, fieldOracle(e)).engagement;
  return e;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

for (const spec of FIELD_MISSIONS) {
  const parts: string[] = [];
  let human: FieldTally | null = null;
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    const tries = Math.ceil(FIELD_N / 2);
    const oracle = fieldAttempts(spec, difficulty, byOracle, tries);
    if (oracle.won < tries) fail(`${spec.id} ${difficulty}: knowing the physics lost ${tries - oracle.won}: ${JSON.stringify(oracle.outcomes)}`);
    const gunner = fieldAttempts(spec, difficulty, byBot(() => fieldGunnerBot()));
    parts.push(`${difficulty} ${pct(gunner.won / FIELD_N)}`);
    if (difficulty === "normal") {
      human = fieldAttempts(spec, difficulty, byBot(() => fieldHumanBot()));
      expect(gunner.won / FIELD_N >= 0.9, `${spec.id}: the gunner wins only ${pct(gunner.won / FIELD_N)} on Normal`);
      expect(human.won / FIELD_N >= 0.7, `${spec.id}: a player at the screen wins only ${pct(human.won / FIELD_N)} on Normal`);
    }
  }
  console.log(`  ${spec.id.padEnd(3)} ${spec.title.padEnd(18)} the gunner wins ${parts.join(", ")}`);
  if (human) console.log(`      a player at the screen, Normal: wins ${pct(human.won / FIELD_N)}, ${quantile(human.rounds, 0.5)} rounds and ${Math.round(quantile(human.seconds, 0.5))} s at the median`);
}
console.log("  and every attempt on every difficulty won by a player who knows the physics");

console.log("\nEach mission's twist matters (Normal)\n");
const fieldTwists: { id: string; what: string; bot: () => FieldBot; most?: number }[] = [
  { id: "F2", what: "ignoring the crest", bot: () => fieldHumanBot({ respectsCrest: false }), most: 0.9 },
  { id: "F4", what: "not leading the convoy", bot: () => fieldHumanBot({ leads: false }), most: 0.3 },
  { id: "F3", what: "ignoring the crosswind", bot: () => fieldHumanBot({ minds: false }) },
  { id: "F9", what: "never calling a star shell", bot: () => fieldHumanBot({ lights: false }) },
];
for (const twist of fieldTwists) {
  const spec = fieldMissionById(twist.id)!;
  const blind = fieldAttempts(spec, "normal", byBot(twist.bot));
  if (twist.most !== undefined) {
    console.log(`  ${twist.id} ${twist.what}: won ${pct(blind.won / FIELD_N)} (at most ${pct(twist.most)} expected)`);
    if (blind.won / FIELD_N > twist.most) fail(`${twist.id}: ${twist.what} still wins ${pct(blind.won / FIELD_N)}`);
  } else {
    const seeing = fieldAttempts(spec, "normal", byBot(() => fieldHumanBot()));
    console.log(`  ${twist.id} ${twist.what}: ${mean(blind.rounds).toFixed(2)} rounds a win against ${mean(seeing.rounds).toFixed(2)}; won ${pct(blind.won / FIELD_N)} against ${pct(seeing.won / FIELD_N)}`);
    if (mean(blind.rounds) <= mean(seeing.rounds) && blind.won >= seeing.won) fail(`${twist.id}: ${twist.what} costs nothing`);
  }
}

/* ---------- The duel ---------- */

console.log("\nThe Counter-Battery Duel (Normal), each side played from both ends of the ridge\n");
{
  const asOrder = (bot: FieldBot) => (v: FieldSeen): DuelOrder => {
    const a = bot(v);
    return a.kind === "relocate" ? { kind: "relocate" } : a.kind === "fire" ? { kind: "fire", aim: a.aim } : { kind: "fire", aim: { charge: 2, elevation: 40, line: 0 } };
  };
  const DUELS = Number(process.argv.find((a) => a.startsWith("--duels="))?.slice(8) ?? 120);
  const players = [
    { who: "a player at the screen", make: () => asOrder(fieldHumanBot()), least: 0.3, most: 0.75 },
    { who: "a skilled gunner", make: () => asOrder(fieldGunnerBot()), least: 0.55, most: 0.95 },
  ];
  for (const { who, make, least, most } of players) {
    const line: string[] = [];
    for (const kind of ["cautious", "aggressive", "methodical"] as const) {
      let won = 0;
      let undecided = 0;
      for (let i = 0; i < DUELS; i++) {
        const westIsUs = i % 2 === 0;
        let e = createDuel(`check/${i}`, "normal", "player", kind);
        const us = make();
        const them = commander(kind);
        for (let turn = 0; turn < 40 && !e.winner; turn++) {
          const west = westIsUs ? us(duelSeen(e, "west")) : them(duelSeen(e, "west"));
          const east = westIsUs ? them(duelSeen(e, "east")) : us(duelSeen(e, "east"));
          e = actDuel(e, { west, east }).engagement;
        }
        if (!e.winner) undecided++;
        if (e.winner === (westIsUs ? "west" : "east")) won++;
      }
      line.push(`the ${kind} commander ${pct(won / DUELS)}`);
      expect(undecided === 0, `${who} against the ${kind} commander: ${undecided} duels never ended`);
      expect(won / DUELS >= least && won / DUELS <= most, `${who} beats the ${kind} commander ${pct(won / DUELS)} of the time (expected ${pct(least)} to ${pct(most)})`);
    }
    console.log(`  ${who} beats ${line.join(", ")}`);
  }
}

/* ---------- The Daily Barrage ---------- */

const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7) ?? 120);
console.log(`\nThe Daily Barrage: the first ${DAYS} days\n`);
{
  let gunnerWins = 0;
  for (let day = 0; day < DAYS; day++) {
    const daily = dailyOn(day);
    const start = buildDaily(daily);
    const oracle = byOracle(start);
    if (oracle.outcome !== "won") fail(`Daily Barrage #${day + 1} (${daily.spec.lesson}): knowing the physics could not win (${oracle.outcome})`);
    if (byBot(() => fieldGunnerBot())(start).outcome === "won") gunnerWins++;
  }
  console.log(`  every day winnable; the gunner wins ${pct(gunnerWins / DAYS)} of them`);
  expect(gunnerWins / DAYS >= 0.9, `the gunner wins only ${pct(gunnerWins / DAYS)} of the dailies`);
}

/* ---------- The 1970s terminals ---------- */

console.log("\nThe 1970s terminals against the unmodified programs\n");
for (const run of terminalGolden.runs) {
  let step = bootTerminal(run.program as Program);
  const events: TerminalEvent[] = [...step.events];
  for (const typed of run.typed) {
    step = typeLine(step.state, typed);
    events.push(...step.events);
  }
  const same = JSON.stringify(events) === JSON.stringify(run.events);
  console.log(`  ${run.name.padEnd(22)} ${String(run.typed.length).padStart(2)} lines typed, ${String(run.events.length).padStart(2)} things happened: ${same ? "the same" : "DIFFERENT"}`);
  expect(same, `${run.name}: the terminal parts company with the original`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll Over / Short checks passed");
process.exit(failures ? 1 : 0);
