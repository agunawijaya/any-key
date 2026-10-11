"use client";

import { ForgetButton } from "@/components/kit/ForgetButton";
import { usePrefs } from "@/components/kit/hooks";
import { setPrefs, type MotionPref } from "@/lib/kit/appearance";
import { PLAY_STYLE_LIST, PLAY_STYLES } from "@/lib/sol-y-sombra/playStyles";
import { resetProgress, updateProgress, type Progress, type Settings } from "@/lib/sol-y-sombra/progress";
import { TRADITION_LIST, TRADITIONS } from "@/lib/sol-y-sombra/traditions";
import panel from "./panel.module.css";
import styles from "./GameSettings.module.css";

/*
 * The game's own settings: how you play, which tradition, which style, and
 * a few comforts. Light and dark and the master volume are the collection's,
 * in the top bar; motion is the collection's too, shown here for
 * convenience.
 */

type Choice<T extends string | boolean> = { value: T; label: string; disabled?: boolean };

function Segmented<T extends string | boolean>({
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
          <label key={String(c.value)} className={styles.option} data-checked={c.value === value} data-disabled={c.disabled || undefined}>
            <input type="radio" name={name} checked={c.value === value} disabled={c.disabled} onChange={() => onChange(c.value)} />
            {c.label}
            {c.disabled && <small> · soon</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function GameSettings({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const prefs = usePrefs();
  const s = progress.settings;
  const set = (patch: Partial<Settings>) => updateProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const onOff = [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ];
  return (
    <section className={`${panel.panel} ${styles.settings}`} aria-labelledby="sys-settings">
      <p className={panel.kicker}>Sol y Sombra</p>
      <h2 id="sys-settings" className={panel.heading}>
        Game settings
      </h2>
      <div className={styles.columns}>
        <Segmented
          name="play-style"
          legend="Play style"
          hint={PLAY_STYLES[s.playStyle].line}
          value={s.playStyle}
          choices={PLAY_STYLE_LIST.map((id) => ({ value: id, label: PLAY_STYLES[id].name, disabled: !PLAY_STYLES[id].available }))}
          onChange={(playStyle) => set({ playStyle })}
        />
        <Segmented
          name="tradition"
          legend="Tradition"
          hint={TRADITIONS[s.tradition].line}
          value={s.tradition}
          choices={TRADITION_LIST.map((id) => ({ value: id, label: TRADITIONS[id].name, disabled: !TRADITIONS[id].available }))}
          onChange={(tradition) => set({ tradition })}
        />
        <Segmented
          name="style"
          legend="Style"
          hint="Early-1900s posters come alive: flat inks, the sun and the shade across the sand."
          value={s.style}
          choices={[
            { value: "poster", label: "Vintage Poster" },
            { value: "stylized-3d", label: "Stylized 3D", disabled: true },
          ]}
          onChange={(style) => set({ style })}
        />
        <Segmented
          name="slow"
          legend="Slow motion at the closest moment"
          hint="Each pass slows as the horns go by the cape."
          value={s.slowMotion}
          choices={onOff}
          onChange={(slowMotion) => set({ slowMotion })}
        />
        <Segmented
          name="crowd"
          legend="The stands"
          hint="Half-full stands draw faster on a slow machine."
          value={s.crowd}
          choices={[
            { value: "full", label: "Full" },
            { value: "half", label: "Half full" },
          ]}
          onChange={(crowd) => set({ crowd })}
        />
        <Segmented
          name="sound"
          legend="Ring sounds"
          hint="The crowd, the hooves, the cape and the band. The switch in the top bar silences everything."
          value={s.sound}
          choices={onOff}
          onChange={(sound) => set({ sound })}
        />
        <Segmented<MotionPref>
          name="motion"
          legend="Motion"
          hint="Reduced: the crowd keeps still, slow motion is off, and the long walks are cut short. For every game in the collection."
          value={prefs.motion}
          choices={[
            { value: "system", label: "As the system" },
            { value: "reduce", label: "Reduced" },
            { value: "full", label: "Full" },
          ]}
          onChange={(motion) => setPrefs({ motion })}
        />
      </div>
      <div className={panel.row}>
        <button type="button" className={panel.primary} onClick={onBack} data-autofocus>
          Back to the game menu
        </button>
        <ForgetButton className={panel.quiet} gameTitle="Sol y Sombra" keeps="Your records go too." onForget={resetProgress} />
      </div>
    </section>
  );
}
