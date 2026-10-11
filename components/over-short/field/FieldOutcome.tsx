"use client";

import { Results } from "@/components/kit/Results";
import { ShareButton } from "@/components/kit/ShareButton";
import { dailyShare, type DailyBarrage } from "@/lib/over-short/daily";
import type { FieldEngagement } from "@/lib/over-short/field";
import { FIELD_MISSIONS, fieldMedalFor, fieldMissionById } from "@/lib/over-short/fieldMissions";
import { overShortManifest } from "@/lib/over-short/manifest";
import { MedalIcon } from "../icons";
import ui from "../ui.module.css";
import play from "../play/FiringScreen.module.css";
import styles from "./Field.module.css";

/*
 * How a Field Artillery shoot ended, on the collection's results card: the
 * medal for the rounds and the time it took, or why it was lost; for the
 * Daily Barrage, the day's result in the marks players share.
 */

export type FieldSession = { kind: "mission"; mission: string; seed: string; difficulty: "easy" | "normal" | "hard" } | { kind: "daily"; daily: DailyBarrage };

type Props = {
  session: FieldSession;
  engagement: FieldEngagement;
  unlocked: string[];
  onAgain: () => void;
  onMenu: () => void;
  onNextMission?: (id: string) => void;
};

const WHY_LOST: Record<string, string> = {
  "gun-lost": "The enemy found the gun first",
  "out-of-ammo": "Out of rounds",
  "out-of-time": "The column got across",
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)} min ${String(Math.round(seconds % 60)).padStart(2, "0")} s`;

export function FieldOutcome({ session, engagement: e, unlocked, onAgain, onMenu, onNextMission }: Props) {
  const won = e.outcome === "won";
  const caps = { gameId: overShortManifest.id, ids: unlocked };
  const spec = session.kind === "mission" ? fieldMissionById(session.mission)! : session.daily.spec;
  const medal = won ? fieldMedalFor(spec, e.shots.length, e.time) : null;
  const rounds = `${e.shots.length} ${e.shots.length === 1 ? "round" : "rounds"}`;
  const why = e.outcome === "out-of-time" && e.targets[0].kind !== "bridge" ? "Out of time" : WHY_LOST[e.outcome ?? "out-of-ammo"];
  const verdict = won
    ? `${rounds} in ${clock(e.time)} of battle: ${medal} medal. Gold takes ${spec.medals.gold.rounds} ${spec.medals.gold.rounds === 1 ? "round" : "rounds"} within ${clock(spec.medals.gold.seconds)}.`
    : `${rounds} fired. Register the gun on the first round, then trust the observer: add or drop what they say, and move left or right by the mils it comes to.`;

  if (session.kind === "daily") {
    const share = dailyShare(session.daily, e, typeof window === "undefined" ? "" : `${window.location.origin}${overShortManifest.route}`);
    return (
      <Results
        title={won ? "Target down" : why}
        tone={won ? "win" : "loss"}
        kicker={`Daily Barrage #${session.daily.number}`}
        art={medal ? <MedalIcon medal={medal} size={56} /> : undefined}
        playAgainLabel="Shoot it again"
        onPlayAgain={onAgain}
        onMenu={onMenu}
        unlocked={caps}
      >
        <p className={play.verdict}>{verdict}</p>
        <pre className={styles.share} aria-label="Your result to share">
          {share.split("\n").slice(0, 2).join("\n")}
        </pre>
        <ShareButton text={share} label="Share result" className={ui.secondary} />
      </Results>
    );
  }

  const index = FIELD_MISSIONS.findIndex((m) => m.id === spec.id);
  const next = FIELD_MISSIONS[index + 1];
  return (
    <Results
      title={won ? `${spec.title}: mission won` : why}
      tone={won ? "win" : "loss"}
      kicker={`Field Artillery · ${spec.id} · ${session.difficulty}`}
      art={medal ? <MedalIcon medal={medal} size={56} /> : undefined}
      playAgainLabel={won ? "Play it again" : "Try again"}
      onPlayAgain={onAgain}
      onMenu={onMenu}
      unlocked={caps}
      extras={won && next && onNextMission ? [{ label: `Next: ${next.title}`, onSelect: () => onNextMission(next.id), primary: true }] : []}
    >
      <p className={play.verdict}>{verdict}</p>
    </Results>
  );
}
