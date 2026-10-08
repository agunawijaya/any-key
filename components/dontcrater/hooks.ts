"use client";

import { useSyncExternalStore } from "react";

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The page's dark theme is the night side of every world. */
export function useNight() {
  return useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
}

/** Follows the Settings motion choice as well as the operating system's. */
export { useReducedMotion } from "@/components/kit/hooks";
