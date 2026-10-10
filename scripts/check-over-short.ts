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
 */

import { asOriginalPlayer, bracketBot, calculatorBot, gunnerBot, halvingBot, naiveBot, playOut, type Bot, type Seen } from "../lib/over-short/bots";
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

console.log(failures ? `\n${failures} check(s) failed` : "\nAll Over / Short checks passed");
process.exit(failures ? 1 : 0);
