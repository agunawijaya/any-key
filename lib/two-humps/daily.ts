import { dailyDate } from "@/lib/kit/daily";
import type { TrekConfig } from "./engine";
import { twoHumpsManifest } from "./manifest";
import type { PursuerKind } from "./rules";

/*
 * The Daily Crossing: one crossing a day, the same for everyone. The pursuer
 * takes turns (storm, rival, gang), the difficulty is Normal and the trek
 * always sets off at dawn, whatever the player's appearance, so every share
 * text compares like with like.
 */

export const DAILY_PURSUERS: PursuerKind[] = ["haboob", "rival", "gang"];

export type DailyCrossing = { number: number; key: string; config: TrekConfig };

export function dailyFor(date = new Date()): DailyCrossing {
  const { day, key, number } = dailyDate(date, twoHumpsManifest.daily?.epoch);
  const pursuer = DAILY_PURSUERS[((day % 3) + 3) % 3];
  return { number, key, config: { pursuer, difficulty: "normal", seed: `two-humps/daily/${key}`, startClock: 6 } };
}
