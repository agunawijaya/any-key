"use client";

import { useSyncExternalStore } from "react";

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readDark = () => document.documentElement.dataset.theme === "dark";

/** True while the collection wears its dark appearance (the pit by moonlight), live as the player switches it. */
export function useDarkAppearance() {
  return useSyncExternalStore(subscribeTheme, readDark, () => false);
}
