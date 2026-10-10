"use client";

import { ForgetButton } from "@/components/kit/ForgetButton";
import { usePrefs } from "@/components/kit/hooks";
import { setPrefs } from "@/lib/kit/appearance";
import { tenTurnsManifest } from "@/lib/ten-turns/manifest";
import { type Progress, resetProgress, type Settings, updateProgress } from "@/lib/ten-turns/progress";
import { STYLES } from "./styles";
import panel from "./panel.module.css";
import styles from "./GameSettings.module.css";

/*
 * The game's settings. Sound, appearance and motion belong to the whole
 * collection; they are repeated here because a game is where people look.
 */

type Choice<T extends string | boolean> = { value: T; label: string; disabled?: boolean };

function Segmented<T extends string | boolean>({ name, legend, hint, value, choices, onChange }: { name: string; legend: string; hint?: string; value: T; choices: Choice<T>[]; onChange: (v: T) => void }) {
  return (
    <fieldset className={styles.setting}>
      <legend className={styles.legend}>{legend}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.options}>
        {choices.map((c) => (
          <label key={String(c.value)} className={styles.option} data-checked={c.value === value} data-disabled={!!c.disabled}>
            <input type="radio" name={name} checked={c.value === value} disabled={c.disabled} onChange={() => onChange(c.value)} />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function GameSettings({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const s = progress.settings;
  const prefs = usePrefs();
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => updateProgress((p) => ({ ...p, settings: { ...p.settings, [key]: value } }));

  return (
    <section className={`${panel.panel} ${panel.roomy} ${panel.spread} ${styles.settings}`} aria-labelledby="tt-settings">
      <button type="button" className={`${panel.quiet} ${panel.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <h2 id="tt-settings" className={panel.title}>
        Game settings
      </h2>

      <div className={styles.columns}>
        <div>
          <Segmented
            name="play-style"
            legend="Play style"
            value={s.playStyle}
            choices={[
              { value: "classic", label: "Classic" },
              { value: "tactics", label: "Tactics" },
            ]}
            hint="Arena, the real-time escape, is on its way."
            onChange={(v) => set("playStyle", v)}
          />
          <Segmented name="style" legend="Look" value={s.style} choices={STYLES.map((st) => ({ value: st.id, label: st.create ? st.name : `${st.name} (soon)`, disabled: !st.create }))} onChange={(v) => set("style", v)} />
          <Segmented
            name="intent"
            legend="The rabbit's plan (Tactics)"
            hint="Its next pounce, drawn as a dotted arc to a ring where it will land."
            value={s.intent}
            choices={[
              { value: "on", label: "Always" },
              { value: "request", label: "While I hold I" },
              { value: "off", label: "Never" },
            ]}
            onChange={(v) => set("intent", v)}
          />
        </div>
        <div>
          <Segmented
            name="keys"
            legend="Keyboard"
            hint="Which letters make the square you step with."
            value={s.keys}
            choices={[
              { value: "qwerty", label: "QWERTY" },
              { value: "azerty", label: "AZERTY" },
              { value: "qwertz", label: "QWERTZ" },
            ]}
            onChange={(v) => set("keys", v)}
          />
          <Segmented
            name="speed"
            legend="Animation speed"
            value={s.speed}
            choices={[
              { value: "relaxed", label: "Relaxed" },
              { value: "normal", label: "Normal" },
              { value: "brisk", label: "Brisk" },
            ]}
            onChange={(v) => set("speed", v)}
          />
          <Segmented
            name="motion"
            legend="Motion"
            hint="Reduced: no camera moves, slow motion or shaking; quick fades instead."
            value={prefs.motion}
            choices={[
              { value: "system", label: "As my device" },
              { value: "reduce", label: "Reduced" },
              { value: "full", label: "Full" },
            ]}
            onChange={(v) => setPrefs({ motion: v })}
          />
          <Segmented
            name="sound"
            legend="Sound"
            value={prefs.sound}
            choices={[
              { value: true, label: "On" },
              { value: false, label: "Off" },
            ]}
            onChange={(v) => setPrefs({ sound: v })}
          />
        </div>
      </div>

      <div className={styles.forget}>
        <ForgetButton gameTitle={tenTurnsManifest.title} onForget={resetProgress} className={panel.quiet} keeps="Your settings for the collection stay." />
      </div>
    </section>
  );
}
