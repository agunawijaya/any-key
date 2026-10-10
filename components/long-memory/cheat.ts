"use client";

import { useEffect, useSyncExternalStore } from "react";

/*
 * The owner's secret: Ctrl+Alt+C, anywhere in the game, marks the pit the
 * computer would sow for whoever's turn it is; the same keys take the mark
 * away. It lasts until the page is left. On purpose it appears nowhere in the
 * docs, the shortcuts sheet or the game's copy.
 */

let on = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the secret help is on. */
export const useCheat = () =>
  useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );

/** Listens for the secret keys while the game is open. */
export function useCheatKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The physical C key, so it works on any keyboard layout.
      if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey || event.code !== "KeyC" || event.repeat) return;
      event.preventDefault();
      on = !on;
      for (const listener of listeners) listener();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
