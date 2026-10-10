/*
 * Builds a day's Daily Pit off the main thread: the ground is solved to be
 * sure it is fair, which takes a second or two.
 */

import { dailyPitFor } from "./daily";

self.addEventListener("message", (event: MessageEvent<{ day: number }>) => {
  const { day } = event.data;
  try {
    self.postMessage({ day, found: dailyPitFor(day) });
  } catch (error) {
    self.postMessage({ day, error: String(error) });
  }
});
