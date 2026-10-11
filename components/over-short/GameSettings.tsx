"use client";

import { ForgetButton } from "@/components/kit/ForgetButton";
import { resetProgress, updateSettings, type Progress, type Settings } from "@/lib/over-short/progress";
import { ERAS } from "./eras";
import ui from "./ui.module.css";
import styles from "./GameSettings.module.css";

/*
 * The game's own settings. Sound, light and dark, and motion belong to the
 * collection: they are in the Settings sheet of the pause menu.
 */

type Choice<T extends string | number | boolean> = { value: T; label: string };

function Segmented<T extends string | number | boolean>({ name, legend, hint, value, choices, onChange }: { name: string; legend: string; hint?: string; value: T; choices: Choice<T>[]; onChange: (v: T) => void }) {
  return (
    <fieldset className={styles.setting}>
      <legend className={styles.legend}>{legend}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.options}>
        {choices.map((c) => (
          <label key={String(c.value)} className={styles.option} data-checked={c.value === value}>
            <input type="radio" name={name} checked={c.value === value} onChange={() => onChange(c.value)} />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function GameSettings({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const s = progress.settings;
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  return (
    <section className={`${ui.panel} ${styles.settings}`} aria-labelledby="os-settings-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <div>
        <p className={ui.kicker}>Over / Short</p>
        <h2 id="os-settings-title" className={ui.heading}>
          Game settings
        </h2>
      </div>
      <div className={styles.columns}>
        <Segmented
          name="difficulty"
          legend="Difficulty (Field Artillery and the duel)"
          hint="The wind and its gusts, how sharp the observer's eye is, how far out the map is, how fast the enemy finds you. The Daily Barrage is always Normal."
          value={s.difficulty}
          choices={[
            { value: "easy", label: "Easy" },
            { value: "normal", label: "Normal" },
            { value: "hard", label: "Hard" },
          ]}
          onChange={(difficulty) => set({ difficulty })}
        />
        <Segmented
          name="era"
          legend="Era"
          hint={ERAS.find((e) => e.id === s.era)?.blurb ?? ERAS[0].blurb}
          value={s.era}
          choices={ERAS.map((e) => ({ value: e.id, label: e.name }))}
          onChange={(era) => set({ era })}
        />
        <Segmented
          name="units"
          legend="Distances in"
          value={s.units}
          choices={[
            { value: "m", label: "Metres" },
            { value: "yd", label: "Yards" },
          ]}
          onChange={(units) => set({ units })}
        />
        <Segmented
          name="precision"
          legend="Finest elevation step"
          hint="What Shift with the arrow keys moves, and what you can type."
          value={s.precision}
          choices={[
            { value: 0.1, label: "Tenths of a degree" },
            { value: 0.01, label: "Hundredths" },
          ]}
          onChange={(precision) => set({ precision })}
        />
        <Segmented
          name="camera"
          legend="Flight camera"
          hint="With less motion turned on, the camera always stays on the gun."
          value={s.camera}
          choices={[
            { value: "follow", label: "Rides with the shell" },
            { value: "fixed", label: "Stays on the gun" },
          ]}
          onChange={(camera) => set({ camera })}
        />
        <Segmented
          name="hint"
          legend="Textbook hint (Campaign)"
          hint="A dashed arc to where the 1973 formula says your elevation lands. Right in the Drill, wrong almost everywhere after. A mission played with it earns silver at most."
          value={s.hint}
          choices={[
            { value: false, label: "Off" },
            { value: true, label: "On" },
          ]}
          onChange={(hint) => set({ hint })}
        />
      </div>
      <p className={styles.hint}>Sound, light and dark, and motion are in the Settings of the pause menu, for every game in the collection.</p>
      <div className={ui.row}>
        <ForgetButton className={ui.quiet} gameTitle="Over / Short" keeps="Your settings go too." onForget={resetProgress} />
      </div>
    </section>
  );
}
