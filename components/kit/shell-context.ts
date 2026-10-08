"use client";

import { createContext, useContext, useLayoutEffect } from "react";

/*
 * How a game talks to its GameShell. A game in its menu says nothing; while
 * a round is on screen it calls `usePlayScreen` every render with what the
 * shell needs to pause it, show the pause menu and leave it safely.
 */

export type PauseItem = {
  label: string;
  onSelect: () => void;
  /** The game's own key for it, shown as a hint ("R"). */
  shortcut?: string;
};

export type PlayScreen = {
  screen: "play" | "results";
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  /** The game's own pause-menu items; they sit between Resume and How to play. */
  items?: PauseItem[];
  /** True while leaving would throw away a round in progress: the shell asks first. */
  losesProgress?: boolean;
  /** What would be lost, for the question: "this flight", "this game". */
  roundName?: string;
  /** Go back to the game menu. */
  onMenu: () => void;
};

export type ShellApi = {
  /** Which tab is showing; the game stays mounted (and should stay quiet) behind the Story. */
  tab: "play" | "story";
  report(screen: PlayScreen | null): void;
  /** Back to the Hall, asking first if a round would be lost. */
  toHall(): void;
  /** To the game menu, asking first if a round would be lost. */
  toMenu(): void;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
  const api = useContext(ShellContext);
  if (!api) throw new Error("useShell needs a GameShell around it");
  return api;
}

/** Tells the shell what is on screen. Pass null (or stop calling it) when the game is back in its menu. */
export function usePlayScreen(screen: PlayScreen | null) {
  const api = useContext(ShellContext);
  useLayoutEffect(() => {
    api?.report(screen);
  });
  useLayoutEffect(() => () => api?.report(null), [api]);
}
