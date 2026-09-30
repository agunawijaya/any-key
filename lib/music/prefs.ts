"use client";

import { useSyncExternalStore } from "react";
import type { SongVersion } from "./score";

/** What Bop Box remembers between visits, in this browser only. */

export type BopPrefs = { version: SongVersion };

const KEY = "anykey.bopbox.v1";
const DEFAULTS: BopPrefs = { version: "short" };

let current = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function snapshot() {
  if (!loaded) {
    loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      // No storage (a private window): the defaults last for this visit.
    }
  }
  return current;
}

export function setBopPrefs(change: Partial<BopPrefs>) {
  current = { ...snapshot(), ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // As above: remembered for this visit only.
  }
  listeners.forEach((l) => l());
}

export function useBopPrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => DEFAULTS,
  );
}
