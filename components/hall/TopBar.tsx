"use client";

import Link from "next/link";
import { usePrefs } from "@/components/kit/hooks";
import { HALL_STYLES, setPrefs, type HallStyle } from "@/lib/kit/appearance";
import { BarTools } from "@/components/kit/BarTools";
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

      <BarTools className={styles.tools} />
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
