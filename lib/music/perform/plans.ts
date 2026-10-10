import { barIndexAt } from "../tempo";
import type { Performance } from "./cues";

/*
 * Bar-by-bar plans for performers whose moves follow the shape of the music
 * rather than single notes: a DJ who cues in the intro and throws a hand up
 * at the drop, a dancer who drops to the floor when the tune comes in and
 * freezes on the last hit of a phrase. Plans read the arrangement's bars,
 * passes and drum density, so they land where the music changes.
 */

export type BarInfo = {
  index: number;
  at: number;
  len: number;
  section: "intro" | "main" | "outro";
  /** First bar of the tune proper: where a DJ set "drops". */
  drop: boolean;
  /** Last bar before the drop. */
  build: boolean;
  /** A drum fill or a roll: busier than the bars round it. */
  fill: boolean;
  /** Bar number within its phrase of four. */
  inPhrase: number;
  /** Last bar of a phrase of four. */
  phraseEnd: boolean;
};

/** Every bar, with what kind of moment it is. */
export function barMap(perf: Performance): BarInfo[] {
  const { grid } = perf.arrangement;
  const drums = perf.tracks.filter((c) => c.track.patch.drums);
  const counts = grid.map(() => 0);
  for (const cues of drums) for (const hit of cues.lane.hits) counts[barIndexAt(grid, hit.at)]++;
  const sorted = [...counts].filter((c) => c > 0).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const firstMain = grid.findIndex((bar) => perf.section(bar.at + 0.01) === "main");
  return grid.map((bar, index) => {
    const section = perf.section(bar.at + 0.01);
    const fromDrop = firstMain < 0 ? index : index - firstMain;
    const inPhrase = ((fromDrop % 4) + 4) % 4;
    return {
      index,
      at: bar.at,
      len: bar.len,
      section,
      drop: index === firstMain,
      build: index === firstMain - 1,
      fill: typical > 0 && counts[index] > typical * 1.25,
      inPhrase,
      phraseEnd: inPhrase === 3,
    };
  });
}

export type DjMove = "cue" | "jog" | "faders" | "knobs" | "raise" | "pump" | "filter" | "fadeOut";

/**
 * A DJ's set, one move per bar: cueing the next record in the intro, both
 * hands on the filter for the build, a hand in the air on the drop, then
 * faders, EQ and fist pumps through the tune, the filter on every fill and
 * the fader coming down at the end.
 */
export function djPlan(bars: BarInfo[]): DjMove[] {
  const cycle: DjMove[] = ["faders", "pump", "jog", "knobs", "pump", "faders", "jog", "pump"];
  return bars.map((bar, i) => {
    if (bar.section === "intro") return bar.build ? "filter" : "cue";
    if (bar.section === "outro") return "fadeOut";
    if (bar.drop) return "raise";
    if (bar.fill) return "filter";
    return cycle[(i + Math.floor(i / 8)) % cycle.length];
  });
}

export type DanceMove = "toprock" | "drop" | "sixstep" | "freeze" | "kick";

export type DanceStep = { from: number; to: number; move: DanceMove };

/**
 * A breaker's routine, keyed to the bars: toprock while the beat builds, a
 * drop on the last beat before the tune comes in and a freeze on its first
 * downbeat, footwork through each phrase, and another freeze on the clap of
 * the phrase's last bar, held to the bar line. Each new phrase opens back on
 * the feet; a fill gets kick-outs instead of footwork.
 */
export function dancePlan(bars: BarInfo[], clapBeat = 2): DanceStep[] {
  const steps: DanceStep[] = [];
  const push = (from: number, to: number, move: DanceMove) => {
    const last = steps[steps.length - 1];
    if (last && last.move === move && Math.abs(last.to - from) < 1e-6) last.to = to;
    else if (to > from + 1e-6) steps.push({ from, to, move });
  };
  let down = false;
  for (const bar of bars) {
    const end = bar.at + bar.len;
    const floorWork: DanceMove = bar.fill ? "kick" : "sixstep";
    if (bar.section !== "main") {
      if (bar.build) {
        push(bar.at, end - 1, "toprock");
        push(end - 1, end, "drop");
        down = true;
      } else {
        push(bar.at, end, "toprock");
        down = false;
      }
    } else if (bar.drop) {
      push(bar.at, bar.at + Math.min(2, bar.len), "freeze");
      push(bar.at + Math.min(2, bar.len), end, floorWork);
      down = true;
    } else if (bar.inPhrase === 0) {
      push(bar.at, end, "toprock");
      down = false;
    } else if (!down) {
      push(bar.at, bar.at + 1, "drop");
      push(bar.at + 1, end, floorWork);
      down = true;
    } else if (bar.phraseEnd) {
      const freezeAt = bar.at + Math.min(clapBeat, bar.len - 1);
      push(bar.at, freezeAt, floorWork);
      push(freezeAt, end, "freeze");
    } else {
      push(bar.at, end, floorWork);
    }
  }
  return steps;
}
