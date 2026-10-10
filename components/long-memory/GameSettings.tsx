"use client";

import { useState } from "react";
import { ForgetButton } from "@/components/kit/ForgetButton";
import { MemoryBook } from "./MemoryBook";
import {
  resetProgress,
  updateProgress,
  type Progress,
  type Settings,
} from "@/lib/long-memory/progress";
import { RULE_ORDER, RULES } from "@/lib/long-memory/rules";
import panel from "./panel.module.css";
import styles from "./GameSettings.module.css";

/*
 * The game's own settings. Sound, appearance and motion are the
 * collection's, in the Settings sheet of the pause menu and the top bar.
 */

type Choice<T extends string | number | boolean> = { value: T; label: string };

function Segmented<T extends string | number | boolean>({
  name,
  legend,
  hint,
  value,
  choices,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: string;
  value: T;
  choices: Choice<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className={styles.setting}>
      <legend className={styles.legend}>{legend}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.options}>
        {choices.map((c) => (
          <label
            key={String(c.value)}
            className={styles.option}
            data-checked={c.value === value}
          >
            <input
              type="radio"
              name={name}
              checked={c.value === value}
              onChange={() => onChange(c.value)}
            />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function GameSettings({
  progress,
  onBack,
}: {
  progress: Progress;
  onBack: () => void;
}) {
  const [book, setBook] = useState(false);
  const s = progress.settings;
  const set = (patch: Partial<Settings>) =>
    updateProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const onOff = [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ];
  return (
    <section
      className={`${panel.panel} ${styles.settings}`}
      aria-labelledby="stt-settings"
    >
      <p className={panel.kicker}>Same Trick Twice</p>
      <h2 id="stt-settings" className={panel.heading}>
        Game settings
      </h2>
      <div className={styles.columns}>
        <Segmented
          name="rules"
          legend="Rules to start with"
          value={s.rules}
          choices={RULE_ORDER.map((r) => ({ value: r, label: RULES[r].title }))}
          onChange={(rules) => set({ rules })}
        />
        <Segmented
          name="kalah"
          legend="Seeds a pit in Kalah"
          value={s.kalahSeeds}
          choices={RULES.kalah.seedChoices.map((n) => ({
            value: n,
            label: String(n),
          }))}
          onChange={(kalahSeeds) => set({ kalahSeeds })}
        />
        <Segmented
          name="preview"
          legend="Show where a pit's seeds will go"
          hint="When you point at a pit, or pick it with the arrow keys."
          value={s.preview}
          choices={onOff}
          onChange={(preview) => set({ preview })}
        />
        <Segmented
          name="counts"
          legend="Numbers by the pits"
          hint="Off, you count the seeds yourself; a pit still shows its number while you point at it."
          value={s.counts}
          choices={onOff}
          onChange={(counts) => set({ counts })}
        />
        <Segmented
          name="speed"
          legend="Sowing speed"
          value={s.speed}
          choices={[
            { value: "relaxed", label: "Relaxed" },
            { value: "normal", label: "Normal" },
            { value: "brisk", label: "Brisk" },
          ]}
          onChange={(speed) => set({ speed })}
        />
        <Segmented
          name="memory"
          legend="The Learner's memory"
          hint={
            s.memory === "keep"
              ? "Its book stays from visit to visit."
              : "As in 1978: it learns while you play and forgets everything when you leave."
          }
          value={s.memory}
          choices={[
            { value: "keep", label: "Keeps its book" },
            { value: "1978", label: "As in 1978" },
          ]}
          onChange={(memory) => set({ memory })}
        />
      </div>
      <div className={panel.row}>
        <button
          type="button"
          className={panel.secondary}
          onClick={() => setBook(true)}
        >
          Open the Memory Book
        </button>
        <ForgetButton
          className={panel.quiet}
          gameTitle="Same Trick Twice"
          keeps="The Learner's book goes too."
          onForget={resetProgress}
        />
      </div>
      <p className={styles.hint}>
        Sound, light and dark, and motion are in the Settings of the pause menu,
        for every game in the collection.
      </p>
      <div className={panel.row}>
        <button type="button" className={panel.primary} onClick={onBack}>
          Back to the game menu
        </button>
      </div>
      {book && (
        <MemoryBook progress={progress} onClose={() => setBook(false)} />
      )}
    </section>
  );
}
