/*
 * Collection-wide preferences: light or dark, the Hall style, sound on or off
 * and its volume, and how much motion to show. They are plain keys (not a
 * versioned save) because the inline <head> script reads theme, hall and
 * motion before the first paint, so no page ever flashes the wrong look.
 *
 * No React here: the root layout (a server component) imports PREFS_SCRIPT.
 * The hooks live in components/kit/hooks.ts.
 */

import { storage } from "./save";

export const HALL_STYLES = ["wall", "orbit", "device"] as const;

export type HallStyle = (typeof HALL_STYLES)[number];
export type ThemePref = "light" | "dark" | "system";
/** "system" follows the operating system's reduced-motion setting; the others override it. */
export type MotionPref = "system" | "reduce" | "full";

export type Prefs = {
  theme: ThemePref;
  hall: HallStyle;
  sound: boolean;
  /** Master volume, 0 to 1. */
  volume: number;
  motion: MotionPref;
};

export const DEFAULT_PREFS: Prefs = { theme: "system", hall: "wall", sound: true, volume: 0.8, motion: "system" };

export const PREF_KEYS = {
  theme: "anykey.theme",
  hall: "anykey.hall",
  sound: "anykey.sound",
  volume: "anykey.volume",
  motion: "anykey.motion",
} as const;

/**
 * Runs in <head> before first paint so the saved theme, hall style and motion
 * setting are on <html> before anything renders.
 */
export const PREFS_SCRIPT = `(function(){var d=document.documentElement,t="system",h=null,m="system";try{t=localStorage.getItem("${PREF_KEYS.theme}")||"system";h=localStorage.getItem("${PREF_KEYS.hall}");m=localStorage.getItem("${PREF_KEYS.motion}")||"system"}catch(e){}var dark=t==="dark"||(t!=="light"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);d.setAttribute("data-theme",dark?"dark":"light");d.setAttribute("data-theme-pref",t);if(m==="reduce"||m==="full")d.setAttribute("data-motion",m);if(${JSON.stringify(HALL_STYLES)}.indexOf(h)>-1)d.setAttribute("data-hall",h)})()`;

let current: Prefs = DEFAULT_PREFS;
let loaded = false;
const listeners = new Set<() => void>();

function readStored(): Prefs {
  const theme = storage.read(PREF_KEYS.theme);
  const hall = storage.read(PREF_KEYS.hall);
  const volume = Number(storage.read(PREF_KEYS.volume));
  const motion = storage.read(PREF_KEYS.motion);
  return {
    theme: theme === "light" || theme === "dark" ? theme : "system",
    hall: HALL_STYLES.includes(hall as HallStyle) ? (hall as HallStyle) : DEFAULT_PREFS.hall,
    sound: storage.read(PREF_KEYS.sound) !== "off",
    volume: storage.read(PREF_KEYS.volume) !== null && Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_PREFS.volume,
    motion: motion === "reduce" || motion === "full" ? motion : "system",
  };
}

function getSnapshot(): Prefs {
  if (!loaded) {
    current = readStored();
    loaded = true;
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePref = prefs.theme;
  root.dataset.hall = prefs.hall;
  if (prefs.motion === "system") delete root.dataset.motion;
  else root.dataset.motion = prefs.motion;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...getSnapshot(), ...patch };
  storage.write(PREF_KEYS.theme, current.theme);
  storage.write(PREF_KEYS.hall, current.hall);
  storage.write(PREF_KEYS.sound, current.sound ? "on" : "off");
  storage.write(PREF_KEYS.volume, String(current.volume));
  storage.write(PREF_KEYS.motion, current.motion);
  applyPrefs(current);
  listeners.forEach((listener) => listener());
}

export function getPrefs() {
  return getSnapshot();
}

export const subscribePrefs = subscribe;

/** True when animations should calm down: the override if set, otherwise the operating system. */
export function prefersReducedMotion(prefs = getPrefs()): boolean {
  if (prefs.motion !== "system") return prefs.motion === "reduce";
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Calls back when either the override or the operating system's setting changes. */
export function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  const stop = subscribe(listener);
  return () => {
    media.removeEventListener("change", listener);
    stop();
  };
}
