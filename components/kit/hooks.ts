"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, getPrefs, prefersReducedMotion, subscribeMotion, subscribePrefs } from "@/lib/kit/appearance";
import { keyringStore } from "@/lib/kit/keyring";
import type { Store } from "@/lib/kit/save";

export function usePrefs() {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
}

/** Honours the Keyring's motion override as well as the operating system. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => prefersReducedMotion(), () => false);
}

/** A kit store's current data; the server and the first render see the defaults. */
export function useStore<T>(store: Pick<Store<T>, "subscribe" | "get" | "defaults">): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.defaults);
}

export function useKeyring() {
  return useStore(keyringStore);
}

const noSubscribe = () => () => {};

/** False while rendering on the server and hydrating, true after: for anything that depends on the browser (dates, storage). */
export function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus: while `open`, focus moves into `ref` (its `[data-autofocus]`
 * element, or the first focusable one), Tab stays inside, and on close focus
 * returns to where it was.
 */
export function useModalFocus(ref: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const before = document.activeElement as HTMLElement | null;
    const first = root.querySelector<HTMLElement>("[data-autofocus]") ?? root.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        items[0].focus();
      }
    }
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [ref, open]);
}

/** Arrow keys move focus between the buttons of a vertical menu. */
export function onMenuArrows(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])")];
  const at = items.indexOf(document.activeElement as HTMLElement);
  event.preventDefault();
  items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
}
