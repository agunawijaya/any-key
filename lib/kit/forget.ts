/*
 * "Forget my data": per game, and for the whole collection. Preferences
 * (theme, Hall style, sound, motion) are settings, not data, and stay.
 * The legacy keys go too, or the next visit would import them again.
 */

import { forgetGameInKeyring, forgetKeyring } from "./keyring";
import { LEGACY_SAVES } from "./legacy";
import { forgetSave, saveKey, storage } from "./save";
import { forgetStats, statsStore } from "./stats";

export function forgetGame(gameId: string) {
  forgetSave(gameId, LEGACY_SAVES[gameId]);
  forgetGameInKeyring(gameId);
  forgetStats(gameId);
}

export function forgetEverything(gameIds: readonly string[]) {
  for (const id of new Set([...gameIds, ...Object.keys(LEGACY_SAVES)])) forgetSave(id, LEGACY_SAVES[id]);
  // Saves of games this build no longer lists still carry the player's data.
  for (const key of storage.keys()) if (key.endsWith(".save") && key !== saveKey("keyring") && key !== statsStore.key) storage.remove(key);
  statsStore.reset();
  forgetKeyring();
}
