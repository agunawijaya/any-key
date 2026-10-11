"use client";

import { useEffect, useState } from "react";
import type { Commander, DuelPlayer } from "@/lib/over-short/duel";
import { updateSettings, type Progress } from "@/lib/over-short/progress";
import ui from "../ui.module.css";
import brief from "../Briefing.module.css";
import levels from "../field/FieldMissions.module.css";
import styles from "./Duel.module.css";

/*
 * Setting up a Counter-Battery Duel: a friend on the same screen, taking
 * turns to lay their gun in secret, or one of the computer's three
 * commanders, each with a way of its own.
 */

const OPPONENTS: { id: "friend" | Commander; title: string; note: string }[] = [
  { id: "friend", title: "A friend, on this screen", note: "Take turns to lay your guns; the screen hides each battery's orders from the other" },
  { id: "cautious", title: "The cautious commander", note: "Trusts only part of each report, and moves the gun as soon as your rounds come close" },
  { id: "aggressive", title: "The aggressive commander", note: "Never moves, loads the biggest charge so its rounds arrive first, and over-corrects" },
  { id: "methodical", title: "The methodical commander", note: "Follows its observer to the letter, and moves only when a round lands right beside it" },
];

type Props = { progress: Progress; onStart: (west: DuelPlayer, east: DuelPlayer) => void; onBack: () => void };

export function DuelSetup({ progress, onStart, onBack }: Props) {
  const [opponent, setOpponent] = useState<"friend" | Commander>("methodical");
  const start = () => onStart("player", opponent === "friend" ? "player" : opponent);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "INPUT") return;
      event.preventDefault();
      start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const d = progress.settings.difficulty;
  return (
    <section className={`${ui.panel} ${brief.brief} ${styles.setup}`} aria-labelledby="os-duel-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <p className={ui.kicker}>Counter-Battery Duel</p>
      <h2 id="os-duel-title" className={ui.heading}>
        Two guns, one ridge
      </h2>
      <p className={ui.lede}>
        Your gun on the west side of a ridge, theirs on the east, neither in sight of the other. Each turn both guns are laid in secret and fire together; the round that lands
        first counts first. Two hits silence a battery. You may move your gun back instead of firing: their round falls on the empty pit.
      </p>
      <div className={styles.opponents} role="radiogroup" aria-label="Your opponent">
        {OPPONENTS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={opponent === o.id} className={styles.opponent} onClick={() => setOpponent(o.id)}>
            <strong>{o.title}</strong>
            <small>{o.note}</small>
          </button>
        ))}
      </div>
      <div className={levels.startRow}>
        <div className={levels.difficulty} role="radiogroup" aria-label="Difficulty">
          {(["easy", "normal", "hard"] as const).map((level) => (
            <button key={level} type="button" role="radio" aria-checked={d === level} className={levels.level} onClick={() => updateSettings({ difficulty: level })}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={ui.primary} onClick={start} data-autofocus>
        <span className={ui.label}>
          To the guns
          <small>Enter</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
