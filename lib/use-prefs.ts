"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, HALL_STYLES, PREF_KEYS, type HallStyle, type Prefs } from "./prefs";

let current: Prefs = DEFAULT_PREFS;
let loaded = false;
const listeners = new Set<() => void>();

function readStored(): Prefs {
  try {
    const theme = localStorage.getItem(PREF_KEYS.theme);
    const hall = localStorage.getItem(PREF_KEYS.hall);
    return {
      theme: theme === "light" || theme === "dark" ? theme : "system",
      hall: HALL_STYLES.includes(hall as HallStyle) ? (hall as HallStyle) : DEFAULT_PREFS.hall,
      sound: localStorage.getItem(PREF_KEYS.sound) !== "off",
    };
  } catch {
    return DEFAULT_PREFS;
  }
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
  const dark =
    prefs.theme === "dark" ||
    (prefs.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePref = prefs.theme;
  root.dataset.hall = prefs.hall;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...getSnapshot(), ...patch };
  try {
    localStorage.setItem(PREF_KEYS.theme, current.theme);
    localStorage.setItem(PREF_KEYS.hall, current.hall);
    localStorage.setItem(PREF_KEYS.sound, current.sound ? "on" : "off");
  } catch {
    // Private windows can refuse storage; the choice still applies for this visit.
  }
  applyPrefs(current);
  listeners.forEach((listener) => listener());
}

export function getPrefs() {
  return getSnapshot();
}

export function usePrefs() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PREFS);
}
