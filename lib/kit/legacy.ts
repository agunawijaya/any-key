/*
 * Where the games saved before the kit existed (October 2026). Each game's
 * store reads its key once to migrate; the Keyring reads the achievements and
 * finished dailies out of all of them on its first load. The old keys are
 * left in place for one version so a rollback keeps everyone's progress.
 *
 * Remove this table, and the `legacy` options that point at it, in the first
 * release after the retrofit has shipped.
 */

export const LEGACY_SAVES: Record<string, string> = {
  music: "anykey.bopbox.v1",
  "23mtch": "anykey.stickler.v1",
  escape: "anykey.outta.v1",
  lander: "anykey.dontcrater.v1",
};

export const LEGACY_VERSION = 1;

/** What the Keyring needs from an old save: its badge ids and the dates of finished dailies. */
export function legacyAchievementsAndDailies(raw: unknown): { achievements: string[]; dailies: string[] } {
  if (typeof raw !== "object" || raw === null) return { achievements: [], dailies: [] };
  const { achievements, daily } = raw as { achievements?: unknown; daily?: unknown };
  return {
    achievements: Array.isArray(achievements) ? achievements.filter((id): id is string => typeof id === "string") : [],
    dailies: typeof daily === "object" && daily !== null ? Object.keys(daily).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)) : [],
  };
}
