"use client";

import { useLayoutEffect } from "react";
import { applyPrefs, getPrefs } from "@/lib/use-prefs";

/**
 * The inline <head> script sets the theme and hall before first paint. This
 * re-applies them after React's dev-mode remount wipes <html> attributes, and
 * follows the OS theme while the preference is "system".
 */
export function PrefsSync() {
  useLayoutEffect(() => {
    applyPrefs(getPrefs());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getPrefs().theme === "system") applyPrefs(getPrefs());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
