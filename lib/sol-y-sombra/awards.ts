import type { Corrida } from "./corrida";
import type { OriginalEvent } from "./original";
import type { PlayStyleId } from "./playStyles";
import { emptyRecords, withAchievement, type Progress } from "./progress";

/*
 * What a finished afternoon adds to the records, and the keycaps it earns.
 * Pure: the screens call these inside `updateProgress`.
 */

/** Records and keycaps after a Classic corrida, once the crowd has decided. */
export function afterCorrida(p: Progress, corrida: Corrida, style: PlayStyleId, carriedOn: boolean): Progress {
  const verdict = corrida.decide();
  const passes = corrida.history.filter((h) => h.kind === "pass");
  const before = p.records[style] ?? emptyRecords();
  const tiers = [...before.tiers] as [number, number, number, number];
  tiers[verdict.tier] += 1;
  const endings = { ...before.endings };
  if (corrida.ending) endings[corrida.ending] += 1;
  const records = {
    ...before,
    corridas: before.corridas + 1,
    endings,
    tiers,
    passes: before.passes + passes.length,
    closeCalls: before.closeCalls + passes.filter((h) => h.outcome === "close").length,
    gorings: before.gorings + corrida.gorings,
    bestTotal: Math.max(before.bestTotal, verdict.total),
    mostPasses: Math.max(before.mostPasses, passes.length),
  };
  let next: Progress = { ...p, records: { ...p.records, [style]: records } };
  next = withAchievement(next, "first-paseo");
  if (passes.length >= 7 && corrida.attempts > 0) next = withAchievement(next, "seven-passes");
  if (passes.length >= 5 && passes.every((h) => h.move === "veronica") && corrida.ending === "rested") next = withAchievement(next, "all-veronicas");
  if (passes.some((h) => h.outcome === "close")) next = withAchievement(next, "close-call");
  if (carriedOn) next = withAchievement(next, "back-on-your-feet");
  if (verdict.tier >= 2) next = withAchievement(next, "lap-of-honour");
  if (verdict.tier === 3) next = withAchievement(next, "on-their-shoulders");
  return next;
}

/**
 * The 1970s terminal's tally after an afternoon there. Killing the bull
 * with both crews doing an awful job earns the secret keycap: the program's
 * instructions say good crews help you, its arithmetic says the opposite.
 */
export function afterTerminal(p: Progress, events: OriginalEvent[]): Progress {
  const killed = events.some((e) => e.kind === "killed");
  const awarded = events.some((e) => e.kind === "award" && e.tier > 0);
  const crews = events.filter((e): e is Extract<OriginalEvent, { kind: "crew" }> => e.kind === "crew");
  let next: Progress = {
    ...p,
    terminal: { games: p.terminal.games + 1, kills: p.terminal.kills + (killed ? 1 : 0), awards: p.terminal.awards + (awarded ? 1 : 0) },
  };
  if (killed && crews.length === 2 && crews.every((c) => c.rating === 5)) next = withAchievement(next, "the-inversion");
  return next;
}
