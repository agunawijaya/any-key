import { describe, expect, it } from "vitest";
import { Choreographer, NORMAL_TEMPO } from "@/components/long-memory/scene/choreography";
import { makeSeed, settleInto, type Seed } from "@/components/long-memory/scene/seeds";
import { dailyDate } from "@/lib/kit/daily";
import { createRng } from "@/lib/kit/rng";
import { afterMatch, storyOf } from "@/lib/long-memory/awards";
import { pitsOf } from "@/lib/long-memory/board";
import { DAILY_EPOCH, dailyPuzzleFor } from "@/lib/long-memory/daily";
import { freshMind, learnerMove, learnFrom, newGameRecord, recordSowing, type Lesson } from "@/lib/long-memory/learner";
import { legalPits, play, resultOf, startMatch, type Match, type MatchConfig } from "@/lib/long-memory/match";
import { DEFAULT_SETTINGS, type Progress } from "@/lib/long-memory/progress";
import { RULE_ORDER, RULES } from "@/lib/long-memory/rules";
import { dailyShare } from "@/lib/long-memory/share";
import { answer } from "@/lib/long-memory/thinking";

/*
 * Same Trick Twice's engine in small, fast cases. The long runs (the 1978
 * program against PC-BASIC, the Scholar's strength, a year of dailies) are in
 * scripts/check-long-memory.ts.
 */

const fresh: Progress = {
  settings: DEFAULT_SETTINGS,
  mind: freshMind(),
  records: {},
  beatenWith: {},
  daily: {},
  terminal: { games: 0, crashes: 0 },
  seenRules: [],
  achievements: [],
};

/** A whole 1978 game the Learner lost 14 to 21: you open with pit 3, the hard Scholar plays the rest of your moves. */
const LOST_BY_THE_LEARNER = [2, 12, 5, 8, 1, 10, 3, 9, 2, 11, 1, 12, 10, 0, 7, 3, 8, 2, 9, 3, 10, 4];

function replay(config: MatchConfig, pits: number[]) {
  let match: Match = startMatch(config);
  for (const pit of pits) match = play(match, pit).match;
  return match;
}

const learnerGame = (opponent: MatchConfig["opponent"] = "learner") =>
  replay({ rules: "awari1978", seeds: 3, opponent, level: "normal", first: "south" }, LOST_BY_THE_LEARNER);

describe("Same Trick Twice rules", () => {
  it("1978 Awari: a sowing that ends in your store earns one more move", () => {
    const outcome = RULES.awari1978.play(RULES.awari1978.start(3), 3);
    expect(outcome.path).toEqual([4, 5, 6]);
    expect(outcome.extraTurn).toBe(true);
    expect(outcome.next.toMove).toBe("south");
  });

  it("Kalah: sowing passes over the other player's store", () => {
    const start = RULES.kalah.start(4);
    const position = { ...start, board: [0, 0, 0, 0, 0, 10, 0, 1, 1, 1, 1, 1, 1, 0] };
    expect(RULES.kalah.play(position, 5).path).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1, 2]);
  });

  it("Oware: a lap of twelve or more skips the pit it came from, and no seed goes to a store", () => {
    const start = RULES.oware.start(4);
    const position = { ...start, board: [12, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0] };
    const path = RULES.oware.play(position, 0).path;
    expect(path).toHaveLength(12);
    expect(path).not.toContain(0);
    expect(path).not.toContain(6);
    expect(path).not.toContain(13);
  });

  it.each(RULE_ORDER)("%s: random games keep every seed and always end", (rules) => {
    const seeds = RULES[rules].defaultSeeds;
    const rng = createRng(`rules/${rules}`);
    for (let game = 0; game < 40; game++) {
      let match = startMatch({ rules, seeds, opponent: "friend", level: "normal", first: "south" });
      let plies = 0;
      while (!match.position.over) {
        match = play(match, rng.pick(legalPits(match))).match;
        expect(match.position.board.reduce((sum, n) => sum + n, 0)).toBe(12 * seeds);
        expect(++plies).toBeLessThan(1000);
      }
    }
  });
});

describe("the Learner", () => {
  it("writes down a game it did not win, and only that", () => {
    let game = newGameRecord();
    for (const pit of LOST_BY_THE_LEARNER) game = recordSowing(game, pit);
    const learned = learnFrom(freshMind(), game, 21, 14, "2026-10-04");
    expect(learned.lessons).toEqual([{ code: 833672, opening: LOST_BY_THE_LEARNER.slice(0, 8), learned: "2026-10-04", you: 21, learner: 14 }]);
    expect(learnFrom(freshMind(), game, 14, 21, "2026-10-04").lessons).toEqual([]);
  });

  it("turns away from the reply that lost it that game", () => {
    const lesson: Lesson = { code: 833672, opening: LOST_BY_THE_LEARNER.slice(0, 8), learned: "2026-10-04", you: 21, learner: 14 };
    const match = replay({ rules: "awari1978", seeds: 3, opponent: "learner", level: "normal", first: "south" }, [2]);
    const forgetful = learnerMove(match.position.board, match.game, freshMind()).choice;
    const remembering = learnerMove(match.position.board, match.game, { ...freshMind(), lessons: [lesson] }).choice;
    expect(forgetful.pit).toBe(12);
    expect(remembering.avoided).toEqual({ pit: 12, lessons: [0] });
    expect(remembering.pit).not.toBe(12);
  });
});

describe("keycaps after a game", () => {
  it("beating the Learner teaches it, and the same opening twice is an Encore", () => {
    const match = learnerGame();
    expect(resultOf(match)).toEqual({ you: 21, them: 14, winner: "south" });
    const first = afterMatch(fresh, match, storyOf(match, false), freshMind(), "2026-10-09");
    expect(first.progress.achievements).toEqual(["taught-it", "first-harvest"]);
    expect(first.mind?.lessons).toHaveLength(1);
    const second = afterMatch(first.progress, match, storyOf(match, false), first.mind, "2026-10-09");
    expect(second.progress.achievements).toContain("encore");
    expect(second.progress.records["awari1978/learner"]).toEqual({ played: 2, won: 2, drawn: 0, lost: 0 });
  });

  it("a game against a friend goes into the records but earns nothing", () => {
    const match = learnerGame("friend");
    const after = afterMatch(fresh, match, storyOf(match, false), null, "2026-10-09");
    expect(after.progress.achievements).toEqual([]);
    expect(after.progress.records["awari1978/friend"]).toEqual({ played: 1, won: 1, drawn: 0, lost: 0 });
  });
});

describe("the Daily Endgame", () => {
  it("deals the first day's position, which must never change", () => {
    const puzzle = dailyPuzzleFor(dailyDate(new Date(2026, 9, 9, 12), DAILY_EPOCH));
    expect(puzzle).toEqual({
      rules: "awari1978",
      position: { board: [2, 2, 2, 0, 0, 1, 15, 1, 0, 1, 0, 0, 1, 11], toMove: "south", extraUsed: false, plies: 18, over: false },
      goal: { kind: "win", moves: 3 },
      answers: [1, 2],
      number: 1,
      key: "2026-10-09",
    });
    expect(dailyShare(puzzle, { solved: true, moves: 2, tries: 1 }).split("\n").slice(0, 2)).toEqual([
      "Same Trick Twice · Daily Endgame #1",
      "1978 Awari · win in 3 · solved in 2 moves",
    ]);
  });
});

describe("the hidden help", () => {
  it("in a daily, suggests a first move that solves it", () => {
    const puzzle = dailyPuzzleFor(dailyDate(new Date(2026, 9, 9, 12), DAILY_EPOCH));
    const hint = answer({ kind: "hint", rules: puzzle.rules, position: puzzle.position, goal: puzzle.goal.kind }) as { pit: number };
    expect(puzzle.answers).toContain(hint.pit);
  });

  it.each(RULE_ORDER)("%s: suggests a legal pit for whoever moves", (rules) => {
    let match = startMatch({ rules, seeds: RULES[rules].defaultSeeds, opponent: "friend", level: "normal", first: "south" });
    match = play(match, legalPits(match)[0]).match;
    const hint = answer({ kind: "hint", rules, position: match.position }) as { pit: number };
    expect(legalPits(match)).toContain(hint.pit);
  });
});

describe("the board's seeds", () => {
  it("land every seed of a big Kalah sweep when the move is played at once (reduced motion, or Space)", () => {
    // Player 1 sows their last pit, captures across, and the other side's 29 seeds are swept home.
    const before = replay({ rules: "kalah", seeds: 4, opponent: "friend", level: "normal", first: "south" }, [0, 7, 1, 2, 7, 3, 7, 4, 7]);
    const outcome = play(before, 5).outcome;
    const rng = createRng("sweep");
    const seeds: Seed[] = [];
    before.position.board.forEach((count, hole) => {
      for (let i = 0; i < count; i++) seeds.push(makeSeed(seeds.length, hole, rng));
    });
    settleInto(seeds, "sweep/settle");
    const scene = new Choreographer(seeds);
    const sown = scene.sow(outcome.pit, outcome.path, scene.time, NORMAL_TEMPO);
    scene.at(sown, () => scene.capture(outcome.captures[0].from, outcome.captures[0].to, sown));
    scene.at(sown + 1, () => {
      scene.capture(pitsOf("south"), 6, sown + 1);
      scene.capture(pitsOf("north"), 13, sown + 1);
    });
    scene.finish();
    expect(scene.busy).toBe(false);
    expect(scene.counts).toEqual(outcome.next.board);
  });
});
