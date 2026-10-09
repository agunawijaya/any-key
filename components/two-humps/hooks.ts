"use client";

import { useSyncExternalStore } from "react";

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readDark = () => document.documentElement.dataset.theme === "dark";

/** True while the collection wears its dark appearance, live as the player switches it. */
export function useDarkAppearance() {
  return useSyncExternalStore(subscribeTheme, readDark, () => false);
}

/** The appearance picks the hour a trek sets off: light at dawn, dark at dusk. */
export const startClockFor = (dark: boolean) => (dark ? 18 : 6);
