"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

/**
 * A program's Play / Story tabs, kept in the address: `/stickler#story` opens
 * the Story, so the Hall can link straight to it, and Back returns to the tab
 * you came from. The first tab is the default and has no hash.
 */
export function useHashTab<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const tab = (tabs as readonly string[]).includes(hash) ? (hash as T) : tabs[0];
  const setTab = useCallback(
    (next: T) => {
      if (next === tab) return;
      const { pathname, search } = window.location;
      window.history.pushState(null, "", next === tabs[0] ? pathname + search : `${pathname}${search}#${next}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.scrollTo({ top: 0 });
    },
    [tab, tabs],
  );
  return [tab, setTab];
}
