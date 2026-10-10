"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import type { Engagement, Shot, TableRow } from "./engagement";
import { overShortManifest } from "./manifest";
import { missionById, MISSIONS, type Medal } from "./missions";
import { verdictOf, type PlayStyleId, type Session } from "./playstyles";
import type { Units } from "./words";

/** Everything Over / Short remembers lives in this browser only, in the kit store `anykey.over-short.save`. */

export type Settings = {
  style: PlayStyleId;
  /** Cosmetic only: never changes a shot, a mission or a record. */
  era: string;
  units: Units;
  /** The finest step of the elevation control, in degrees. */
  precision: 0.1 | 0.01;
  /** Whether the camera rides with the shell or stays on the gun. */
  camera: "follow" | "fixed";
  /** The Campaign assist: where the textbook formula says a round will land. */
  hint: boolean;
};

export type MissionRecord = { tries: number; wins: number; best: number | null; medal: Medal | null };

export type Progress = {
  classic: { games: number; complete: number; standard: number; best: number | null; targets: number; firstRoundHits: number };
  campaign: {
    missions: Record<string, MissionRecord>;
    /** The battery gun's range table, from every round it has fired with a distance reported (Chapters 4 and 5). */
    table: TableRow[];
  };
  achievements: string[];
  settings: Settings;
};

const EMPTY: Progress = {
  classic: { games: 0, complete: 0, standard: 0, best: null, targets: 0, firstRoundHits: 0 },
  campaign: { missions: {}, table: [] },
  achievements: [],
  settings: { style: "classic", era: "great-war", units: "m", precision: 0.1, camera: "follow", hint: false },
};

type Saved = Omit<Progress, "achievements">;

export const overShortStore = createStore<Saved>(overShortManifest.id, {
  version: 1,
  defaults: withoutAchievements(EMPTY),
  normalise: (saved) => ({
    ...withoutAchievements(EMPTY),
    ...saved,
    classic: { ...EMPTY.classic, ...saved.classic },
    campaign: { ...EMPTY.campaign, ...saved.campaign },
    settings: { ...EMPTY.settings, ...saved.settings },
  }),
});

const progress = createProgress<Progress>(overShortManifest.id, overShortStore, {
  play: (before, after) => {
    const played = (p: Progress) => p.classic.games + Object.values(p.campaign.missions).reduce((n, m) => n + m.tries, 0);
    const won = (p: Progress) => p.classic.complete + Object.values(p.campaign.missions).reduce((n, m) => n + m.wins, 0);
    return played(after) > played(before) ? { won: won(after) > won(before) } : null;
  },
});

export const getProgress = progress.get;

/** Updates progress; returns the keycaps this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything Over / Short remembers, its keycaps included. */
export const resetProgress = () => forgetGame(overShortManifest.id);

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const updateSettings = (patch: Partial<Settings>) => updateProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

const withAchievement = (p: Progress, id: string): Progress => (p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] });

/* ---------- The battery's range table ---------- */

/** The table's rows run in 5° bands from 5° to 45°; a row is filled once a round has been fired in its band. */
export const TABLE_BANDS = [5, 10, 15, 20, 25, 30, 35, 40] as const;

export const bandFilled = (table: TableRow[], start: number) => table.some((r) => r.elevation >= start && r.elevation < start + 5);

/** Rounds from an air-model engagement on level, calm ground, as rows for the battery's table. */
function tableRows(e: Engagement): TableRow[] {
  if (e.rules.model !== "air" || e.rules.wind !== 0 || e.rules.reports !== "distance") return [];
  return e.shots
    .filter((s) => e.targets[s.target].height === 0)
    .map((s) => ({ elevation: Math.round(s.elevation * 100) / 100, range: Math.round(s.flight.landed / 10) * 10, time: Math.round(s.flight.time * 10) / 10 }));
}

/** Keeps the newest row for each elevation, at most 40, in elevation order. */
function mergeTable(table: TableRow[], rows: TableRow[]): TableRow[] {
  const byElevation = new Map(table.map((r) => [r.elevation, r]));
  for (const r of rows) byElevation.set(r.elevation, r);
  return [...byElevation.values()].sort((a, b) => a.elevation - b.elevation).slice(-40);
}

/* ---------- After a game ---------- */

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };
const better = (a: Medal | null, b: Medal | null) => (!a ? b : !b ? a : MEDAL_RANK[a] >= MEDAL_RANK[b] ? a : b);

/** With the textbook hint on, the best a mission can earn is silver. */
export const assistedMedal = (medal: Medal | null, assisted: boolean): Medal | null => (assisted && medal === "gold" ? "silver" : medal);

/** What a finished engagement records, keycaps included. */
export function afterEngagement(p: Progress, session: Session, e: Engagement, assisted: boolean): Progress {
  const verdict = verdictOf(session, e);
  let next = p;
  if (session.style === "classic") {
    const c = p.classic;
    const perTarget = e.targets.map((_, i) => e.shots.filter((s) => s.target === i)).filter((shots) => shots.some((s) => s.destroyed));
    const firsts = perTarget.filter((shots) => shots.length === 1).length;
    next = {
      ...next,
      classic: {
        games: c.games + 1,
        complete: c.complete + (verdict.won ? 1 : 0),
        standard: c.standard + (verdict.standard ? 1 : 0),
        best: verdict.won ? Math.min(c.best ?? Infinity, verdict.rounds) : c.best,
        targets: c.targets + perTarget.length,
        firstRoundHits: c.firstRoundHits + firsts,
      },
    };
    if (firsts > 0) next = withAchievement(next, "one-round");
    if (verdict.standard) next = withAchievement(next, "under-eighteen");
    if (verdict.won && verdict.rounds === e.targets.length) next = withAchievement(next, "five-for-five");
  } else {
    const old = p.campaign.missions[session.mission] ?? { tries: 0, wins: 0, best: null, medal: null };
    const medal = assistedMedal(verdict.medal, assisted);
    const record: MissionRecord = {
      tries: old.tries + 1,
      wins: old.wins + (verdict.won ? 1 : 0),
      best: verdict.won ? Math.min(old.best ?? Infinity, verdict.rounds) : old.best,
      medal: better(old.medal, medal),
    };
    const missions = { ...p.campaign.missions, [session.mission]: record };
    next = { ...next, campaign: { missions, table: mergeTable(p.campaign.table, tableRows(e)) } };
    for (const id of campaignKeycaps(session.mission, e, verdict.won)) next = withAchievement(next, id);
    if (TABLE_BANDS.every((b) => bandFilled(next.campaign.table, b))) next = withAchievement(next, "table-maker");
    if (MISSIONS.every((m) => (missions[m.id]?.wins ?? 0) > 0)) next = withAchievement(next, "campaign-done");
    if (MISSIONS.every((m) => missions[m.id]?.medal === "gold")) next = withAchievement(next, "fort-sill");
  }
  if (e.targets.some((_, i) => bracketedThenHit(e.shots.filter((s) => s.target === i)))) next = withAchievement(next, "first-bracket");
  return next;
}

/** One over and one short at a target, then a hit on it. */
function bracketedThenHit(shots: Shot[]) {
  const hit = shots.findIndex((s) => s.hit);
  if (hit < 0) return false;
  const before = shots.slice(0, hit);
  return before.some((s) => s.report.call === "over") && before.some((s) => s.report.call === "short");
}

function campaignKeycaps(missionId: string, e: Engagement, won: boolean): string[] {
  const spec = missionById(missionId);
  if (!spec) return [];
  const ids: string[] = [];
  const hits = e.shots.filter((s) => s.hit);
  if (hits.some((a) => hits.some((b) => a.target === b.target && a.elevation < 45 && b.elevation > 45))) ids.push("two-roads");
  if (won && e.rules.told.maxRange === null && e.shots.length <= 3) ids.push("range-finder");
  if (won && e.rules.wind <= -10) ids.push("into-the-wind");
  if (e.targets.some((t, i) => t.speed !== 0 && e.shots.filter((s) => s.target === i).slice(0, 2).some((s) => s.hit))) ids.push("moving-target");
  if (won && e.rules.counterfire) ids.push("counter-battery");
  return ids;
}
