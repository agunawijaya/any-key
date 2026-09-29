"use client";

import { setPrefs } from "@/lib/use-prefs";
import styles from "./ThemeButton.module.css";

/**
 * Flips between light and dark on every click. Picking the same look as the
 * operating system stores "system", so the page keeps following the OS after that.
 * The icon follows <html data-theme>, so it never shows the wrong state.
 */
export function ThemeButton({ className = "" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setPrefs({ theme: (next === "dark") === systemDark ? "system" : next });
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${className}`}
      aria-label="Switch between light and dark"
      title="Light / dark"
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden className={styles.icon} data-icon="light">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden className={styles.icon} data-icon="dark">
        <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" />
      </svg>
    </button>
  );
}
