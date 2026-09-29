"use client";

import Link from "next/link";
import { HALL_STYLES, type HallStyle } from "@/lib/prefs";
import { setPrefs, usePrefs } from "@/lib/use-prefs";
import { ThemeButton } from "@/components/ui/ThemeButton";
import styles from "./TopBar.module.css";

const HALL_LABELS: Record<HallStyle, string> = { wall: "Wall", orbit: "Orbit", device: "Device" };

export function TopBar() {
  const prefs = usePrefs();

  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.logo} aria-label="Any Key, home">
        <span className={styles.any}>any</span>
        <span className={styles.cap}>
          <span>key</span>
        </span>
      </Link>

      <div className={styles.switch} role="group" aria-label="Hall style">
        <span className={styles.thumb} aria-hidden />
        {HALL_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            data-option={style}
            aria-pressed={prefs.hall === style}
            onClick={() => setPrefs({ hall: style })}
          >
            <HallIcon style={style} />
            <span>{HALL_LABELS[style]}</span>
          </button>
        ))}
      </div>

      <div className={styles.tools}>
        <button
          type="button"
          className={styles.tool}
          aria-pressed={prefs.sound}
          aria-label={prefs.sound ? "Key sounds on" : "Key sounds off"}
          title={prefs.sound ? "Key sounds on" : "Key sounds off"}
          onClick={() => setPrefs({ sound: !prefs.sound })}
        >
          <svg viewBox="0 0 24 24" aria-hidden className={styles.soundIcon}>
            <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
            <path className={styles.waves} d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
            <path className={styles.mute} d="M16 9.5l5 5M21 9.5l-5 5" />
          </svg>
        </button>
        <ThemeButton />
      </div>
    </header>
  );
}

function HallIcon({ style }: { style: HallStyle }) {
  if (style === "wall") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden>
        <rect x="2" y="2" width="9" height="9" rx="2.5" />
        <rect x="13" y="2" width="5" height="5" rx="1.8" />
        <rect x="13" y="9" width="5" height="9" rx="1.8" />
        <rect x="2" y="13" width="9" height="5" rx="1.8" />
      </svg>
    );
  }
  if (style === "orbit") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="4.5" />
        <ellipse cx="10" cy="10" rx="8.5" ry="3.2" transform="rotate(-18 10 10)" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <rect x="2" y="4" width="16" height="12" rx="3" fill="none" />
      <rect x="4.5" y="6.5" width="6.5" height="7" rx="1.2" />
      <circle cx="14.5" cy="10" r="1.8" />
    </svg>
  );
}
