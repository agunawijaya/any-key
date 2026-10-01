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

function subscribeMotion(listener: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
}
