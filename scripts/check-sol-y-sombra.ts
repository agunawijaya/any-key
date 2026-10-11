/*
 * Sol y Sombra's rules and the 1970s program, by calculation and simulation.
 *
 *   npx tsx scripts/check-sol-y-sombra.ts            the checks (exits 1 if a target is missed)
 *   npx tsx scripts/check-sol-y-sombra.ts --n=40000  more games per measurement
 *
 * The 1970s program: its formulas against hand-worked values, the inversion
 * (a worse crew makes passes safer), the ignored choice between the two kills,
 * the crowd's triple roll, awards after a fatal goring, and the strategies
 * from the prompt as written and with the mistakes mended.
 * The Classic corrida: the odds on the cards against what the engine rolls,
 * the balance targets for five bots, and every kind of draw winnable.
 */

import { createRng } from "../lib/kit/rng";
import { BOTS, tallyCorridas } from "../lib/sol-y-sombra/bots";
import { Corrida } from "../lib/sol-y-sombra/corrida";
import { crewRating, goringChance, killChance, merit, numberInput, OriginalBull, risk, yesNo, type OriginalEvent } from "../lib/sol-y-sombra/original";
import { STRATEGIES, tally } from "../lib/sol-y-sombra/originalSim";
import { MOVE_LIST, TELL_LIST, type Quality, type Tell, type Work } from "../lib/sol-y-sombra/rules";
import { award, awardOdds } from "../lib/sol-y-sombra/verdict";

const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 20000);
let failures = 0;
const fail = (message: string) => {
  failures++;
  console.log(`FAIL ${message}`);
};
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

/* ---------- The 1970s formulas ---------- */

console.log("The 1970s program");
// Line 940 for a fair bull (A=3), fair crews (C=0.3), first pass, a veronica (M=3), RND=0.5: (3.3 × 0.5) / ((0.6 + 0.1) × 5).
if (!near(risk(3, 3, 0.3, 0.3, 1, 0.5), 0.4714, 1e-4)) fail("line 940's risk value is off");
// Line 1230 for the same bull at pass 7, RND=0.5: (3 × 10 × 0.5) / (0.6 × 5 × 7).
if (!near(0.7143, (3 * 10 * 0.5) / (0.6 * 5 * 7), 1e-4)) fail("line 1230's kill value is off");
// Line 1390: a brave kill after seven veronicas against a fair bull with fair crews.
if (!near(merit(22, 0.3, 0.3, 1, 2, 8, 3), 4.5 + 22 / 6 - 1.5 + 4 + 4 - 64 / 120 - 3, 1e-9)) fail("line 1390's merit is off");
// The crews' draw comes from the bull: a superb bull (A=1) mostly brings superb crews, an awful one mostly awful crews.
{
  const rng = createRng("crew-draw");
  const superbShare = (a: number, rating: number) => {
    let n = 0;
    for (let i = 0; i < N; i++) if (crewRating(a, rng.float).t === rating) n++;
    return n / N;
  };
  const superbWithSuperb = superbShare(1, 1);
  const awfulWithAwful = superbShare(5, 5);
  console.log(`  a superb bull's crew is superb ${pct(superbWithSuperb)} of the time; an awful bull's crew is awful ${pct(awfulWithAwful)}`);
  if (!near(superbWithSuperb, (3 - 0.87) / 3, 0.02)) fail("the superb bull's crew share is off");
  if (!near(awfulWithAwful, 0.37 / 0.6, 0.02)) fail("the awful bull's crew share is off");
}

// The inversion: in the risk and kill formulas a worse crew (larger C) makes things safer.
const fairBull = { superb: goringChance(3, 3, 0.1, 0.1, 1), awful: goringChance(3, 3, 0.5, 0.5, 1) };
console.log(`  first-pass veronica, fair bull: gored ${pct(fairBull.superb)} with superb crews, ${pct(fairBull.awful)} with awful ones`);
if (!(fairBull.superb > fairBull.awful)) fail("the inversion doesn't show in the risk formula");
const kills = { superb: killChance(3, 0.1, 0.1, 7), awful: killChance(3, 0.5, 0.5, 7) };
console.log(`  kill at pass 7, fair bull: ${pct(kills.superb)} with superb crews, ${pct(kills.awful)} with awful ones`);
if (!(kills.awful > kills.superb)) fail("the inversion doesn't show in the kill formula");

// The ignored choice: 4 and 5 face the same test; seeded runs that differ only in the method end the same way.
{
  let differ = 0;
  for (let i = 0; i < 2000; i++) {
    const endings = [4, 5].map((method) => {
      const rng = createRng(`method/${i}`);
      const bull = new OriginalBull(rng.float);
      const events: OriginalEvent[] = [...bull.start(), ...bull.answer("NO"), ...bull.answer("YES"), ...bull.answer(String(method))];
      return events.map((e) => (e.kind === "kill-attempt" ? "attempt" : e.kind)).join(",");
    });
    if (endings[0] !== endings[1]) differ++;
  }
  console.log(`  over the horns and in the chest gave different results in ${differ} of 2000 identical games`);
  if (differ) fail("the two kills differ, but line 1240 makes them the same");
}

// The triple roll: each tier gets a fresh random number.
{
  const rng = createRng("triple");
  let rollsUsed = 0;
  let games = 0;
  for (let i = 0; i < 3000; i++) {
    const bull = new OriginalBull(rng.float);
    const events: OriginalEvent[] = [...bull.start(), ...bull.answer("NO")];
    while (bull.waiting !== "done")
      events.push(
        ...bull.answer(bull.waiting === "kill" ? (bull.state.pass >= 5 ? "YES" : "NO") : bull.waiting === "cape" ? "2" : bull.waiting === "run" ? "NO" : "4"),
      );
    const verdict = events.find((e) => e.kind === "award");
    if (verdict?.kind !== "award") continue;
    games++;
    rollsUsed += verdict.rolls.length;
    const expected =
      verdict.rolls.length === 1 ? verdict.merit * verdict.rolls[0] < 2.4 : verdict.rolls.length === 2 ? verdict.merit * verdict.rolls[1] < 4.9 : true;
    if (!expected) fail("an award stopped at the wrong roll");
  }
  console.log(`  the crowd rolled ${(rollsUsed / games).toFixed(2)} times per verdict on average`);
  if (rollsUsed / games <= 1.05) fail("the triple roll isn't happening");
}

// Awards after a fatal goring, and the exact YES/NO.
{
  let posthumous = 0;
  let deaths = 0;
  const rng = createRng("posthumous");
  for (let i = 0; i < 3000; i++) {
    const bull = new OriginalBull(rng.float);
    const events: OriginalEvent[] = [...bull.start(), ...bull.answer("NO")];
    // Veronicas until pass twelve (later passes are so safe the fight would never end), then the kill.
    while (bull.waiting !== "done")
      events.push(
        ...bull.answer(bull.waiting === "kill" ? (bull.state.pass >= 12 ? "YES" : "NO") : bull.waiting === "cape" ? "0" : bull.waiting === "run" ? "NO" : "4"),
      );
    if (events.some((e) => e.kind === "dead")) {
      deaths++;
      if (events.some((e) => e.kind === "award")) posthumous++;
    }
  }
  if (!deaths || posthumous !== deaths) fail("a matador killed in the ring didn't receive an award");
  console.log(`  ${posthumous} of ${deaths} fatal gorings still got an award from the crowd`);
}
if (yesNo("yes") !== null || yesNo(" YES ") !== true || yesNo("No") !== null) fail("YES/NO isn't read as the program reads it");
if (numberInput("2") !== 2 || numberInput("") !== 0 || numberInput("two") !== null) fail("numbers aren't read as BASIC reads them");

// The strategies from the prompt, as written and with every mistake mended.
console.log("\n  strategy                               as written: kill / dead / top award     mended: kill / dead / top award");
for (const s of STRATEGIES) {
  const asWritten = tally(s, N, `s/${s.name}`);
  const mended = tally(s, N, `s/${s.name}`, { inversion: true, killChoice: true, singleRoll: true });
  console.log(
    `  ${s.name.padEnd(36)} ${pct(asWritten.endings.killed).padStart(6)} ${pct(asWritten.endings.dead).padStart(6)} ${pct(asWritten.awards[3]).padStart(6)}        ${pct(mended.endings.killed).padStart(6)} ${pct(mended.endings.dead).padStart(6)} ${pct(mended.awards[3]).padStart(6)}`,
  );
}
const waitSeven = tally(STRATEGIES[1], N, "lock/wait7");
// Locked from NOTES.md: waiting for pass seven with veronicas kills about one bull in five and dies about seven times in ten.
if (!near(waitSeven.endings.killed, 0.198, 0.02)) fail(`waiting for pass seven kills ${pct(waitSeven.endings.killed)}, NOTES say about 19.8%`);
if (!near(waitSeven.endings.dead, 0.701, 0.02)) fail(`waiting for pass seven dies ${pct(waitSeven.endings.dead)}, NOTES say about 70.1%`);

/* ---------- The Classic corrida ---------- */

console.log("\nThe Classic corrida");
// The cards' odds are what the engine rolls: a fixed situation, played many times.
{
  const setup = { quality: 2 as Quality, tells: ["hooks-left", "charges-late"] as [Tell, Tell], picadores: 4 as Work, banderilleros: 2 as Work };
  for (const move of MOVE_LIST) {
    const shown = new Corrida("card", setup).moveOdds(move).goring;
    let gored = 0;
    for (let i = 0; i < N; i++) if (new Corrida(`card/${move}/${i}`, setup).makePass(move).outcome === "gored") gored++;
    const seen = gored / N;
    console.log(`  ${move.padEnd(9)} card says ${pct(shown)}, the engine gored ${pct(seen)}`);
    if (!near(seen, shown, Math.max(0.006, 4 * Math.sqrt((shown * (1 - shown)) / N)))) fail(`the ${move} card's odds don't match the engine`);
  }
  const odds = awardOdds(17);
  let landed = [0, 0, 0, 0];
  const rng = createRng("verdict");
  for (let i = 0; i < N; i++) landed[award(17, rng.float()).tier]++;
  landed = landed.map((n) => n / N);
  if (odds.some((p, t) => !near(p, landed[t], 0.015))) fail("the verdict's shown odds don't match its roll");
}

// Balance targets for the bots.
const targets: Record<string, { serious: [number, number]; shoulders: [number, number] }> = {
  careful: { serious: [0, 0.08], shoulders: [0, 0.02] },
  balanced: { serious: [0.08, 0.18], shoulders: [0.15, 0.32] },
  brave: { serious: [0.18, 0.34], shoulders: [0.5, 0.75] },
  reckless: { serious: [0.2, 0.36], shoulders: [0.55, 0.8] },
  reader: { serious: [0.1, 0.22], shoulders: [0.12, 0.3] },
};
for (const bot of BOTS) {
  const t = tallyCorridas(bot, Math.round(N / 2), `bal/${bot.name}`);
  const target = targets[bot.name];
  console.log(
    `  ${bot.name.padEnd(9)} gored ${pct(t.gored).padStart(6)}  serious ${pct(t.serious).padStart(6)}  silence ${pct(t.tiers[0]).padStart(6)}  applause ${pct(t.tiers[1]).padStart(6)}  lap ${pct(t.tiers[2]).padStart(6)}  shoulders ${pct(t.tiers[3]).padStart(6)}`,
  );
  if (t.serious < target.serious[0] || t.serious > target.serious[1])
    fail(`${bot.name}: serious gorings ${pct(t.serious)} outside ${pct(target.serious[0])}–${pct(target.serious[1])}`);
  if (t.tiers[3] < target.shoulders[0] || t.tiers[3] > target.shoulders[1])
    fail(`${bot.name}: on shoulders ${pct(t.tiers[3])} outside ${pct(target.shoulders[0])}–${pct(target.shoulders[1])}`);
}

// Every kind of draw can be won: some way of playing it reaches the shoulders, and careful play keeps serious gorings low.
{
  const pairs: [Tell, Tell][] = [];
  for (const a of TELL_LIST) for (const b of TELL_LIST) if (a < b && !(a.startsWith("hooks") && b.startsWith("hooks"))) pairs.push([a, b]);
  let lowestBest = { value: 1, draw: "" };
  let highestCareful = { value: 0, draw: "" };
  const games = 300;
  for (const quality of [1, 2, 3, 4, 5] as Quality[])
    for (const work of [1, 3, 5] as Work[])
      for (const tells of pairs) {
        const setup = { quality, picadores: work, banderilleros: work, tells };
        const draw = `quality ${quality}, crews ${work}, ${tells.join(" + ")}`;
        const best = Math.max(...BOTS.map((b) => tallyCorridas(b, games, `draw/${b.name}/${draw}`, setup).tiers[3]));
        const careful = tallyCorridas(BOTS[0], games, `draw/careful/${draw}`, setup).serious;
        if (best < lowestBest.value) lowestBest = { value: best, draw };
        if (careful > highestCareful.value) highestCareful = { value: careful, draw };
      }
  console.log(`  every draw: the best way of playing reaches the shoulders at least ${pct(lowestBest.value)} of the time (${lowestBest.draw})`);
  console.log(`  every draw: careful play is seriously gored at most ${pct(highestCareful.value)} of the time (${highestCareful.draw})`);
  if (lowestBest.value < 0.25) fail("a draw where no way of playing reaches the shoulders often enough");
  if (highestCareful.value > 0.15) fail("a draw where careful play is too dangerous");
}

// The same seed and the same choices give the same corrida.
{
  const run = () => {
    const c = new Corrida("same");
    while (c.phase === "pass" && c.passes < 5) c.makePass("veronica");
    if (c.phase === "down") c.carryOn();
    if (c.phase === "pass") c.beginTruth();
    while (c.phase === "truth") c.tryFinish("over-the-horns");
    if (c.phase === "down") c.retire();
    return JSON.stringify([c.history, c.decide()]);
  };
  if (run() !== run()) fail("a seeded corrida isn't repeatable");
}

console.log(failures ? `\n${failures} checks failed` : "\nall Sol y Sombra checks passed");
process.exitCode = failures ? 1 : 0;
