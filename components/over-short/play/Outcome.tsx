"use client";

import { Results } from "@/components/kit/Results";
import { overShortManifest } from "@/lib/over-short/manifest";
import type { Engagement } from "@/lib/over-short/engagement";
import { chapterOpen, missionById, MISSIONS } from "@/lib/over-short/missions";
import { verdictOf, type Session } from "@/lib/over-short/playstyles";
import { assistedMedal, getProgress } from "@/lib/over-short/progress";
import { distanceLabel, type Units } from "@/lib/over-short/words";
import { MedalIcon } from "../icons";
import styles from "./FiringScreen.module.css";

/*
 * How a game ended, on the collection's results card: Classic's tally
 * against the 18-round standard, or a mission's medal; and why, when the
 * gun lost.
 */

type Props = {
  session: Session;
  engagement: Engagement;
  unlocked: string[];
  assisted: boolean;
  units: Units;
  onAgain: () => void;
  onMenu: () => void;
  onNextMission: (id: string) => void;
};

const WHY_LOST: Record<string, string> = {
  "gun-lost": "The enemy found the gun first",
  "out-of-ammo": "Out of rounds",
  "out-of-time": "Out of time",
};

export function Outcome({ session, engagement: e, unlocked, assisted, units, onAgain, onMenu, onNextMission }: Props) {
  const verdict = verdictOf(session, e);
  const caps = { gameId: overShortManifest.id, ids: unlocked };

  if (session.style === "classic") {
    const rows = e.targets.map((_, i) => e.shots.filter((s) => s.target === i)).filter((shots) => shots.length > 0);
    return (
      <Results
        title={verdict.won ? "All five targets down" : WHY_LOST[e.outcome ?? "gun-lost"]}
        tone={verdict.standard ? "win" : verdict.won ? "neutral" : "loss"}
        kicker="Classic"
        playAgainLabel="New game"
        onPlayAgain={onAgain}
        onMenu={onMenu}
        unlocked={caps}
      >
        <ol className={styles.tally}>
          {rows.map((shots, i) => (
            <li key={i}>
              <span>Target {i + 1}</span>
              <span>{shots.some((s) => s.destroyed) ? `${shots.length} ${shots.length === 1 ? "round" : "rounds"}` : `missed with all ${shots.length}`}</span>
            </li>
          ))}
        </ol>
        <p className={styles.verdict}>
          {verdict.won
            ? verdict.standard
              ? `${verdict.rounds} rounds in all: within the standard of 18. Nicely done.`
              : `${verdict.rounds} rounds in all: over the standard of 18. A refresher course at Fort Sill beckons.`
            : `Five rounds at target ${rows.length} and none within ${distanceLabel(100, units)}. The gun's position was found before it found its mark.`}
        </p>
      </Results>
    );
  }

  const spec = missionById(session.mission)!;
  const medal = assistedMedal(verdict.medal, assisted);
  const index = MISSIONS.findIndex((m) => m.id === spec.id);
  const next = MISSIONS[index + 1];
  const won = (id: string) => (getProgress().campaign.missions[id]?.wins ?? 0) > 0;
  const nextOpen = verdict.won && next && chapterOpen(next.chapter, won);
  return (
    <Results
      title={verdict.won ? `${spec.title}: mission won` : WHY_LOST[e.outcome ?? "out-of-ammo"]}
      tone={verdict.won ? "win" : "loss"}
      kicker={`Mission ${spec.id}`}
      art={medal ? <MedalIcon medal={medal} size={56} /> : undefined}
      playAgainLabel={verdict.won ? "Play it again" : "Try again"}
      onPlayAgain={onAgain}
      onMenu={onMenu}
      unlocked={caps}
      extras={nextOpen ? [{ label: `Next: ${next.title}`, onSelect: () => onNextMission(next.id), primary: true }] : []}
    >
      <p className={styles.verdict}>
        {verdict.won
          ? `${verdict.rounds} ${verdict.rounds === 1 ? "round" : "rounds"} of ${spec.ammo}: ${medal} medal${assisted && verdict.medal === "gold" ? " (silver with the textbook hint on)" : ""}. Gold takes ${spec.medals.gold} or fewer.`
          : `${e.shots.length} ${e.shots.length === 1 ? "round" : "rounds"} fired. Every mission can be won within its rounds: ${
              e.rules.reports === "direction" ? "get one round over and one short, then split the difference." : "bracket the target, and let the distances in the reports size each correction."
            }`}
      </p>
    </Results>
  );
}
