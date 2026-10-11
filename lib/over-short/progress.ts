"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import type { DuelEngagement, DuelSide, Commander } from "./duel";
import type { Engagement, Shot, TableRow } from "./engagement";
import type { Difficulty, FieldEngagement } from "./field";
import { fieldMedalFor, fieldMissionById, type FieldMedal } from "./fieldMissions";
import { overShortManifest } from "./manifest";
import { missionById, MISSIONS, type Medal } from "./missions";
import { verdictOf, type PlayStyleId, type Session } from "./playstyles";
import type { Program } from "./terminal";
import type { Units } from "./words";
import { heightAt as terrainHeight } from "./terrain";

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
  /** Field Artillery and the duel: the wind, the observer's eye, the enemy's speed. */
  difficulty: Difficulty;
};

export type MissionRecord = { tries: number; wins: number; best: number | null; medal: Medal | null };

export type FieldRecord = { tries: number; wins: number; best: { rounds: number; seconds: number } | null; medal: FieldMedal | null };

export type DailyRecord = { number: number; won: boolean; rounds: number; marks: string };

export type TerminalRecord = { wars: number; finished: number; best: number | null };

export type Progress = {
  classic: { games: number; complete: number; standard: number; best: number | null; targets: number; firstRoundHits: number };
  campaign: {
    missions: Record<string, MissionRecord>;
    /** The battery gun's range table, from every round it has fired with a distance reported (Chapters 4 and 5). */
    table: TableRow[];
  };
  /** Field Artillery's missions, kept per difficulty: "F3/normal". */
  field: { missions: Record<string, FieldRecord> };
  duel: { played: number; won: number; drawn: number; hotSeat: number; beat: Record<Commander, number> };
  /** Daily Barrages played to an end, by local date. */
  daily: Record<string, DailyRecord>;
  terminals: Record<Program, TerminalRecord>;
  achievements: string[];
  settings: Settings;
};

const EMPTY: Progress = {
  classic: { games: 0, complete: 0, standard: 0, best: null, targets: 0, firstRoundHits: 0 },
  campaign: { missions: {}, table: [] },
  field: { missions: {} },
  duel: { played: 0, won: 0, drawn: 0, hotSeat: 0, beat: { cautious: 0, aggressive: 0, methodical: 0 } },
  daily: {},
  terminals: { gunner: { wars: 0, finished: 0, best: null }, cannoneer: { wars: 0, finished: 0, best: null } },
  achievements: [],
  settings: { style: "classic", era: "great-war", units: "m", precision: 0.1, camera: "follow", hint: false, difficulty: "normal" },
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
    field: { ...EMPTY.field, ...saved.field },
    duel: { ...EMPTY.duel, ...saved.duel, beat: { ...EMPTY.duel.beat, ...saved.duel?.beat } },
    daily: saved.daily ?? {},
    terminals: { gunner: { ...EMPTY.terminals.gunner, ...saved.terminals?.gunner }, cannoneer: { ...EMPTY.terminals.cannoneer, ...saved.terminals?.cannoneer } },
    settings: { ...EMPTY.settings, ...saved.settings },
  }),
});

const sum = <T>(records: Record<string, T>, count: (r: T) => number) => Object.values(records).reduce((n, r) => n + count(r), 0);

const progress = createProgress<Progress>(overShortManifest.id, overShortStore, {
  play: (before, after) => {
    const played = (p: Progress) =>
      p.classic.games + sum(p.campaign.missions, (m) => m.tries) + sum(p.field.missions, (m) => m.tries) + p.duel.played + Object.keys(p.daily).length + p.terminals.gunner.wars + p.terminals.cannoneer.wars;
    const won = (p: Progress) =>
      p.classic.complete + sum(p.campaign.missions, (m) => m.wins) + sum(p.field.missions, (m) => m.wins) + p.duel.won + sum(p.daily, (d) => (d.won ? 1 : 0)) + p.terminals.gunner.finished + p.terminals.cannoneer.finished;
    return played(after) > played(before) ? { won: won(after) > won(before) } : null;
  },
  dailies: (p) => p.daily,
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

/* ---------- Field Artillery, the duel, the Daily and the terminals ---------- */

const FIELD_MEDAL_RANK: Record<FieldMedal, number> = { bronze: 1, silver: 2, gold: 3 };
const betterField = (a: FieldMedal | null, b: FieldMedal | null) => (!a ? b : !b ? a : FIELD_MEDAL_RANK[a] >= FIELD_MEDAL_RANK[b] ? a : b);

/** The keycaps any finished Field Artillery engagement can earn, mission or Daily. */
function fieldKeycaps(next: Progress, e: FieldEngagement): Progress {
  const won = e.outcome === "won";
  const target = e.targets[0];
  let p = next;
  // A crest between gun and target, and a hit on it with one of the two smallest charges.
  if (won && e.shots.some((s) => s.hit && s.aim.charge <= 2) && hasCrest(e)) p = withAchievement(p, "charge-two");
  // A hit on the round after the observer called the line off by fifty or more.
  if (e.shots.some((s, i) => s.hit && i > 0 && e.shots[i - 1].report.kind === "correction" && (() => { const r = e.shots[i - 1].report; return r.kind === "correction" && (r.line?.metres ?? 0) >= 50; })())) p = withAchievement(p, "left-fifty");
  if (won && target.kind === "bridge" && e.rules.deadline !== null) p = withAchievement(p, "bridge-down");
  if (won && e.rules.smoke.length > 0 && e.shots.some((s) => s.report.kind === "lost")) p = withAchievement(p, "smoke-and-mirrors");
  if (won && e.enemyRounds.some((r) => r.emptyPit)) p = withAchievement(p, "moving-day");
  return p;
}

/** Whether the ground rises above the line from the gun to the target anywhere between. */
function hasCrest(e: FieldEngagement) {
  const t = e.targets[0];
  const ground = (x: number) => heightAtTerrain(e, x);
  const from = ground(0);
  const to = ground(t.x);
  for (let x = 200; x < t.x - 60; x += 25) if (ground(x) - (from + ((to - from) * x) / t.x) > 30) return true;
  return false;
}

const heightAtTerrain = (e: FieldEngagement, x: number) => terrainHeight(e.rules.terrain, x);

/** What a finished Field Artillery mission records. */
export function afterField(p: Progress, mission: string, difficulty: Difficulty, e: FieldEngagement): Progress {
  const spec = fieldMissionById(mission);
  if (!spec) return p;
  const key = `${mission}/${difficulty}`;
  const old = p.field.missions[key] ?? { tries: 0, wins: 0, best: null, medal: null };
  const won = e.outcome === "won";
  const medal = won ? fieldMedalFor(spec, e.shots.length, e.time) : null;
  const faster = won && (!old.best || e.shots.length < old.best.rounds || (e.shots.length === old.best.rounds && e.time < old.best.seconds));
  const record: FieldRecord = {
    tries: old.tries + 1,
    wins: old.wins + (won ? 1 : 0),
    best: faster ? { rounds: e.shots.length, seconds: Math.round(e.time) } : old.best,
    medal: betterField(old.medal, medal),
  };
  return fieldKeycaps({ ...p, field: { missions: { ...p.field.missions, [key]: record } } }, e);
}

/** What a finished Daily Barrage records: its first finish on the day stands. */
export function afterDaily(p: Progress, key: string, number: number, e: FieldEngagement, marks: string): Progress {
  if (p.daily[key]) return fieldKeycaps(p, e);
  const daily = { ...p.daily, [key]: { number, won: e.outcome === "won", rounds: e.shots.length, marks } };
  let next = fieldKeycaps({ ...p, daily }, e);
  if (Object.values(daily).filter((d) => d.won).length >= 7) next = withAchievement(next, "daily-gunner");
  return next;
}

/** What a finished duel records, for the human side or sides. */
export function afterDuel(p: Progress, e: DuelEngagement): Progress {
  const humans = (["west", "east"] as const).filter((side) => e[side].player === "player");
  const hotSeat = humans.length === 2;
  const human: DuelSide | undefined = humans[0];
  const computer = !hotSeat && human ? e[human === "west" ? "east" : "west"].player : null;
  const won = !hotSeat && human !== undefined && e.winner === human;
  const beat = { ...p.duel.beat };
  if (won && computer && computer !== "player") beat[computer] += 1;
  let next: Progress = {
    ...p,
    duel: {
      played: p.duel.played + 1,
      won: p.duel.won + (won ? 1 : 0),
      drawn: p.duel.drawn + (e.winner === "draw" ? 1 : 0),
      hotSeat: p.duel.hotSeat + (hotSeat ? 1 : 0),
      beat,
    },
  };
  if (won) next = withAchievement(next, "duelist");
  return next;
}

/** What a war on a 1970s terminal records: begun, and finished (all five targets down) with its total. */
export function afterTerminal(p: Progress, program: Program, finished: boolean, total: number): Progress {
  const old = p.terminals[program];
  const record: TerminalRecord = { wars: old.wars + 1, finished: old.finished + (finished ? 1 : 0), best: finished ? Math.min(old.best ?? Infinity, total) : old.best };
  let next: Progress = { ...p, terminals: { ...p.terminals, [program]: record } };
  if (next.terminals.gunner.finished > 0 && next.terminals.cannoneer.finished > 0) next = withAchievement(next, "old-terminals");
  return next;
}
