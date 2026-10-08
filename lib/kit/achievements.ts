/*
 * Unlocking achievements. Games declare theirs in their manifest and call
 * `unlock` when one is earned; the Keyring stores it and the shell's toast
 * hears about it through the `anykey:unlock` window event. Unlocking twice is
 * harmless: the second call changes nothing and announces nothing.
 */

import { keyringStore } from "./keyring";

export const UNLOCK_EVENT = "anykey:unlock";

export type UnlockDetail = { gameId: string; id: string; at: number };

/** Unlocks one or more achievements; returns the ids that were new. */
export function unlock(gameId: string, ids: string | readonly string[]): string[] {
  const wanted = typeof ids === "string" ? [ids] : [...ids];
  const already = keyringStore.get().unlocked[gameId] ?? {};
  const fresh = wanted.filter((id, i) => !already[id] && wanted.indexOf(id) === i);
  if (!fresh.length) return [];

  const at = Date.now();
  keyringStore.set((data) => ({
    ...data,
    unlocked: { ...data.unlocked, [gameId]: { ...(data.unlocked[gameId] ?? {}), ...Object.fromEntries(fresh.map((id) => [id, at])) } },
  }));
  for (const id of fresh) announce({ gameId, id, at });
  return fresh;
}

/* ---------- Announcing ---------- */

let holds = 0;
const waiting: UnlockDetail[] = [];

function announce(detail: UnlockDetail) {
  if (typeof window === "undefined") return;
  if (holds > 0) waiting.push(detail);
  else window.dispatchEvent(new CustomEvent<UnlockDetail>(UNLOCK_EVENT, { detail }));
}

/**
 * Keeps unlock toasts back while a game plays its ending (a landing, a
 * fanfare) and lets them out when the results appear. Call the returned
 * function once; it is safe to call it again.
 */
export function holdAnnouncements(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) waiting.splice(0).forEach(announce);
  };
}

export const unlockedIds = (gameId: string): string[] => Object.keys(keyringStore.get().unlocked[gameId] ?? {});

export const isUnlocked = (gameId: string, id: string) => !!keyringStore.get().unlocked[gameId]?.[id];

export function onUnlock(listener: (detail: UnlockDetail) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<UnlockDetail>).detail);
  window.addEventListener(UNLOCK_EVENT, handler);
  return () => window.removeEventListener(UNLOCK_EVENT, handler);
}
