import type { Arrangement } from "./arrange/types";

/*
 * Arrangements count in beats; a full-length piece can change tempo along
 * the way (a slow introduction before the waltz). These convert between
 * beats and seconds through the arrangement's tempo changes.
 */

type Tempos = Arrangement["tempos"];

/** Seconds from the start to a beat. */
export function secondsAt(tempos: Tempos, beat: number) {
  let seconds = 0;
  for (let i = 0; i < tempos.length; i++) {
    const from = tempos[i].at;
    const to = i + 1 < tempos.length ? tempos[i + 1].at : Infinity;
    if (beat <= from) break;
    seconds += ((Math.min(beat, to) - from) * 60) / tempos[i].bpm;
  }
  return seconds;
}

/** The beat reached after some seconds. */
export function beatAt(tempos: Tempos, seconds: number) {
  let left = seconds;
  for (let i = 0; i < tempos.length; i++) {
    const from = tempos[i].at;
    const to = i + 1 < tempos.length ? tempos[i + 1].at : Infinity;
    const span = ((to - from) * 60) / tempos[i].bpm;
    if (left <= span) return from + (left * tempos[i].bpm) / 60;
    left -= span;
  }
  return tempos[tempos.length - 1]?.at ?? 0;
}

/** The tempo in force at a beat. */
export function bpmAt(tempos: Tempos, beat: number) {
  let bpm = tempos[0]?.bpm ?? 120;
  for (const t of tempos) {
    if (t.at <= beat + 1e-6) bpm = t.bpm;
    else break;
  }
  return bpm;
}

/** Index of the bar a beat falls in. */
export function barIndexAt(grid: Arrangement["grid"], beat: number) {
  let lo = 0;
  let hi = grid.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (grid[mid].at <= beat + 1e-6) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
