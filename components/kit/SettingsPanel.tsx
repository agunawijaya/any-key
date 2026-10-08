"use client";

import { setPrefs, type MotionPref, type ThemePref } from "@/lib/kit/appearance";
import { usePrefs } from "./hooks";
import styles from "./SettingsPanel.module.css";

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const MOTION: { id: MotionPref; label: string; hint: string }[] = [
  { id: "system", label: "Follow my device", hint: "Calm when your system asks for less motion" },
  { id: "reduce", label: "Less motion", hint: "Fades instead of drops, swings and shakes" },
  { id: "full", label: "Full motion", hint: "Every swing and bounce, whatever the system says" },
];

/** Sound, volume, appearance and motion: the same controls in the pause menu and on the Keyring page. */
export function SettingsPanel() {
  const prefs = usePrefs();
  return (
    <div className={styles.panel}>
      <fieldset className={styles.group}>
        <legend>Sound</legend>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={prefs.sound} onChange={(e) => setPrefs({ sound: e.target.checked })} />
          <span className={styles.switch} aria-hidden />
          <span>{prefs.sound ? "Sound on" : "Sound off"}</span>
        </label>
        <label className={styles.slider}>
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(prefs.volume * 100)}
            disabled={!prefs.sound}
            onChange={(e) => setPrefs({ volume: Number(e.target.value) / 100 })}
            aria-valuetext={`${Math.round(prefs.volume * 100)}%`}
          />
          <output>{Math.round(prefs.volume * 100)}%</output>
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Appearance</legend>
        <div className={styles.segments}>
          {THEMES.map((t) => (
            <label key={t.id}>
              <input type="radio" name="kit-theme" checked={prefs.theme === t.id} onChange={() => setPrefs({ theme: t.id })} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Motion</legend>
        <div className={styles.options}>
          {MOTION.map((m) => (
            <label key={m.id} className={styles.option}>
              <input type="radio" name="kit-motion" checked={prefs.motion === m.id} onChange={() => setPrefs({ motion: m.id })} />
              <span>
                <strong>{m.label}</strong>
                <small>{m.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
