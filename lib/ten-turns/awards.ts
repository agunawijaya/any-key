/*
 * What a finished game changes in the player's progress: the records, the
 * medals, the Daily, the counters, and the keycaps they earn. Pure: the
 * play screens build a summary and hand it to `recordGame`.
 */

import { PITS } from "./pits";
import { bestOf, type Progress, withAchievement } from "./progress";
import type { Medals } from "./tactics";

export type GameSummary = {
  mode: "classic" | "tactics" | "daily";
  pitId?: string;
  outcome: "squish" | "crunch" | "released";
  rabbits: number;
  medals: Medals;
  hat: boolean;
  /** The most pounces any rabbit made in one turn. */
  longestChain: number;
  carrotsEaten: number;
  tunnels: number;
  stoneBonks: number;
  toolsUsed: number;
  /** Turns lasted (10 or 15 on a survival). */
  turns: number;
  daily?: { key: string; number: number; share: string };
};

const survived = (s: GameSummary) => s.outcome !== "crunch";

export function recordGame(p: Progress, s: GameSummary): Progress {
  let next: Progress = {
    ...p,
    counters: {
      carrotsEaten: p.counters.carrotsEaten + s.carrotsEaten,
      tunnels: p.counters.tunnels + s.tunnels,
      longestChain: Math.max(p.counters.longestChain, s.longestChain),
      stoneBonks: p.counters.stoneBonks + s.stoneBonks,
      dailySurvived: p.counters.dailySurvived + (s.mode === "daily" && survived(s) && !p.daily[s.daily!.key]?.survived ? 1 : 0),
    },
  };

  if (s.mode === "classic") {
    const c = p.classic;
    const won = survived(s);
    const streak = won ? c.streak + 1 : 0;
    next.classic = {
      played: c.played + 1,
      released: c.released + (s.outcome === "released" ? 1 : 0),
      squished: c.squished + (s.outcome === "squish" ? 1 : 0),
      crunched: c.crunched + (s.outcome === "crunch" ? 1 : 0),
      streak,
      bestStreak: Math.max(c.bestStreak, streak),
    };
  }
  if (s.mode === "tactics" && s.pitId) {
    const before = p.pits[s.pitId] ?? { played: 0, survived: 0, best: { survived: false, toolsToSpare: false, untouched: false } };
    next.pits = { ...p.pits, [s.pitId]: { played: before.played + 1, survived: before.survived + (survived(s) ? 1 : 0), best: bestOf(before.best, s.medals) } };
  }
  if (s.mode === "daily" && s.daily) {
    const before = p.daily[s.daily.key];
    // The first result of the day is the one that counts for the share; later tries are practice.
    next.daily = {
      ...p.daily,
      [s.daily.key]: before
        ? { ...before, tries: before.tries + 1, survived: before.survived || survived(s) }
        : { number: s.daily.number, survived: survived(s), tries: 1, untouched: s.hat && survived(s), toolsUsed: s.toolsUsed, turns: s.turns, share: s.daily.share },
    };
  }

  const earn = (id: string, yes: boolean) => {
    if (yes) next = withAchievement(next, id);
  };
  earn("ten-turns", s.outcome === "released");
  earn("squish", s.outcome === "squish");
  earn("untouched", s.mode !== "classic" && survived(s) && s.hat);
  earn("bonk", next.counters.stoneBonks > 0);
  earn("burrow-hopper", next.counters.tunnels > 0);
  earn("carrot-diplomat", next.counters.carrotsEaten >= 3);
  earn("pounce-counter", next.counters.longestChain >= 4);
  earn("double-trouble", survived(s) && s.rabbits >= 2);
  earn("daily-survivor", next.counters.dailySurvived >= 7);
  earn("the-big-one", s.pitId === "the-big-one" && survived(s));
  earn("full-marks", chapterFullMarks(next));
  return next;
}

/** Every pit of some chapter with all three medals. */
function chapterFullMarks(p: Progress) {
  const chapters = new Set(PITS.map((pit) => pit.chapter));
  for (const chapter of chapters) {
    const pits = PITS.filter((pit) => pit.chapter === chapter);
    if (pits.every((pit) => {
      const best = p.pits[pit.id]?.best;
      return best?.survived && best.toolsToSpare && best.untouched;
    })) return true;
  }
  return false;
}

/** The 1970s terminal's keycaps and record: a game there ended. */
export function recordTerminal(p: Progress, outcome: "squish" | "crunch" | "ran-into" | "released", flags: { frozenTurns: number; releasedUnderRabbit: boolean }): Progress {
  let next: Progress = {
    ...p,
    terminal: {
      games: p.terminal.games + 1,
      released: p.terminal.released + (outcome === "released" ? 1 : 0),
      squished: p.terminal.squished + (outcome === "squish" ? 1 : 0),
      crunched: p.terminal.crunched + (outcome === "crunch" || outcome === "ran-into" ? 1 : 0),
    },
  };
  // Middle Row: out alive after standing over a frozen rabbit for three turns, which the middle-row slip makes possible.
  if (outcome === "released" && flags.frozenTurns >= 3) next = withAchievement(next, "middle-row");
  if (outcome === "released" && flags.releasedUnderRabbit) next = withAchievement(next, "turn-ten-miracle");
  if (outcome === "squish") next = withAchievement(next, "squish");
  return next;
}
