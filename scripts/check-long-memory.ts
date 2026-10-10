/*
 * Same Trick Twice: rules, the 1978 program and the dailies, by test and by simulation.
 *
 *   npx tsx scripts/check-long-memory.ts           the checks (exits 1 if one fails)
 *   npx tsx scripts/check-long-memory.ts --full    a year of dailies and longer simulations
 *
 * - Each rule set against positions worked out by hand.
 * - The 1978 module against recordings of the original running in PC-BASIC
 *   (tests/fixtures/long-memory-1978.json): every move it printed, every
 *   result, and the crash after its 51st lesson.
 * - The game's Learner against the 1978 module: the same decisions.
 * - The Scholar: legal, and stronger at each level.
 * - The Daily Endgame: every puzzle solvable as stated, checked again by a fresh solver.
 * - The Learner's learning, measured: the numbers in docs/long-memory/NOTES.md.
 */

import { readFileSync } from "node:fs";
import { dailyDate, shiftDateKey } from "../lib/kit/daily";
import { createRng, type Rng } from "../lib/kit/rng";
import { boardOf } from "../lib/long-memory/board";
import { DAILY_EPOCH, dailyPuzzleFor } from "../lib/long-memory/daily";
import { freshMind, learnerMove, learnFrom, newGameRecord, recordSowing } from "../lib/long-memory/learner";
import { Original1978, OriginalCrash, spokenPit } from "../lib/long-memory/original";
import { RULES, type Position, type RuleId } from "../lib/long-memory/rules";
import { scholarMove, Searcher, type Difficulty } from "../lib/long-memory/scholar";
import { dailyShare } from "../lib/long-memory/share";
import { Solver } from "../lib/long-memory/solver";

const FULL = process.argv.includes("--full");
let failures = 0;
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else {
    failures++;
    console.log(`FAIL ${message}`);
  }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const at = (board: readonly number[], toMove: "south" | "north" = "south", extraUsed = false): Position => ({ board, toMove, extraUsed, plies: 0, over: false });
const section = (title: string) => console.log(`\n${title}`);

/* ---------- 1978 Awari ---------- */

section("1978 Awari, by hand");
{
  const r = RULES.awari1978;
  const start = r.start();
  check(same(start.board, [3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 0]), "starts with three seeds a pit");
  const first = r.play(start, 2);
  check(same(first.path, [3, 4, 5]) && same(first.next.board.slice(0, 7), [3, 3, 0, 4, 4, 4, 0]) && first.next.toMove === "north", "pit 3 sows three holes and passes the turn");
  const store = r.play(start, 3);
  check(store.extraTurn && store.next.toMove === "south" && store.next.extraUsed, "a last seed in your store earns a move");
  const second = r.play(at(boardOf([0, 0, 0, 0, 0, 1], [3, 3, 3, 3, 3, 3], 4, 0), "south", true), 5);
  check(!second.extraTurn && second.next.toMove === "north", "but only one: a second store landing passes the turn");
  const long = r.play(at(boardOf([1, 0, 0, 0, 0, 9], [1, 1, 1, 1, 1, 1])), 5);
  check(same(long.path, [6, 7, 8, 9, 10, 11, 12, 13, 0]) && long.next.board[13] === 1, "sowing passes through the opponent's store and drops a seed in it");
  const own = r.play(at(boardOf([1, 0, 0, 0, 3, 2], [0, 4, 4, 4, 4, 4])), 4);
  check(
    same(own.captures, [{ from: [5, 7], to: 6, seeds: 4 }]) && own.next.board[6] === 5,
    "a last seed in an empty pit on their side takes your own pit opposite, into your store",
  );
  const noSweep = r.play(at(boardOf([0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 1], 10, 10), "north"), 12);
  check(noSweep.next.over && noSweep.next.board[5] === 1 && noSweep.next.board[6] === 10, "the game ends when a row is empty, and the seeds left stay out of the count");
}

/* ---------- Kalah ---------- */

section("Kalah, by hand");
{
  const r = RULES.kalah;
  check(same(r.start(4).board, [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]) && same(r.start(6).board.slice(0, 6), [6, 6, 6, 6, 6, 6]), "four seeds a pit, or the chosen number");
  const skip = r.play(at(boardOf([0, 0, 2, 0, 0, 10], [1, 1, 1, 1, 1, 1])), 5);
  check(same(skip.path, [6, 7, 8, 9, 10, 11, 12, 0, 1, 2]) && skip.next.board[13] === 0, "seeds skip the opponent's store");
  const chain1 = r.play(at(boardOf([1, 0, 0, 0, 2, 1], [1, 1, 1, 1, 1, 1])), 5);
  const chain2 = r.play(chain1.next, 4);
  check(chain1.extraTurn && chain2.extraTurn && chain2.next.toMove === "south", "extra turns chain");
  const take = r.play(at(boardOf([2, 0, 1, 0, 0, 0], [1, 1, 5, 1, 1, 1])), 2);
  check(same(take.captures, [{ from: [9, 3], to: 6, seeds: 6 }]) && take.next.board[6] === 6, "a last seed in your own empty pit takes the pit opposite");
  const empty = r.play(at(boardOf([2, 0, 1, 0, 0, 0], [1, 1, 0, 1, 1, 1])), 2);
  check(empty.captures.length === 0 && empty.next.board[3] === 1, "no capture when the pit opposite is empty");
  const sweep = r.play(at(boardOf([0, 0, 0, 0, 0, 1], [2, 0, 3, 0, 0, 1], 20, 10)), 5);
  check(sweep.next.over && same(sweep.sweep, { south: 0, north: 6 }) && sweep.next.board[13] === 16 && sweep.next.board[6] === 21, "when a row empties, each side sweeps its own seeds into its store");
}

/* ---------- Oware ---------- */

section("Oware (Abapa), by hand");
{
  const r = RULES.oware;
  const lap = r.play(at(boardOf([12, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1])), 0);
  check(same(lap.path, [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 1]) && lap.next.board[0] === 0, "twelve seeds skip the pit they came from");
  const chain = r.play(at(boardOf([1, 1, 1, 1, 1, 3], [1, 2, 1, 4, 1, 1])), 5);
  check(same(chain.captures, [{ from: [9, 8, 7], to: 6, seeds: 7 }]) && chain.next.board[6] === 7, "two or three on their side are taken, then the pits before it while they hold two or three");
  const slam = r.play(at(boardOf([1, 1, 1, 1, 1, 3], [1, 2, 1, 0, 0, 0])), 5);
  check(slam.grandSlamForfeit && slam.captures.length === 0 && slam.next.board[6] === 0, "a move that would take every seed they have captures nothing");
  check(same(r.legal(at(boardOf([1, 0, 0, 0, 2, 0], [0, 0, 0, 0, 0, 0], 20, 20))), [4]), "with their row empty you must give them seeds");
  const stuck = r.play(at(boardOf([1, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1], 22, 22), "north"), 12);
  check(stuck.ending === "cannot-feed" && stuck.next.board[13] === 24 && stuck.next.board[6] === 23 && stuck.next.over, "if they cannot be fed, the player keeps the seeds on their side and the game ends");
  const majority = r.play(at(boardOf([1, 1, 1, 1, 1, 1], [1, 1, 0, 0, 0, 0], 23, 10)), 5);
  check(majority.ending === "majority" && majority.next.board[6] === 25, "more than half the seeds wins");
}

/* ---------- The 1978 program against its recordings ---------- */

section("The 1978 module against the original (PC-BASIC recordings)");
{
  type Fixture = {
    strong: { typed: string; computer: string[]; margins: number[]; crashLine: number | null }[];
    random: { order: string; you: string; computer: number[][]; start: number[]; end: number[] }[];
  };
  const fixture: Fixture = JSON.parse(readFileSync("tests/fixtures/long-memory-1978.json", "utf8"));
  let moves = 0;
  for (const [i, run] of fixture.strong.entries()) {
    const machine = new Original1978("skip");
    const typed = [...run.typed].map(Number);
    let next = 0;
    const printed: string[] = [];
    const margins: number[] = [];
    let crashLine: number | null = null;
    try {
      for (;;) {
        const result = machine.playGame(() => typed[next++] - 1);
        // The computer prints its two moves of one turn joined by a comma.
        for (const t of result.turns) {
          if (t.who !== "computer") continue;
          if (t.extra) printed[printed.length - 1] += `,${spokenPit(t.pit)}`;
          else printed.push(spokenPit(t.pit));
        }
        margins.push(result.you - result.computer);
      }
    } catch (error) {
      if (!(error instanceof OriginalCrash)) throw error;
      crashLine = error.line;
    }
    moves += printed.length;
    check(same(printed, run.computer), `strong run ${i + 1}: every move the original printed`);
    check(same(margins, run.margins), `strong run ${i + 1}: every result`);
    check(crashLine === run.crashLine && machine.n === 51, `strong run ${i + 1}: stops at line ${run.crashLine} after its 51st lesson`);
  }
  const machine = new Original1978("skip");
  let exact = true;
  for (const game of fixture.random) {
    machine.newGame();
    exact &&= machine.n === game.start[0] && machine.globals.q === game.start[1];
    let you = 0;
    let mine = 0;
    for (const step of game.order) {
      if (step === "h") machine.playYours(Number(game.you[you++]) - 1);
      else {
        const [pit, best, q] = game.computer[mine++];
        const { decision } = machine.playMine();
        exact &&= decision.pit === pit && decision.best === best && machine.globals.q === q;
        moves++;
      }
    }
    const before = machine.n;
    const result = machine.finish();
    exact &&= result.you === game.end[0] && result.computer === game.end[1] && before === game.end[2];
  }
  check(exact, "random run: every choice, every best score and the leftover Q, game after game");
  console.log(`  ${moves} computer moves replayed`);
}

/* ---------- The game's Learner is the 1978 program ---------- */

type Strategy = (p: Position) => number;
const position1978 = (board: readonly number[], m: Original1978): Position => ({ board: [...board], toMove: "south", extraUsed: m.turns.at(-1)?.who === "you" && !m.turns.at(-1)?.extra, plies: m.c, over: false });
const lookahead = (depth: number): Strategy => (p) => new Searcher(RULES.awari1978, 200_000).search(p, depth).pit;
const randomPlayer = (rng: Rng): Strategy => (p) => rng.pick(RULES.awari1978.legal(p));

section("The Learner in the game makes the 1978 program's choices");
{
  // Ten games against a fixed player, through the game's own path: rules module, game record, lessons.
  const r = RULES.awari1978;
  let mind = freshMind();
  const original = new Original1978("run-once");
  let agree = true;
  let firstAvoided: number | null = null;
  const thirdMoves: number[] = [];
  for (let g = 0; g < 12; g++) {
    let p = r.start();
    let game = newGameRecord();
    const fromOriginal = original.playGame((b, m) => lookahead(2)(position1978(b, m)));
    let turn = 0;
    while (!p.over) {
      let pit: number;
      if (p.toMove === "south") pit = lookahead(2)(p);
      else {
        const { choice, mind: next } = learnerMove(p.board, game, mind);
        mind = next;
        pit = choice.pit;
        if (choice.avoided && firstAvoided === null) firstAvoided = g + 1;
      }
      agree &&= fromOriginal.turns[turn++]?.pit === pit;
      if (game.moves === 2) thirdMoves.push(pit);
      game = recordSowing(game, pit);
      p = r.play(p, pit).next;
    }
    mind = learnFrom(mind, game, p.board[6], p.board[13], "2026-10-09");
  }
  check(agree, "same moves as the 1978 module, game after game, lessons included");
  check(firstAvoided === 2, `it turns away from its first lesson in the very next game (game ${firstAvoided})`);
  check(same(thirdMoves.slice(0, 9), [12, 11, 10, 9, 8, 8, 8, 8, 12]), `it tries a new reply game after game, then comes back to the one it lost with first (${thirdMoves.join(" ")})`);
  check(mind.lessons.length === 10 && mind.lessons.every((l) => l.opening.length === 8), "ten lessons, eight moves each");
}

/* ---------- The Scholar ---------- */

function match(rules: RuleId, south: (p: Position, rng: Rng) => number, north: (p: Position, rng: Rng) => number, games: number, label: string) {
  const r = RULES[rules];
  let southWins = 0;
  let northWins = 0;
  let legal = true;
  for (let g = 0; g < games; g++) {
    const rng = createRng(`${label}/${g}`);
    let p = r.start(undefined, g % 2 === 0 ? "south" : "north");
    const seen = new Map<string, number>();
    while (!p.over && p.plies < 400) {
      const pit = p.toMove === "south" ? south(p, rng) : north(p, rng);
      legal &&= r.legal(p).includes(pit);
      p = r.play(p, pit).next;
      const key = `${p.board.join(",")}${p.toMove}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if ((seen.get(key) ?? 0) >= 3) break;
    }
    if (p.board[6] > p.board[13]) southWins++;
    else if (p.board[13] > p.board[6]) northWins++;
  }
  return { southWins, northWins, legal };
}

section("The Scholar");
{
  let currentRules: RuleId = "kalah";
  const at = (level: Difficulty) => (p: Position, rng: Rng) => scholarMove(RULES[currentRules], p, level, rng);
  // Hard thinks for about half a second a move, so the long match only runs with --full.
  const games = FULL ? 40 : 12;
  for (const rules of ["awari1978", "kalah", "oware"] as RuleId[]) {
    currentRules = rules;
    const easyNormal = match(rules, at("normal"), at("easy"), games, `${rules}/n-e`);
    check(easyNormal.legal, `${rules}: only legal moves`);
    check(easyNormal.southWins > easyNormal.northWins, `${rules}: Normal beats Easy (${easyNormal.southWins}–${easyNormal.northWins})`);
    let line = `  ${rules}: Normal vs Easy ${easyNormal.southWins}–${easyNormal.northWins}`;
    if (FULL) {
      const normalHard = match(rules, at("hard"), at("normal"), 10, `${rules}/h-n`);
      check(normalHard.legal && normalHard.southWins > normalHard.northWins, `${rules}: Hard beats Normal (${normalHard.southWins}–${normalHard.northWins})`);
      line += `, Hard vs Normal ${normalHard.southWins}–${normalHard.northWins}`;
    }
    console.log(line);
  }
}

/* ---------- The Daily Endgame ---------- */

section("Daily Endgame");
{
  const days = FULL ? 365 : 45;
  let slowest = 0;
  let valid = true;
  const kinds = { win: 0, margin: 0 };
  for (let d = 0; d < days; d++) {
    const key = shiftDateKey(DAILY_EPOCH, d);
    const [y, m, dd] = key.split("-").map(Number);
    const date = dailyDate(new Date(y, m - 1, dd), DAILY_EPOCH);
    const t = Date.now();
    const puzzle = dailyPuzzleFor(date);
    slowest = Math.max(slowest, Date.now() - t);
    kinds[puzzle.goal.kind]++;
    // A fresh solver confirms the goal and the answers.
    const solver = new Solver(RULES[puzzle.rules]);
    const r = RULES[puzzle.rules];
    const legal = r.legal(puzzle.position);
    if (puzzle.goal.kind === "win") {
      const goal = puzzle.goal.moves;
      valid &&= solver.fastestWin(puzzle.position) === goal;
      valid &&= same(
        legal.filter((pit) => 1 + solver.fastestWin(r.play(puzzle.position, pit).next) <= goal),
        puzzle.answers,
      );
    } else {
      const goal = puzzle.goal.seeds;
      valid &&= solver.bestMargin(puzzle.position) === goal && goal > 0;
      valid &&= same(solver.marginsOf(puzzle.position).filter((x) => x.margin >= goal).map((x) => x.pit), puzzle.answers);
    }
    valid &&= puzzle.answers.length > 0 && puzzle.answers.length * 2 <= legal.length;
    valid &&= solver.marginsOf(puzzle.position).some((x) => x.margin <= 0);
    valid &&= puzzle.number === d + 1;
    const share = dailyShare(puzzle, { solved: true, moves: 3, tries: 1 });
    valid &&= share.startsWith(`Same Trick Twice · Daily Endgame #${d + 1}`);
  }
  check(valid, `${days} days: every puzzle solvable as stated, not by every move, and losable`);
  check(kinds.win > 0 && kinds.margin > 0, "both kinds of goal appear");
  check(slowest < 6000, `the slowest day is built in ${slowest} ms`);
  console.log(`  ${days} days, ${kinds.win} "win in N" and ${kinds.margin} "win by K", slowest ${slowest} ms`);
}

/* ---------- How the Learner learns ---------- */

section("The 1978 Learner, measured");
{
  const seriesAgainst = (strategy: (b: readonly number[], m: Original1978) => number, games: number, clearQ = false) => {
    const m = new Original1978("run-once", clearQ);
    const results: string[] = [];
    for (let g = 0; g < games; g++) {
      try {
        const r = m.playGame(strategy);
        results.push(r.computer > r.you ? "W" : r.computer === r.you ? "D" : "L");
      } catch {
        results.push("X");
        break;
      }
    }
    return results.join("");
  };
  const fixed = (depth: number) => (b: readonly number[], m: Original1978) => lookahead(depth)(position1978(b, m));
  const vsTwo = seriesAgainst(fixed(2), 30);
  check(vsTwo === "L".repeat(10) + "W".repeat(20), `against a fixed two-move search it loses ten in a row, then never again (${vsTwo})`);
  const vsTwoCleared = seriesAgainst(fixed(4), 60, true);
  check(vsTwoCleared.endsWith("X") && !vsTwoCleared.includes("W"), `with Q cleared as intended, a fixed four-move search beats or draws it until the table runs out (${vsTwoCleared})`);

  const runs = FULL ? 40 : 12;
  let wins = 0;
  let games = 0;
  for (let run = 0; run < runs; run++) {
    const rng = createRng(`random-${run}`);
    const series = seriesAgainst((b, m) => randomPlayer(rng)(position1978(b, m)), 100);
    wins += [...series].filter((r) => r === "W").length;
    games += series.length;
  }
  const rate = wins / games;
  check(rate > 0.93 && rate < 0.99, `against random moves it wins ${pct(rate)} (93–99%)`);
  console.log(`  random players: the Learner wins ${pct(rate)} of ${games} games`);
}

console.log(failures ? `\n${failures} checks failed, ${passes} passed` : `\nall ${passes} Same Trick Twice checks passed`);
process.exitCode = failures ? 1 : 0;
